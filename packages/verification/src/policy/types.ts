/**
 * Policy Types (VAE Sprint 10)
 *
 * Extended policy types for verification engine hardening:
 * - PolicyType enum for categorization
 * - Evidence requirement types
 * - Confidence threshold configurations
 * - Fraud limit policies
 * - Session constraint policies
 * - Policy CRUD interfaces
 */

import { z } from 'zod';

// ─── Policy Type Enum ───────────────────────────────────────────────────────

export enum PolicyType {
  VERIFICATION = 'VERIFICATION',     // Core verification policies
  FRAUD = 'FRAUD',                   // Fraud detection policies
  SESSION = 'SESSION',               // Session constraint policies
  REWARD = 'REWARD',                 // Reward/pricing policies
  PRIVACY = 'PRIVACY',               // Privacy/compliance policies
}

// ─── Evidence Requirement Types ─────────────────────────────────────────────

export const EvidenceRequirementSchema = z.object({
  type: z.enum([
    'E-INTERACTION',
    'E-VISIBLE',
    'E-DURATION',
    'E-CONTEXT',
    'E-QUALITY',
    'E-FRAUD-SIGNAL',
  ]),
  required: z.boolean().default(true),
  minCount: z.number().int().nonnegative().default(1),
  weight: z.number().min(0).max(1).default(1.0),
});

export type EvidenceRequirement = z.infer<typeof EvidenceRequirementSchema>;

// ─── Confidence Threshold Configuration ─────────────────────────────────────

export const ConfidenceThresholdsSchema = z.object({
  pass: z.number().min(0).max(1).default(0.75),
  fail: z.number().min(0).max(1).default(0.3),
  inconclusive: z
    .object({
      min: z.number().min(0).max(1).default(0.3),
      max: z.number().min(0).max(1).default(0.75),
    })
    .default({ min: 0.3, max: 0.75 }),
  manualReviewEnabled: z.boolean().default(true),
});

export type ConfidenceThresholds = z.infer<typeof ConfidenceThresholdsSchema>;

// ─── Fraud Limit Policy ──────────────────────────────────────────────────────

export const FraudLimitPolicySchema = z.object({
  maxFraudScore: z.number().min(0).max(1).default(0.7),
  blockThreshold: z.number().min(0).max(1).default(0.9),
  reviewThreshold: z.number().min(0).max(1).default(0.5),
  vectorWeights: z
    .record(z.string(), z.number().min(0).max(1))
    .default({
      automation: 1.0,
      replay: 1.0,
      emulator: 1.0,
      sybil: 1.0,
      velocity: 0.8,
    }),
  actionOnBlock: z.enum(['REJECT', 'QUARANTINE', 'REVIEW']).default('REJECT'),
});

export type FraudLimitPolicy = z.infer<typeof FraudLimitPolicySchema>;

// ─── Session Constraint Policy ──────────────────────────────────────────────

export const SessionConstraintPolicySchema = z.object({
  minDurationMs: z.number().int().nonnegative().default(30_000),
  maxDurationMs: z.number().int().positive().optional(),
  maxInteractions: z.number().int().positive().optional(),
  idleTimeoutMs: z.number().int().positive().default(300_000),
  requireContinuousVisibility: z.boolean().default(false),
  allowedPlatforms: z.array(z.string()).optional(),
  geoRestrictions: z.array(z.string()).optional(),
});

export type SessionConstraintPolicy = z.infer<typeof SessionConstraintPolicySchema>;

// ─── Complete Policy Configuration ──────────────────────────────────────────

