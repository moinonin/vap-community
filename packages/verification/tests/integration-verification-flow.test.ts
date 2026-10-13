/**
 * Integration Test: Full Verification Flow (VAP Section 9)
 *
 * Exercises the end-to-end VAP lifecycle through the public VerificationEngine API:
 *   session -> evidence -> confidence -> policy -> decision
 *
 * This is the Stage 6 deliverable from the Sprint 5 COMMAND_RUNWAY runbook:
 * "End-to-end integration test with mock evidence" — it uses the EvidenceSchema from
 * core, the confidence/policy/outcomes modules from this package, and asserts the
 * full VerificationResult shape for each outcome (PASS, FAIL, INSUFFICIENT, PENDING).
 */

import { describe, it, expect } from 'vitest';
import {
  VerificationEngine,
  createVerificationEngine,
  DEFAULT_CONFIDENCE_CONFIG,
  type VerificationInput,
  type VerificationResult,
} from '@verified-attention/verification';
import { VerificationOutcome, type Evidence } from '@verified-attention/core';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const SESSION_OPEN = {
  sessionId: 'urn:vap:session:660e8400-e29b-41d4-a716-446655440000',
  contentId: 'urn:vap:content:article-sprint5-integration',
  viewerIdHash: 'b1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  startedAt: '2024-02-01T09:00:00.000Z', // ms precision for exact Date math
  endedAt: '2024-02-01T09:05:00.000Z',
};

const SESSION_CLOSED = { ...SESSION_OPEN, endedAt: '2024-02-01T09:05:00.000Z' };

// A complete, well-formed evidence set covering all three required default-policy types.
const COMPLETE_EVIDENCE: Evidence[] = [
  {
    evidenceId: 'urn:vap:evidence:11111111-1111-1111-1111-111111111111',
    sessionId: SESSION_OPEN.sessionId,
    sourceId: 'urn:vap:source:browser-extension-v1',
    timestamp: '2024-02-01T09:00:05.000Z',
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
    signature: 'sig-int-1',
  },
  {
    evidenceId: 'urn:vap:evidence:22222222-2222-2222-2222-222222222222',
    sessionId: SESSION_OPEN.sessionId,
    sourceId: 'urn:vap:source:browser-extension-v1',
    timestamp: '2024-02-01T09:01:00.000Z',
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
    signature: 'sig-int-2',
  },
  {
    evidenceId: 'urn:vap:evidence:33333333-3333-3333-3333-333333333333',
    sessionId: SESSION_OPEN.sessionId,
    sourceId: 'urn:vap:source:browser-extension-v1',
    timestamp: '2024-02-01T09:02:00.000Z',
    evidenceType: 'E-DURATION',
    confidence: 0.8,
    payload: {
      sessionStartTime: 1706778000000,
      sessionEndTime: 1706778300000,
      activeDurationMs: 240000,
      idleDurationMs: 60000,
      heartbeatCount: 4,
    },
    provenance: {
      observationIds: ['cccccccc-cccc-cccc-cccc-cccccccccccc'],
      observationHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abce',
      sourceId: 'urn:vap:source:browser-extension-v1',
    },
    signature: 'sig-int-3',
  },
];

const onlyVisible = (): Evidence[] =>
  COMPLETE_EVIDENCE.filter((e) => e.evidenceType === 'E-VISIBLE');

// ─── Integration Tests ─────────────────────────────────────────────────────

