/**
 * Manual Review Queue (VAE Sprint 10)
 *
 * Handles verification outcomes that are INCONCLUSIVE and require human review.
 * Integrates with the verification engine to queue items for manual adjudication.
 */

import { z } from 'zod';

// ─── Review Item Schema ─────────────────────────────────────────────────────

export const ReviewItemSchema = z.object({
  reviewId: z.string().min(1),
  sessionId: z.string().min(1),
  policyId: z.string().min(1),
  status: z.enum(['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ESCALATED']).default('PENDING'),
  reason: z.string(),
  evidenceSummary: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  assignedReviewer: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().optional(),
  reviewerNotes: z.string().optional(),
  decision: z.enum(['PASS', 'FAIL']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  metadata: z.record(z.unknown()).default({}),
});

export type ReviewItem = z.infer<typeof ReviewItemSchema>;

export const CreateReviewItemInputSchema = z.object({
  sessionId: z.string().min(1),
  policyId: z.string().min(1),
  reason: z.string(),
  evidenceSummary: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  metadata: z.record(z.unknown()).default({}),
});

export type CreateReviewItemInput = z.infer<typeof CreateReviewItemInputSchema>;

export const ReviewDecisionInputSchema = z.object({
  decision: z.enum(['PASS', 'FAIL']),
  reviewerNotes: z.string().optional(),
});

export type ReviewDecisionInput = z.infer<typeof ReviewDecisionInputSchema>;

// ─── Review Queue Interface ──────────────────────────────────────────────────

export type ReviewQueue = {
  enqueue(item: CreateReviewItemInput): ReviewItem;
  get(reviewId: string): ReviewItem | undefined;
  list(filters?: ReviewQueueFilters): ReviewItem[];
  assign(reviewId: string, reviewerId: string): ReviewItem | undefined;
  decide(reviewId: string, decision: ReviewDecisionInput, reviewerId: string): ReviewItem | undefined;
  getStats(): ReviewQueueStats;
  getAgingReport(): ReviewAgingReport;
};

export interface ReviewQueueFilters {
  status?: ReviewItem['status'];
  assignedReviewer?: string;
  priority?: ReviewItem['priority'];
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export interface ReviewQueueStats {
  total: number;
  pending: number;
  inReview: number;
  approved: number;
  rejected: number;
  escalated: number;
  avgResolutionTimeMs: number;
  oldestPendingMs: number;
}

export interface ReviewAgingReport {
  buckets: Array<{
    range: string;
    count: number;
    oldestMs: number;
  }>;
  overSla: number;
}

// ─── In-Memory Review Queue Implementation ──────────────────────────────────

export class InMemoryReviewQueue implements ReviewQueue {
  private queue: Map<string, ReviewItem> = new Map();
  private reviewCounter = 0;

  // SLA thresholds in milliseconds
  private static readonly SLA_THRESHOLDS: Record<ReviewItem['priority'], number> = {
    URGENT: 60 * 60 * 1000,       // 1 hour
    HIGH: 4 * 60 * 60 * 1000,     // 4 hours
    NORMAL: 24 * 60 * 60 * 1000,  // 24 hours
    LOW: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  enqueue(input: CreateReviewItemInput): ReviewItem {
    const reviewId = `review_${Date.now()}_${++this.reviewCounter}`;
    const now = new Date().toISOString();

    const item: ReviewItem = {
      reviewId,
      sessionId: input.sessionId,
      policyId: input.policyId,
      status: 'PENDING',
      reason: input.reason,
      evidenceSummary: input.evidenceSummary,
      confidence: input.confidence,
      assignedReviewer: undefined,
      createdAt: now,
      updatedAt: now,
      reviewedAt: undefined,
      reviewerNotes: undefined,
      decision: undefined,
      priority: input.priority,
      metadata: input.metadata,
    };

    this.queue.set(reviewId, item);
    return item;
  }

  get(reviewId: string): ReviewItem | undefined {
    return this.queue.get(reviewId);
  }

  list(filters: ReviewQueueFilters = {}): ReviewItem[] {
    let items = Array.from(this.queue.values());

    if (filters.status) {
      items = items.filter((item) => item.status === filters.status);
    }
    if (filters.assignedReviewer) {
      items = items.filter((item) => item.assignedReviewer === filters.assignedReviewer);
    }
    if (filters.priority) {
      items = items.filter((item) => item.priority === filters.priority);
    }
    if (filters.fromDate) {
      const from = new Date(filters.fromDate).getTime();
      items = items.filter((item) => new Date(item.createdAt).getTime() >= from);
    }
    if (filters.toDate) {
      const to = new Date(filters.toDate).getTime();
      items = items.filter((item) => new Date(item.createdAt).getTime() <= to);
    }

    // Sort by priority then creation time
    const priorityOrder: Record<ReviewItem['priority'], number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    items.sort((a, b) => {
      const pDiff = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      if (pDiff !== 0) return pDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    if (filters.offset) {
      items = items.slice(filters.offset);
    }
    if (filters.limit) {
      items = items.slice(0, filters.limit);
    }

    return items;
  }

  assign(reviewId: string, reviewerId: string): ReviewItem | undefined {
    const item = this.queue.get(reviewId);
    if (!item) return undefined;
    if (item.status !== 'PENDING') return undefined;

    item.status = 'IN_REVIEW';
    item.assignedReviewer = reviewerId;
    item.updatedAt = new Date().toISOString();
    return item;
  }

  decide(reviewId: string, decision: ReviewDecisionInput, reviewerId: string): ReviewItem | undefined {
    const item = this.queue.get(reviewId);
    if (!item) return undefined;
    if (item.status !== 'IN_REVIEW' && item.status !== 'PENDING') return undefined;
    if (item.assignedReviewer && item.assignedReviewer !== reviewerId) return undefined;

    const now = new Date().toISOString();
    item.status = decision.decision === 'PASS' ? 'APPROVED' : 'REJECTED';
    item.decision = decision.decision;
    item.reviewerNotes = decision.reviewerNotes;
    item.reviewedAt = now;
    item.updatedAt = now;

    return item;
  }

  getStats(): ReviewQueueStats {
    const items = Array.from(this.queue.values());
    const now = Date.now();

    const statusCounts = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<ReviewItem['status'], number>
    );

    const resolved = items.filter((i) => i.reviewedAt);
    const avgResolutionTimeMs =
      resolved.length > 0
        ? resolved.reduce((sum, i) => sum + (new Date(i.reviewedAt!).getTime() - new Date(i.createdAt).getTime()), 0) / resolved.length
        : 0;

    const pending = items.filter((i) => i.status === 'PENDING' || i.status === 'IN_REVIEW');
    const oldestPendingMs =
      pending.length > 0
        ? now - Math.min(...pending.map((i) => new Date(i.createdAt).getTime()))
        : 0;

    return {
      total: items.length,
      pending: statusCounts.PENDING || 0,
      inReview: statusCounts.IN_REVIEW || 0,
      approved: statusCounts.APPROVED || 0,
      rejected: statusCounts.REJECTED || 0,
      escalated: statusCounts.ESCALATED || 0,
      avgResolutionTimeMs: Math.round(avgResolutionTimeMs),
      oldestPendingMs,
    };
  }

  getAgingReport(): ReviewAgingReport {
    const items = Array.from(this.queue.values()).filter(
      (i) => i.status === 'PENDING' || i.status === 'IN_REVIEW'
    );
    const now = Date.now();

    const buckets = [
      { range: '< 1h', maxMs: 60 * 60 * 1000 },
      { range: '1h - 4h', maxMs: 4 * 60 * 60 * 1000 },
      { range: '4h - 24h', maxMs: 24 * 60 * 60 * 1000 },
      { range: '1d - 7d', maxMs: 7 * 24 * 60 * 60 * 1000 },
      { range: '> 7d', maxMs: Infinity },
    ];

    const result = buckets.map((bucket) => {
      const inBucket = items.filter((i) => {
        const ageMs = now - new Date(i.createdAt).getTime();
        return ageMs < bucket.maxMs;
      });
      return {
        range: bucket.range,
        count: inBucket.length,
        oldestMs: inBucket.length > 0 ? Math.max(...inBucket.map((i) => now - new Date(i.createdAt).getTime())) : 0,
      };
    });

    const overSla = items.filter((i) => {
      const priority = i.priority ?? 'NORMAL';
      const threshold = InMemoryReviewQueue.SLA_THRESHOLDS[priority] ?? InMemoryReviewQueue.SLA_THRESHOLDS.NORMAL;
      return now - new Date(i.createdAt).getTime() > threshold;
    }).length;

    return { buckets: result, overSla };
  }
}

// ─── Review Queue Factory ────────────────────────────────────────────────────

export class ReviewQueueFactory {
  static getInstance(): ReviewQueue {
    if (!_reviewQueue) {
      _reviewQueue = new InMemoryReviewQueue();
    }
    return _reviewQueue;
  }

  static setInstance(queue: ReviewQueue): void {
    _reviewQueue = queue;
  }
}

let _reviewQueue: ReviewQueue | null = null;

export function getReviewQueue(): ReviewQueue {
  return ReviewQueueFactory.getInstance();
}

export function setReviewQueue(queue: ReviewQueue): void {
  ReviewQueueFactory.setInstance(queue);
}