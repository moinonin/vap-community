/**
 * Session lifecycle manager.
 *
 * Owns: the API-created sessionId, heartbeat interval, the live observation
 * stream, and the observation → evidence mapping (VAP Section 5):
 *
 * - CUSTOM/session-start observation → E-CONTEXT evidence (environment)
 * - VIEWPORT_VISIBILITY observations → E-VISIBLE evidence
 * - SCROLL/CLICK/KEY_PRESS observations → E-INTERACTION evidence
 * - session end → E-DURATION evidence
 *
 * Evidence is signed with an ephemeral per-session ECDSA key (WebCrypto)
 * and enqueued for the offline-tolerant queue to deliver.
 */

import type { Observation } from '@verified-attention/core';
import type { ApiClient } from '../api/client';
import type { DomAdapter } from '../dom';
import type { EvidenceQueue } from '../queue';
import type { SignalTypeName, TimerAdapter } from '../types';
import {
  canonicalJson,
  createSessionSigner,
  isoNow,
  sha256Hex,
  uuid,
  type SessionSigner,
} from '../utils';

export interface SessionManagerOptions {
  api: ApiClient;
  queue: EvidenceQueue;
  adapter: DomAdapter;
  policyId: string;
  contentId: string;
  sourceId: string;
  viewerIdHash: string;
  consentId?: string;
  heartbeatMs?: number;
  timers?: TimerAdapter;
  /** How many visibility/interaction observations aggregate into one record. */
  aggregateWindow?: number;
  onError?: (error: unknown) => void;
}

const defaultTimers: TimerAdapter = { setInterval, clearInterval };

export class SessionManager {
  private sessionId?: string;
  private signer?: SessionSigner;
  private heartbeatId?: unknown;
  private startedAtMs = 0;
  private activeMs = 0;
  private lastActiveStamp = 0;
  private heartbeats = 0;
  private observations: Observation[] = [];
  private readonly timers: TimerAdapter;
  private readonly aggregateWindow: number;

  constructor(private readonly opts: SessionManagerOptions) {
    this.timers = opts.timers ?? defaultTimers;
    this.aggregateWindow = opts.aggregateWindow ?? 25;
  }

  get currentSessionId(): string | undefined {
    return this.sessionId;
  }

  get isActive(): boolean {
    return this.sessionId !== undefined;
  }

  async start(consentId?: string): Promise<string> {
    if (this.sessionId) return this.sessionId;
    const { sessionId } = await this.opts.api.createSession({
      contentId: this.opts.contentId,
      participant: {
        viewerIdHash: this.opts.viewerIdHash,
        ...(consentId ? { consentId } : {}),
      },
      metadata: { policyId: this.opts.policyId, sdk: 'browser', sdkVersion: '0.1.0-dev' },
    });
    this.sessionId = sessionId;
    this.signer = await createSessionSigner();
    const t = Date.now();
    this.startedAtMs = t;
    this.lastActiveStamp = t;
    this.activeMs = 0;
    this.heartbeats = 0;
    this.observations = [];
    this.heartbeatId = this.timers.setInterval(
      () => void this.onHeartbeat().catch((e) => this.opts.onError?.(e)),
      this.opts.heartbeatMs ?? 30_000,
    );
    // Environment snapshot captured as an observation → basis for E-CONTEXT.
    this.emit('CUSTOM', {
      kind: 'SESSION_CONTEXT',
      platform: 'browser',
      userAgent: this.opts.adapter.userAgent(),
      language: this.opts.adapter.language(),
      timezone: this.opts.adapter.timezone(),
      viewportSize: this.opts.adapter.viewportSize(),
      devicePixelRatio: this.opts.adapter.devicePixelRatio(),
    });
    return sessionId;
  }

  /** ObservationSink handed to the observers. */
  readonly sink = {
    emit: (signalType: SignalTypeName, payload: Observation['payload']) =>
      this.emit(signalType, payload),
  };