export const PolicyConfigSchema = z.object({
  policyId: z.string().min(1),
  name: z.string().min(1),
  type: z.nativeEnum(PolicyType).default(PolicyType.VERIFICATION),
  description: z.string().optional(),
  version: z.number().int().nonnegative().default(1),
  // Evidence requirements
  evidenceRequirements: z.array(EvidenceRequirementSchema).default([
    { type: 'E-INTERACTION', required: true, minCount: 1, weight: 0.5 },
    { type: 'E-VISIBLE', required: true, minCount: 1, weight: 0.5 },
  ]),
  // Confidence thresholds
  confidenceThresholds: ConfidenceThresholdsSchema.default({}),
  // Fraud limits
  fraudLimits: FraudLimitPolicySchema.default({}),
  // Session constraints
  sessionConstraints: SessionConstraintPolicySchema.default({}),
  // Metadata
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  deprecatedAt: z.string().datetime().optional(),
  createdBy: z.string().optional(),
  active: z.boolean().default(true),
});

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

// ─── Default Policies ────────────────────────────────────────────────────────

export const DEFAULT_VERIFICATION_POLICY: PolicyConfig = {
  policyId: 'default-verification-v1',
  name: 'Default Verification Policy',
  type: PolicyType.VERIFICATION,
  description: 'Standard verification policy for general content attention',
  version: 1,
  evidenceRequirements: [
    { type: 'E-INTERACTION', required: true, minCount: 1, weight: 0.4 },
    { type: 'E-VISIBLE', required: true, minCount: 1, weight: 0.3 },
    { type: 'E-DURATION', required: false, minCount: 1, weight: 0.2 },
    { type: 'E-CONTEXT', required: false, minCount: 1, weight: 0.1 },
  ],
  confidenceThresholds: {
    pass: 0.75,
    fail: 0.3,
    inconclusive: { min: 0.3, max: 0.75 },
    manualReviewEnabled: true,
  },
  fraudLimits: {
    maxFraudScore: 0.7,
    blockThreshold: 0.9,
    reviewThreshold: 0.5,
    vectorWeights: {
      automation: 1.0,
      replay: 1.0,
      emulator: 1.0,
      sybil: 1.0,
      velocity: 0.8,
    },
    actionOnBlock: 'REJECT',
  },
  sessionConstraints: {
    minDurationMs: 30_000,
    maxDurationMs: 7_200_000, // 2 hours
    idleTimeoutMs: 300_000, // 5 minutes
    requireContinuousVisibility: false,
  },
  active: true,
};

export const HIGH_TRUST_VERIFICATION_POLICY: PolicyConfig = {
  ...DEFAULT_VERIFICATION_POLICY,
  policyId: 'high-trust-verification-v1',
  name: 'High Trust Verification Policy',
  description: 'Strict verification for high-value or sensitive content',
  evidenceRequirements: [
    { type: 'E-INTERACTION', required: true, minCount: 3, weight: 0.3 },
    { type: 'E-VISIBLE', required: true, minCount: 3, weight: 0.3 },
    { type: 'E-DURATION', required: true, minCount: 2, weight: 0.2 },
    { type: 'E-CONTEXT', required: true, minCount: 1, weight: 0.1 },
    { type: 'E-QUALITY', required: true, minCount: 1, weight: 0.1 },
  ],
  confidenceThresholds: {
    pass: 0.9,
    fail: 0.2,
    inconclusive: { min: 0.2, max: 0.9 },
    manualReviewEnabled: true,
  },
  fraudLimits: {
    maxFraudScore: 0.5,
    blockThreshold: 0.7,
    reviewThreshold: 0.3,
    vectorWeights: {
      automation: 1.2,
      replay: 1.2,
      emulator: 1.2,
      sybil: 1.0,
      velocity: 1.0,
    },
    actionOnBlock: 'QUARANTINE',
  },
  sessionConstraints: {
    minDurationMs: 60_000,
    maxDurationMs: 14_400_000, // 4 hours
    idleTimeoutMs: 120_000,
    requireContinuousVisibility: true,
  },
};

