import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeHSM, getHSM, signWithHSM, HSMProviderType } from './index.js';
import type { UnsignedProof } from '@verified-attention/core';
import { ProofState } from '@verified-attention/core';

describe('StubHSM', () => {
  let hsm: Awaited<ReturnType<typeof initializeHSM>>;

  beforeAll(async () => {
    hsm = await initializeHSM({ type: HSMProviderType.STUB, algorithm: 'ECDSA_P256' });
  });

  afterAll(async () => {
    await hsm.close();
  });

  it('should initialize with STUB type', () => {
    expect(hsm).toBeDefined();
    expect(hsm.getKeyId()).toMatch(/^stub-stub-\d+$/);
  });

  it('should sign data and return Uint8Array', async () => {
    const data = new TextEncoder().encode('test data');
    const signature = await hsm.sign(data);
    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.length).toBeGreaterThan(0);
  });

  it('should return public key', async () => {
    const publicKey = await hsm.getPublicKey();
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(publicKey.length).toBeGreaterThan(0);
  });

  it('should sign with HSM convenience function', async () => {
    const unsignedProof: UnsignedProof = {
      proofId: 'urn:vap:proof:test-123',
      sessionId: 'session-456',
      contentId: 'content-789',
      confidence: 0.85,
      evidenceHash: 'abc123',
      verifierId: 'verifier-001',
      state: ProofState.UNSIGNED,
      metadata: {
        policyId: 'test-policy',
      },
      baseMetadata: {
        createdAt: new Date().toISOString(),
        version: 1,
      },
    };

    const signature = await signWithHSM(unsignedProof);
    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(0);
    // Should be hex string
    expect(signature).toMatch(/^[0-9a-f]+$/);
  });

  it('should produce different signatures for same input (ECDSA is non-deterministic)', async () => {
    const unsignedProof: UnsignedProof = {
      proofId: 'urn:vap:proof:deterministic-test',
      sessionId: 'session-deterministic',
      contentId: 'content-deterministic',
      confidence: 0.9,
      evidenceHash: 'fixed-hash',
      verifierId: 'verifier-deterministic',
      state: ProofState.UNSIGNED,
      metadata: {
        policyId: 'test-policy',
      },
      baseMetadata: {
        createdAt: new Date().toISOString(),
        version: 1,
      },
    };

    const sig1 = await signWithHSM(unsignedProof);
    const sig2 = await signWithHSM(unsignedProof);
    // ECDSA signatures are non-deterministic, so they should be different
    expect(sig1).not.toBe(sig2);
    // But both should be valid hex strings
    expect(sig1).toMatch(/^[0-9a-f]+$/);
    expect(sig2).toMatch(/^[0-9a-f]+$/);
  });
});

describe('HSM Factory', () => {
  it('should return singleton instance', () => {
    const hsm1 = getHSM();
    const hsm2 = getHSM();
    expect(hsm1).toBe(hsm2);
  });
});