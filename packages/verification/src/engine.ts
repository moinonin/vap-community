/**
 * Verification Engine (VAP Section 9)
 *
 * Core engine that orchestrates the verification process:
 * 1. Collects evidence for a session
 * 2. Computes confidence using the confidence model
 * 3. Evaluates policy constraints
 * 4. Determines outcome based on confidence and policy
 * 5. Returns a complete verification result
 */

import { z } from 'zod';
import {
  VerificationOutcome,
  VerificationOutcomeSchema,
  EvidenceSchema,
  type Evidence,
  type EvidenceType,
} from '@verified-attention/core';
import {
  ConfidenceInputSchema,
  ConfidenceResultSchema,
  ConfidenceConfigSchema,
  DEFAULT_CONFIDENCE_CONFIG,
  calculateConfidence,
  type ConfidenceInput,
  type ConfidenceResult,
  type ConfidenceConfig,
} from './confidence.js';
import {
  PolicyConfigSchema,
  type PolicyConfig,
  DEFAULT_POLICY,
  evaluatePolicy,
  type PolicyEvaluationInput,
} from './policy.js';
import {
  determineOutcome,
} from './outcomes.js';
// ─── Helper Functions ────────────────────────────────────────────────────

/**
 * Assess evidence quality based on type and payload
 */
function assessEvidenceQuality(evidence: Evidence): number {
  const { evidenceType, payload, confidence, metadata } = evidence;
  
  // Base quality from confidence
  let quality = confidence;
  
  // Adjust based on metadata quality score if present
  if (metadata?.qualityScore !== undefined) {
    quality = (quality + metadata.qualityScore) / 2;
  }
  
  // Adjust based on completeness score if present
  if (metadata?.completenessScore !== undefined) {
    quality = (quality + metadata.completenessScore) / 2;
  }
  
  return Math.max(0, Math.min(1, quality));
}

/**
 * Assess source reliability from evidence
 */
function assessSourceReliability(evidence: Evidence): number {
  // Use metadata quality score as proxy for source reliability
  if (evidence.metadata?.qualityScore !== undefined) {
    return evidence.metadata.qualityScore;
  }
  // Default reliability based on confidence
  return evidence.confidence;
}

/**
 * Calculate contradiction penalty across evidence items
 * Returns 0 = no contradictions, 1 = fully contradictory
 */
function calculateContradictionPenalty(evidence: Evidence[]): number {
  if (evidence.length < 2) return 0;
  
  // Simple contradiction detection: check if same evidence types have conflicting confidence
  const byType = new Map<EvidenceType, Evidence[]>();
  for (const e of evidence) {
    const arr = byType.get(e.evidenceType) || [];
    arr.push(e);
    byType.set(e.evidenceType, arr);
  }
  
  let totalPenalty = 0;
  let pairCount = 0;
  
  for (const [, items] of byType) {
    if (items.length < 2) continue;
    for (let i = 0; i < items.length - 1; i++) {
      const itemI = items[i];
      for (let j = i + 1; j < items.length; j++) {
        const itemJ = items[j];
        if (itemI && itemJ) {
          const diff = Math.abs(itemI.confidence - itemJ.confidence);
          totalPenalty += diff;
          pairCount++;
        }
      }
    }
  }
  
  return pairCount > 0 ? totalPenalty / pairCount : 0;
}

// ─── Verification Engine Types ──────────────────────────────────────────

export const VerificationInputSchema = z.object({
  // Session being verified
  session: z.object({
    sessionId: z.string(),
    contentId: z.string(),
    viewerIdHash: z.string(),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional(),
  }),
  // Evidence items for this session
  evidence: z.array(EvidenceSchema),
  // Policy to apply (optional, uses default if not provided)
  policy: PolicyConfigSchema.optional(),
  // Confidence config (optional, uses default if not provided)
  confidenceConfig: ConfidenceConfigSchema.optional(),
  // Whether the session can receive more evidence
  canReceiveMoreEvidence: z.boolean().default(true),
});

export type VerificationInput = z.infer<typeof VerificationInputSchema>;