  private emit(signalType: SignalTypeName, payload: Observation['payload']): void {
    if (!this.sessionId) return;
    const t = Date.now();
    this.activeMs += Math.max(0, Math.min(t - this.lastActiveStamp, 60_000));
    this.lastActiveStamp = t;
    const observation = {
      observationId: uuid(),
      sourceId: this.opts.sourceId,
      sessionId: this.sessionId,
      contentId: this.opts.contentId,
      timestamp: isoNow(),
      signalType: signalType as Observation['signalType'],
      payload,
      platform: 'browser' as const,
      viewportSize: this.opts.adapter.viewportSize(),
    };
    this.observations.push(observation);
    if (signalType === 'SCROLL' || signalType === 'CLICK' || signalType === 'KEY_PRESS' || signalType === 'FOCUS') {
      if (this.interactionCount() >= this.aggregateWindow) void this.flushInteraction();
    }
  }

  private interactionCount(): number {
    return this.observations.filter((o) =>
      ['SCROLL', 'CLICK', 'KEY_PRESS', 'FOCUS'].includes(o.signalType as unknown as string),
    ).length;
  }

  private async onHeartbeat(): Promise<void> {
    if (!this.sessionId) return;
    this.heartbeats += 1;
    await this.opts.api.heartbeat(this.sessionId);
    await this.flushAggregates();
    await this.opts.queue.flush();
    this.lastActiveStamp = Date.now();
  }

  /** Aggregate pending observations into evidence and enqueue. */
  async flushAggregates(): Promise<void> {
    if (!this.sessionId || this.observations.length === 0) return;
    const pending = this.observations;
    const byType = (types: string[]) =>
      pending.filter((o) => types.includes(o.signalType as unknown as string));

    const context = byType(['CUSTOM']).filter(
      (o) => (o.payload as { kind?: string })?.kind === 'SESSION_CONTEXT',
    );
    const visibility = byType(['VIEWPORT_VISIBILITY']);
    const interaction = byType(['SCROLL', 'CLICK', 'KEY_PRESS', 'FOCUS']);

    const keep: Observation[] = [];
    if (context.length > 0) {
      await this.enqueueEvidence('E-CONTEXT', buildContextPayload(context), context);
      keep.push(...pending.filter((o) => !context.includes(o)));
    } else keep.push(...pending);

    let rest = keep;
    if (visibility.length > 0) {
      await this.enqueueEvidence('E-VISIBLE', buildVisibilityPayload(visibility), visibility);
      rest = rest.filter((o) => !visibility.includes(o));
    }
    if (interaction.length > 0) {
      await this.enqueueEvidence('E-INTERACTION', buildInteractionPayload(interaction), interaction);
      rest = rest.filter((o) => !interaction.includes(o));
    }
    this.observations = rest;
  }

  private async flushInteraction(): Promise<void> {
    if (!this.sessionId) return;
    const interaction = this.observations.filter((o) =>
      ['SCROLL', 'CLICK', 'KEY_PRESS', 'FOCUS'].includes(o.signalType as unknown as string),
    );
    if (interaction.length === 0) return;
    await this.enqueueEvidence('E-INTERACTION', buildInteractionPayload(interaction), interaction);
    this.observations = this.observations.filter((o) => !interaction.includes(o));
  }

  private async enqueueEvidence(
    evidenceType: 'E-INTERACTION' | 'E-VISIBLE' | 'E-DURATION' | 'E-CONTEXT',
    payload: Record<string, unknown>,
    observations: Observation[],
  ): Promise<void> {
    if (!this.sessionId || observations.length === 0) return;
    const unsigned = {
      evidenceId: `urn:vap:evidence:${uuid()}`,
      sessionId: this.sessionId,
      sourceId: this.opts.sourceId,
      timestamp: isoNow(),
      evidenceType,
      confidence: 0.9,
      payload,
      provenance: {
        observationIds: observations.map((o) => o.observationId),
        observationHash:
          (await sha256Hex(canonicalJson(observations))) ??
          'unavailable-no-webcrypto-0123456789abcdef0123456789abcd',
        sourceId: this.opts.sourceId,
        collectionMethod: 'sdk',
      },
      metadata: {
        policyId: this.opts.policyId,
        ...(this.signer ? { publicKey: this.signer.publicKeyBase64Url } : { unsigned: true }),
      },
    };
    const signature = this.signer
      ? await this.signer.sign(canonicalJson(unsigned))
      : 'UNSIGNED-no-webcrypto';
    this.opts.queue.enqueue({ ...unsigned, signature });
  }

