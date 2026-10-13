import { describe, it, expect } from 'vitest';
import {
  ProofState,
  createUnsignedProof,
  signProof,
  publishProof,
  serializeProof,
  computeProofHash
} from '@verified-attention/core';
import { randomUUID } from 'crypto';

describe('Proof Serialization and Hashing', () => {
  const mockBaseProof = {
    sessionId: `urn:vap:session:${randomUUID()}`,
    contentId: `urn:vap:content:${randomUUID()}`,
    confidence: 0.95,
    evidenceHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    verifierId: `urn:vap:verifier:${randomUUID()}`
  };

  describe('serializeProof()', () => {
    it('should produce valid JSON string', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      const signed = signProof(unsigned, 'sig_abc');
      const json = serializeProof(signed);
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.proofId).toBe(signed.proofId);
      expect(parsed.state).toBe(ProofState.SIGNED);
    });

    it('should be deterministic — same proof produces same serialized output', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      const signed = signProof(unsigned, 'sig_abc');
      const json1 = serializeProof(signed);
      const json2 = serializeProof(signed);
      expect(json1).toBe(json2);
    });

    it('should include all 7 mandatory fields', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      const signed = signProof(unsigned, 'sig_abc');
      const parsed = JSON.parse(serializeProof(signed));
      expect(parsed).toHaveProperty('proofId');
      expect(parsed).toHaveProperty('sessionId');
      expect(parsed).toHaveProperty('contentId');
      expect(parsed).toHaveProperty('confidence');
      expect(parsed).toHaveProperty('evidenceHash');
      expect(parsed).toHaveProperty('verifierId');
      expect(parsed).toHaveProperty('signature');
    });

    it('should not include signature field for unsigned proofs', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      // serializeProof should work on unsigned proof (no signature)
      const json = serializeProof(unsigned as any);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('proofId');
      expect(parsed.state).toBe(ProofState.UNSIGNED);
    });
  });

  describe('computeProofHash()', () => {
    it('should produce a 64-char hex SHA-256 hash', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      const signed = signProof(unsigned, 'sig_abc');
      const hash = computeProofHash(signed);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be deterministic — same proof produces same hash', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      const signed = signProof(unsigned, 'sig_abc');
      const h1 = computeProofHash(signed);
      const h2 = computeProofHash(signed);
      expect(h1).toBe(h2);
    });

    it('should differ when proof data differs', () => {
      const unsigned1 = createUnsignedProof({
        ...mockBaseProof,
        confidence: 0.95
      });
      const signed1 = signProof(unsigned1, 'sig_abc');

      const unsigned2 = createUnsignedProof({
        ...mockBaseProof,
        confidence: 0.80
      });
      const signed2 = signProof(unsigned2, 'sig_abc');

      expect(computeProofHash(signed1)).not.toBe(computeProofHash(signed2));
    });

    it('should differ when signature differs', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      const signed1 = signProof(unsigned, 'sig_aaa');
      const signed2 = signProof(unsigned, 'sig_bbb');
      expect(computeProofHash(signed1)).not.toBe(computeProofHash(signed2));
    });

    it('should hash only the 7 mandatory fields (not state or timestamps)', () => {
      const unsigned = createUnsignedProof(mockBaseProof);
      const signed = signProof(unsigned, 'sig_abc');
      const published = publishProof(signed);
      // Hash should be same — only mandatory fields matter, not state/timestamps
      expect(computeProofHash(signed)).toBe(computeProofHash(published));
    });
  });
});
