import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { EvidenceQueue } from './index';
import { makeEvidence, ManualTimers, MemoryStorage } from '../test-support';

describe('EvidenceQueue', () => {
  it('drops evidence that fails pre-send validation', () => {
    const onError = vi.fn();
    const q = new EvidenceQueue({ send: async () => '', onError, storage: null });
    expect(q.enqueue({ bogus: true })).toBe(false);
    expect(q.size).toBe(0);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('flushes automatically at batch size', async () => {
    const sent: unknown[] = [];
    const q = new EvidenceQueue({
      batchSize: 3,
      storage: null,
      send: async (e) => {
        sent.push(e);
        return '';
      },
    });
    q.enqueue(makeEvidence());
    q.enqueue(makeEvidence());
    q.enqueue(makeEvidence());
    await new Promise((r) => setImmediate(r));
    expect(sent).toHaveLength(3);
    expect(q.size).toBe(0);
  });

  it('flushes on the interval timer', async () => {
    const timers = new ManualTimers();
    const sent: unknown[] = [];
    const q = new EvidenceQueue({
      storage: null,
      timers,
      send: async (e) => {
        sent.push(e);
        return '';
      },
    });
    q.enqueue(makeEvidence());
    q.start(5000);
    await new Promise((r) => setImmediate(r));
    expect(sent).toHaveLength(0);
    timers.tick();
    await new Promise((r) => setImmediate(r));
    expect(sent).toHaveLength(1);
  });

  it('retries transient failures with backoff, keeping the item queued', async () => {
    const sent: unknown[] = [];
    let calls = 0;
    let now = 0;
    const q = new EvidenceQueue({
      storage: null,
      batchSize: 100,
      now: () => now,
      send: async (e) => {
        calls += 1;
        if (calls === 1) throw new Error('offline'); // network failure → retryable
        sent.push(e);
        return '';
      },
    });
    q.enqueue(makeEvidence());
    await q.flush(); // fails, schedules backoff
    expect(q.size).toBe(1);
    expect(sent).toHaveLength(0);
    await q.flush(); // still inside backoff window → skipped
    expect(sent).toHaveLength(0);
    now += 5000; // past backoff
    await q.flush();
    expect(sent).toHaveLength(1);
    expect(q.size).toBe(0);
  });

  it('retries 5xx but permanently drops 4xx', async () => {
    const onError = vi.fn();
    const sent: unknown[] = [];
    let now = 0;
    let calls = 0;
    const q = new EvidenceQueue({
      storage: null,
      batchSize: 100,
      now: () => now,
      onError,
      send: async (e) => {
        calls += 1;
        if (calls === 1) throw new ApiError('server exploded', 500);
        if (calls === 2) throw new ApiError('rejected', 400);
        sent.push(e);
        return '';
      },
    });
    q.enqueue(makeEvidence());
    q.enqueue(makeEvidence());
    q.enqueue(makeEvidence());
    await q.flush(); // first: 500 → stays; loop breaks
    now += 2000;
    await q.flush(); // first retried ok; second: 400 → dropped; third sent
    expect(q.size).toBe(0);
    expect(sent).toHaveLength(2);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('persists queued items to storage and restores them on construction', async () => {
    const storage = new MemoryStorage();
    const sent: unknown[] = [];
    const q1 = new EvidenceQueue({
      storage,
      batchSize: 100,
      send: async () => {
        throw new Error('offline');
      },
    });
    q1.enqueue(makeEvidence());
    // Persisted but unsent (offline).
    const q2 = new EvidenceQueue({
      storage,
      batchSize: 100,
      send: async (e) => {
        sent.push(e);
        return '';
      },
    });
    expect(q2.size).toBe(1);
    await q2.flush();
    expect(sent).toHaveLength(1);
    expect(storage.map.size).toBe(0); // storage cleared after successful flush
  });

  it('clears corrupted persisted state instead of crashing', () => {
    const storage = new MemoryStorage();
    storage.setItem('vap:evidence-queue', 'not-json{{');
    const q = new EvidenceQueue({ storage, send: async () => '' });
    expect(q.size).toBe(0);
  });
});
