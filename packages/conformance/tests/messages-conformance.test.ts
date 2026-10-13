import { describe, it, expect } from 'vitest';
import {
  SubmitEvidenceSchema,
  ClaimRequestSchema,
  VerificationCreateSchema,
  EvidenceType,
  EvidenceLifecycleStateSchema
} from '@verified-attention/core';
import { randomUUID } from 'crypto';

describe('Protocol Messages Conformance', () => {
  const sessionId = `urn:vap:session:${randomUUID()}`;
  const policyId = `urn:vap:policy:${randomUUID()}`;
  
  const mockEvidence = {
    evidenceId: `urn:vap:evidence:${randomUUID()}`,
    sessionId,
    sourceId: `urn:vap:source:${randomUUID()}`,
    timestamp: new Date().toISOString(),
    evidenceType: EvidenceType.INTERACTION,
    confidence: 0.95,
    provenance: {
      observationIds: [randomUUID()],
      observationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      sourceId: `urn:vap:source:${randomUUID()}`,
      collectionMethod: 'sdk' as const
    },
    payload: {
      avgScrollVelocity: 150.5,
      scrollDirectionChanges: 3,
      clickCount: 10,
      keyPressCount: 50,
      interactionDurationMs: 30000,
      engagementScore: 0.85
    },
    signature: 'sig_123'
  };

  describe('SubmitEvidence', () => {
    it('validates a correct SubmitEvidence message', () => {
      const msg = {
        session_id: sessionId,
        evidence_item: mockEvidence,
        producer_signature: 'sig_123'
      };
      
      const result = SubmitEvidenceSchema.safeParse(msg);
      if (!result.success) {
        console.error(JSON.stringify(result.error.issues, null, 2));
      }
      expect(result.success).toBe(true);
    });

    it('requires session_id and evidence_item', () => {
      const msg = {
        producer_signature: 'sig_123'
      };
      
      const result = SubmitEvidenceSchema.safeParse(msg);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('session_id'))).toBe(true);
        expect(result.error.issues.some(i => i.path.includes('evidence_item'))).toBe(true);
      }
    });
  });

  describe('ClaimRequest', () => {
    it('validates a correct ClaimRequest message', () => {
      const msg = {
        session_id: sessionId,
        policy_id: policyId,
        requester_id: 'requester-123'
      };
      
      const result = ClaimRequestSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('requires all fields', () => {
      const result = ClaimRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('VerificationCreate', () => {
    it('validates a correct VerificationCreate message', () => {
      const msg = {
        session_id: sessionId,
        policy: policyId,
        threshold: 0.95
      };
      
      const result = VerificationCreateSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('enforces threshold limits between 0 and 1', () => {
      const msg1 = { session_id: sessionId, policy: policyId, threshold: -0.1 };
      const msg2 = { session_id: sessionId, policy: policyId, threshold: 1.1 };
      
      expect(VerificationCreateSchema.safeParse(msg1).success).toBe(false);
      expect(VerificationCreateSchema.safeParse(msg2).success).toBe(false);
    });
  });
});