  async end(): Promise<void> {
    if (!this.sessionId) return;
    if (this.heartbeatId !== undefined) {
      this.timers.clearInterval(this.heartbeatId);
      this.heartbeatId = undefined;
    }
    // Final aggregates + duration evidence, then close session.
    await this.flushAggregates();
    const endObs: Observation = {
      observationId: uuid(),
      sourceId: this.opts.sourceId,
      sessionId: this.sessionId,
      contentId: this.opts.contentId,
      timestamp: isoNow(),
      signalType: 'CUSTOM' as Observation['signalType'],
      payload: { kind: 'SESSION_END' },
      platform: 'browser',
    };
    this.activeMs += Math.max(0, Date.now() - this.lastActiveStamp);
    await this.enqueueEvidence(
      'E-DURATION',
      {
        sessionStartTime: this.startedAtMs,
        sessionEndTime: Date.now(),
        activeDurationMs: Math.round(this.activeMs),
        heartbeatCount: this.heartbeats,
      },
      [endObs],
    );
    await this.opts.queue.flush();
    const id = this.sessionId;
    this.sessionId = undefined;
    this.observations = [];
    try {
      await this.opts.api.closeSession(id);
    } catch (err) {
      this.opts.onError?.(err); // close failure must not lose queued evidence
    }
  }
}

// ─── Observation → evidence payload mapping ──────────────────────────────────

function buildContextPayload(observations: Observation[]): Record<string, unknown> {
  const merged: Record<string, unknown> = { platform: 'browser' };
  for (const o of observations) {
    const p = o.payload as Record<string, unknown>;
    for (const [k, v] of Object.entries(p)) {
      if (k !== 'kind' && v !== undefined) merged[k] = v;
    }
  }
  return merged;
}

function buildVisibilityPayload(observations: Observation[]): Record<string, unknown> {
  const ratios = observations.map(
    (o) => (o.payload as { visibilityRatio: number }).visibilityRatio,
  );
  const first = new Date(observations[0]!.timestamp).getTime();
  const last = new Date(observations[observations.length - 1]!.timestamp).getTime();
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return {
    visibleDurationMs: Math.max(0, Math.round((last - first) * avg)),
    maxVisibilityRatio: Math.max(...ratios),
    avgVisibilityRatio: avg,
    viewportIntersections: observations.map((o) => ({
      timestamp: new Date(o.timestamp).getTime(),
      ratio: (o.payload as { visibilityRatio: number }).visibilityRatio,
    })),
  };
}

function buildInteractionPayload(observations: Observation[]): Record<string, unknown> {
  const first = new Date(observations[0]!.timestamp).getTime();
  const last = new Date(observations[observations.length - 1]!.timestamp).getTime();
  const scrolls = observations.filter((o) => o.signalType === 'SCROLL');
  let velocitySum = 0;
  let directionChanges = 0;
  let prevDy = 0;
  for (const s of scrolls) {
    const p = s.payload as { deltaY: number };
    velocitySum += Math.abs(p.deltaY);
    if (prevDy !== 0 && Math.sign(p.deltaY) !== 0 && Math.sign(p.deltaY) !== Math.sign(prevDy)) {
      directionChanges += 1;
    }
    if (p.deltaY !== 0) prevDy = p.deltaY;
  }
  return {
    clickCount: observations.filter((o) => o.signalType === 'CLICK').length,
    keyPressCount: observations.filter((o) => o.signalType === 'KEY_PRESS').length,
    interactionDurationMs: Math.max(0, last - first),
    ...(scrolls.length > 0 ? { avgScrollVelocity: velocitySum / scrolls.length } : {}),
    ...(scrolls.length > 1 ? { scrollDirectionChanges: directionChanges } : {}),
  };
}
