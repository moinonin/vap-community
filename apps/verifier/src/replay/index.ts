/**
 * Verification Replay (VAE Sprint 10)
 *
 * Re-runs verification decisions on the same evidence with new/updated policies.
 * Used for audit, policy migration, and what-if analysis.
 */

import { z } from 'zod';
import type { ExtendedPolicyConfig, ExtendedPolicyEvaluationInput, ExtendedPolicyEvaluationResult } from '@verified-attention/verification';
import { evaluateExtendedPolicy } from '@verified-attention/verification';
import type { AuditEntry } from '@verified-attention/store-verification-audit';
import { getAuditLog } from '@verified-attention/store-verification-audit';

// ─── Replay Types ────────────────────────────────────────────────────────────

export const ReplayRequestSchema = z.object({
  sessionId: z.string().min(1),
  originalPolicyId: z.string().min(1),
  newPolicyId: z.string().min(1),
  useOriginalInput: z.boolean().default(true),
  // Optional: provide new input to override — must match PolicyEvaluationInput
  newInput: z
    .object({
      evidenceTypes: z.array(z.string()),
      evidenceCount: z.number().int().nonnegative(),
      sessionDurationMs: z.number().int().nonnegative(),
      fraudScore: z.number().min(0).max(1),
    })
    .optional(),
});

export type ReplayRequest = z.infer<typeof ReplayRequestSchema>;

export const ReplayResultSchema = z.object({
  replayId: z.string().min(1),
  sessionId: z.string().min(1),
  originalPolicyId: z.string().min(1),
  newPolicyId: z.string().min(1),
  originalOutcome: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE', 'REVIEW', 'ERROR']),
  newOutcome: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE', 'REVIEW', 'ERROR']),
  originalConfidence: z.number().min(0).max(1),
  newConfidence: z.number().min(0).max(1),
  outcomeChanged: z.boolean(),
  confidenceDelta: z.number(),
  originalEvaluation: z.object({
    passed: z.boolean(),
    outcome: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE', 'REVIEW']),
    confidence: z.number(),
    reasons: z.array(z.string()),
    failures: z.array(z.string()),
    warnings: z.array(z.string()),
    evidenceGaps: z.array(z.string()),
  }),
  newEvaluation: z.object({
    passed: z.boolean(),
    outcome: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE', 'REVIEW']),
    confidence: z.number(),
    reasons: z.array(z.string()),
    failures: z.array(z.string()),
    warnings: z.array(z.string()),
    evidenceGaps: z.array(z.string()),
  }),
  timestamp: z.string().datetime(),
});

export type ReplayResult = z.infer<typeof ReplayResultSchema>;

export type ReplayService = {
  replay(request: ReplayRequest): ReplayResult;
  replayBatch(requests: ReplayRequest[]): ReplayResult[];
  getReplayHistory(sessionId: string): ReplayResult[];
};

// ─── In-Memory Replay Service ────────────────────────────────────────────────

export class InMemoryReplayService implements ReplayService {
  private policyStore: Map<string, ExtendedPolicyConfig> = new Map();
  private auditLog = getAuditLog();
  private replayHistory: Map<string, ReplayResult[]> = new Map();
  private replayCounter = 0;

  constructor() {
    // In production, this would load from a persistent policy store
  }

  setPolicyStore(policies: Map<string, ExtendedPolicyConfig>): void {
    this.policyStore = new Map(policies);
  }

  addPolicy(policy: ExtendedPolicyConfig): void {
    this.policyStore.set(policy.policyId, policy);
  }

  replay(request: ReplayRequest): ReplayResult {
    const originalPolicy = this.policyStore.get(request.originalPolicyId) as unknown as ExtendedPolicyConfig | undefined;
    const newPolicy = this.policyStore.get(request.newPolicyId) as unknown as ExtendedPolicyConfig | undefined;

    if (!originalPolicy) {
      throw new Error(`Original policy not found: ${request.originalPolicyId}`);
    }
    if (!newPolicy) {
      throw new Error(`New policy not found: ${request.newPolicyId}`);
    }

    // Get original input from audit log if using original input
    let input: ExtendedPolicyEvaluationInput;
    if (request.useOriginalInput && !request.newInput) {
      const auditEntries = this.auditLog.query({ sessionId: request.sessionId });
      const originalEntry = auditEntries.find(
        (e) => e.policyId === request.originalPolicyId
      );

      if (!originalEntry || !originalEntry.inputSnapshot) {
        throw new Error(
          `Original audit entry not found for session ${request.sessionId} with policy ${request.originalPolicyId}`
        );
      }

      input = originalEntry.inputSnapshot as unknown as ExtendedPolicyEvaluationInput;
    } else if (request.newInput) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input = {
        evidenceTypes: request.newInput.evidenceTypes,
        evidenceCount: request.newInput.evidenceCount,
        sessionDurationMs: request.newInput.sessionDurationMs,
        fraudScore: request.newInput.fraudScore,
        fraudVectorScores: {},
      } as any;
    } else {
      throw new Error('Either useOriginalInput must be true or newInput must be provided');
    }

