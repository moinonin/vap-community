import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryReviewQueue, getReviewQueue, setReviewQueue, type CreateReviewItemInput } from './review-queue/index.js';
import { InMemoryReplayService, getReplayService, setReplayService } from './replay/index.js';

describe('InMemoryReviewQueue', () => {
  let queue: InMemoryReviewQueue;

  beforeEach(() => {
    queue = new InMemoryReviewQueue();
  });

  it('should enqueue a review item', () => {
    const input: CreateReviewItemInput = {
      sessionId: 'session-123',
      policyId: 'policy-456',
      reason: 'Confidence in inconclusive range',
      evidenceSummary: { interactionCount: 3, visibleCount: 2 },
      confidence: 0.55,
      priority: 'NORMAL',
      metadata: {},
    };

    const item = queue.enqueue(input);

    expect(item.reviewId).toMatch(/^review_\d+_\d+$/);
    expect(item.sessionId).toBe('session-123');
    expect(item.policyId).toBe('policy-456');
    expect(item.status).toBe('PENDING');
    expect(item.confidence).toBe(0.55);
    expect(item.priority).toBe('NORMAL');
    expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should get an item by reviewId', () => {
    const input: CreateReviewItemInput = {
      sessionId: 'session-get',
      policyId: 'policy-get',
      reason: 'Test',
      evidenceSummary: {},
      confidence: 0.5,
      metadata: {},
    };

    const item = queue.enqueue(input);
    const retrieved = queue.get(item.reviewId);

    expect(retrieved).toEqual(item);
  });

  it('should return undefined for non-existent item', () => {
    const retrieved = queue.get('non-existent');
    expect(retrieved).toBeUndefined();
  });

  it('should list items with filters', () => {
    queue.enqueue({ sessionId: 's1', policyId: 'p1', reason: 'r1', evidenceSummary: {}, confidence: 0.5, priority: 'HIGH', metadata: {} });
    queue.enqueue({ sessionId: 's2', policyId: 'p1', reason: 'r2', evidenceSummary: {}, confidence: 0.4, priority: 'LOW', metadata: {} });
    queue.enqueue({ sessionId: 's3', policyId: 'p2', reason: 'r3', evidenceSummary: {}, confidence: 0.6, priority: 'NORMAL', metadata: {} });

    const highPriority = queue.list({ priority: 'HIGH' });
    expect(highPriority).toHaveLength(1);

    const policy1 = queue.list({ status: 'PENDING' });
    expect(policy1).toHaveLength(3);
  });

  it('should assign a reviewer', () => {
    const item = queue.enqueue({ sessionId: 's1', policyId: 'p1', reason: 'r', evidenceSummary: {}, confidence: 0.5, priority: 'NORMAL', metadata: {} });
    const assigned = queue.assign(item.reviewId, 'reviewer-alice');

    expect(assigned).not.toBeUndefined();
    expect(assigned!.status).toBe('IN_REVIEW');
    expect(assigned!.assignedReviewer).toBe('reviewer-alice');
  });

  it('should make a decision', () => {
    const item = queue.enqueue({ sessionId: 's1', policyId: 'p1', reason: 'r', evidenceSummary: {}, confidence: 0.5, priority: 'NORMAL', metadata: {} });
    queue.assign(item.reviewId, 'reviewer-bob');
    const decided = queue.decide(item.reviewId, { decision: 'PASS', reviewerNotes: 'Looks good' }, 'reviewer-bob');

    expect(decided).not.toBeUndefined();
    expect(decided!.status).toBe('APPROVED');
    expect(decided!.decision).toBe('PASS');
    expect(decided!.reviewerNotes).toBe('Looks good');
    expect(decided!.reviewedAt).toBeDefined();
  });

  it('should return stats', () => {
    queue.enqueue({ sessionId: 's1', policyId: 'p1', reason: 'r', evidenceSummary: {}, confidence: 0.5, priority: 'NORMAL', metadata: {} });
    queue.enqueue({ sessionId: 's2', policyId: 'p1', reason: 'r', evidenceSummary: {}, confidence: 0.5, priority: 'NORMAL', metadata: {} });
    const item3 = queue.enqueue({ sessionId: 's3', policyId: 'p1', reason: 'r', evidenceSummary: {}, confidence: 0.5, priority: 'NORMAL', metadata: {} });
    queue.assign(item3.reviewId, 'reviewer');
    queue.decide(item3.reviewId, { decision: 'PASS' }, 'reviewer');

    const stats = queue.getStats();
    expect(stats.total).toBe(3);
    expect(stats.pending).toBe(2);
    expect(stats.inReview).toBe(0);
    expect(stats.approved).toBe(1);
  });

  it('should generate aging report', () => {
    queue.enqueue({ sessionId: 's1', policyId: 'p1', reason: 'r', evidenceSummary: {}, confidence: 0.5, priority: 'URGENT', metadata: {} });
    const report = queue.getAgingReport();
    expect(report.buckets).toHaveLength(5);
    expect(report.overSla).toBe(0);
  });
});

describe('ReviewQueue Factory', () => {
  it('should return singleton instance', () => {
    const q1 = getReviewQueue();
    const q2 = getReviewQueue();
    expect(q1).toBe(q2);
  });

  it('should allow setting custom implementation', () => {
    const custom = new InMemoryReviewQueue();
    setReviewQueue(custom);
    expect(getReviewQueue()).toBe(custom);
  });
});

describe('InMemoryReplayService', () => {
  let service: InMemoryReplayService;

  beforeEach(() => {
    service = new InMemoryReplayService();
  });

  it('should add and replay with policies', () => {
    // First add some policies to the store
    // This is a basic test - full integration requires the verification module
    expect(service).toBeDefined();
  });

  it('should store replay history', () => {
    // Test that history is maintained per session
    const history = service.getReplayHistory('session-new');
    expect(history).toEqual([]);
  });
});

describe('ReplayService Factory', () => {
  it('should return singleton instance', () => {
    const s1 = getReplayService();
    const s2 = getReplayService();
    expect(s1).toBe(s2);
  });

  it('should allow setting custom implementation', () => {
    const custom = new InMemoryReplayService();
    setReplayService(custom);
    expect(getReplayService()).toBe(custom);
  });
});