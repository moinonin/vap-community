/**
 * Verification Engine Conformance Tests (VAP Section 9)
 * Tests the verification engine lifecycle: evidence -> claims -> confidence -> decision
 */

import { describe, it, expect } from 'vitest';
import {
  VerificationEngine,
  createVerificationEngine,
  VerificationInputSchema,
  VerificationResultSchema,
} from '@verified-attention/verification';
import {
  VerificationOutcome,
  EvidenceSchema,
  EvidenceType,
  type Evidence,
} from '@verified-attention/core';

// ─── Test Fixtures ────────────────────────────────────────────────────────

const VALID_SESSION = {
  sessionId: 'urn:vap:session:550e8400-e29b-41d4-a716-446655440000',
  contentId: 'urn:vap:content:article-12345',
  viewerIdHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  // Use millisecond-precision ISO timestamps so Date.getTime() duration math is exact
  // (microsecond/fractional-second precision is silently truncated by Date, causing drift).
  startedAt: '2024-01-15T10:30:00.000Z',
  endedAt: '2024-01-15T10:35:00.000Z',
};

const VALID_EVIDENCE: Evidence[] = [
  {
    evidenceId: 'urn:vap:evidence:11111111-1111-1111-1111-111111111111',
    sessionId: VALID_SESSION.sessionId,
    sourceId: 'urn:vap:source:browser-extension-v1',
    timestamp: '2024-01-15T10:30:05.000Z',
    evidenceType: 'E-VISIBLE',
    confidence: 0.9,
    payload: {
      visibleDurationMs: 120000,
      maxVisibilityRatio: 0.95,
      avgVisibilityRatio: 0.85,
    },
    provenance: {
      observationIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
      observationHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
      sourceId: 'urn:vap:source:browser-extension-v1',
    },
    signature: 'sig123',
  },
  {
    evidenceId: 'urn:vap:evidence:22222222-2222-2222-2222-222222222222',
    sessionId: VALID_SESSION.sessionId,
    sourceId: 'urn:vap:source:browser-extension-v1',
    timestamp: '2024-01-15T10:31:00.000Z',
    evidenceType: 'E-INTERACTION',
    confidence: 0.85,
    payload: {
      avgScrollVelocity: 150,
      scrollDirectionChanges: 3,
      clickCount: 2,
      keyPressCount: 0,
      interactionDurationMs: 60000,
    },
    provenance: {
      observationIds: ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
      observationHash: 'def456abc123def456abc123def456abc123def456abc123def456abc123def0',
      sourceId: 'urn:vap:source:browser-extension-v1',
    },
    signature: 'sig456',
  },
  {
    evidenceId: 'urn:vap:evidence:33333333-3333-3333-3333-333333333333',
    sessionId: VALID_SESSION.sessionId,
    sourceId: 'urn:vap:source:browser-extension-v1',
    timestamp: '2024-01-15T10:32:00.000Z',
    evidenceType: 'E-DURATION',
    confidence: 0.8,
    payload: {
      sessionStartTime: 1705312200000,
      sessionEndTime: 1705312500000,
      activeDurationMs: 240000,
      idleDurationMs: 60000,
      heartbeatCount: 4,
    },
    provenance: {
      observationIds: ['cccccccc-cccc-cccc-cccc-cccccccccccc'],
      observationHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abce',
      sourceId: 'urn:vap:source:browser-extension-v1',
    },
    signature: 'sig789',
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────

describe('VerificationEngine', () => {
  const engine = createVerificationEngine();

  describe('Schema Validation', () => {
    it('should validate complete verification input', () => {
      const input = {
        session: VALID_SESSION,
        evidence: VALID_EVIDENCE,
      };
      const result = VerificationInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate complete verification result', () => {
      const result = {
        sessionId: VALID_SESSION.sessionId,
        outcome: VerificationOutcome.PASS,
        confidence: {
          confidence: 0.85,
          rawConfidence: 0.88,
          calibratedConfidence: 0.85,
          qualityScore: 0.88,
          completenessScore: 1.0,
          reliabilityScore: 0.88,
          components: {
            qualityWeight: 0.35,
            completenessWeight: 0.25,
            countWeight: 0.15,
            reliabilityWeight: 0.25,
            contradictionPenalty: 0,
            fraudPenalty: 0,
          },
        },
        policyEvaluation: {
          passed: true,
          reasons: ['All required evidence types present'],
          failures: [],
          warnings: [],
        },
        verifiedAt: '2024-01-15T10:35:00.000Z',
        policyId: 'default-v1',
        evidenceCount: 3,
        sessionDurationMs: 300000,
      };
      const parseResult = VerificationResultSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('verify() - Core Verification Logic', () => {
    it('should return PASS for sufficient high-quality evidence', async () => {
      const result = await engine.verify({
        session: VALID_SESSION,
        evidence: VALID_EVIDENCE,
      });

      expect(result.sessionId).toBe(VALID_SESSION.sessionId);
      expect(result.outcome).toBe(VerificationOutcome.PASS);
      expect(result.confidence.confidence).toBeGreaterThan(0.5);
      expect(result.evidenceCount).toBe(3);
      expect(result.sessionDurationMs).toBeGreaterThan(0);
      expect(result.policyId).toBe('default-v1');
      expect(result.verifiedAt).toBeDefined();
    });

    it('should return INSUFFICIENT when evidence is insufficient and session is closed', async () => {
      // VAP §9: insufficient evidence with canReceiveMoreEvidence=false is the terminal
      // INSUFFICIENT outcome (NOT FAIL — FAIL is reserved for fraud or confidence < failThreshold).
      const result = await engine.verify({
        session: VALID_SESSION,
        evidence: [VALID_EVIDENCE[0]], // Only 1 piece of evidence, need 3
        canReceiveMoreEvidence: false,
      });

      expect(result.outcome).toBe(VerificationOutcome.INSUFFICIENT);
      expect(result.policyEvaluation.passed).toBe(false);
    });

    it('should return PENDING when required evidence types are missing but more evidence can arrive', async () => {
      // Only E-VISIBLE, missing E-INTERACTION and E-DURATION
      const partialEvidence = VALID_EVIDENCE.filter(e => e.evidenceType === 'E-VISIBLE');

      const result = await engine.verify({
        session: VALID_SESSION,
        evidence: partialEvidence,
      });

      // When required evidence types are missing but more evidence can be received, outcome is PENDING
      expect(result.outcome).toBe(VerificationOutcome.PENDING);
      expect(result.policyEvaluation.failures.some(f => f.includes('Missing required evidence types'))).toBe(true);
    });

    it('should handle custom policy', async () => {
      const customPolicy = {
        policyId: 'custom-test',
        name: 'Custom Test Policy',
        requiredEvidenceTypes: ['E-VISIBLE'],
        passThreshold: 0.5,
        failThreshold: 0.2,
        minEvidenceCount: 1,
        fraudScoreThreshold: 0.9,
        contradictionMultiplier: 1.0,
        fraudMultiplier: 2.0,
        allowManualReview: true,
        active: true,
      };

      const result = await engine.verify({
        session: VALID_SESSION,
        evidence: [VALID_EVIDENCE[0]], // Only E-VISIBLE
        policy: customPolicy,
      });

      // With custom policy, E-VISIBLE alone should PASS
      expect(result.policyId).toBe('custom-test');
      expect(result.outcome).toBe(VerificationOutcome.PASS);
    });

    it('should handle canReceiveMoreEvidence = true with insufficient evidence', async () => {
      const result = await engine.verify({
        session: VALID_SESSION,
        evidence: [VALID_EVIDENCE[0]], // Only 1 piece
        canReceiveMoreEvidence: true,
      });

      // With canReceiveMoreEvidence = true and low evidence count, should be PENDING
      expect(result.outcome).toBe(VerificationOutcome.PENDING);
    });

    it('should return INSUFFICIENT when canReceiveMoreEvidence = false', async () => {
      const result = await engine.verify({
        session: VALID_SESSION,
        evidence: [VALID_EVIDENCE[0]],
        canReceiveMoreEvidence: false,
      });

      expect(result.outcome).toBe(VerificationOutcome.INSUFFICIENT);
    });
  });

  describe('Confidence Calculation', () => {
    it('should produce deterministic confidence for same input', async () => {
      const input = {
        session: VALID_SESSION,
        evidence: VALID_EVIDENCE,
      };

      const result1 = await engine.verify(input);
      const result2 = await engine.verify(input);

      expect(result1.confidence.confidence).toBe(result2.confidence.confidence);
      expect(result1.confidence.rawConfidence).toBe(result2.confidence.rawConfidence);
    });

    it('should include confidence breakdown in result', async () => {
      const result = await engine.verify({
        session: VALID_SESSION,
        evidence: VALID_EVIDENCE,
      });

      expect(result.confidence.rawConfidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence.rawConfidence).toBeLessThanOrEqual(1);
      expect(result.confidence.calibratedConfidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.confidence.completenessScore).toBe(1.0); // All required types present
      expect(result.confidence.reliabilityScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Policy Evaluation', () => {
    it('should include policy evaluation details in result', async () => {
      const result = await engine.verify({
        session: VALID_SESSION,
        evidence: VALID_EVIDENCE,
      });

      expect(result.policyEvaluation).toBeDefined();
      expect(typeof result.policyEvaluation.passed).toBe('boolean');
      expect(Array.isArray(result.policyEvaluation.reasons)).toBe(true);
      expect(Array.isArray(result.policyEvaluation.failures)).toBe(true);
      expect(Array.isArray(result.policyEvaluation.warnings)).toBe(true);
    });

    it('should pass policy with default policy and sufficient evidence', async () => {
      const result = await engine.verify({
        session: VALID_SESSION,
        evidence: VALID_EVIDENCE,
      });

      expect(result.policyEvaluation.passed).toBe(true);
      expect(result.policyEvaluation.failures.length).toBe(0);
    });
  });

  describe('verifyStreaming()', () => {
    it('should delegate to verify()', async () => {
      const result = await engine.verifyStreaming(
        VALID_SESSION,
        VALID_EVIDENCE,
        { canReceiveMoreEvidence: true }
      );

      expect(result.sessionId).toBe(VALID_SESSION.sessionId);
      expect(result.outcome).toBe(VerificationOutcome.PASS);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty evidence array', async () => {
      const result = await engine.verify({
        session: VALID_SESSION,
        evidence: [],
      });

      expect(result.outcome).toBe(VerificationOutcome.FAIL);
      expect(result.evidenceCount).toBe(0);
    });

    it('should calculate session duration correctly', async () => {
      // Valid_SESSION.startedAt is 10:30:00.000Z; end at 10:40:00.000Z → exactly 600000ms.
      const sessionWithEnd = { ...VALID_SESSION, endedAt: '2024-01-15T10:40:00.000Z' };
      const result = await engine.verify({
        session: sessionWithEnd,
        evidence: VALID_EVIDENCE,
      });

      // 10 minutes = 600000ms
      expect(result.sessionDurationMs).toBe(600000);
    });

    it('should use current time when endedAt not provided', async () => {
      const sessionNoEnd = { ...VALID_SESSION, endedAt: undefined };
      const result = await engine.verify({
        session: sessionNoEnd,
        evidence: VALID_EVIDENCE,
      });

      expect(result.sessionDurationMs).toBeGreaterThan(0);
    });
  });
});

// ─── Determinism Test ────────────────────────────────────────────────────

describe('Verification Determinism', () => {
  it('should produce identical results for identical inputs', async () => {
    const engine = createVerificationEngine();
    const input = {
      session: VALID_SESSION,
      evidence: VALID_EVIDENCE,
    };

    const results = await Promise.all([
      engine.verify(input),
      engine.verify(input),
      engine.verify(input),
    ]);

    const first = results[0];
    for (const result of results.slice(1)) {
      expect(result.outcome).toBe(first.outcome);
      expect(result.confidence.confidence).toBe(first.confidence.confidence);
      expect(result.confidence.rawConfidence).toBe(first.confidence.rawConfidence);
      expect(result.confidence.calibratedConfidence).toBe(first.confidence.calibratedConfidence);
      expect(result.policyEvaluation.passed).toBe(first.policyEvaluation.passed);
    }
  });
});