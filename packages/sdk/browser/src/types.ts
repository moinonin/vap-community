/**
 * Shared types for the browser SDK.
 *
 * The SDK is dependency-free at runtime (only zod for pre-send validation);
 * everything browser-specific goes through the DomAdapter seam so tests can
 * run in plain Node without a DOM.
 */

import type { Observation } from '@verified-attention/core';

/** Proof of Attention shape returned by the verification API. */
export interface ProofOfAttention {
  proofId: string;
  claimId: string;
  verifierId: string;
  issuedAt: string;
  expiresAt: string;
  confidence: number;
  evidenceClasses: string[];
  policyId: string;
  modelVersion: string;
  signature: string;
  publicKey: string;
}

/** Consent status values mirror packages/privacy/consent ConsentStatusSchema. */
export type ConsentStatus = 'GRANTED' | 'DENIED' | 'WITHDRAWN' | 'PENDING';

/** Minimal consent result the SDK needs from a consent provider. */
export interface ConsentDecision {
  status: ConsentStatus;
  /** Optional consent record id, attached to session participant metadata. */
  consentId?: string;
}

export interface ConsentContext {
  policyId: string;
  contentId: string;
}

/**
 * Pluggable consent provider (e.g. a CMP / cookie banner integration).
 * Evidence collection MUST NOT begin until requestConsent resolves GRANTED.
 */
export interface ConsentProvider {
  requestConsent(context: ConsentContext): Promise<ConsentDecision> | ConsentDecision;
}

/** A raw, canonical Observation record as defined in @verified-attention/core. */
export type { Observation };

/** String names of the VAP signal types (core SignalType enum values). */
export type SignalTypeName =
  | 'SCROLL'
  | 'CLICK'
  | 'KEY_PRESS'
  | 'VIEWPORT_VISIBILITY'
  | 'FOCUS'
  | 'DEVICE_MOTION'
  | 'PAGE_RESIZE'
  | 'CUSTOM';

/** Sink passed to observers; observers only see this, never the SDK itself. */
export interface ObservationSink {
  emit(signalType: SignalTypeName, payload: Observation['payload']): void;
}

/**
 * Minimal storage adapter (localStorage shape). Persisted queue survives
 * page reloads; pass `null` in config to disable persistence.
 */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Minimal timer adapter so tests can drive time without vi.useFakeTimers. */
export interface TimerAdapter {
  setInterval(handler: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

export const defaultTimers: TimerAdapter = { setInterval, clearInterval };

/** Minimal fetch shape (matches the global fetch signature we rely on). */
export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface VerifiedAttentionConfig {
  /** Base URL of the VAE API, e.g. https://api.example.com (no trailing slash needed). */
  apiUrl: string;
  policyId: string;
  contentId: string;
  /** Content element tracked by the visibility observer (Element in browser). */
  contentElement?: unknown;
  /** Consent gate; when omitted the SDK assumes the host already obtained consent. */
  consentProvider?: ConsentProvider;
  /** Pseudonymized viewer id hash; generated per-install when omitted. */
  viewerIdHash?: string;
  sourceId?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  heartbeatMs?: number;
  onProof?: (proof: ProofOfAttention) => void;
  onError?: (error: unknown) => void;
  onConsentDenied?: (context: ConsentContext) => void;
  autoStart?: boolean;
  // ── Test embedding seams ──────────────────────────────────────────────
  adapter?: import('./dom').DomAdapter;
  storage?: StorageAdapter | null;
  timers?: TimerAdapter;
  fetchImpl?: FetchLike;
}
