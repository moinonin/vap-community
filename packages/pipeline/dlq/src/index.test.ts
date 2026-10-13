import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeadLetterQueue, DLQStatus, DEFAULT_DLQ_CONFIG } from './index';

describe('DeadLetterQueue', () => {
  let dlq: DeadLetterQueue;

  beforeEach(() => {
    dlq = new DeadLetterQueue({ baseRetryDelayMs: 10, maxRetryDelayMs: 1000, maxRetries: 3 });
  });

  it('should add failed evidence', () => {
    const entry = dlq.add({ evidenceId: 'test-1' }, 'validation_error');
    expect(entry.id).toMatch(/^dlq-/);
    expect(entry.retryCount).toBe(0);
    expect(entry.status).toBe(DLQStatus.PENDING);
    expect(entry.failureReasons).toEqual(['validation_error']);
  });

  it('should record retry failures and increment count', () => {
    const entry = dlq.add({ evidenceId: 'test-1' }, 'error-1');
    dlq.recordRetryFailure(entry.id, 'error-2');
    dlq.recordRetryFailure(entry.id, 'error-3');
    const updated = dlq.get(entry.id)!;
    expect(updated.retryCount).toBe(2);
    expect(updated.failureReasons).toHaveLength(3);
    expect(updated.status).toBe(DLQStatus.RETRYING);
  });

  it('should mark as permanently failed after max retries', () => {
    const entry = dlq.add({ evidenceId: 'test-1' }, 'error-1');
    dlq.recordRetryFailure(entry.id, 'error-2');
    dlq.recordRetryFailure(entry.id, 'error-3');
    dlq.recordRetryFailure(entry.id, 'error-4');
    const updated = dlq.get(entry.id)!;
    expect(updated.retryCount).toBe(3);
    expect(updated.status).toBe(DLQStatus.PERMANENTLY_FAILED);
  });

  it('should mark as reprocessed', () => {
    const entry = dlq.add({ evidenceId: 'test-1' }, 'error-1');
    dlq.markReprocessed(entry.id);
    const updated = dlq.get(entry.id)!;
    expect(updated.status).toBe(DLQStatus.REPROCESSED);
  });

  it('should compute exponential backoff delay', () => {
    const entry = dlq.add({ evidenceId: 'test-1' }, 'error-1');
    const initialDelay = entry.nextRetryAt - entry.firstFailedAt;
    expect(initialDelay).toBeGreaterThanOrEqual(10);
    dlq.recordRetryFailure(entry.id, 'error-2');
    const updated = dlq.get(entry.id)!;
    const secondDelay = updated.nextRetryAt - updated.lastFailedAt;
    expect(secondDelay).toBeGreaterThan(initialDelay);
  });

  it('should get entries ready for retry', () => {
    const entry = dlq.add({ evidenceId: 'test-1' }, 'error-1');
    // Initially pending
    const ready = dlq.getReadyForRetry();
    expect(ready).toHaveLength(1);
    // After retry failure, not ready until nextRetryAt
    dlq.recordRetryFailure(entry.id, 'error-2');
    const readyAfterRetry = dlq.getReadyForRetry();
    expect(readyAfterRetry).toHaveLength(0);
  });

  it('should get entries by status', () => {
    dlq.add({ evidenceId: 'test-1' }, 'error-1');
    dlq.add({ evidenceId: 'test-2' }, 'error-2');
    const pending = dlq.getByStatus(DLQStatus.PENDING);
    expect(pending).toHaveLength(2);
  });

  it('should compute statistics', () => {
    dlq.add({ evidenceId: 'test-1' }, 'error-1');
    const entry2 = dlq.add({ evidenceId: 'test-2' }, 'error-2');
    dlq.recordRetryFailure(entry2.id, 'error-3');
    dlq.recordRetryFailure(entry2.id, 'error-4');
    dlq.recordRetryFailure(entry2.id, 'error-5');
    const stats = dlq.getStats();
    expect(stats.total).toBe(2);
    expect(stats.pending).toBe(1);
    expect(stats.permanentlyFailed).toBe(1);
  });

  it('should remove entries', () => {
    const entry = dlq.add({ evidenceId: 'test-1' }, 'error-1');
    expect(dlq.remove(entry.id)).toBe(true);
    expect(dlq.get(entry.id)).toBeUndefined();
  });

  it('should clear all', () => {
    dlq.add({ evidenceId: 'test-1' }, 'error-1');
    dlq.add({ evidenceId: 'test-2' }, 'error-2');
    dlq.clear();
    expect(dlq.getAll()).toHaveLength(0);
  });
});

describe('DEFAULT_DLQ_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_DLQ_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_DLQ_CONFIG.baseRetryDelayMs).toBe(1000);
    expect(DEFAULT_DLQ_CONFIG.maxRetryDelayMs).toBe(60000);
  });
});
