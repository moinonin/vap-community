/**
 * Claim types and schemas (VAP Section 7)
 *
 * A claim asserts a semantic proposition about an attention session, derived from evidence.
 * Claims are functions of evidence — they MUST reference evidence with unique IDs and hashes.
 * Every claim has a confidence rating (calibrated probability 0.0–1.0).
 */

import { z } from 'zod';
import {
  TimestampSchema,
  UUIDSchema,
  SessionIdSchema,
  ClaimIdSchema,
  EvidenceIdSchema,
  PolicyIdSchema,
  ConfidenceSchema,
  ClaimTypeSchema,
  BaseMetadataSchema,
  zodIssuesToPlain
} from './common';
import { randomUUID } from 'crypto';

/**
 * Claim lifecycle states (VAP Section 7)
 */
export enum ClaimState {
  PROPOSED = 'PROPOSED',
  EVALUATED = 'EVALUATED',
  ISSUED = 'ISSUED',
  REVOKED = 'REVOKED'
}

export const ClaimStateSchema = z.nativeEnum(ClaimState);

/**
 * Claim metadata
 */
export const ClaimMetadataSchema = z.object({
  policyId: PolicyIdSchema.optional(),
  evaluationModel: z.string().optional(),
  modelVersion: z.string().optional(),
  evidenceCount: z.number().int().nonnegative().optional(),
  evidenceQualityScore: z.number().min(0).max(1).optional(),
  contradictionScore: z.number().min(0).max(1).optional()
});

export type ClaimMetadata = z.infer<typeof ClaimMetadataSchema>;

/**
 * Complete Claim object (VAP Section 7)
 */
export const ClaimSchema = z.object({
  claimId: ClaimIdSchema,
  sessionId: SessionIdSchema,
  claimType: ClaimTypeSchema,
  // Evidence references (cryptographically bound)
  evidenceIds: z.array(EvidenceIdSchema).min(1),
  // Evidence hash (aggregate hash of all referenced evidence)
  evidenceHash: z.string().min(1),
  // Confidence that this claim is correct (calibrated probability)
  confidence: ConfidenceSchema,
  // Claim lifecycle state
  state: ClaimStateSchema,
  // Timestamps
  proposedAt: TimestampSchema,
  evaluatedAt: TimestampSchema.optional(),
  issuedAt: TimestampSchema.optional(),
  revokedAt: TimestampSchema.optional(),
  // Expiration (when this claim is considered stale)
  expiration: TimestampSchema.optional(),
  // Metadata
  metadata: ClaimMetadataSchema.optional(),
  baseMetadata: BaseMetadataSchema.optional()
});

export type Claim = z.infer<typeof ClaimSchema>;

/**
 * Claim validation result
 */
export const ClaimValidationResultSchema = z.object({
  valid: z.boolean(),
  claimId: ClaimIdSchema,
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    path: z.array(z.union([z.string(), z.number()])).optional()
  })).optional(),
  warnings: z.array(z.string()).optional()
});

export type ClaimValidationResult = z.infer<typeof ClaimValidationResultSchema>;

/**
 * Create a new claim (in PROPOSED state, awaiting evaluation)
 */
export function createClaim(
  params: Omit<Claim, 'claimId' | 'state' | 'proposedAt'> & { proposedAt?: string }
): Claim {
  return {
    ...params,
    claimId: `urn:vap:claim:${randomUUID()}`,
    state: 'PROPOSED' as const,
    proposedAt: params.proposedAt ?? new Date().toISOString()
  } as Claim;
}

/**
 * Transition claim state
 */
export function transitionClaimState(
  claim: Claim,
  newState: ClaimState
): Claim {
  const validTransitions: Record<ClaimState, ClaimState[]> = {
    [ClaimState.PROPOSED]: [ClaimState.EVALUATED, ClaimState.REVOKED],
    [ClaimState.EVALUATED]: [ClaimState.ISSUED, ClaimState.REVOKED],
    [ClaimState.ISSUED]: [ClaimState.REVOKED],
    [ClaimState.REVOKED]: []
  };

  if (!validTransitions[claim.state]?.includes(newState)) {
    throw new Error(`Invalid claim state transition: ${claim.state} -> ${newState}`);
  }

  const now = new Date().toISOString();
  return {
    ...claim,
    state: newState,
    ...(newState === ClaimState.EVALUATED && { evaluatedAt: now }),
    ...(newState === ClaimState.ISSUED && { issuedAt: now }),
    ...(newState === ClaimState.REVOKED && { revokedAt: now })
  };
}

/**
 * Validate claim structure and required fields
 */
export function validateClaim(claim: unknown): ClaimValidationResult {
  const result = ClaimSchema.safeParse(claim);
  if (!result.success) {
    return {
      valid: false,
      claimId: (claim as any)?.claimId ?? 'unknown',
      errors: zodIssuesToPlain(result.error.issues)
    };
  }
  return { valid: true, claimId: result.data.claimId };
}

/**
 * Check if claim is expired
 */
export function isClaimExpired(claim: Claim): boolean {
  if (!claim.expiration) return false;
  return new Date(claim.expiration).getTime() < Date.now();
}

/**
 * Check if claim is active (issued and not revoked or expired)
 */
export function isClaimActive(claim: Claim): boolean {
  return claim.state === 'ISSUED' && !isClaimExpired(claim);
}