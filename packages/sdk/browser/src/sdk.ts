/**
 * VerifiedAttention — public SDK facade (S16).
 *
 * Composes: consent gate → session manager → observers → evidence queue.
 * Nothing is collected before consent is granted.
 */

import { ApiClient } from './api/client';
import { ConsentGate } from './consent/gate';
import { createDefaultAdapter, type DomAdapter } from './dom';
import { FocusObserver } from './observers/focus';
import { InteractionObserver } from './observers/interaction';
import { VisibilityObserver } from './observers/visibility';
import { EvidenceQueue } from './queue';
import { SessionManager } from './session/manager';
import type { ProofOfAttention, VerifiedAttentionConfig } from './types';
import { defaultTimers } from './types';
import { isoNow, sha256Hex, uuid } from './utils';

export class VerifiedAttention {
  private readonly config: VerifiedAttentionConfig;
  private readonly adapter: DomAdapter;
  private readonly gate: ConsentGate;
  private readonly api: ApiClient;
  private readonly queue: EvidenceQueue;
  private readonly observers: Array<{ start(s: unknown): void; stop(): void }>;
  private readonly viewerIdHashPromise: Promise<string>;
  private session?: SessionManager;
  private starting?: Promise<string>;
  private proofListeners: Array<(proof: ProofOfAttention) => void> = [];

  constructor(config: VerifiedAttentionConfig) {
    if (!config.apiUrl) throw new Error('VerifiedAttention: apiUrl is required');
    if (!config.policyId) throw new Error('VerifiedAttention: policyId is required');
    if (!config.contentId) throw new Error('VerifiedAttention: contentId is required');
    this.config = config;
    this.adapter = config.adapter ?? createDefaultAdapter();
    this.gate = new ConsentGate(config.consentProvider);
    this.api = new ApiClient(config.apiUrl, config.fetchImpl);
    this.queue = new EvidenceQueue({
      batchSize: config.batchSize ?? 10,
      storage:
        config.storage === null
          ? null
          : config.storage ??
            (typeof localStorage !== 'undefined'
              ? (localStorage as unknown as import('./types').StorageAdapter)
              : null),
      timers: config.timers ?? defaultTimers,
      onError: config.onError,
      send: (evidence) => this.api.ingestEvidence(evidence),
    });
    this.observers = [
      new VisibilityObserver(this.adapter, config.contentElement),
      new InteractionObserver(this.adapter),
      new FocusObserver(this.adapter),
    ];
    this.queue.start(config.flushIntervalMs ?? 10_000);
    this.viewerIdHashPromise = this.deriveViewerIdHash();
    if (config.autoStart) void this.startSession().catch((e) => config.onError?.(e));
  }

  /**
   * Request consent (if a provider is configured) and, once granted, create
   * the API session and start collecting observations.
   * Rejects / records an error and collects nothing when consent is denied.
   */
  async startSession(): Promise<string> {
    if (this.session?.isActive) return this.session.currentSessionId!;
    this.starting ??= (async () => {
      const decision = await this.gate.ensureConsent({
        policyId: this.config.policyId,
        contentId: this.config.contentId,
      });
      if (!ConsentGate.isGranted(decision)) {
        const err = new Error(`consent not granted (status: ${decision.status})`);
        this.config.onConsentDenied?.({
          policyId: this.config.policyId,
          contentId: this.config.contentId,
        });
        this.starting = undefined;
        throw err;
      }
      const manager = new SessionManager({
        api: this.api,
        queue: this.queue,
        adapter: this.adapter,
        policyId: this.config.policyId,
        contentId: this.config.contentId,
        sourceId: this.config.sourceId ?? 'browser-sdk',
        viewerIdHash: this.config.viewerIdHash ?? (await this.viewerIdHashPromise),
        ...(decision.consentId ? { consentId: decision.consentId } : {}),
        heartbeatMs: this.config.heartbeatMs,
        timers: this.config.timers ?? defaultTimers,
        onError: this.config.onError,
      });
      const sessionId = await manager.start(decision.consentId);
      this.session = manager;
      this.starting = undefined;
      for (const observer of this.observers) observer.start(manager.sink);
      return sessionId;
    })();
    return this.starting;
  }

  /**
   * Stop observers, flush remaining evidence, close the API session, and
   * invoke onProof listeners if a proof is already retrievable.
   */
  async stopSession(): Promise<ProofOfAttention | undefined> {
    const manager = this.session;
    if (!manager) return undefined;
    for (const observer of this.observers) observer.stop();
    this.session = undefined;
    const sessionId = manager.currentSessionId!;
    await manager.end();
    const proof = await this.api.fetchProof(sessionId);
    if (proof) {
      this.config.onProof?.(proof);
      for (const listener of this.proofListeners) listener(proof);
    }
    return proof;
  }

  onProof(listener: (proof: ProofOfAttention) => void): void {
    this.proofListeners.push(listener);
  }

  getSessionId(): string | null {
    return this.session?.currentSessionId ?? null;
  }

  getIsActive(): boolean {
    return this.session?.isActive ?? false;
  }

  /** Force an immediate queue flush (e.g. on pagehide). */
  async flush(): Promise<void> {
    if (this.session?.isActive) await this.session.flushAggregates();
    await this.queue.flush();
  }

  /** Stop timers; SDK instance should not be reused after destroy(). */
  destroy(): void {
    for (const observer of this.observers) observer.stop();
    this.queue.stopTimer();
    this.session = undefined;
  }

  private async deriveViewerIdHash(): Promise<string> {
    // Pseudonymous, per-install: sha256(userAgent + stored random id).
    const storage =
      this.config.storage === null
        ? undefined
        : this.config.storage ??
          (typeof localStorage !== 'undefined' ? localStorage : undefined);
    let installId: string;
    try {
      installId = storage?.getItem('vap:install-id') ?? uuid();
      storage?.setItem('vap:install-id', installId);
    } catch {
      installId = uuid();
    }
    const hash = await sha256Hex(`${this.adapter.userAgent() ?? 'unknown'}:${installId}`);
    return hash ?? `anonymous-${installId}`;
  }
}

export { isoNow };
