/**
 * Selective Disclosure for Proofs (VAE Sprint 15)
 *
 * Allows revealing only specific parts of a proof:
 * - Confidence-only disclosure
 * - Evidence-hash-only disclosure
 * - Custom field selection
 */

import { z } from 'zod';
import type { Proof, ProofState } from '@verified-attention/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export const DisclosureLevelSchema = z.enum([
  'FULL',
  'CONFIDENCE_ONLY',
  'EVIDENCE_HASH_ONLY',
  'METADATA_ONLY',
  'SESSION_REF_ONLY',
  'CUSTOM',
]);
export type DisclosureLevel = z.infer<typeof DisclosureLevelSchema>;

export const SelectiveDisclosureSchema = z.object({
  proofId: z.string().min(1),
  disclosureLevel: DisclosureLevelSchema,
  disclosedAt: z.string().datetime(),
  disclosedBy: z.string().min(1),
  // For CUSTOM level
  disclosedFields: z.array(z.string()).optional(),
  // Proof of disclosure (signed by verifier)
  verificationSignature: z.string().optional(),
});

export type SelectiveDisclosure = z.infer<typeof SelectiveDisclosureSchema>;

export const DisclosureProofSchema = z.object({
  originalProofId: z.string().min(1),
  disclosure: SelectiveDisclosureSchema,
  disclosedData: z.record(z.unknown()),
  // The disclosure itself is signed to prove it came from the verifier
  signature: z.string().optional(),
});

export type DisclosureProof = z.infer<typeof DisclosureProofSchema>;

export interface SelectiveDisclosureService {
  disclose(proof: Proof, level: DisclosureLevel, disclosedBy: string, fields?: string[]): DisclosureProof;
  verifyDisclosure(disclosureProof: DisclosureProof): boolean;
  discloseConfidenceOnly(proof: Proof, disclosedBy: string): DisclosureProof;
  discloseEvidenceHashOnly(proof: Proof, disclosedBy: string): DisclosureProof;
  discloseMetadataOnly(proof: Proof, disclosedBy: string): DisclosureProof;
}

// ─── Selective Disclosure Service ─────────────────────────────────────────────

export class SelectiveDisclosureServiceImpl implements SelectiveDisclosureService {
  private disclosures = new Map<string, SelectiveDisclosure>();

  disclose(
    proof: Proof,
    level: DisclosureLevel,
    disclosedBy: string,
    fields?: string[]
  ): DisclosureProof {
    const disclosedAt = new Date().toISOString();

    const disclosure: SelectiveDisclosure = {
      proofId: proof.proofId,
      disclosureLevel: level,
      disclosedAt,
      disclosedBy,
      disclosedFields: fields,
    };

    const disclosedData = this.buildDisclosedData(proof, level, fields);

    this.disclosures.set(proof.proofId, disclosure);

    return {
      originalProofId: proof.proofId,
      disclosure,
      disclosedData,
      signature: undefined, // Would be signed in production
    };
  }

  verifyDisclosure(disclosureProof: DisclosureProof): boolean {
    // In production, verify the signature
    // For now, check that the disclosed data is consistent with the level
    const proofId = disclosureProof.originalProofId;
    const disclosure = this.disclosures.get(proofId);
    if (!disclosure) return false;

    return this.validateDisclosedData(disclosureProof.disclosedData, disclosure.disclosureLevel);
  }

  discloseConfidenceOnly(proof: Proof, disclosedBy: string): DisclosureProof {
    return this.disclose(proof, 'CONFIDENCE_ONLY', disclosedBy);
  }

  discloseEvidenceHashOnly(proof: Proof, disclosedBy: string): DisclosureProof {
    return this.disclose(proof, 'EVIDENCE_HASH_ONLY', disclosedBy);
  }

  discloseMetadataOnly(proof: Proof, disclosedBy: string): DisclosureProof {
    return this.disclose(proof, 'METADATA_ONLY', disclosedBy);
  }

  private buildDisclosedData(
    proof: Proof,
    level: DisclosureLevel,
    fields?: string[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    switch (level) {
      case 'FULL':
        // Return everything (but without signature for external consumption)
        (result as any).proofId = proof.proofId;
        (result as any).sessionId = proof.sessionId;
        (result as any).contentId = proof.contentId;
        (result as any).confidence = proof.confidence;
        (result as any).evidenceHash = proof.evidenceHash;
        (result as any).verifierId = proof.verifierId;
        (result as any).state = proof.state;
        (result as any).issuedAt = proof.issuedAt;
        (result as any).metadata = proof.metadata;
        break;

      case 'CONFIDENCE_ONLY':
        (result as any).proofId = proof.proofId;
        (result as any).confidence = proof.confidence;
        (result as any).verifierId = proof.verifierId;
        break;

      case 'EVIDENCE_HASH_ONLY':
        (result as any).proofId = proof.proofId;
        (result as any).evidenceHash = proof.evidenceHash;
        break;

      case 'METADATA_ONLY':
        (result as any).proofId = proof.proofId;
        (result as any).metadata = proof.metadata;
        break;

      case 'SESSION_REF_ONLY':
        (result as any).proofId = proof.proofId;
        (result as any).sessionId = proof.sessionId;
        break;

      case 'CUSTOM':
        if (fields) {
          for (const field of fields) {
            (result as any)[field] = (proof as any)[field];
          }
        }
        break;
    }

    return result;
  }

  private validateDisclosedData(
    data: Record<string, unknown>,
    level: DisclosureLevel
  ): boolean {
    switch (level) {
      case 'CONFIDENCE_ONLY':
        return 'proofId' in data && 'confidence' in data && 'verifierId' in data
          && !('sessionId' in data) && !('contentId' in data);
      case 'EVIDENCE_HASH_ONLY':
        return 'proofId' in data && 'evidenceHash' in data
          && !('confidence' in data);
      case 'METADATA_ONLY':
        return 'proofId' in data && 'metadata' in data;
      case 'SESSION_REF_ONLY':
        return 'proofId' in data && 'sessionId' in data
          && !('confidence' in data);
      case 'FULL':
        return 'proofId' in data && 'confidence' in data && 'evidenceHash' in data;
      case 'CUSTOM':
        return 'proofId' in data;
    }
    return false;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _service: SelectiveDisclosureService | null = null;

export function getSelectiveDisclosureService(): SelectiveDisclosureService {
  if (!_service) {
    _service = new SelectiveDisclosureServiceImpl();
  }
  return _service;
}

export function setSelectiveDisclosureService(service: SelectiveDisclosureService): void {
  _service = service;
}

/**
 * Convenience: create a confidence-only disclosure for a proof.
 */
export function selectiveDisclose(
  proof: Proof,
  disclosedBy: string
): DisclosureProof {
  return getSelectiveDisclosureService().discloseConfidenceOnly(proof, disclosedBy);
}
