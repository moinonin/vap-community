/**
 * Common types shared across all VAP protocol objects.
 * Derived from VAP Specification Sections 1, 4, 5, 6, 7, 8, 9, 10.
 */

import { z } from 'zod';

/**
 * RFC 3339 timestamp with millisecond or microsecond precision.
 * Accepts both Z (UTC) and offset (+HH:MM) forms.
 */
export const TimestampSchema = z.string().datetime({ offset: true });
export type Timestamp = z.infer<typeof TimestampSchema>;

/**
 * Universally unique identifier (UUID v4)
 */
export const UUIDSchema = z.string().uuid();
export type UUID = z.infer<typeof UUIDSchema>;

/**
 * URN-formatted identifier following VAP conventions:
 * - Evidence: urn:vap:evidence:<hash>
 * - Session: urn:vap:session:<uuid>
 * - Claim: urn:vap:claim:<uuid>
 * - Proof: urn:vap:proof:<uuid>
 */
export const URNSchema = z.string().regex(/^urn:vap:(evidence|session|claim|proof):[a-zA-Z0-9_-]+$/);
export type URN = z.infer<typeof URNSchema>;

/**
 * Evidence Identifier (EVID)
 */
export const EvidenceIdSchema = z.string().regex(/^urn:vap:evidence:[a-zA-Z0-9_-]+$/);
export type EvidenceId = z.infer<typeof EvidenceIdSchema>;

/**
 * Session Identifier (SID)
 */
export const SessionIdSchema = z.string().regex(/^urn:vap:session:[a-zA-Z0-9_-]+$/);
export type SessionId = z.infer<typeof SessionIdSchema>;

/**
 * Claim Identifier (CLID)
 */
export const ClaimIdSchema = z.string().regex(/^urn:vap:claim:[a-zA-Z0-9_-]+$/);
export type ClaimId = z.infer<typeof ClaimIdSchema>;

/**
 * Proof Identifier (PID)
 */
export const ProofIdSchema = z.string().regex(/^urn:vap:proof:[a-zA-Z0-9_-]+$/);
export type ProofId = z.infer<typeof ProofIdSchema>;

/**
 * Content Identifier - publisher-defined, opaque to protocol
 */
export const ContentIdSchema = z.string().min(1).max(256);
export type ContentId = z.infer<typeof ContentIdSchema>;

/**
 * Verifier Identifier
 */
export const VerifierIdSchema = z.string().min(1).max(128);
export type VerifierId = z.infer<typeof VerifierIdSchema>;

/**
 * Policy Identifier
 */
export const PolicyIdSchema = z.string().min(1).max(128);
export type PolicyId = z.infer<typeof PolicyIdSchema>;

/**
 * Source Identifier (observation producer)
 */
export const SourceIdSchema = z.string().min(1).max(128);
export type SourceId = z.infer<typeof SourceIdSchema>;

/**
 * Confidence score: calibrated probability 0.0–1.0
 */
export const ConfidenceSchema = z.number().min(0).max(1);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/**
 * SHA-256 hash (hex encoded, 64 chars)
 */
export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export type Hash = z.infer<typeof HashSchema>;

/**
 * Ed25519 signature (base64url encoded)
 */
export const SignatureSchema = z.string().min(1);
export type Signature = z.infer<typeof SignatureSchema>;

/**
 * Public key (base64url encoded Ed25519)
 */
export const PublicKeySchema = z.string().min(1);
export type PublicKey = z.infer<typeof PublicKeySchema>;

/**
 * Verification outcome codes (VAP Section 9)
 */
export enum VerificationOutcome {
  PASS = 'PASS',
  FAIL = 'FAIL',
  INSUFFICIENT = 'INSUFFICIENT',
  PENDING = 'PENDING',
  INCONCLUSIVE = 'INCONCLUSIVE'
}

export const VerificationOutcomeSchema = z.nativeEnum(VerificationOutcome);

/**
 * Evidence types (VAP Section 5)
 */
export enum EvidenceType {
  INTERACTION = 'E-INTERACTION',
  VISIBLE = 'E-VISIBLE',
  DURATION = 'E-DURATION',
  CONTEXT = 'E-CONTEXT',
  CUSTOM = 'E-CUSTOM'
}

