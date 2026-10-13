/**
 * Background service worker logic (MV3).
 *
 * The background owns consent, the API session, the session manager and the
 * evidence queue. Content scripts forward page observations here, and the
 * popup toggles consent and reads status:
 *
 *   content.ts  ──vap:observation──▶  background (session + queue + consent)
 *   popup.ts    ──vap:consent/start/stop/status──▶
 *
 * Chrome APIs never appear here directly: messaging and storage are injected
 * (`RuntimeAdapter`, `AsyncStorageStore`), so this module runs in Node tests.
 */

import {
  ApiClient,
  ConsentGate,
  EvidenceQueue,
  SessionManager,
  createNullAdapter,
  type ConsentProvider,
  type FetchLike,
  type ProofOfAttention,
  type TimerAdapter,
} from '@verified-attention/browser-sdk';
import { MSG, isExtensionMessage } from './messages';
import type { AsyncStorageStore, RuntimeAdapter } from './runtime';
import { createChromeRuntime, createChromeStorageStore, inChromeExtension } from './runtime';

const CONSENT_KEY = 'vap:consent';
const CONFIG_KEY = 'vap:config';

/** Consent provider that reads the toggle written by the popup. */
export class StoreConsentProvider implements ConsentProvider {
  constructor(private readonly store: AsyncStorageStore) {}

  async requestConsent() {
    const value = await this.store.get(CONSENT_KEY);
    return { status: value === 'granted' ? ('GRANTED' as const) : ('PENDING' as const) };
  }
}

export interface ExtensionBackgroundConfig {
  apiUrl: string;
  policyId: string;
  contentId: string;
  sourceId?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  heartbeatMs?: number;
  onError?: (error: unknown) => void;
  onProof?: (proof: ProofOfAttention) => void;
  // ── Test seams ──────────────────────────────────────────────────────
  fetchImpl?: FetchLike;
  timers?: import('@verified-attention/browser-sdk').TimerAdapter;
}

export interface ExtensionBackgroundDeps {
  runtime: RuntimeAdapter;
  store?: AsyncStorageStore;
  config?: ExtensionBackgroundConfig;
}

export interface StatusResponse {
  active: boolean;
  sessionId: string | null;
  queueSize: number;
  consentGranted: boolean;
}

/**
 * Service-worker entry: a message router over session/queue/consent reuse from
 * @verified-attention/browser-sdk. No DOM: the background collects only what
 * content scripts forward.
 */
export class ExtensionBackground {
  private readonly runtime: RuntimeAdapter;
  private readonly store: AsyncStorageStore;
  private config?: ExtensionBackgroundConfig;
  private session?: SessionManager;
  private api?: ApiClient;
  private queue?: EvidenceQueue;
  private apiFromConfig?: ApiClient;
  private stop?: () => void;

  constructor(deps: ExtensionBackgroundDeps) {
    this.runtime = deps.runtime;
    this.store = deps.store ?? {
      get: async () => undefined,
      set: async () => {},
    };
    this.config = deps.config;
  }

  /** Register the message listener. Safe to call once. */
  start(): void {
    if (this.stop) return;
    this.stop = this.runtime.addListener((message) => this.handle(message));
  }

  destroy(): void {
    this.stop?.();
    this.stop = undefined;
  }

  private async ensureConfig(): Promise<ExtensionBackgroundConfig> {
    if (this.config) return this.config;
    const raw = await this.store.get(CONFIG_KEY);
    if (raw) {
      try {
        const value = JSON.parse(raw) as ExtensionBackgroundConfig;
        if (value && typeof value.apiUrl === 'string' && value.apiUrl && value.policyId && value.contentId) {
          this.config = value;
          return value;
        }
      } catch {
        // fall through to error below
      }
    }
    throw new Error(`extension-sdk: missing config — set ${CONFIG_KEY} (JSON: {apiUrl, policyId, contentId})`);
  }

  private ensureTransport(config: ExtensionBackgroundConfig): { api: ApiClient; queue: EvidenceQueue } {
    const api = (this.apiFromConfig ??= new ApiClient(config.apiUrl, config.fetchImpl));
    this.api = api;
    const queue =
      this.queue ??
      (this.queue = new EvidenceQueue({
        batchSize: config.batchSize ?? 10,
        storage: null, // service workers are ephemeral; persistence is the popup's default
        storageKey: 'vap:evidence-queue',
        timers: config.timers,
        onError: config.onError,
        send: (evidence) => api.ingestEvidence(evidence),
      }));
    return { api, queue };
  }

  private async handleStart(): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
    const config = await this.ensureConfig();
    const gate = new ConsentGate(new StoreConsentProvider(this.store));
    const decision = await gate.ensureConsent({
      policyId: config.policyId,
      contentId: config.contentId,
    });
    if (!ConsentGate.isGranted(decision)) {
      return { ok: false, error: `consent not granted (status: ${decision.status})` };
    }
    const { api, queue } = this.ensureTransport(config);
    const manager = new SessionManager({
      api,
      queue,
      adapter: createNullAdapter(), // no DOM in the service worker
      policyId: config.policyId,
      contentId: config.contentId,
      sourceId: config.sourceId ?? 'extension-sdk',
      viewerIdHash: `extension-${config.policyId}`,
      timers: config.timers,
      heartbeatMs: config.heartbeatMs,
      onError: config.onError,
    });
    const sessionId = await manager.start();
    this.session = manager;
    return { ok: true, sessionId };
  }

  private async handleStop(): Promise<{ ok: true; proof?: ProofOfAttention }> {
    const config = this.config;
    const manager = this.session;
    if (!manager || !config) return { ok: true };
    const sessionId = manager.currentSessionId!;
    await manager.end();
    const { api, queue } = this.ensureTransport(config);
    await queue.flush();
    const proof = await api.fetchProof(sessionId);
    if (proof) config.onProof?.(proof);
    this.session = undefined;
    return { ok: true, ...(proof ? { proof } : {}) };
  }

  private async buildStatus(): Promise<StatusResponse> {
    return {
      active: this.session?.isActive ?? false,
      sessionId: this.session?.currentSessionId ?? null,
      queueSize: this.queue?.size ?? 0,
      consentGranted: (await this.store.get(CONSENT_KEY)) === 'granted',
    };
  }

  async handle(message: unknown): Promise<unknown> {
    if (!isExtensionMessage(message)) return { ok: false, error: 'unknown message' };
    switch (message.type) {
      case MSG.START:
        try {
          return await this.handleStart();
        } catch (err) {
          this.config?.onError?.(err);
          return { ok: false, error: String((err as Error)?.message ?? err) };
        }
      case MSG.STOP:
        try {
          return await this.handleStop();
        } catch (err) {
          this.config?.onError?.(err);
          return { ok: false, error: String((err as Error)?.message ?? err) };
        }
      case MSG.STATUS:
        return this.buildStatus();
      case MSG.CONSENT:
        await this.store.set(CONSENT_KEY, message.granted ? 'granted' : 'denied');
        return { ok: true };
      case MSG.OBSERVATION:
        if (this.session?.isActive) {
          this.session.sink.emit(message.signalType, message.payload as never);
        }
        return { ok: true };
    }
  }
}

// ─── Real service-worker boot ──────────────────────────────────────────────
// In Chrome, the boot registers a listener immediately; in Node/tests,
// `chrome` is undefined and the block never runs — boot is opt-in and lazy.

declare const chrome: unknown;

if (inChromeExtension()) {
  const runtime = createChromeRuntime();
  const store = createChromeStorageStore();
  const background = new ExtensionBackground({ runtime, store });
  background.start();
}
