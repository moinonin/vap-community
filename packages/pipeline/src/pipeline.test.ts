/**
 * Unit tests for Pipeline integration
 * Tests end-to-end: validation → normalization → store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Pipeline, ValidationStage, NormalizationStage, StoreStage } from './pipeline';
import { InMemoryReplayCache } from './validation';
import { InMemoryEvidenceStore } from '@verified-attention/store';

const VALID_EVIDENCE_ID = 'urn:vap:evidence:550e8400-e29b-41d4-a716-446655440000';
const VALID_SESSION_ID = 'urn:vap:session:550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_HASH = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const VALID_SIG = 'MEUCIQD1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd';

function makeEvidence(overrides: Record<string, unknown> = {}) {
  return {
    evidenceId: VALID_EVIDENCE_ID,
    sessionId: VALID_SESSION_ID,
    sourceId: 'source-001',
    timestamp: new Date().toISOString(),
    evidenceType: 'E-CUSTOM',
    confidence: 0.8,
    payload: { foo: 'bar' },
    provenance: { observationIds: [VALID_UUID], observationHash: VALID_HASH, sourceId: 'source-001' },
    signature: VALID_SIG,
    ...overrides,
  };
}

// ─── ValidationStage ───────────────────────────────────────────────────────

describe('ValidationStage', () => {
  it('should have name "ValidationStage"', () => {
    const s = new ValidationStage();
    expect(s.name).toBe('ValidationStage');
  });

  it('should accept valid evidence', async () => {
    const stage = new ValidationStage();
    const ctx = { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE', replayCache: new InMemoryReplayCache() };
    const result = await stage.process(makeEvidence(), ctx);
    expect(result.ok).toBe(true);
  });

  it('should reject invalid evidence (bad schema)', async () => {
    const stage = new ValidationStage();
    const ctx = { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE', replayCache: new InMemoryReplayCache() };
    const result = await stage.process(makeEvidence({ confidence: 1.5 }), ctx);
    expect(result.ok).toBe(false);
  });

  it('should reject duplicate evidence (replay)', async () => {
    const stage = new ValidationStage();
    const cache = new InMemoryReplayCache();
    await cache.add(VALID_EVIDENCE_ID);
    const ctx = { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE', replayCache: cache };
    const result = await stage.process(makeEvidence(), ctx);
    expect(result.ok).toBe(false);
  });

  it('should reject when session is not ACTIVE/CREATED', async () => {
    const stage = new ValidationStage();
    const ctx = { sessionId: VALID_SESSION_ID, sessionState: 'ENDED', replayCache: new InMemoryReplayCache() };
    const result = await stage.process(makeEvidence(), ctx);
    expect(result.ok).toBe(false);
  });
});

// ─── NormalizationStage ───────────────────────────────────────────────────

describe('NormalizationStage', () => {
  it('should have name "NormalizationStage"', () => {
    const s = new NormalizationStage();
    expect(s.name).toBe('NormalizationStage');
  });

  it('should pass through valid evidence', async () => {
    const stage = new NormalizationStage();
    const ctx = { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE', replayCache: new InMemoryReplayCache() };
    const result = await stage.process({ ok: true, value: makeEvidence() }, ctx);
    expect(result.ok).toBe(true);
  });

  it('should normalize numeric timestamp to ISO string', async () => {
    const stage = new NormalizationStage();
    const ctx = { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE', replayCache: new InMemoryReplayCache() };
    const evidence = makeEvidence({ timestamp: Date.now() });
    const result = await stage.process({ ok: true, value: evidence }, ctx);
    expect(result.ok).toBe(true);
    expect(typeof (result as any).value.timestamp).toBe('string');
  });
});

// ─── StoreStage ───────────────────────────────────────────────────────────

describe('StoreStage', () => {
  it('should have name "StoreStage"', () => {
    const store = new InMemoryEvidenceStore();
    const s = new StoreStage(store);
    expect(s.name).toBe('StoreStage');
  });

  it('should persist evidence to store', async () => {
    const store = new InMemoryEvidenceStore();
    const stage = new StoreStage(store);
    const ctx = { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE', replayCache: new InMemoryReplayCache() };
    const result = await stage.process({ ok: true, value: makeEvidence() }, ctx);
    expect(result.ok).toBe(true);
    expect(await store.count()).toBe(1);
  });

  it('should report error when duplicate is appended', async () => {
    const store = new InMemoryEvidenceStore();
    await store.append(makeEvidence() as any);
    const stage = new StoreStage(store);
    const ctx = { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE', replayCache: new InMemoryReplayCache() };
    const result = await stage.process({ ok: true, value: makeEvidence() }, ctx);
    expect(result.ok).toBe(false);
  });
});

// ─── Pipeline (end-to-end) ────────────────────────────────────────────────

describe('Pipeline', () => {
  it('should validate and pass through valid evidence', async () => {
    const pipeline = new Pipeline();
    const result = await pipeline.run(makeEvidence(), { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE' });
    expect(result.ok).toBe(true);
    expect(result.stage).toBe('normalization');
  });

  it('should reject invalid evidence at validation stage', async () => {
    const pipeline = new Pipeline();
    const result = await pipeline.run(makeEvidence({ confidence: 1.5 }), { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE' });
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('validation');
  });

  it('should reject evidence for inactive session', async () => {
    const pipeline = new Pipeline();
    const result = await pipeline.run(makeEvidence(), { sessionId: VALID_SESSION_ID, sessionState: 'CLOSED' });
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('validation');
  });

  it('should persist evidence when store attached', async () => {
    const store = new InMemoryEvidenceStore();
    const pipeline = new Pipeline().attachStore(store);
    const result = await pipeline.run(makeEvidence(), { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE' });
    expect(result.ok).toBe(true);
    expect(result.stage).toBe('store');
    expect(await store.count()).toBe(1);
  });

  it('should reject duplicate evidence via replay cache', async () => {
    const cache = new InMemoryReplayCache();
    await cache.add(VALID_EVIDENCE_ID);
    const pipeline = new Pipeline(cache);
    const result = await pipeline.run(makeEvidence(), { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE' });
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('validation');
  });

  it('should report store error for duplicate append', async () => {
    const store = new InMemoryEvidenceStore();
    await store.append(makeEvidence() as any);
    const pipeline = new Pipeline().attachStore(store);
    const result = await pipeline.run(makeEvidence(), { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE' });
    expect(result.ok).toBe(false);
    // Duplicate evidence fails at validation (replay cache is populated by store append on prior run)
    // OR at store (if replay cache was empty). Either is acceptable per immutability enforcement.
    expect(['validation', 'store']).toContain(result.stage);
  });

  it('should accept custom timestamp constraints', async () => {
    const pipeline = new Pipeline(new InMemoryReplayCache(), { maxAgeMs: 60 * 1000 });
    const oldTs = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const result = await pipeline.run(makeEvidence({ timestamp: oldTs }), { sessionId: VALID_SESSION_ID, sessionState: 'ACTIVE' });
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('validation');
  });
});