export const LOW_FRICTION_VERIFICATION_POLICY: PolicyConfig = {
  ...DEFAULT_VERIFICATION_POLICY,
  policyId: 'low-friction-verification-v1',
  name: 'Low Friction Verification Policy',
  description: 'Reduced evidence requirements for low-risk content',
  evidenceRequirements: [
    { type: 'E-VISIBLE', required: true, minCount: 1, weight: 0.6 },
    { type: 'E-INTERACTION', required: false, minCount: 1, weight: 0.4 },
  ],
  confidenceThresholds: {
    pass: 0.5,
    fail: 0.15,
    inconclusive: { min: 0.15, max: 0.5 },
    manualReviewEnabled: false,
  },
  fraudLimits: {
    maxFraudScore: 0.85,
    blockThreshold: 0.95,
    reviewThreshold: 0.7,
    vectorWeights: {
      automation: 0.8,
      replay: 0.8,
      emulator: 0.8,
      sybil: 0.8,
      velocity: 0.5,
    },
    actionOnBlock: 'REVIEW',
  },
  sessionConstraints: {
    minDurationMs: 5_000,
    maxDurationMs: 3_600_000, // 1 hour
    idleTimeoutMs: 600_000, // 10 minutes
    requireContinuousVisibility: false,
  },
};

// ─── Policy Store Interface ──────────────────────────────────────────────────

export interface PolicyStore {
  getPolicy(policyId: string): PolicyConfig | undefined;
  listPolicies(): PolicyConfig[];
  listPoliciesByType(type: PolicyType): PolicyConfig[];
  createPolicy(policy: PolicyConfig): void;
  updatePolicy(policyId: string, updates: Partial<PolicyConfig>): PolicyConfig | undefined;
  deprecatePolicy(policyId: string): boolean;
  deletePolicy(policyId: string): boolean;
}

// ─── In-Memory Policy Store Implementation ──────────────────────────────────

export class InMemoryPolicyStore implements PolicyStore {
  private policies: Map<string, PolicyConfig> = new Map();
  private auditLog: Array<{
    action: string;
    policyId: string;
    timestamp: string;
    details: string;
    userId?: string;
  }> = [];

  constructor() {
    // Seed with default policies
    this.policies.set(DEFAULT_VERIFICATION_POLICY.policyId, DEFAULT_VERIFICATION_POLICY);
    this.policies.set(HIGH_TRUST_VERIFICATION_POLICY.policyId, HIGH_TRUST_VERIFICATION_POLICY);
    this.policies.set(LOW_FRICTION_VERIFICATION_POLICY.policyId, LOW_FRICTION_VERIFICATION_POLICY);
  }

  getPolicy(policyId: string): PolicyConfig | undefined {
    return this.policies.get(policyId);
  }

  listPolicies(): PolicyConfig[] {
    return Array.from(this.policies.values()).filter((p) => p.active);
  }

  listPoliciesByType(type: PolicyType): PolicyConfig[] {
    return this.listPolicies().filter((p) => p.type === type);
  }

  createPolicy(policy: PolicyConfig): void {
    this.policies.set(policy.policyId, policy);
    this.auditLog.push({
      action: 'CREATE',
      policyId: policy.policyId,
      timestamp: new Date().toISOString(),
      details: `Created ${policy.type} policy v${policy.version}: ${policy.name}`,
    });
  }

  updatePolicy(policyId: string, updates: Partial<PolicyConfig>): PolicyConfig | undefined {
    const existing = this.policies.get(policyId);
    if (!existing) return undefined;
    const updated: PolicyConfig = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.policies.set(policyId, updated);
    this.auditLog.push({
      action: 'UPDATE',
      policyId,
      timestamp: new Date().toISOString(),
      details: `Updated fields: ${Object.keys(updates).join(', ')}`,
    });
    return updated;
  }

  deprecatePolicy(policyId: string): boolean {
    const existing = this.policies.get(policyId);
    if (!existing) return false;
    existing.active = false;
    existing.deprecatedAt = new Date().toISOString();
    this.auditLog.push({
      action: 'DEPRECATE',
      policyId,
      timestamp: new Date().toISOString(),
      details: 'Policy deprecated',
    });
    return true;
  }

  deletePolicy(policyId: string): boolean {
    const existing = this.policies.get(policyId);
    if (!existing) return false;
    this.policies.delete(policyId);
    this.auditLog.push({
      action: 'DELETE',
      policyId,
      timestamp: new Date().toISOString(),
      details: 'Policy deleted',
    });
    return true;
  }

