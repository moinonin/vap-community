/**
 * Proof of Attention types and schemas (VAP Section 10)
 *
 * A Proof of Attention is a digitally signed, auditable record confirming
 * that a session achieved verified attention with a given confidence.
 * Proofs are immutable once created.
 */

import { z } from 'zod';
import {
  TimestampSchema,
  SessionIdSchema,
  ProofIdSchema,
  ContentIdSchema,
  VerifierIdSchema,
  ConfidenceSchema,
  HashSchema,
  SignatureSchema,
  BaseMetadataSchema,
  zodIssuesToPlain
} from './common';
import type { Hash } from './common';
import { randomUUID, createHash } from 'crypto';

/**
 * Proof lifecycle states (VAP Section 10)
 */
export enum ProofState {
  UNSIGNED = 'UNSIGNED',
  SIGNED = 'SIGNED',
  PUBLISHED = 'PUBLISHED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED'
}

export const ProofStateSchema = z.nativeEnum(ProofState);

/**
 * Proof metadata
 */
export const ProofMetadataSchema = z.object({
  policyId: z.string().min(1),
  verificationModelVersion: z.string().optional(),
  fraudScore: z.number().min(0).max(1).optional(),
  evidenceCount: z.number().int().nonnegative().optional(),
  sessionDurationMs: z.number().int().nonnegative().optional(),
  claimIds: z.array(z.string()).optional()
});

export type ProofMetadata = z.infer<typeof ProofMetadataSchema>;

/**
 * Complete Proof of Attention object (VAP Section 10)
 *
 * Contains 7 mandatory fields:
 * 1. proof_id (unique)
 * 2. session_id (referenced)
 * 3. content_id (referenced)
 * 4. confidence (aggregated confidence)
 * 5. evidence_hash (of all considered evidence)
 * 6. verifier_id (identity of verifier)
 * 7. signature (Ed25519/ECDSA over above fields)
 */
export const ProofSchema = z.object({
  proofId: ProofIdSchema,
  sessionId: SessionIdSchema,
  contentId: ContentIdSchema,
  confidence: ConfidenceSchema,
  evidenceHash: HashSchema,
  verifierId: VerifierIdSchema,
  signature: SignatureSchema,
  // Lifecycle
  state: ProofStateSchema,
  // Timestamps
  issuedAt: TimestampSchema,
  publishedAt: TimestampSchema.optional(),
  revokedAt: TimestampSchema.optional(),
  expiresAt: TimestampSchema.optional(),
  // Metadata
  metadata: ProofMetadataSchema.optional(),
  baseMetadata: BaseMetadataSchema.optional()
});

export type Proof = z.infer<typeof ProofSchema>;

/**
 * Proof validation result
 */
export const ProofValidationResultSchema = z.object({
  valid: z.boolean(),
  proofId: ProofIdSchema,
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    path: z.array(z.union([z.string(), z.number()])).optional()
  })).optional(),
  warnings: z.array(z.string()).optional()
});

export type ProofValidationResult = z.infer<typeof ProofValidationResultSchema>;

/**
 * Unsigned proof (before signature is applied)
 */
export type UnsignedProof = Omit<Proof, 'signature' | 'state' | 'issuedAt'> & {
  state: typeof ProofState.UNSIGNED;
};

/**
 * Create an unsigned proof from verification result
 */
export function createUnsignedProof(
  params: Omit<Proof, 'proofId' | 'signature' | 'state' | 'issuedAt'>
): UnsignedProof {
  return {
    ...params,
    proofId: `urn:vap:proof:${randomUUID()}`,
    state: ProofState.UNSIGNED
  } as UnsignedProof;
}

/**
 * Sign a proof (transitions UNSIGNED → SIGNED)
 */
export function signProof(
  unsigned: UnsignedProof,
  signature: string
): Proof {
  return {
    ...unsigned,
    signature,
    state: ProofState.SIGNED,
    issuedAt: new Date().toISOString()
  } as Proof;
}

/**
 * Publish a signed proof (transitions SIGNED → PUBLISHED)
 */
export function publishProof(proof: Proof): Proof {
  if (proof.state !== ProofState.SIGNED) {
    throw new Error(`Cannot publish proof in state ${proof.state}; must be SIGNED`);
  }
  return {
    ...proof,
    state: ProofState.PUBLISHED,
    publishedAt: new Date().toISOString()
  };
}

/**
 * Revoke a proof (any state → REVOKED)
 */
export function revokeProof(proof: Proof): Proof {
  if (proof.state === ProofState.REVOKED) {
    return proof;
  }
  return {
    ...proof,
    state: ProofState.REVOKED,
    revokedAt: new Date().toISOString()
  };
}

/**
 * Transition proof state with validation
 */
export function transitionProofState(
  proof: Proof,
  newState: ProofState
): Proof {
  const validTransitions: Record<ProofState, ProofState[]> = {
    [ProofState.UNSIGNED]: [ProofState.SIGNED],
    [ProofState.SIGNED]: [ProofState.PUBLISHED, ProofState.REVOKED],
    [ProofState.PUBLISHED]: [ProofState.REVOKED, ProofState.EXPIRED],
    [ProofState.REVOKED]: [],
    [ProofState.EXPIRED]: []
  };

  if (!validTransitions[proof.state]?.includes(newState)) {
    throw new Error(`Invalid proof state transition: ${proof.state} -> ${newState}`);
  }

  switch (newState) {
    case ProofState.PUBLISHED:
      return publishProof(proof);
    case ProofState.REVOKED:
      return revokeProof(proof);
    default:
      return { ...proof, state: newState };
  }
}

/**
 * Validate proof structure, signature presence, and required fields
 */
export function validateProof(proof: unknown): ProofValidationResult {
  const result = ProofSchema.safeParse(proof);
  if (!result.success) {
    return {
      valid: false,
      proofId: (proof as { proofId?: string })?.proofId ?? 'unknown',
      errors: zodIssuesToPlain(result.error.issues)
    };
  }
  return { valid: true, proofId: result.data.proofId };
}

/**
 * Check if proof is expired
 */
export function isProofExpired(proof: Proof): boolean {
  if (proof.state === ProofState.EXPIRED) return true;
  if (!proof.expiresAt) return false;
  return new Date(proof.expiresAt).getTime() < Date.now();
}

/**
 * Check if proof is valid (published, not revoked, not expired)
 */
export function isProofValid(proof: Proof): boolean {
  return proof.state === ProofState.PUBLISHED && !isProofExpired(proof);
}

/**
 * Serialize a proof to canonical JSON.
 * Keys are sorted to ensure deterministic output regardless of insertion order.
 * Works for both Proof and UnsignedProof.
 */
export function serializeProof(proof: Proof | UnsignedProof): string {
  return JSON.stringify(proof, Object.keys(proof).sort());
}

/**
 * Compute deterministic SHA-256 hash over the 7 mandatory proof fields.
 * Excludes state, timestamps, and metadata — only identity and content fields.
 * VAP: sha256(proofId + sessionId + contentId + confidence + evidenceHash + verifierId + signature)
 */
export function computeProofHash(proof: Proof | UnsignedProof): Hash {
  const data = JSON.stringify({
    proofId: proof.proofId,
    sessionId: proof.sessionId,
    contentId: proof.contentId,
    confidence: proof.confidence,
    evidenceHash: proof.evidenceHash,
    verifierId: proof.verifierId,
    signature: (proof as Proof).signature ?? ''
  }, null, 0);
  return createHash('sha256').update(data).digest('hex') as Hash;
}