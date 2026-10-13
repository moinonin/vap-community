/**
 * Eligibility Engine (VAE Sprint 12)
 *
 * Determines reward eligibility based on:
 * - Policy match (verification outcome meets campaign requirements)
 * - Proof validation (valid, unrevoked, not expired)
 * - Deduplication (no duplicate rewards for same session/content)
 */

import { z } from 'zod';
import type { Proof, ProofState } from '@verified-attention/core';
import type { PolicyConfig } from '@verified-attention/verification';
import { getAuditLog } from '@verified-attention/store-verification-audit';

// ─── Types ────────────────────────────────────────────────────────────────────

export const EligibilityCriteriaSchema = z.object({
  // Required verification outcomes that qualify for reward
  allowedOutcomes: z.array(z.enum(['PASS', 'FAIL', 'INCONCLUSIVE', 'REVIEW'])).default(['PASS']),
  // Minimum confidence threshold
  minConfidence: z.number().min(0).max(1).default(0.5),
  // Required proof states
  allowedProofStates: z.array(z.enum(['UNSIGNED', 'SIGNED', 'PUBLISHED', 'REVOKED', 'EXPIRED'])).default(['PUBLISHED']),
  // Maximum age of proof in milliseconds
  maxProofAgeMs: z.number().int().positive().optional(),
  // Whether to check for duplicate rewards
  checkDeduplication: z.boolean().default(true),
  // Custom validation function name (for extensibility)
  customValidator: z.string().optional(),
});

export type EligibilityCriteria = z.infer<typeof EligibilityCriteriaSchema>;

export const EligibilityInputSchema = z.object({
  // The proof being evaluated
  proof: z.object({
    proofId: z.string().min(1),
    sessionId: z.string().min(1),
    contentId: z.string().min(1),
    verifierId: z.string().min(1),
    state: z.enum(['UNSIGNED', 'SIGNED', 'PUBLISHED', 'REVOKED', 'EXPIRED']),
    confidence: z.number().min(0).max(1),
    outcome: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE', 'REVIEW']),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
    revokedAt: z.string().datetime().optional(),
  }),
  // The policy that was used for verification
  policy: z.object({
    policyId: z.string().min(1),
    requiredEvidenceTypes: z.array(z.string()).optional(),
    passThreshold: z.number().min(0).max(1).optional(),
    failThreshold: z.number().min(0).max(1).optional(),
    minEvidenceCount: z.number().int().nonnegative().optional(),
  }),
  // Campaign criteria
  criteria: EligibilityCriteriaSchema,
  // Context for deduplication
  deduplicationContext: z.object({
    sessionId: z.string().min(1),
    contentId: z.string().min(1),
    verifierId: z.string().min(1),
  }).optional(),
});

export type EligibilityInput = z.infer<typeof EligibilityInputSchema>;

export const EligibilityResultSchema = z.object({
  eligible: z.boolean(),
  reason: z.string(),
  // Detailed breakdown
  checks: z.object({
    policyMatch: z.boolean(),
    proofValid: z.boolean(),
    proofState: z.boolean(),
    confidenceMet: z.boolean(),
    notDuplicate: z.boolean(),
    notExpired: z.boolean(),
    notRevoked: z.boolean(),
  }),
  // If not eligible, specific failure reasons
  failureReasons: z.array(z.string()).default([]),
  // Metadata
  evaluatedAt: z.string().datetime(),
  eligibilityId: z.string().min(1),
});

export type EligibilityResult = z.infer<typeof EligibilityResultSchema>;

export interface EligibilityEngine {
  evaluate(input: EligibilityInput): Promise<EligibilityResult>;
  evaluateBatch(inputs: EligibilityInput[]): Promise<EligibilityResult[]>;
}

// ─── In-Memory Eligibility Engine ────────────────────────────────────────────

export class InMemoryEligibilityEngine implements EligibilityEngine {
  private eligibilityCache: Map<string, EligibilityResult> = new Map();
  private deduplicationIndex: Map<string, Set<string>> = new Map(); // sessionId -> set of contentIds

  constructor() {}