    // Run evaluations (uses ExtendedPolicyEvaluationResult which has outcome/confidence)
    const originalResult = evaluateExtendedPolicy(originalPolicy as unknown as ExtendedPolicyConfig, input);
    const newResult = evaluateExtendedPolicy(newPolicy as unknown as ExtendedPolicyConfig, input);

    const replayId = `replay_${Date.now()}_${++this.replayCounter}`;
    const timestamp = new Date().toISOString();

    const result: ReplayResult = {
      replayId,
      sessionId: request.sessionId,
      originalPolicyId: request.originalPolicyId,
      newPolicyId: request.newPolicyId,
      originalOutcome: originalResult.outcome,
      newOutcome: newResult.outcome,
      originalConfidence: originalResult.confidence,
      newConfidence: newResult.confidence,
      outcomeChanged: originalResult.outcome !== newResult.outcome,
      confidenceDelta: newResult.confidence - originalResult.confidence,
      originalEvaluation: {
        passed: originalResult.passed,
        outcome: originalResult.outcome,
        confidence: originalResult.confidence,
        reasons: originalResult.reasons,
        failures: originalResult.failures,
        warnings: originalResult.warnings,
        evidenceGaps: originalResult.evidenceGaps,
      },
      newEvaluation: {
        passed: newResult.passed,
        outcome: newResult.outcome,
        confidence: newResult.confidence,
        reasons: newResult.reasons,
        failures: newResult.failures,
        warnings: newResult.warnings,
        evidenceGaps: newResult.evidenceGaps,
      },
      timestamp,
    };

    // Store in history
    const history = this.replayHistory.get(request.sessionId) || [];
    history.push(result);
    this.replayHistory.set(request.sessionId, history);

    return result;
  }

  replayBatch(requests: ReplayRequest[]): ReplayResult[] {
    return requests.map((req) => this.replay(req));
  }

  getReplayHistory(sessionId: string): ReplayResult[] {
    return this.replayHistory.get(sessionId) || [];
  }
}

// ─── Replay Service Factory ──────────────────────────────────────────────────

export class ReplayServiceFactory {
  static getInstance(): ReplayService {
    if (!_replayService) {
      _replayService = new InMemoryReplayService();
    }
    return _replayService;
  }

  static setInstance(service: ReplayService): void {
    _replayService = service;
  }
}

let _replayService: ReplayService | null = null;

export function getReplayService(): ReplayService {
  return ReplayServiceFactory.getInstance();
}

export function setReplayService(service: ReplayService): void {
  ReplayServiceFactory.setInstance(service);
}

// ─── Convenience Function ────────────────────────────────────────────────────

/**
 * Replay a verification decision with a new policy.
 * This is the main entry point used by external callers.
 */
export function replayVerification(
  sessionId: string,
  originalPolicyId: string,
  newPolicyId: string,
  options?: { newInput?: ExtendedPolicyEvaluationInput }
): ReplayResult {
  const service = getReplayService();

  // If we have a policy store, use it
  if (service instanceof InMemoryReplayService) {
    // Add policies from the verification module if not already present
  }

  return service.replay({
    sessionId,
    originalPolicyId,
    newPolicyId,
    useOriginalInput: !options?.newInput,
    newInput: options?.newInput !== undefined
      ? {
          evidenceTypes: options.newInput.evidenceTypes,
          evidenceCount: options.newInput.evidenceTypes.length,
          sessionDurationMs: options.newInput.sessionDurationMs,
          fraudScore: options.newInput.fraudScore,
        }
      : undefined,
  });
}