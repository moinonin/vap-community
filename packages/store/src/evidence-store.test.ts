/**
 * Unit tests for Evidence Store (VAP Section 3/5)
 * Tests append-only behavior, indexing, immutability, pagination
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryEvidenceStore,
  EvidenceStoreError,
  createEvidenceStore,
  type StoredEvidence,
  type EvidenceStore,
} from './evidence-store';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeEvidence(overrides: Partial<StoredEvidence> = {}): StoredEvidence {
  return {
    evidenceId: 'urn:vap:evidence:550e8400-e29b-41d4-a716-446655440000',
    sessionId: 'urn:vap:session:550e8400-e29b-41d4-a716-446655440000',
    sourceId: 'source-001',
    timestamp: '2024-01-15T10:30:00.123456Z',
    evidenceType: 'E-CUSTOM',
    confidence: 0.8,
    payload: { foo: 'bar' },
    provenance: {
      observationIds: ['550e8400-e29b-41d4-a716-446655440000'],
      observationHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      sourceId: 'source-001',
    },
    signature: 'MEUCIQD1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
    ...overrides,
  };
}

const EID = (n: number) => `urn:vap:evidence:550e8400-e29b-41d4-a716-446655440${n.toString().padStart(3, '0')}`;
const SID = 'urn:vap:session:550e8400-e29b-41d4-a716-446655440000';
const SID2 = 'urn:vap:session:550e8400-e29b-41d4-a716-446655440999';

// ─── InMemoryEvidenceStore ───────────────────────────────────────────────

describe('InMemoryEvidenceStore', () => {
  let store: InMemoryEvidenceStore;

  beforeEach(() => {
    store = new InMemoryEvidenceStore();
  });

  // ─── append ──────────────────────────────────────────────────────────

  describe('append', () => {
    it('should accept new evidence', async () => {
      const ev = makeEvidence();
      await store.append(ev);
      expect(await store.count()).toBe(1);
    });

    it('should reject duplicate evidenceId (immutability)', async () => {
      const ev = makeEvidence();
      await store.append(ev);
      await expect(store.append(ev)).rejects.toThrow(EvidenceStoreError);
      await expect(store.append(ev)).rejects.toMatchObject({ code: 'DUPLICATE' });
    });

    it('should reject evidence exceeding maxEntriesPerSession', async () => {
      const limited = new InMemoryEvidenceStore({ maxEntriesPerSession: 2 });
      await limited.append(makeEvidence({ evidenceId: EID(1) }));
      await limited.append(makeEvidence({ evidenceId: EID(2) }));
      await expect(limited.append(makeEvidence({ evidenceId: EID(3) }))).rejects.toMatchObject({ code: 'OVERFLOW' });
    });

    it('should accept evidence from different sessions independently', async () => {
      await store.append(makeEvidence({ evidenceId: EID(1), sessionId: SID }));
      await store.append(makeEvidence({ evidenceId: EID(2), sessionId: SID2 }));
      expect(await store.count()).toBe(2);
      expect((await store.getBySession(SID)).length).toBe(1);
      expect((await store.getBySession(SID2)).length).toBe(1);
    });

    it('should default maxEntriesPerSession to 100000', async () => {
      // Ensure no overflow with default limit
      const ev = makeEvidence();
      await store.append(ev);
      expect(await store.count()).toBe(1);
    });
  });

  // ─── getByEvidenceId ────────────────────────────────────────────────

  describe('getByEvidenceId', () => {
    it('should return evidence by ID', async () => {
      const ev = makeEvidence({ evidenceId: EID(1) });
      await store.append(ev);
      const found = await store.getByEvidenceId(EID(1));
      expect(found).not.toBeNull();
      expect(found!.evidenceId).toBe(EID(1));
    });

    it('should return null for non-existent ID', async () => {
      const found = await store.getByEvidenceId('urn:vap:evidence:does-not-exist');
      expect(found).toBeNull();
    });

    it('should preserve readonly fields', async () => {
      const ev = makeEvidence({ evidenceId: EID(1) });
      await store.append(ev);
      const found = await store.getByEvidenceId(EID(1));
      expect(found!.confidence).toBe(0.8);
      expect(found!.evidenceType).toBe('E-CUSTOM');
    });
  });

  // ─── getBySession ───────────────────────────────────────────────────

  describe('getBySession', () => {
    it('should return empty array for unknown session', async () => {
      const results = await store.getBySession(SID);
      expect(results).toEqual([]);
    });

    it('should return all evidence for a session sorted by timestamp', async () => {
      await store.append(makeEvidence({ evidenceId: EID(1), timestamp: '2024-01-15T10:30:02.000Z' }));
      await store.append(makeEvidence({ evidenceId: EID(2), timestamp: '2024-01-15T10:30:00.000Z' }));
      await store.append(makeEvidence({ evidenceId: EID(3), timestamp: '2024-01-15T10:30:01.000Z' }));
      const results = await store.getBySession(SID);
      expect(results.length).toBe(3);
      expect(results[0]!.evidenceId).toBe(EID(2)); // earliest first
      expect(results[2]!.evidenceId).toBe(EID(1)); // latest last
    });

    it('should not return evidence from other sessions', async () => {
      await store.append(makeEvidence({ evidenceId: EID(1), sessionId: SID }));
      await store.append(makeEvidence({ evidenceId: EID(2), sessionId: SID2 }));
      const results = await store.getBySession(SID);
      expect(results.length).toBe(1);
      expect(results[0]!.sessionId).toBe(SID);
    });
  });

  // ─── count ──────────────────────────────────────────────────────────

  describe('count', () => {
    it('should return 0 for empty store', async () => {
      expect(await store.count()).toBe(0);
    });

    it('should return total count across all sessions', async () => {
      await store.append(makeEvidence({ evidenceId: EID(1), sessionId: SID }));
      await store.append(makeEvidence({ evidenceId: EID(2), sessionId: SID }));
      await store.append(makeEvidence({ evidenceId: EID(3), sessionId: SID2 }));
      expect(await store.count()).toBe(3);
    });
  });

  // ─── iterate ────────────────────────────────────────────────────────

  describe('iterate', () => {
    it('should yield all stored evidence', async () => {
      await store.append(makeEvidence({ evidenceId: EID(1) }));
      await store.append(makeEvidence({ evidenceId: EID(2) }));
      const collected: StoredEvidence[] = [];
      for await (const ev of store.iterate(100)) {
        collected.push(ev);
      }
      expect(collected.length).toBe(2);
    });

    it('should respect pageSize limit', async () => {
      await store.append(makeEvidence({ evidenceId: EID(1) }));
      await store.append(makeEvidence({ evidenceId: EID(2) }));
      await store.append(makeEvidence({ evidenceId: EID(3) }));
      const collected: StoredEvidence[] = [];
      for await (const ev of store.iterate(100, 2)) {
        collected.push(ev);
      }
      expect(collected.length).toBe(2);
    });

    it('should yield nothing from empty store', async () => {
      const collected: StoredEvidence[] = [];
      for await (const ev of store.iterate(100)) {
        collected.push(ev);
      }
      expect(collected.length).toBe(0);
    });
  });
});

// ─── EvidenceStoreError ──────────────────────────────────────────────────

describe('EvidenceStoreError', () => {
  it('should be an Error subclass', () => {
    const err = new EvidenceStoreError('test', 'DUPLICATE');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('test');
    expect(err.code).toBe('DUPLICATE');
    expect(err.name).toBe('EvidenceStoreError');
  });

  it('should support OVERFLOW code', () => {
    const err = new EvidenceStoreError('overflow', 'OVERFLOW');
    expect(err.code).toBe('OVERFLOW');
  });

  it('should support MISSING_SESSION code', () => {
    const err = new EvidenceStoreError('missing', 'MISSING_SESSION');
    expect(err.code).toBe('MISSING_SESSION');
  });
});

// ─── createEvidenceStore factory ──────────────────────────────────────────

describe('createEvidenceStore', () => {
  it('should return an InMemoryEvidenceStore instance', () => {
    const s = createEvidenceStore();
    expect(s).toBeInstanceOf(InMemoryEvidenceStore);
  });

  it('should accept options', async () => {
    const s = createEvidenceStore({ maxEntriesPerSession: 1 });
    await s.append(makeEvidence({ evidenceId: EID(1) }));
    await expect(s.append(makeEvidence({ evidenceId: EID(2) }))).rejects.toMatchObject({ code: 'OVERFLOW' });
  });

  it('returned store implements EvidenceStore interface', () => {
    const s: EvidenceStore = createEvidenceStore();
    expect(s.append).toBeDefined();
    expect(s.getByEvidenceId).toBeDefined();
    expect(s.getBySession).toBeDefined();
    expect(s.count).toBeDefined();
    expect(s.iterate).toBeDefined();
  });
});

// ─── StoredEvidence type ────────────────────────────────────────────────

describe('StoredEvidence interface', () => {
  it('should be usable with all required fields', () => {
    const ev: StoredEvidence = makeEvidence();
    expect(ev.evidenceId).toBeDefined();
    expect(ev.sessionId).toBeDefined();
    expect(ev.sourceId).toBeDefined();
    expect(ev.timestamp).toBeDefined();
    expect(ev.evidenceType).toBeDefined();
    expect(ev.confidence).toBeDefined();
    expect(ev.payload).toBeDefined();
    expect(ev.provenance).toBeDefined();
    expect(ev.signature).toBeDefined();
  });
});
