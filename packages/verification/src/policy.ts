/**
 * Policy Engine (VAE Section 10)
 *
 * JSON policy config with:
 * - Required evidence types
 * - Confidence thresholds (pass/fail)
 * - Fraud thresholds
 * - Session constraints
 * - Versioned policies with audit log
 */

import { z } from 'zod';

// ─── Policy Schema ───────────────────────────────────────────────────────

export const PolicyConfigSchema = z.object({
  policyId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.number().int().nonnegative().default(1),
  // Required evidence types that must be present
  requiredEvidenceTypes: z.array(z.string()).default(['E-INTERACTION', 'E-VISIBLE']),
  // Confidence thresholds
  passThreshold: z.number().min(0).max(1).default(0.75),
  failThreshold: z.number().min(0).max(1).default(0.3),
  // Minimum evidence count required
  minEvidenceCount: z.number().int().nonnegative().default(3),
  // Fraud detection thresholds
  fraudScoreThreshold: z.number().min(0).max(1).default(0.7),
  // Session constraints
  maxSessionDurationMs: z.number().int().positive().optional(),
  minSessionDurationMs: z.number().int().nonnegative().default(30000),
  // Multiplier for contradiction penalty in confidence
  contradictionMultiplier: z.number().min(0).max(2).default(1.0),
  // Multiplier for fraud penalty in confidence
  fraudMultiplier: z.number().min(0).max(2).default(2.0),
  // Whether to allow manual review for inconclusive outcomes
  allowManualReview: z.boolean().default(true),
  // Metadata
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  deprecatedAt: z.string().datetime().optional(),
  createdBy: z.string().optional(),
  active: z.boolean().default(true),
});

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

// ─── Default Policy ──────────────────────────────────────────────────────

export const DEFAULT_POLICY: PolicyConfig = {
  policyId: 'default-v1',
  name: 'Default Verification Policy',
  description: 'Standard verification policy for general content attention',
  version: 1,
  requiredEvidenceTypes: ['E-INTERACTION', 'E-VISIBLE'],
  passThreshold: 0.75,
  failThreshold: 0.3,
  minEvidenceCount: 3,
  fraudScoreThreshold: 0.7,
  maxSessionDurationMs: 7_200_000, // 2 hours
  minSessionDurationMs: 30_000, // 30 seconds
  contradictionMultiplier: 1.0,
  fraudMultiplier: 2.0,
  allowManualReview: true,
  active: true,
};

/**
 * High-trust policy for verified/sensitive content
 */
export const HIGH_TRUST_POLICY: PolicyConfig = {
  ...DEFAULT_POLICY,
  policyId: 'high-trust-v1',
  name: 'High Trust Verification Policy',
  description: 'Strict verification for high-value or sensitive content',
  version: 1,
  requiredEvidenceTypes: ['E-INTERACTION', 'E-VISIBLE', 'E-DURATION', 'E-CONTEXT'],
  passThreshold: 0.9,
  failThreshold: 0.2,
  minEvidenceCount: 10,
  fraudScoreThreshold: 0.5,
  contradictionMultiplier: 1.5,
  fraudMultiplier: 3.0,
};

/**
 * Low-friction policy for low-risk content / exploratory sessions
 */
export const LOW_FRICTION_POLICY: PolicyConfig = {
  ...DEFAULT_POLICY,
  policyId: 'low-friction-v1',
  name: 'Low Friction Policy',
  description: 'Reduced evidence requirements for low-risk content',
  version: 1,
  requiredEvidenceTypes: ['E-VISIBLE'],
  passThreshold: 0.5,
  failThreshold: 0.15,
  minEvidenceCount: 1,
  fraudScoreThreshold: 0.85,
  contradictionMultiplier: 0.5,
  fraudMultiplier: 1.0,
};

// ─── Policy Store ─────────────────────────────────────────────────────────

export interface PolicyStore {
  getPolicy(policyId: string): PolicyConfig | undefined;
  listPolicies(): PolicyConfig[];
  listPoliciesByType(type: string): PolicyConfig[];
  createPolicy(policy: PolicyConfig): void;
  updatePolicy(policyId: string, updates: Partial<PolicyConfig>): PolicyConfig | undefined;
  deprecatePolicy(policyId: string): boolean;
  deletePolicy(policyId: string): boolean;
}