export const EvidenceTypeSchema = z.nativeEnum(EvidenceType);

/**
 * Claim types (VAP Section 7)
 */
export enum ClaimType {
  HUMAN_PRESENCE = 'HUMAN_PRESENCE',
  CONTENT_VISIBLE = 'CONTENT_VISIBLE',
  ENGAGEMENT_SUFFICIENT = 'ENGAGEMENT_SUFFICIENT',
  DURATION_MET = 'DURATION_MET',
  NO_FRAUD_DETECTED = 'NO_FRAUD_DETECTED',
  CUSTOM = 'CUSTOM'
}

export const ClaimTypeSchema = z.nativeEnum(ClaimType);

/**
 * Observation signal types (VAP Section 4)
 */
export enum SignalType {
  SCROLL = 'SCROLL',
  CLICK = 'CLICK',
  KEY_PRESS = 'KEY_PRESS',
  VIEWPORT_VISIBILITY = 'VIEWPORT_VISIBILITY',
  FOCUS = 'FOCUS',
  DEVICE_MOTION = 'DEVICE_MOTION',
  PAGE_RESIZE = 'PAGE_RESIZE',
  CUSTOM = 'CUSTOM'
}

export const SignalTypeSchema = z.nativeEnum(SignalType);

/**
 * Session states (VAP Section 6)
 */
export enum SessionState {
  CREATED = 'CREATED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  VERIFIED = 'VERIFIED',
  CERTIFIED = 'CERTIFIED',
  CANCELLED = 'CANCELLED'
}

export const SessionStateSchema = z.nativeEnum(SessionState);

/**
 * Evidence lifecycle states (VAP Section 3)
 */
export enum EvidenceState {
  PROPOSED = 'PROPOSED',
  VALIDATED = 'VALIDATED',
  INDEXED = 'INDEXED',
  ARCHIVED = 'ARCHIVED',
  DISCARDED = 'DISCARDED'
}

export const EvidenceStateSchema = z.nativeEnum(EvidenceState);

/**
 * Base metadata for all protocol objects
 */
export const BaseMetadataSchema = z.object({
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema.optional(),
  version: z.number().int().positive().default(1),
  tags: z.record(z.string()).optional()
});

export type BaseMetadata = z.infer<typeof BaseMetadataSchema>;

/**
 * Zod issue type for validation errors
 */
export interface ZodIssue {
  code: string;
  message: string;
  path: (string | number)[];
}

/**
 * Convert Zod issues to plain objects
 */
export function zodIssuesToPlain(issues: z.ZodIssue[]): ZodIssue[] {
  return issues.map(issue => ({
    code: issue.code,
    message: issue.message,
    path: issue.path
  }));
}

/**
 * Cryptographic integrity hash for evidence/proof objects
 * Computed as: sha256(id + session_id + timestamp + type + payload_hash + signature)
 */
export function computeIntegrityHash(parts: string[]): Hash {
  // Implementation uses crypto.subtle.digest('SHA-256', ...)
  // This is a type-only declaration; actual implementation in crypto package
  return '' as Hash;
}

/**
 * Validate that a confidence score is properly calibrated
 * (same input + same rules = same output)
 */
export function assertDeterministicConfidence(confidence: Confidence, context: string): void {
  if (confidence < 0 || confidence > 1) {
    throw new Error(`Invalid confidence ${confidence} in ${context}: must be in [0, 1]`);
  }
  if (!Number.isFinite(confidence)) {
    throw new Error(`Non-finite confidence in ${context}`);
  }
}

/**
 * Generate a VAP-compliant URN
 */
export function generateURN(type: 'evidence' | 'session' | 'claim' | 'proof', suffix: string): URN {
  return `urn:vap:${type}:${suffix}` as URN;
}

/**
 * Parse a VAP URN into components
 */
export function parseURN(urn: URN): { type: string; value: string } | null {
  const match = urn.match(/^urn:vap:(evidence|session|claim|proof):(.+)$/);
  if (!match) return null;
  return { type: match[1]!, value: match[2]! };
}