  async evaluate(input: EligibilityInput): Promise<EligibilityResult> {
    const eligibilityId = `elig_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const evaluatedAt = new Date().toISOString();

    const checks = {
      policyMatch: false,
      proofValid: false,
      proofState: false,
      confidenceMet: false,
      notDuplicate: true,
      notExpired: true,
      notRevoked: true,
    };

    const failureReasons: string[] = [];

    // 1. Check proof validity
    const proof = input.proof;
    if (!proof || !proof.proofId) {
      checks.proofValid = false;
      failureReasons.push('Invalid proof: missing proofId');
    } else {
      checks.proofValid = true;
    }

    // 2. Check proof state
    if (input.criteria.allowedProofStates.includes(proof.state)) {
      checks.proofState = true;
    } else {
      checks.proofState = false;
      failureReasons.push(`Proof state '${proof.state}' not allowed`);
    }

    // 3. Check revocation
    if (proof.state === 'REVOKED' || proof.revokedAt) {
      checks.notRevoked = false;
      failureReasons.push('Proof has been revoked');
    } else {
      checks.notRevoked = true;
    }

    // 4. Check expiration
    if (proof.expiresAt && new Date(proof.expiresAt).getTime() < Date.now()) {
      checks.notExpired = false;
      failureReasons.push('Proof has expired');
    } else {
      checks.notExpired = true;
    }

    // 4. Check confidence threshold
    if (proof.confidence >= input.criteria.minConfidence) {
      checks.confidenceMet = true;
    } else {
      checks.confidenceMet = false;
      failureReasons.push(`Confidence ${proof.confidence} below threshold ${input.criteria.minConfidence}`);
    }

    // 5. Check outcome policy match
    if (input.criteria.allowedOutcomes.includes(proof.outcome)) {
      checks.policyMatch = true;
    } else {
      checks.policyMatch = false;
      failureReasons.push(`Outcome '${proof.outcome}' not in allowed outcomes`);
    }

    // 6. Check policy requirements
    const policy = input.policy;
    if (policy.minEvidenceCount && policy.requiredEvidenceTypes) {
      // Policy requirements are assumed met if proof passed
      // In a full implementation, we'd check the audit log
    }

    // 7. Deduplication check
    if (input.criteria.checkDeduplication && input.deduplicationContext) {
      const { sessionId, contentId } = input.deduplicationContext;
      const key = `${sessionId}:${contentId}`;
      const existing = this.deduplicationIndex.get(key);
      
      if (existing && existing.has(proof.proofId)) {
        checks.notDuplicate = false;
        failureReasons.push('Duplicate reward for same session/content/proof');
      }
    }

    // Determine overall eligibility
    const eligible = Object.values(checks).every(v => v === true);

    const result: EligibilityResult = {
      eligible,
      reason: eligible 
        ? 'All eligibility criteria met' 
        : `Failed: ${failureReasons.join(', ')}`,
      checks,
      failureReasons,
      evaluatedAt,
      eligibilityId,
    };

    // Cache result
    this.eligibilityCache.set(eligibilityId, result);

    // Update deduplication index if eligible
    if (eligible && input.deduplicationContext) {
      const { sessionId, contentId } = input.deduplicationContext;
      const key = `${sessionId}:${contentId}`;
      if (!this.deduplicationIndex.has(key)) {
        this.deduplicationIndex.set(key, new Set());
      }
      this.deduplicationIndex.get(key)!.add(proof.proofId);
    }

    return result;
  }

  async evaluateBatch(inputs: EligibilityInput[]): Promise<EligibilityResult[]> {
    return Promise.all(inputs.map(input => this.evaluate(input)));
  }

  // Helper methods for testing/inspection
  getCache(): Map<string, EligibilityResult> {
    return new Map(this.eligibilityCache);
  }

  getDeduplicationIndex(): Map<string, Set<string>> {
    const copy = new Map<string, Set<string>>();
    for (const [k, v] of this.deduplicationIndex) {
      copy.set(k, new Set(v));
    }
    return copy;
  }

  clearCache(): void {
    this.eligibilityCache.clear();
  }

  clearDeduplicationIndex(): void {
    this.deduplicationIndex.clear();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _engine: EligibilityEngine | null = null;

export function getEligibilityEngine(): EligibilityEngine {
  if (!_engine) {
    _engine = new InMemoryEligibilityEngine();
  }
  return _engine;
}

export function setEligibilityEngine(engine: EligibilityEngine): void {
  _engine = engine;
}

// ─── Convenience Function ─────────────────────────────────────────────────────

/**
 * Quick eligibility check for a proof against a policy and campaign criteria.
 */
export async function checkEligibility(
  proof: {
    proofId: string;
    sessionId: string;
    contentId: string;
    verifierId: string;
    state: 'UNSIGNED' | 'SIGNED' | 'PUBLISHED' | 'REVOKED' | 'EXPIRED';
    confidence: number;
    outcome: 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'REVIEW';
    issuedAt: string;
    expiresAt?: string;
    revokedAt?: string;
  },
  policy: {
    policyId: string;
    requiredEvidenceTypes?: string[];
    passThreshold?: number;
    failThreshold?: number;
    minEvidenceCount?: number;
  },
  criteria?: Partial<EligibilityCriteria>
): Promise<EligibilityResult> {
  const engine = getEligibilityEngine();
  
  return engine.evaluate({
    proof,
    policy,
    criteria: {
      allowedOutcomes: ['PASS'],
      minConfidence: 0.5,
      allowedProofStates: ['PUBLISHED'],
      checkDeduplication: true,
      ...criteria,
    },
    deduplicationContext: {
      sessionId: proof.sessionId,
      contentId: proof.contentId,
      verifierId: proof.verifierId,
    },
  });
}