/**
 * In-memory policy store (default implementation)
 */
export class InMemoryPolicyStore implements PolicyStore {
  private policies: Map<string, PolicyConfig> = new Map();
  private auditLog: Array<{ action: string; policyId: string; timestamp: string; details: string }> = [];

  constructor() {
    // Seed with default policies
    this.policies.set(DEFAULT_POLICY.policyId, DEFAULT_POLICY);
    this.policies.set(HIGH_TRUST_POLICY.policyId, HIGH_TRUST_POLICY);
    this.policies.set(LOW_FRICTION_POLICY.policyId, LOW_FRICTION_POLICY);
  }

  getPolicy(policyId: string): PolicyConfig | undefined {
    return this.policies.get(policyId);
  }

  listPolicies(): PolicyConfig[] {
    return Array.from(this.policies.values());
  }

  listPoliciesByType(type: string): PolicyConfig[] {
    return Array.from(this.policies.values()).filter((p) => p.policyId.includes(type) || type === 'VERIFICATION');
  }

  createPolicy(policy: PolicyConfig): void {
    this.policies.set(policy.policyId, policy);
    this.auditLog.push({
      action: 'CREATE',
      policyId: policy.policyId,
      timestamp: new Date().toISOString(),
      details: `Created policy v${policy.version}`,
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
    return this.policies.delete(policyId);
  }

  getAuditLog(): Array<{ action: string; policyId: string; timestamp: string; details: string }> {
    return [...this.auditLog];
  }
}

// ─── Policy Engine ────────────────────────────────────────────────────────

export interface PolicyEvaluationInput {
  evidenceTypes: string[];
  evidenceCount: number;
  sessionDurationMs: number;
  fraudScore: number;
}

export interface PolicyEvaluationResult {
  passed: boolean;
  reasons: string[];
  failures: string[];
  warnings: string[];
}

/**
 * Evaluate a policy against input data
 */
export function evaluatePolicy(
  policy: PolicyConfig,
  input: PolicyEvaluationInput,
  options?: { checkDuration?: boolean }
): PolicyEvaluationResult {
  const reasons: string[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];

  // Check required evidence types
  const missingTypes = policy.requiredEvidenceTypes.filter(
    (t) => !input.evidenceTypes.includes(t)
  );
  if (missingTypes.length > 0) {
    failures.push(`Missing required evidence types: ${missingTypes.join(', ')}`);
  } else {
    reasons.push('All required evidence types present');
  }

  // Check minimum evidence count
  if (input.evidenceCount < policy.minEvidenceCount) {
    failures.push(
      `Insufficient evidence count: ${input.evidenceCount} < ${policy.minEvidenceCount}`
    );
  } else {
    reasons.push(`Evidence count sufficient: ${input.evidenceCount} >= ${policy.minEvidenceCount}`);
  }

  // Check session duration
  if (options?.checkDuration !== false) {
    if (policy.minSessionDurationMs && input.sessionDurationMs < policy.minSessionDurationMs) {
      failures.push(
        `Session duration too short: ${input.sessionDurationMs}ms < ${policy.minSessionDurationMs}ms`
      );
    } else if (policy.maxSessionDurationMs && input.sessionDurationMs > policy.maxSessionDurationMs) {
      warnings.push(
        `Session duration exceeds max: ${input.sessionDurationMs}ms > ${policy.maxSessionDurationMs}ms`
      );
    } else {
      reasons.push('Session duration within policy limits');
    }
  }

  // Check fraud score
  if (input.fraudScore >= policy.fraudScoreThreshold) {
    failures.push(
      `Fraud score exceeds threshold: ${input.fraudScore} >= ${policy.fraudScoreThreshold}`
    );
  } else {
    reasons.push(`Fraud score within threshold: ${input.fraudScore} < ${policy.fraudScoreThreshold}`);
  }

  return {
    passed: failures.length === 0,
    reasons,
    failures,
    warnings,
  };
}