export const VerificationResultSchema = z.object({
  // Session identifier
  sessionId: z.string(),
  // Final verification outcome
  outcome: VerificationOutcomeSchema,
  // Confidence calculation result
  confidence: ConfidenceResultSchema,
  // Policy evaluation result
  policyEvaluation: z.object({
    passed: z.boolean(),
    reasons: z.array(z.string()),
    failures: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  // Timestamp of verification
  verifiedAt: z.string().datetime(),
  // Policy ID used
  policyId: z.string(),
  // Evidence count
  evidenceCount: z.number().int().nonnegative(),
  // Session duration in milliseconds
  sessionDurationMs: z.number().int().nonnegative(),
});

export type VerificationResult = z.infer<typeof VerificationResultSchema>;

/**
 * Main verification engine class
 */
export class VerificationEngine {
  private defaultPolicy: PolicyConfig;
  private defaultConfidenceConfig: ConfidenceConfig;

  constructor(options: {
    defaultPolicy?: PolicyConfig;
    defaultConfidenceConfig?: ConfidenceConfig;
  } = {}) {
    this.defaultPolicy = options.defaultPolicy || DEFAULT_POLICY;
    this.defaultConfidenceConfig = options.defaultConfidenceConfig || DEFAULT_CONFIDENCE_CONFIG;
  }

  /**
   * Verify a session with evidence
   */
  async verify(input: VerificationInput): Promise<VerificationResult> {
    const policy = input.policy || this.defaultPolicy;
    const confidenceConfig = input.confidenceConfig || this.defaultConfidenceConfig;
    // Honor VerificationInputSchema's `.default(true)` for canReceiveMoreEvidence
    // even when the caller passes a plain object (Zod defaults only apply on parse).
    // VAP §9: when not specified, sessions are assumed able to receive more evidence.
    const canReceiveMoreEvidence = input.canReceiveMoreEvidence ?? true;

    // Calculate session duration
    const startedAt = new Date(input.session.startedAt).getTime();
    const endedAt = input.session.endedAt
      ? new Date(input.session.endedAt).getTime()
      : Date.now();
    const sessionDurationMs = Math.max(0, endedAt - startedAt);

    // Assess evidence quality and reliability
    const evidenceQuality = input.evidence.map(assessEvidenceQuality);
    const sourceReliability = input.evidence.map(assessSourceReliability);

    // Calculate contradiction penalty
    const contradictionPenalty = calculateContradictionPenalty(input.evidence);

    // Calculate completeness: fraction of required evidence types present
    const evidenceTypes = new Set<EvidenceType>(
      input.evidence.map((e) => e.evidenceType)
    );
    const requiredTypes = new Set<EvidenceType>(
      policy.requiredEvidenceTypes.map((t) => t as EvidenceType)
    );
    const presentRequiredTypes = [...requiredTypes].filter((t) => evidenceTypes.has(t));
    const completeness = requiredTypes.size > 0
      ? presentRequiredTypes.length / requiredTypes.size
      : 1;

    // Check if all required evidence types are present
    const allRequiredPresent = presentRequiredTypes.length === requiredTypes.size;

    // Extract fraud score from E-CUSTOM evidence (fraud detection results)
    let extractedFraudScore = 0;
    for (const e of input.evidence) {
      if (e.evidenceType === 'E-CUSTOM') {
        const payload = e.payload as Record<string, unknown>;
        if (payload.fraudScore !== undefined && typeof payload.fraudScore === 'number') {
          extractedFraudScore = Math.max(extractedFraudScore, payload.fraudScore);
        }
      }
    }

    // Build confidence input
    const confidenceInput: ConfidenceInput = {
      evidenceQuality,
      completeness,
      evidenceCount: input.evidence.length,
      sourceReliability,
      contradictionPenalty,
      fraudScore: extractedFraudScore,
    };

    // Calculate confidence
    const confidence = calculateConfidence(confidenceInput, confidenceConfig);

    // Evaluate policy
    const policyInput: PolicyEvaluationInput = {
      evidenceTypes: Array.from(evidenceTypes),
      evidenceCount: input.evidence.length,
      sessionDurationMs,
      fraudScore: confidenceInput.fraudScore || 0,
    };
    const policyEvaluation = evaluatePolicy(policy, policyInput);

    // Determine outcome
    const outcome = determineOutcome({
      confidence: confidence.confidence,
      passThreshold: policy.passThreshold,
      failThreshold: policy.failThreshold,
      evidenceCount: input.evidence.length,
      minEvidenceCount: policy.minEvidenceCount,
      allRequiredPresent,
      fraudDetected: policyEvaluation.failures.some((f: string) => f.includes('Fraud')),
      canReceiveMoreEvidence,
    });

    return {
      sessionId: input.session.sessionId,
      outcome,
      confidence,
      policyEvaluation,
      verifiedAt: new Date().toISOString(),
      policyId: policy.policyId,
      evidenceCount: input.evidence.length,
      sessionDurationMs,
    };
  }

  /**
   * Verify with streaming evidence (for real-time updates)
   */
  async verifyStreaming(
    session: VerificationInput['session'],
    evidence: VerificationInput['evidence'],
    options?: { policy?: PolicyConfig; canReceiveMoreEvidence?: boolean }
  ): Promise<VerificationResult> {
    return this.verify({
      session,
      evidence,
      policy: options?.policy,
      canReceiveMoreEvidence: options?.canReceiveMoreEvidence ?? true,
    });
  }

  /**
   * Get the default policy
   */
  getDefaultPolicy(): PolicyConfig {
    return this.defaultPolicy;
  }

  /**
   * Get the default confidence config
   */
  getDefaultConfidenceConfig(): ConfidenceConfig {
    return this.defaultConfidenceConfig;
  }
}

/**
 * Create a default verification engine instance
 */
export function createVerificationEngine(options?: {
  defaultPolicy?: PolicyConfig;
  defaultConfidenceConfig?: ConfidenceConfig;
}): VerificationEngine {
  return new VerificationEngine(options);
}