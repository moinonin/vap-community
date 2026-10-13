import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeduplicationStage, InMemoryDeduplicationStore, computeContentHash } from './index';
import { Evidence, EvidenceType, EvidenceState } from '@verified-attention/core';

describe('DeduplicationStage', () => {
  let stage: DeduplicationStage;

  beforeEach(() => {
    stage = new DeduplicationStage();
  });

  const createMockEvidence = (overrides: Partial<any> = {}): Evidence => ({
    id: 'test-eid-1',
    type: EvidenceType.INTERACTION,
    payload: { interactionType: 'click', target: 'button#submit' },
    provenance: {
      sourceId: 'browser-sdk',
      collectionMethod: 'automated',
      observationIds: ['obs-1', 'obs-2'],
      observationHash: 'abc123',
    },
    timestamp: Date.now(),
    metadata: {
      sessionId: 'session-123',
      version: '1.0',
    },
    state: EvidenceState.PENDING,
    ...overrides,
  });

  describe('computeContentHash', () => {
    it('should produce consistent hashes for identical evidence', () => {
      const e1 = createMockEvidence();
      const e2 = createMockEvidence({ id: 'different-id' });

      const hash1 = computeContentHash(e1);
      const hash2 = computeContentHash(e2);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 hex
    });

    it('should produce different hashes for different payloads', () => {
      const e1 = createMockEvidence({ payload: { interactionType: 'click' } });
      const e2 = createMockEvidence({ payload: { interactionType: 'scroll' } });

      const hash1 = computeContentHash(e1);
      const hash2 = computeContentHash(e2);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different source IDs', () => {
      const e1 = createMockEvidence({ provenance: { ...createMockEvidence().provenance, sourceId: 'source-a' } });
      const e2 = createMockEvidence({ provenance: { ...createMockEvidence().provenance, sourceId: 'source-b' } });

      const hash1 = computeContentHash(e1);
      const hash2 = computeContentHash(e2);

      expect(hash1).not.toBe(hash2);
    });

    it('should ignore observation IDs in hash computation', () => {
      const e1 = createMockEvidence({ provenance: { ...createMockEvidence().provenance, observationIds: ['obs-1'] } });
      const e2 = createMockEvidence({ provenance: { ...createMockEvidence().provenance, observationIds: ['obs-999'] } });

      const hash1 = computeContentHash(e1);
      const hash2 = computeContentHash(e2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('InMemoryDeduplicationStore', () => {
    let store: InMemoryDeduplicationStore;

    beforeEach(() => {
      store = new InMemoryDeduplicationStore();
    });

    it('should store and retrieve by content hash', () => {
      store.set('hash-123', 'eid-1');
      expect(store.get('hash-123')).toBe('eid-1');
      expect(store.has('hash-123')).toBe(true);
      expect(store.has('hash-456')).toBe(false);
    });

    it('should store and retrieve session mapping', () => {
      store.setSession('session-1', 'eid-1');
      expect(store.getSession('session-1')).toBe('eid-1');
      expect(store.getSession('session-2')).toBeUndefined();
    });
  });

  describe('DeduplicationStage', () => {
    it('should return isDuplicate: false for new evidence', async () => {
      const stage = new DeduplicationStage();
      const evidence = createMockEvidence({ id: 'eid-new' });

      const result = await stage.process(evidence);

      expect(result.isDuplicate).toBe(false);
      expect(result.evidenceId).toBe('eid-new');
      expect(result.sessionId).toBe('session-123');
    });

    it('should detect duplicate by content hash', async () => {
      const stage = new DeduplicationStage();
      const evidence1 = createMockEvidence({ id: 'eid-1' });
      const evidence2 = createMockEvidence({ id: 'eid-2' }); // Same content, different ID

      await stage.process(evidence1);
      const result = await stage.process(evidence2);

      expect(result.isDuplicate).toBe(true);
      expect(result.evidenceId).toBe('eid-1'); // Returns original evidence ID
    });

    it('should detect duplicate by session ID', async () => {
      const stage = new DeduplicationStage();
      const evidence1 = createMockEvidence({ id: 'eid-1', metadata: { sessionId: 'session-123' } });
      const evidence2 = createMockEvidence({ 
        id: 'eid-2', 
        // Different content but same session
        payload: { interactionType: 'scroll', target: 'div.content' },
        metadata: { sessionId: 'session-123' },
      });

      await stage.process(evidence1);
      const result = await stage.process(evidence2);

      expect(result.isDuplicate).toBe(true);
      expect(result.evidenceId).toBe('eid-1');
    });

    it('should not deduplicate across different sessions', async () => {
      const stage = new DeduplicationStage();
      const evidence1 = createMockEvidence({ id: 'eid-1', metadata: { sessionId: 'session-a' } });
      const evidence2 = createMockEvidence({ 
        id: 'eid-2', 
        payload: { interactionType: 'click', target: 'button' },
        metadata: { sessionId: 'session-b' },
      });

      await stage.process(evidence1);
      const result = await stage.process(evidence2);

      expect(result.isDuplicate).toBe(false);
      expect(result.evidenceId).toBe('eid-2');
    });

    it('should deduplicate same content across different sessions', async () => {
      const stage = new DeduplicationStage();
      const evidence1 = createMockEvidence({ id: 'eid-1', metadata: { sessionId: 'session-a' } });
      const evidence2 = createMockEvidence({ 
        id: 'eid-2', 
        // Same content as evidence1
        metadata: { sessionId: 'session-b' },
      });

      await stage.process(evidence1);
      const result = await stage.process(evidence2);

      // Content-hash deduplication should still catch it
      expect(result.isDuplicate).toBe(true);
      expect(result.evidenceId).toBe('eid-1');
    });

    it('should handle evidence without session ID', async () => {
      const stage = new DeduplicationStage();
      const evidence = createMockEvidence({ 
        id: 'eid-no-session', 
        metadata: { version: '1.0' }, // No sessionId
      });

      const result = await stage.process(evidence);

      expect(result.isDuplicate).toBe(false);
      expect(result.sessionId).toBeNull();
    });
  });

  describe('Integration with pipeline', () => {
    it('should work through multiple process calls', async () => {
      const stage = new DeduplicationStage();
      const evidence = createMockEvidence({ id: 'eid-1' });

      const result1 = await stage.process(evidence);
      const result2 = await stage.process(evidence);
      const result3 = await stage.process(createMockEvidence({ id: 'eid-2', payload: { interactionType: 'scroll', target: 'window' }, metadata: { sessionId: 'session-456', version: '1.0' } }));

      expect(result1.isDuplicate).toBe(false);
      expect(result2.isDuplicate).toBe(true);
      expect(result3.isDuplicate).toBe(false);
    });
  });
});