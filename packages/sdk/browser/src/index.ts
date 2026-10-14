/**
 * @verified-attention/browser-sdk
 * Browser SDK for the Verified Attention Protocol (VAE S16).
 *
 * Public API: VerifiedAttention facade. Everything is dependency-light
 * (zod at runtime only); DOM/storage/timers/fetch are injectable so the
 * SDK also runs in tests, workers and non-browser hosts.
 */

export { VerifiedAttention, VerifiedAttention as default } from './sdk';
export type {
  VerifiedAttentionConfig,
  ProofOfAttention,
  ConsentProvider,
  ConsentDecision,
  ConsentContext,
  ConsentStatus,
  Observation,
  ObservationSink,
  SignalTypeName,
  StorageAdapter,
  TimerAdapter,
  FetchLike,
} from './types';
export { defaultTimers } from './types';

// DOM adapters
export { createBrowserAdapter, createNullAdapter, createDefaultAdapter } from './dom';
export type { DomAdapter, Rect, ScrollPosition } from './dom';

// Internals re-exported for host integrations (extension/mobile/desktop SDKs)
export { ApiClient, ApiError } from './api/client';
export type { CreateSessionResult } from './api/client';
export { ConsentGate } from './consent/gate';
export { EvidenceQueue } from './queue/index';
export type { EvidenceQueueOptions } from './queue/index';
export { SessionManager } from './session/manager';
export type { SessionManagerOptions } from './session/manager';
export { VisibilityObserver } from './observers/visibility';
export { InteractionObserver } from './observers/interaction';
export { FocusObserver } from './observers/focus';
export { validateEvidence, OutgoingEvidenceSchema } from './validation/evidence';

export type { OutgoingEvidence, ValidationResult } from './validation/evidence';

// Sprint 16: Zero-Knowledge Prior Exposure Attribution Handshake
export {
  PriorAttentionHandshake,
  type PriorAttentionVoucher,
  type ConversionAttributionPayload,
  type HandshakeOptions
} from './attribution/index';

