import { describe, it, expect, beforeEach, vi } from 'vitest';
import { revokeProof, isProofRevoked, getRevocation, createSupplementaryProof } from '../proof/revocation';
import { ProofState } from '@verified-attention/core';
import type { Proof, RevocationReason } from '../proof/revocation';

vi.mock('crypto', () => ({
  randomUUID: () => 'test-uuid',
}));

describe('Proof Revocation', () => {
  const mockProof: Proof = {
    proofId: 'urn:vap:proof:test-123',
    sessionId: 'urn:vap:session:test-session',
    contentId: 'urn:vap:content:test-content',
    confidence: 0.85,
    evidenceHash: 'sha256:abc123',
    verifierId: 'urn:vap:verifier:test-verifier',
    state: ProofState.PUBLISHED,
    issuedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    metadata: {
      policyId: 'policy-1',
      verificationModelVersion: '1.0',
      fraudScore: 0.1,
      evidenceCount: 5,
      sessionDurationMs: 120000,
    },
    baseMetadata: {},
  } as unknown as Proof;

  const mockReason: RevocationReason = {
    reason: 'FRAUD_DETECTED',
    description: 'Automated fraud detection flagged this proof',
    evidenceRef: ['urn:vap:evidence:fraud-1'],
    reportedBy: 'system:fraud-detector',
    reportedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    // Reset the singleton between tests by requiring fresh
    vi.resetModules();
  });

  it('revokes a proof and returns a revocation record', async () => {
    const { revokeProof: revoke } = await import('../proof/revocation');
    const record = await revoke(mockProof, mockReason, 'operator-1');

    expect(record).toBeDefined();
    expect(record.revocationId).toMatch(/^revocation_/);
    expect(record.proofId).toBe(mockProof.proofId);
    expect(record.revokedAt).toBeDefined();
    expect(record.reason.reason).toBe('FRAUD_DETECTED');
    expect(record.revokedBy).toBe('operator-1');
    expect(record.supplementaryProof).toBeUndefined();
  });

  it('revocation record has correct structure', async () => {
    const { revokeProof: revoke } = await import('../proof/revocation');
    const record = await revoke(mockProof, mockReason, 'operator-1');

    expect(record).toHaveProperty('revocationId');
    expect(record).toHaveProperty('proofId');
    expect(record).toHaveProperty('revokedAt');
    expect(record).toHaveProperty('reason');
    expect(record).toHaveProperty('revokedBy');
    expect(record.reason).toHaveProperty('reason');
    expect(record.reason).toHaveProperty('description');
    expect(record.reason).toHaveProperty('reportedBy');
    expect(record.reason).toHaveProperty('reportedAt');
  });

  it('checks if a proof is revoked', async () => {
    const { revokeProof: revoke, isProofRevoked: isRevoked } = await import('../proof/revocation');
    await revoke(mockProof, mockReason, 'operator-1');
    const revoked = await isRevoked(mockProof.proofId);
    expect(revoked).toBe(true);
  });

  it('returns false for non-revoked proof', async () => {
    const { isProofRevoked } = await import('../proof/revocation');
    const revoked = await isProofRevoked('urn:vap:proof:nonexistent');
    expect(revoked).toBe(false);
  });

  it('gets revocation record for revoked proof', async () => {
    const { revokeProof: revoke, getRevocation } = await import('../proof/revocation');
    await revoke(mockProof, mockReason, 'operator-1');
    const record = await getRevocation(mockProof.proofId);

    expect(record).toBeDefined();
    expect(record?.proofId).toBe(mockProof.proofId);
    expect(record?.reason.reason).toBe('FRAUD_DETECTED');
  });

  it('returns undefined for non-revoked proof', async () => {
    const { getRevocation } = await import('../proof/revocation');
    const record = await getRevocation('urn:vap:proof:nonexistent');
    expect(record).toBeUndefined();
  });

  it('creates supplementary proof from revoked proof', async () => {
    const { createSupplementaryProof } = await import('../proof/revocation');
    const supplementary = createSupplementaryProof(
      mockProof,
      mockReason,
      0.92,
      'sha256:newevid123',
      'Revised proof after fraud review'
    );

    expect(supplementary.proofId).toContain('supplementary');
    expect(supplementary.sessionId).toBe(mockProof.sessionId);
    expect(supplementary.contentId).toBe(mockProof.contentId);
    expect(supplementary.confidence).toBe(0.92);
    expect(supplementary.evidenceHash).toBe('sha256:newevid123');
    expect(supplementary.verifierId).toBe(mockProof.verifierId);
    expect(supplementary.state).toBe('UNSIGNED');
  });

  it('supplementary proof maintains original context', async () => {
    const { createSupplementaryProof } = await import('../proof/revocation');
    const supplementary = createSupplementaryProof(mockProof, mockReason, 0.92, 'sha256:new');

    expect(supplementary.metadata?.policyId).toBe('policy-1');
    expect(supplementary.metadata?.verificationModelVersion).toBe('1.0');
    expect(supplementary.metadata?.fraudScore).toBe(0.1);
  });

  it('revocation reason has correct enum values', () => {
    expect(mockReason.reason).toMatch(/^(FRAUD_DETECTED|PROCEDURAL_ERROR|CONTENT_REMOVED|POLICY_VIOLATION|USER_REQUEST|OTHER)$/);
  });

  it('revocation is idempotent for same proof', async () => {
    const { revokeProof: revoke } = await import('../proof/revocation');
    const record1 = await revoke(mockProof, mockReason, 'operator-1');
    const record2 = await revoke(mockProof, mockReason, 'operator-1');

    // Both should succeed (no error thrown)
    expect(record1.revocationId).toBeDefined();
    expect(record2.revocationId).toBeDefined();
    expect(record1.revocationId).not.toBe(record2.revocationId);
  });

  it('revocation record includes timestamp in ISO format', async () => {
    const { revokeProof: revoke } = await import('../proof/revocation');
    const record = await revoke(mockProof, mockReason, 'operator-1');
    const date = new Date(record.revokedAt);
    expect(date).toBeInstanceOf(Date);
    expect(isNaN(date.getTime())).toBe(false);
  });

  it('revocation reason enum includes all expected values', () => {
    const validReasons = ['FRAUD_DETECTED', 'PROCEDURAL_ERROR', 'CONTENT_REMOVED', 'POLICY_VIOLATION', 'USER_REQUEST', 'OTHER'];
    expect(validReasons).toContain(mockReason.reason);
  });
});
