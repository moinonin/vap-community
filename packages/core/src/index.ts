/**
 * @verified-attention/core
 *
 * Core VAP-compliant types for the Verified Attention Protocol.
 * All types are derived from the VAP specification
 * (docs/specs/0001-verified-attention-protocol.md).
 *
 * This package has ZERO dependencies on implementation details.
 * It only defines the protocol data structures and validation schemas.
 *
 * Re-exports all VAP protocol objects. Where name collisions exist
 * (e.g., EvidenceState defined in both common.ts and evidence.ts),
 * common.ts is the canonical source and evidence.ts's duplicate
 * is omitted from the barrel export.
 */

// Common types (canonical source for shared enums)
export {
  // Schemas
  TimestampSchema,
  UUIDSchema,
  URNSchema,
  EvidenceIdSchema,
  SessionIdSchema,
  ClaimIdSchema,
  ProofIdSchema,
  ContentIdSchema,
  VerifierIdSchema,
  PolicyIdSchema,
  SourceIdSchema,
  ConfidenceSchema,
  HashSchema,
  SignatureSchema,
  PublicKeySchema,
  BaseMetadataSchema,
  // Enums
  VerificationOutcome,
  VerificationOutcomeSchema,
  EvidenceType,
  EvidenceTypeSchema,
  ClaimType,
  ClaimTypeSchema,
  SignalType,
  SignalTypeSchema,
  SessionState,
  SessionStateSchema,
  EvidenceState,       // canonical export from common.ts
  EvidenceStateSchema, // canonical export from common.ts
} from './common';

// Proof types (VAP Section 10)
export {
  ProofState,
  ProofStateSchema,
} from './proof';

// Observation (VAP Section 4) — no collisions with common
export {
  ScrollPayloadSchema,
  ClickPayloadSchema,
  KeyPressPayloadSchema,
  ViewportVisibilityPayloadSchema,
  FocusPayloadSchema,
  DeviceMotionPayloadSchema,
  PageResizePayloadSchema,
  CustomPayloadSchema,
  ObservationPayloadSchema,
  ObservationMetaSchema,
  ObservationSchema,
  ObservationStateSchema,
  ObservationWithStateSchema,
  ObservationBatchSchema,
  type ObservationPayload,
  type ObservationMeta,
  type Observation,
  type ObservationWithState,
  type ObservationBatch,
  ObservationState,
  createObservation,
  normalizeObservation
} from './observation';

// Evidence (VAP Section 5) — EvidenceState excluded (from common)
export {
  InteractionEvidencePayloadSchema,
  VisibilityEvidencePayloadSchema,
  DurationEvidencePayloadSchema,
  ContextEvidencePayloadSchema,
  CustomEvidencePayloadSchema,
  EvidencePayloadSchema,
  EvidenceProvenanceSchema,
  EvidenceMetadataSchema,
  EvidenceSchema,
  EvidenceStateSchema as EvidenceLifecycleStateSchema,
  EvidenceWithStateSchema,
  EvidenceValidationResultSchema,
  type EvidencePayload,
  type EvidenceProvenance,
  type EvidenceMetadata,
  type Evidence,
  type EvidenceWithState,
  type EvidenceValidationResult,
  // Add ContextEvidencePayload type export
  type ContextEvidencePayload,
  createEvidence,
  computeEvidenceHash,
  validateEvidence
} from './evidence';

// Session (VAP Section 6)
export {
  SessionConfigSchema,
  SessionParticipantSchema,
  SessionSchema,
  SessionStateValue,
  SessionEventType,
  type SessionState as SessionStateType,
  type SessionConfig,
  type SessionParticipant,
  type Session,
  createSession,
  addEvidenceToSession,
  transitionSessionState,
  isSessionExpired,
  sessionHeartbeat
} from './session';

// Claim (VAP Section 7)
export {
  ClaimStateSchema,
  ClaimState,
  ClaimMetadataSchema,
  ClaimSchema,
  ClaimValidationResultSchema,
  type ClaimMetadata,
  type Claim,
  type ClaimValidationResult,
  createClaim,
  transitionClaimState,
  validateClaim,
  isClaimExpired,
  isClaimActive
} from './claim';

// Proof of Attention (VAP Section 10)
export {
  ProofMetadataSchema,
  ProofSchema,
  ProofValidationResultSchema,
  type ProofMetadata,
  type Proof,
  type ProofValidationResult,
  type UnsignedProof,
  createUnsignedProof,
  signProof,
  publishProof,
  revokeProof,
  transitionProofState,
  validateProof,
  isProofExpired,
  isProofValid,
  serializeProof,
  computeProofHash
} from './proof';

// Protocol Messages
export {
  SubmitEvidenceSchema,
  ClaimRequestSchema,
  VerificationCreateSchema,
  type SubmitEvidence,
  type ClaimRequest,
  type VerificationCreate
} from './messages';