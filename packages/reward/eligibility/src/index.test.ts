import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getEligibilityEngine, type EligibilityEngine } from './index';
import type { EligibilityInput, EligibilityCriteria, EligibilityResult } from './index';

vi.mock('crypto', () => ({ randomUUID: () => 'test-uuid' }));

describe('Eligibility Engine', () => {
  let engine: EligibilityEngine;

  beforeEach(() => {
    vi.resetModules();
    engine = getEligibilityEngine();
  });

  const defaultCriteria: EligibilityCriteria = {
    allowedOutcomes: ['PASS'],
    minConfidence: 0.5,
    allowedProofStates: ['PUBLISHED'],
    checkDeduplication: true,
  };

  const mockProof = {
    proofId: 'urn:vap:proof:test-123',
    sessionId: 'urn:vap:session:test-session',
    contentId: 'urn:vap:content:test-content',
    verifierId: 'urn:vap:verifier:test-verifier',
    state: 'PUBLISHED' as const,
    confidence: 0.85,
    outcome: 'PASS' as const,
    issuedAt: new Date().toISOString(),
    expiresAt: undefined,
    revokedAt: undefined,
  };

  const mockPolicy = {
    policyId: 'policy-1',
    requiredEvidenceTypes: ['INTERACTION'],
    passThreshold: 0.7,
    failThreshold: 0.3,
    minEvidenceCount: 1,
  };

  const defaultDedupContext = {
    sessionId: mockProof.sessionId,
    contentId: mockProof.contentId,
    verifierId: mockProof.verifierId,
  };

  it('should return eligible for valid proof with default criteria', async () => {
    const result = await engine.evaluate({
      proof: mockProof,
      policy: mockPolicy,
      criteria: { ...defaultCriteria },
      deduplicationContext: defaultDedupContext,
    });

    expect(result.eligible).toBe(true);
    expect(result.checks.policyMatch).toBe(true);
    expect(result.checks.proofValid).toBe(true);
    expect(result.checks.proofState).toBe(true);
    expect(result.checks.confidenceMet).toBe(true);
    expect(result.checks.notDuplicate).toBe(true);
    expect(result.checks.notExpired).toBe(true);
    expect(result.checks.notRevoked).toBe(true);
  });

  it('should reject proof with insufficient confidence', async () => {
    const lowConfidenceProof = { ...mockProof, confidence: 0.3 };
    const result = await engine.evaluate({
      proof: lowConfidenceProof,
      policy: mockPolicy,
      criteria: { ...defaultCriteria, minConfidence: 0.5 },
      deduplicationContext: { sessionId: mockProof.sessionId, contentId: mockProof.contentId, verifierId: mockProof.verifierId },
    });

    expect(result.eligible).toBe(false);
    expect(result.checks.confidenceMet).toBe(false);
    expect(result.failureReasons).toContain('Confidence 0.3 below threshold 0.5');
  });

  it('should reject revoked proof', async () => {
    const revokedProof = { ...mockProof, state: 'REVOKED' as const, revokedAt: new Date().toISOString() };
    const result = await engine.evaluate({
      proof: revokedProof,
      policy: mockPolicy,
      criteria: { ...defaultCriteria },
      deduplicationContext: { sessionId: mockProof.sessionId, contentId: mockProof.contentId, verifierId: mockProof.verifierId },
    });

    expect(result.eligible).toBe(false);
    expect(result.checks.notRevoked).toBe(false);
    expect(result.failureReasons).toContain('Proof has been revoked');
  });

  it('should reject expired proof', async () => {
    const expiredProof = { ...mockProof, expiresAt: new Date(Date.now() - 86400000).toISOString() };
    const result = await engine.evaluate({
      proof: expiredProof,
      policy: mockPolicy,
      criteria: { ...defaultCriteria },
      deduplicationContext: { sessionId: mockProof.sessionId, contentId: mockProof.contentId, verifierId: mockProof.verifierId },
    });

    expect(result.eligible).toBe(false);
    expect(result.checks.notExpired).toBe(false);
    expect(result.failureReasons).toContain('Proof has expired');
  });

  it('should reject non-matching outcome', async () => {
    const failProof = { ...mockProof, outcome: 'FAIL' as const };
    const result = await engine.evaluate({
      proof: failProof,
      policy: mockPolicy,
      criteria: { ...defaultCriteria, allowedOutcomes: ['PASS'] },
      deduplicationContext: { sessionId: mockProof.sessionId, contentId: mockProof.contentId, verifierId: mockProof.verifierId },
    });

    expect(result.eligible).toBe(false);
    expect(result.checks.policyMatch).toBe(false);
  });

  it('should allow FAIL outcome when configured', async () => {
    const failProof = {
      proofId: 'urn:vap:proof:fail-test-456',
      sessionId: 'urn:vap:session:fail-test',
      contentId: 'urn:vap:content:fail-test',
      verifierId: 'urn:vap:verifier:fail-test',
      state: 'PUBLISHED',
      confidence: 0.85,
      outcome: 'FAIL' as const,
      issuedAt: new Date().toISOString(),
      expiresAt: undefined,
      revokedAt: undefined,
    };
    const criteria = { ...defaultCriteria, allowedOutcomes: ['PASS', 'FAIL'] as const };
    
    const result = await engine.evaluate({
      proof: failProof,
      policy: mockPolicy,
      criteria,
      deduplicationContext: { sessionId: failProof.sessionId, contentId: failProof.contentId, verifierId: failProof.verifierId },
    });

    expect(result.eligible).toBe(true);
  });

  it('should reject duplicate reward', async () => {
    await engine.evaluate({
      proof: mockProof,
      policy: mockPolicy,
      criteria: { ...defaultCriteria, checkDeduplication: true },
      deduplicationContext: { sessionId: mockProof.sessionId, contentId: mockProof.contentId, verifierId: mockProof.verifierId },
    });

    const result = await engine.evaluate({
      proof: mockProof,
      policy: mockPolicy,
      criteria: { ...defaultCriteria, checkDeduplication: true },
      deduplicationContext: { sessionId: mockProof.sessionId, contentId: mockProof.contentId, verifierId: mockProof.verifierId },
    });

    expect(result.eligible).toBe(false);
    expect(result.checks.notDuplicate).toBe(false);
    expect(result.failureReasons).toContain('Duplicate reward for same session/content/proof');
  });

  it('should skip deduplication when disabled', async () => {
    await engine.evaluate({
      proof: mockProof,
      policy: mockPolicy,
      criteria: { ...defaultCriteria, checkDeduplication: false },
      deduplicationContext: { sessionId: mockProof.sessionId, contentId: mockProof.contentId, verifierId: mockProof.verifierId },
    });

    const result = await engine.evaluate({
      proof: mockProof,
      policy: mockPolicy,
      criteria: { ...defaultCriteria, checkDeduplication: false },
      deduplicationContext: { sessionId: mockProof.sessionId, contentId: mockProof.contentId, verifierId: mockProof.verifierId },
    });

    expect(result.eligible).toBe(true);
  });

  it('should handle batch evaluation', async () => {
    const results = await engine.evaluateBatch([
      { proof: mockProof, policy: mockPolicy, criteria: { ...defaultCriteria }, deduplicationContext: { sessionId: 's1', contentId: 'c1', verifierId: 'v1' } },
      { proof: { ...mockProof, proofId: 'urn:vap:proof:2', sessionId: 's2' }, policy: mockPolicy, criteria: { ...defaultCriteria }, deduplicationContext: { sessionId: 's2', contentId: 'c2', verifierId: 'v2' } },
    ]);

    expect(results.length).toBe(2);
    expect(results[0].eligible).toBe(true);
    expect(results[1].eligible).toBe(true);
  });

  it('should accept valid proof state', async () => {
    const signedProof = { ...mockProof, state: 'SIGNED' as const };
    const result = await engine.evaluate({
      proof: signedProof,
      policy: mockPolicy,
      criteria: { ...defaultCriteria, allowedProofStates: ['SIGNED', 'PUBLISHED'] as const },
      deduplicationContext: { sessionId: mockProof.sessionId, contentId: mockProof.contentId, verifierId: mockProof.verifierId },
    });

    expect(result.checks.proofState).toBe(true);
  });

  it('should reject invalid proof state', async () => {
    const unsignedProof = { ...mockProof, state: 'UNSIGNED' as const };
    const result = await engine.evaluate({
      proof: unsignedProof,
      policy: mockPolicy,
      criteria: { ...defaultCriteria, allowedProofStates: ['PUBLISHED'] as const },
      deduplicationContext: { sessionId: mockProof.sessionId, contentId: mockProof.contentId, verifierId: mockProof.verifierId },
    });

    expect(result.checks.proofState).toBe(false);
    expect(result.eligible).toBe(false);
  });

  it('should return correct result structure', async () => {
    const result = await engine.evaluate({
      proof: mockProof,
      policy: mockPolicy,
      criteria: { ...defaultCriteria },
      deduplicationContext: { sessionId: mockProof.sessionId, contentId: mockProof.contentId, verifierId: mockProof.verifierId },
    });

    expect(result).toHaveProperty('eligible');
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('checks');
    expect(result).toHaveProperty('failureReasons');
    expect(result).toHaveProperty('evaluatedAt');
    expect(result).toHaveProperty('eligibilityId');
    expect(typeof result.evaluatedAt).toBe('string');
    expect(typeof result.eligibilityId).toBe('string');
  });
});