/**
 * Selective Disclosure Tests (VAE Sprint 15)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSelectiveDisclosureService, selectiveDisclose } from '../proof/disclosure';
import type { Proof, ProofState } from '@verified-attention/core';
import type { DisclosureLevel, DisclosureProof } from '../proof/disclosure';

vi.mock('crypto', () => ({ createHash: () => ({ digest: () => 'mock' }) }));

describe('Selective Disclosure', () => {
  let service;
  let mockProof;

  beforeEach(() => {
    vi.resetModules();
    service = getSelectiveDisclosureService();
    mockProof = {
      proofId: 'urn:vap:proof:test-123',
      sessionId: 'urn:vap:session:test-session',
      contentId: 'urn:vap:content:test-content',
      confidence: 0.85,
      evidenceHash: 'sha256:abc123def456',
      verifierId: 'urn:vap:verifier:test-verifier',
      state: 'PUBLISHED' as ProofState,
      issuedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      metadata: {
        policyId: 'policy-1',
        verificationModelVersion: '1.0',
        fraudScore: 0.1,
        evidenceCount: 5,
      },
      baseMetadata: {},
    } as unknown as Proof;
  });

  it('creates full disclosure', () => {
    const result = service.disclose(mockProof, 'FULL', 'operator-1');
    expect(result.disclosureLevel).toBeUndefined(); // on the disclosure object
    expect(result.disclosedData).toHaveProperty('proofId');
    expect(result.disclosedData).toHaveProperty('confidence');
    expect(result.disclosedData).toHaveProperty('evidenceHash');
    expect(result.disclosedData).toHaveProperty('sessionId');
    expect(result.disclosedData.confidence).toBe(0.85);
  });

  it('creates confidence-only disclosure', () => {
    const result = service.discloseConfidenceOnly(mockProof, 'operator-1');
    expect(result.disclosedData).toHaveProperty('proofId');
    expect(result.disclosedData).toHaveProperty('confidence');
    expect(result.disclosedData).toHaveProperty('verifierId');
    expect(result.disclosedData).not.toHaveProperty('sessionId');
    expect(result.disclosedData).not.toHaveProperty('contentId');
    expect(result.disclosedData).not.toHaveProperty('evidenceHash');
    expect(result.disclosedData.confidence).toBe(0.85);
  });

  it('creates evidence-hash-only disclosure', () => {
    const result = service.discloseEvidenceHashOnly(mockProof, 'operator-1');
    expect(result.disclosedData).toHaveProperty('proofId');
    expect(result.disclosedData).toHaveProperty('evidenceHash');
    expect(result.disclosedData).not.toHaveProperty('confidence');
    expect(result.disclosedData).not.toHaveProperty('sessionId');
    expect(result.disclosedData.evidenceHash).toBe('sha256:abc123def456');
  });

  it('creates metadata-only disclosure', () => {
    const result = service.discloseMetadataOnly(mockProof, 'operator-1');
    expect(result.disclosedData).toHaveProperty('proofId');
    expect(result.disclosedData).toHaveProperty('metadata');
    expect(result.disclosedData).not.toHaveProperty('confidence');
    expect(result.disclosedData).not.toHaveProperty('sessionId');
    expect(result.disclosedData.metadata).toEqual(mockProof.metadata);
  });

  it('creates session-ref-only disclosure', () => {
    const result = service.disclose(mockProof, 'SESSION_REF_ONLY', 'operator-1');
    expect(result.disclosedData).toHaveProperty('proofId');
    expect(result.disclosedData).toHaveProperty('sessionId');
    expect(result.disclosedData).not.toHaveProperty('confidence');
    expect(result.disclosedData.sessionId).toBe('urn:vap:session:test-session');
  });

  it('creates custom disclosure with selected fields', () => {
    const result = service.disclose(mockProof, 'CUSTOM', 'operator-1', ['proofId', 'confidence', 'metadata.policyId']);
    expect(result.disclosedData).toHaveProperty('proofId');
    expect(result.disclosedData).toHaveProperty('confidence');
    expect(result.disclosedData).not.toHaveProperty('sessionId');
    expect(result.disclosedData.confidence).toBe(0.85);
  });

  it('verifyDisclosure returns true for valid disclosure', () => {
    const result = service.discloseConfidenceOnly(mockProof, 'operator-1');
    const valid = service.verifyDisclosure(result);
    expect(valid).toBe(true);
  });

  it('selectiveDisclose convenience function works', () => {
    const result = selectiveDisclose(mockProof, 'operator-1');
    expect(result.disclosedData).toHaveProperty('confidence');
    expect(result.disclosedData.confidence).toBe(0.85);
  });

  it('disclosure includes proofId', () => {
    const result = service.discloseConfidenceOnly(mockProof, 'operator-1');
    expect(result.originalProofId).toBe('urn:vap:proof:test-123');
    expect(result.disclosure.proofId).toBe('urn:vap:proof:test-123');
  });

  it('disclosure includes disclosedBy', () => {
    const result = service.discloseConfidenceOnly(mockProof, 'operator-1');
    expect(result.disclosure.disclosedBy).toBe('operator-1');
    expect(result.disclosure.disclosedAt).toBeDefined();
  });

  it('verifying unknown disclosure returns false', () => {
    const fakeDisclosure = {
      originalProofId: 'unknown-proof',
      disclosure: {
        proofId: 'unknown-proof',
        disclosureLevel: 'CONFIDENCE_ONLY',
        disclosedAt: new Date().toISOString(),
        disclosedBy: 'someone',
      },
      disclosedData: { proofId: 'unknown-proof', confidence: 0.8 },
      signature: undefined,
    };
    const valid = service.verifyDisclosure(fakeDisclosure);
    expect(valid).toBe(false);
  });

  it('disclosures are tracked by proofId', () => {
    service.disclose(mockProof, 'FULL', 'operator-1');
    // Second disclosure for same proof updates tracking
    service.discloseConfidenceOnly(mockProof, 'operator-2');
    // Both should be valid
    const fullResult = service.disclose(mockProof, 'FULL', 'operator-1');
    expect(service.verifyDisclosure(fullResult)).toBe(true);
  });
});