  getAuditLog(policyId?: string): Array<{
    action: string;
    policyId: string;
    timestamp: string;
    details: string;
    userId?: string;
  }> {
    const log = [...this.auditLog];
    return policyId ? log.filter((entry) => entry.policyId === policyId) : log;
  }
}

// ─── Policy Evaluation ──────────────────────────────────────────────────────

export interface PolicyEvaluationInput {
  evidenceTypes: string[];
  evidenceCounts: Record<string, number>;
  sessionDurationMs: number;
  fraudScore: number;
  fraudVectorScores: Record<string, number>;
}

export interface PolicyEvaluationResult {
  passed: boolean;
  outcome: 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'REVIEW';
  confidence: number;
  reasons: string[];
  failures: string[];
  warnings: string[];
  evidenceGaps: string[];
}

export function evaluatePolicy(
  policy: PolicyConfig,
  input: PolicyEvaluationInput
): PolicyEvaluationResult {
  const reasons: string[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];
  const evidenceGaps: string[] = [];

  let weightedScore = 0;
  let totalWeight = 0;

  // Check evidence requirements
  for (const req of policy.evidenceRequirements) {
    const count = input.evidenceCounts[req.type] ?? 0;
    if (req.required && count < req.minCount) {
      evidenceGaps.push(`Missing required ${req.type}: ${count}/${req.minCount}`);
      failures.push(`Required evidence ${req.type} not met (need ${req.minCount}, have ${count})`);
    } else if (count > 0) {
      weightedScore += req.weight * Math.min(count / Math.max(req.minCount, 1), 1.5);
      totalWeight += req.weight;
      reasons.push(`${req.type} satisfied (${count} items)`);
    }
  }

  // Calculate base confidence from evidence
  const evidenceConfidence = totalWeight > 0 ? weightedScore / totalWeight : 0;

  // Check fraud limits
  if (input.fraudScore >= policy.fraudLimits.blockThreshold) {
    failures.push(
      `Fraud score exceeds block threshold: ${input.fraudScore} >= ${policy.fraudLimits.blockThreshold}`
    );
  } else if (input.fraudScore >= policy.fraudLimits.reviewThreshold) {
    warnings.push(
      `Fraud score in review range: ${input.fraudScore} >= ${policy.fraudLimits.reviewThreshold}`
    );
  } else {
    reasons.push(`Fraud score acceptable: ${input.fraudScore} < ${policy.fraudLimits.reviewThreshold}`);
  }

  // Check session constraints
  if (input.sessionDurationMs < policy.sessionConstraints.minDurationMs) {
    failures.push(
      `Session too short: ${input.sessionDurationMs}ms < ${policy.sessionConstraints.minDurationMs}ms`
    );
  }
  if (
    policy.sessionConstraints.maxDurationMs &&
    input.sessionDurationMs > policy.sessionConstraints.maxDurationMs
  ) {
    warnings.push(
      `Session exceeds max duration: ${input.sessionDurationMs}ms > ${policy.sessionConstraints.maxDurationMs}ms`
    );
  }

  // Determine outcome
  const confidence = Math.max(0, Math.min(1, evidenceConfidence * (1 - input.fraudScore * 0.5)));

  let outcome: PolicyEvaluationResult['outcome'] = 'FAIL';
  if (failures.length === 0) {
    if (confidence >= policy.confidenceThresholds.pass) {
      outcome = 'PASS';
    } else if (confidence >= policy.confidenceThresholds.inconclusive.min) {
      outcome = policy.confidenceThresholds.manualReviewEnabled ? 'INCONCLUSIVE' : 'FAIL';
    } else {
      outcome = 'FAIL';
    }
  } else if (
    policy.confidenceThresholds.manualReviewEnabled &&
    failures.some((f) => f.includes('Fraud score in review'))
  ) {
    outcome = 'REVIEW';
  }

  return {
    passed: outcome === 'PASS',
    outcome,
    confidence,
    reasons,
    failures,
    warnings,
    evidenceGaps,
  };
}