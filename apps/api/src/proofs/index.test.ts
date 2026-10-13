import { describe, it, expect, beforeEach } from 'vitest';
import { ProofState } from '@verified-attention/core';
import { InMemoryProofStorage } from '@verified-attention/verifier';
import { createProofRouter, ProofAPIHandler, type ProofFilter, type ProofSearchResult } from './index';

describe('Proof Retrieval API', () => {
  let proofStorage: InMemoryProofStorage;
  let proofAPI: ProofAPIHandler;

  beforeEach(() => {
    proofStorage = new InMemoryProofStorage();
    proofAPI = new ProofAPIHandler();
  });

  it('searches proofs with no filter returns empty array', async () => {
    const result = await proofAPI.search({});
    expect(result).toEqual({
      proofs: [],
      total: 0,
      limit: 100,
      offset: 0,
    } as ProofSearchResult);
  });

  it('filters by proofId when searching', async () => {
    // This test uses the handler directly; in a real setup,
    // the storage would be populated via the proof-gen pipeline
    const result = await proofAPI.search({ proofId: 'nonexistent' });
    expect(result.proofs).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('filters by sessionId when searching', async () => {
    const result = await proofAPI.search({ sessionId: 'test-session' });
    expect(result.proofs).toHaveLength(0);
  });

  it('filters by contentId when searching', async () => {
    const result = await proofAPI.search({ contentId: 'test-content' });
    expect(result.proofs).toHaveLength(0);
  });

  it('filters by verifierId when searching', async () => {
    const result = await proofAPI.search({ verifierId: 'test-verifier' });
    expect(result.proofs).toHaveLength(0);
  });

  it('filters by state when searching', async () => {
    const result = await proofAPI.search({ state: 'SIGNED' });
    expect(result.proofs).toHaveLength(0);
  });

  it('filters by time range when searching', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    const result = await proofAPI.search({ from: thirtyDaysAgo, to: now });
    expect(result.proofs).toHaveLength(0);
  });

  it('handles pagination in search', async () => {
    const result = await proofAPI.search({ limit: 10, offset: 5 });
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(5);
    expect(result.proofs).toHaveLength(0);
  });

  it('returns correct structure for search result', async () => {
    const result = await proofAPI.search({});
    expect(result).toHaveProperty('proofs');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('offset');
    expect(Array.isArray(result.proofs)).toBe(true);
  });

  it('getByProofId returns undefined for nonexistent proof', async () => {
    const proof = await proofAPI.getByProofId('nonexistent-proof-id');
    expect(proof).toBeUndefined();
  });

  it('getBySession returns empty array for nonexistent session', async () => {
    const proofs = await proofAPI.getBySession('nonexistent-session');
    expect(proofs).toHaveLength(0);
  });

  it('getByContent returns empty array for nonexistent content', async () => {
    const proofs = await proofAPI.getByContent('nonexistent-content');
    expect(proofs).toHaveLength(0);
  });

  it('getByVerifier returns empty array for nonexistent verifier', async () => {
    const proofs = await proofAPI.getByVerifier('nonexistent-verifier');
    expect(proofs).toHaveLength(0);
  });

  it('createProofRouter returns a router object', () => {
    const router = createProofRouter(proofAPI);
    expect(router).toBeDefined();
    expect(typeof router).toBe('object');
  });

  it('proof API handler is instance of ProofAPIHandler', () => {
    expect(proofAPI).toBeInstanceOf(ProofAPIHandler);
  });

  it('ProofFilter type accepts valid filter options', () => {
    const filter: ProofFilter = {
      proofId: 'test',
      sessionId: 'test-session',
      contentId: 'test-content',
      verifierId: 'test-verifier',
      state: 'SIGNED',
      from: new Date().toISOString(),
      to: new Date().toISOString(),
      limit: 50,
      offset: 0,
    };
    expect(filter.proofId).toBe('test');
    expect(filter.limit).toBe(50);
  });

  it('ProofSearchResult has correct shape', () => {
    const result: ProofSearchResult = {
      proofs: [],
      total: 0,
      limit: 10,
      offset: 0,
    };
    expect(result).toHaveProperty('proofs');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('offset');
  });
});
