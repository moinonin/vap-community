import { describe, it, expect } from 'vitest';
import {
  ProofSchema,
  ProofState,
  createUnsignedProof,
  signProof,
  publishProof,
  revokeProof,
  validateProof,
  isProofValid,
  isProofExpired,
  transitionProofState
} from '@verified-attention/core';
import { randomUUID } from 'crypto';

describe('Proof of Attention Conformance', () => {
  const mockBaseProof = {
    sessionId: `urn:vap:session:${randomUUID()}`,
    contentId: `urn:vap:content:${randomUUID()}`,
    confidence: 0.95,
    evidenceHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    verifierId: `urn:vap:verifier:${randomUUID()}`
  };

  describe('Proof Object Structure', () => {
    it('should validate a complete and valid proof', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      const proof = signProof(unsigned, 'sig_mock_signature_string');

      const result = validateProof(proof);
      expect(result.valid).toBe(true);
    });

    it('should require 7 mandatory fields', () => {
      const invalidProof = {
        sessionId: mockBaseProof.sessionId,
        contentId: mockBaseProof.contentId,
        confidence: mockBaseProof.confidence,
        evidenceHash: mockBaseProof.evidenceHash
      };
      
      const result = validateProof(invalidProof);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.path?.includes('proofId'))).toBe(true);
      expect(result.errors?.some(e => e.path?.includes('verifierId'))).toBe(true);
      expect(result.errors?.some(e => e.path?.includes('signature'))).toBe(true);
    });
  });

  describe('Proof Lifecycle and States', () => {
    it('transitions from UNSIGNED to SIGNED', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      expect(unsigned.state).toBe(ProofState.UNSIGNED);
      
      const signed = signProof(unsigned, 'sig_abc');
      expect(signed.state).toBe(ProofState.SIGNED);
      expect(signed.signature).toBe('sig_abc');
    });

    it('transitions from SIGNED to PUBLISHED', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      const signed = signProof(unsigned, 'sig_abc');
      const published = publishProof(signed);
      expect(published.state).toBe(ProofState.PUBLISHED);
      expect(published.publishedAt).toBeDefined();
    });

    it('transitions to REVOKED from any state', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      const signed = signProof(unsigned, 'sig_abc');
      const revoked = revokeProof(signed);
      expect(revoked.state).toBe(ProofState.REVOKED);
      expect(revoked.revokedAt).toBeDefined();
    });

    it('validates proof using isProofValid', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      const signed = signProof(unsigned, 'sig_abc');
      const published = publishProof(signed);
      expect(isProofValid(published)).toBe(true);
      expect(isProofValid(signed)).toBe(false); // Must be published

      const revoked = revokeProof(published);
      expect(isProofValid(revoked)).toBe(false);
    });
  });
});
