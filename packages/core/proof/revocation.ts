/**
 * Proof Revocation (VAE Sprint 11)
 *
 * Revoke proofs and issue supplementary proofs that supersede revoked ones.
 * Revocation is append-only — revoked proofs are never deleted, only marked.
 */

import { z } from 'zod';
import type { Proof, ProofState, UnsignedProof } from '@verified-attention/core';
import { createUnsignedProof, ProofSchema } from '@verified-attention/core';

// ─── Revocation Types ─────────────────────────────────────────────────────────

export const RevocationReasonSchema = z.object({
  reason: z.enum(['FRAUD_DETECTED', 'PROCEDURAL_ERROR', 'CONTENT_REMOVED', 'POLICY_VIOLATION', 'USER_REQUEST', 'OTHER']),
  description: z.string().optional(),
  evidenceRef: z.array(z.string()).optional(),
  reportedBy: z.string().min(1),
  reportedAt: z.string().datetime(),
});

export type RevocationReason = z.infer<typeof RevocationReasonSchema>;

export const SupplementaryProofSchema = z.object({
  supersedesProofId: z.string().min(1),
  revocationReason: RevocationReasonSchema,
  newConfidence: z.number().min(0).max(1),
  newEvidenceHash: z.string().min(1),
  note: z.string().optional(),
});

export type SupplementaryProof = z.infer<typeof SupplementaryProofSchema>;

export const RevocationRecordSchema = z.object({
  revocationId: z.string().min(1),
  proofId: z.string().min(1),
  revokedAt: z.string().datetime(),
  reason: RevocationReasonSchema,
  supplementaryProof: SupplementaryProofSchema.optional(),
  revokedBy: z.string().min(1),
});

export type RevocationRecord = z.infer<typeof RevocationRecordSchema>;

export interface RevocationStore {
  recordRevocation(record: RevocationRecord): Promise<void>;
  getRevocation(proofId: string): Promise<RevocationRecord | undefined>;
  isRevoked(proofId: string): Promise<boolean>;
  listRevocations(opts?: { after?: string; before?: string; limit?: number }): Promise<RevocationRecord[]>;
}

// ─── In-Memory Revocation ─────────────────────────────────────────────────────

export class RevokeProof {
  private revocations = new Map<string, RevocationRecord>();

  constructor(private store?: RevocationStore) {}

  async revoke(
    proof: Proof,
    reason: RevocationReason,
    revokerId: string,
    supplementary?: SupplementaryProof
  ): Promise<RevocationRecord> {
    const revocationId = `revocation_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const record: RevocationRecord = {
      revocationId,
      proofId: proof.proofId,
      revokedAt: new Date().toISOString(),
      reason,
      supplementaryProof: supplementary,
      revokedBy: revokerId,
    };

    // Update proof state to REVOKED
    if (this.store) {
      await this.store.recordRevocation(record);
    }

    this.revocations.set(proof.proofId, record);
    return record;
  }

  async isRevoked(proofId: string): Promise<boolean> {
    if (this.store) {
      return this.store.isRevoked(proofId);
    }
    return this.revocations.has(proofId);
  }

  async getRevocation(proofId: string): Promise<RevocationRecord | undefined> {
    if (this.store) {
      return this.store.getRevocation(proofId);
    }
    return this.revocations.get(proofId);
  }

  async listRevocations(opts?: { after?: string; before?: string; limit?: number }): Promise<RevocationRecord[]> {
    let records = Array.from(this.revocations.values());

    if (opts?.after) {
      records = records.filter(r => r.revokedAt >= opts.after!);
    }
    if (opts?.before) {
      records = records.filter(r => r.revokedAt <= opts.before!);
    }

    records.sort((a, b) => new Date(b.revokedAt).getTime() - new Date(a.revokedAt).getTime());

    if (opts?.limit) {
      records = records.slice(0, opts.limit);
    }

    return records;
  }
}

// ─── Supplementary Proof Generation ──────────────────────────────────────────

export function createSupplementaryProof(
  originalProof: Proof,
  revocationReason: RevocationReason,
  newConfidence: number,
  newEvidenceHash: string,
  note?: string
): UnsignedProof {
  // Create a new proof that supersedes the revoked one
  const supplementary: SupplementaryProof = {
    supersedesProofId: originalProof.proofId,
    revocationReason,
    newConfidence,
    newEvidenceHash,
    note,
  };

  return {
    proofId: `urn:vap:proof:supplementary:${originalProof.proofId}`,
    sessionId: originalProof.sessionId,
    contentId: originalProof.contentId,
    confidence: newConfidence,
    evidenceHash: newEvidenceHash,
    verifierId: originalProof.verifierId,
    state: 'UNSIGNED' as const,
    metadata: {
      policyId: originalProof.metadata?.policyId || '',
      verificationModelVersion: originalProof.metadata?.verificationModelVersion || '1.0',
      fraudScore: originalProof.metadata?.fraudScore ?? 0,
      evidenceCount: originalProof.metadata?.evidenceCount ?? 0,
      sessionDurationMs: originalProof.metadata?.sessionDurationMs ?? 0,
      supersedesProofId: originalProof.proofId,
    },
    baseMetadata: {},
  };
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _revoker: RevokeProof | null = null;

/**
 * Revoke a proof with a reason.
 * Returns the revocation record.
 */
export async function revokeProof(
  proof: Proof,
  reason: RevocationReason,
  revokerId: string,
  supplementary?: SupplementaryProof
): Promise<RevocationRecord> {
  if (!_revoker) {
    _revoker = new RevokeProof();
  }
  return _revoker.revoke(proof, reason, revokerId, supplementary);
}

/**
 * Check if a proof has been revoked.
 */
export async function isProofRevoked(proofId: string): Promise<boolean> {
  if (!_revoker) {
    _revoker = new RevokeProof();
  }
  return _revoker.isRevoked(proofId);
}

/**
 * Get the revocation record for a proof.
 */
export async function getRevocation(proofId: string): Promise<RevocationRecord | undefined> {
  if (!_revoker) {
    _revoker = new RevokeProof();
  }
  return _revoker.getRevocation(proofId);
}