describe('Integration: Full Verification Flow (VAP §9)', () => {
  const engine = createVerificationEngine();

  describe('end-to-end lifecycle: session -> evidence -> verification -> decision', () => {
    it('produces a PASS decision for a complete high-quality evidence set', async () => {
      const input: VerificationInput = {
        session: SESSION_CLOSED,
        evidence: COMPLETE_EVIDENCE,
      };

      const result: VerificationResult = await engine.verify(input);

      // Full result shape is populated end-to-end
      expect(result.sessionId).toBe(SESSION_CLOSED.sessionId);
      expect(result.evidenceCount).toBe(3);
      expect(result.policyId).toBe('default-v1');
      expect(result.sessionDurationMs).toBe(300000); // 5 min exactly

      // Confidence computed deterministically from the evidence
      expect(result.confidence.confidence).toBeGreaterThan(0.5);
      expect(result.confidence.completenessScore).toBe(1.0); // all required types present

      // Policy evaluation passed
      expect(result.policyEvaluation.passed).toBe(true);
      expect(result.policyEvaluation.failures).toHaveLength(0);

      // Decision: PASS (terminal)
      expect(result.outcome).toBe(VerificationOutcome.PASS);
      expect(result.verifiedAt).toBeDefined();
    });

    it('produces PENDING when required evidence is missing but the session is still open', async () => {
      const result = await engine.verify({
        session: SESSION_OPEN, // endedAt present but canReceiveMoreEvidence defaults to true
        evidence: onlyVisible(), // only E-VISIBLE → missing E-INTERACTION and E-DURATION
      });

      expect(result.evidenceCount).toBe(1);
      expect(result.policyEvaluation.passed).toBe(false);
      expect(
        result.policyEvaluation.failures.some((f) =>
          f.includes('Missing required evidence types')
        )
      ).toBe(true);
      // Open session → not terminal yet, more evidence can fix it
      expect(result.outcome).toBe(VerificationOutcome.PENDING);
    });

    it('produces INSUFFICIENT when required evidence is missing and the session is closed', async () => {
      const result = await engine.verify({
        session: SESSION_CLOSED,
        evidence: onlyVisible(),
        canReceiveMoreEvidence: false,
      });

      expect(result.evidenceCount).toBe(1);
      expect(result.policyEvaluation.passed).toBe(false);
      // Closed session with insufficient evidence → terminal INSUFFICIENT (NOT FAIL)
      expect(result.outcome).toBe(VerificationOutcome.INSUFFICIENT);
    });

    it('produces PENDING, then PASS, when the same session receives progressive evidence', async () => {
      // Step 1: open session with only one piece of evidence
      const partial = await engine.verify({
        session: SESSION_OPEN,
        evidence: onlyVisible(),
      });
      expect(partial.outcome).toBe(VerificationOutcome.PENDING);

      // Step 2: the remaining evidence arrives in the same session
      const complete = await engine.verify({
        session: SESSION_CLOSED,
        evidence: COMPLETE_EVIDENCE,
        canReceiveMoreEvidence: false,
      });
      expect(complete.outcome).toBe(VerificationOutcome.PASS);
    });

    it('produces FAIL when confidence drops below the fail threshold (low-quality evidence path)', async () => {
      // Low-confidence evidence across all required types. Completeness/reliability pull
      // the aggregate confidence up, so to exercise the FAIL branch we apply a policy with
      // a failThreshold above the resulting confidence.
      const lowConfidenceEvidence: Evidence[] = COMPLETE_EVIDENCE.map((e) => ({
        ...e,
        confidence: 0.05,
      }));

      // Default failThreshold is 0.3; low-quality aggregate comes out ~0.40, which is
      // above it. Use a stricter policy whose failThreshold (0.5) sits above the result
      // so VAP §9's `confidence < failThreshold -> FAIL` branch is exercised.
      const strictFailPolicy = {
        policyId: 'integration-strict-fail',
        name: 'Integration Strict Fail',
        requiredEvidenceTypes: ['E-VISIBLE', 'E-INTERACTION', 'E-DURATION'],
        passThreshold: 0.9,
        failThreshold: 0.5,
        minEvidenceCount: 3,
        fraudScoreThreshold: 0.7,
        contradictionMultiplier: 1.0,
        fraudMultiplier: 2.0,
        allowManualReview: true,
        active: true,
      };

      const result = await engine.verify({
        session: SESSION_CLOSED,
        evidence: lowConfidenceEvidence,
        policy: strictFailPolicy,
        canReceiveMoreEvidence: false,
      });

      expect(result.confidence.confidence).toBeLessThan(0.5);
      expect(result.policyId).toBe('integration-strict-fail');
      // Confidence below failThreshold (0.5) → terminal FAIL
      expect(result.outcome).toBe(VerificationOutcome.FAIL);
    });

    it('is deterministic: identical inputs yield identical confidence and outcome', async () => {
      const input: VerificationInput = {
        session: SESSION_CLOSED,
        evidence: COMPLETE_EVIDENCE,
      };

      const [r1, r2, r3] = await Promise.all([
        engine.verify(input),
        engine.verify(input),
        engine.verify(input),
      ]);

      expect(r1.outcome).toBe(r2.outcome);
      expect(r2.outcome).toBe(r3.outcome);
      expect(r1.confidence.confidence).toBe(r2.confidence.confidence);
      expect(r2.confidence.confidence).toBe(r3.confidence.confidence);
      expect(r1.confidence.rawConfidence).toBe(r2.confidence.rawConfidence);
      expect(r1.confidence.calibratedConfidence).toBe(
        r2.confidence.calibratedConfidence
      );
    });

    it('honors a custom policy end-to-end (relaxed thresholds → PASS)', async () => {
      const relaxedPolicy = {
        policyId: 'integration-relaxed',
        name: 'Integration Relaxed',
        requiredEvidenceTypes: ['E-VISIBLE'],
        passThreshold: 0.3,
        failThreshold: 0.05,
        minEvidenceCount: 1,
        fraudScoreThreshold: 0.9,
        contradictionMultiplier: 1.0,
        fraudMultiplier: 2.0,
        allowManualReview: true,
        active: true,
      };

      const result = await engine.verify({
        session: SESSION_CLOSED,
        evidence: onlyVisible(),
        policy: relaxedPolicy,
        canReceiveMoreEvidence: false,
      });

      expect(result.policyId).toBe('integration-relaxed');
      expect(result.outcome).toBe(VerificationOutcome.PASS);
    });

    it('validates the full VerificationResult shape for a PASS', async () => {
      const result = await engine.verify({
        session: SESSION_CLOSED,
        evidence: COMPLETE_EVIDENCE,
      });

      // Every field of VerificationResult populated through the lifecycle
      expect(typeof result.sessionId).toBe('string');
      expect(typeof result.outcome).toBe('string');
      expect(typeof result.verifiedAt).toBe('string');
      expect(typeof result.policyId).toBe('string');
      expect(typeof result.evidenceCount).toBe('number');
      expect(typeof result.sessionDurationMs).toBe('number');
      expect(typeof result.confidence.confidence).toBe('number');
      expect(typeof result.confidence.rawConfidence).toBe('number');
      expect(typeof result.confidence.calibratedConfidence).toBe('number');
      expect(typeof result.policyEvaluation.passed).toBe('boolean');
      expect(Array.isArray(result.policyEvaluation.reasons)).toBe(true);
      expect(Array.isArray(result.policyEvaluation.failures)).toBe(true);
      expect(Array.isArray(result.policyEvaluation.warnings)).toBe(true);
    });
  });

  describe('verifyStreaming() end-to-end', () => {
    it('delegates to verify() and returns a complete PASS result', async () => {
      const result = await engine.verifyStreaming(
        SESSION_CLOSED,
        COMPLETE_EVIDENCE,
        { canReceiveMoreEvidence: false }
      );

      expect(result.sessionId).toBe(SESSION_CLOSED.sessionId);
      expect(result.outcome).toBe(VerificationOutcome.PASS);
      expect(result.evidenceCount).toBe(3);
    });
  });
});
