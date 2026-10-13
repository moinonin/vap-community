/**
 * Attention Metrics (VAE Sprint 13)
 *
 * Verified sessions, confidence distribution, fraud rates.
 */

import { z } from 'zod';
import type { Proof, ProofState } from '@verified-attention/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export const MetricsSnapshotSchema = z.object({
  timestamp: z.string().datetime(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  totalSessions: z.number().int().nonnegative(),
  verifiedSessions: z.number().int().nonnegative(),
  verificationRate: z.number().min(0).max(1),
  avgConfidence: z.number().min(0).max(1),
  medianConfidence: z.number().min(0).max(1),
  confidenceBuckets: z.object({
    low: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    veryHigh: z.number().int().nonnegative(),
  }),
  fraudFlags: z.number().int().nonnegative(),
  fraudRate: z.number().min(0).max(1),
  proofsIssued: z.number().int().nonnegative(),
  proofsRevoked: z.number().int().nonnegative(),
  proofsExpired: z.number().int().nonnegative(),
});

export type MetricsSnapshot = z.infer<typeof MetricsSnapshotSchema>;

export interface AttentionMetrics {
  recordProof(proof: Proof): void;
  recordSession(total: number, verified: number): void;
  recordFraudFlag(count: number): void;
  getSnapshot(windowStart?: string, windowEnd?: string): MetricsSnapshot;
  getConfidenceDistribution(): MetricsSnapshot['confidenceBuckets'];
  getDailyTrend(days: number): MetricsSnapshot[];
}

// ─── In-Memory Engine ─────────────────────────────────────────────────────────

export class AttentionMetricsEngine implements AttentionMetrics {
  private proofs: Proof[] = [];
  private sessions = { total: 0, verified: 0 };
  private fraudFlags = 0;

  recordProof(proof: Proof): void {
    this.proofs.push(proof);
  }

  recordSession(total: number, verified: number): void {
    this.sessions.total += total;
    this.sessions.verified += verified;
  }

  recordFraudFlag(count: number): void {
    this.fraudFlags += count;
  }

  getSnapshot(_windowStart?: string, _windowEnd?: string): MetricsSnapshot {
    const now = new Date().toISOString();
    const pubProofs = this.proofs.filter(p => p.state === 'PUBLISHED');
    const revProofs = this.proofs.filter(p => p.state === 'REVOKED');
    const expProofs = this.proofs.filter(p => p.state === 'EXPIRED');

    const confidences = pubProofs.map(p => p.confidence).sort((a, b) => a - b);
    const median = confidences.length > 0 ? confidences[Math.floor(confidences.length / 2)] : 0;
    const avg = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

    return {
      timestamp: now,
      windowStart: now,
      windowEnd: now,
      totalSessions: this.sessions.total,
      verifiedSessions: this.sessions.verified,
      verificationRate: this.sessions.total > 0 ? this.sessions.verified / this.sessions.total : 0,
      avgConfidence: avg,
      medianConfidence: median,
      confidenceBuckets: {
        low: confidences.filter(c => c < 0.5).length,
        medium: confidences.filter(c => c >= 0.5 && c < 0.8).length,
        high: confidences.filter(c => c >= 0.8 && c < 0.95).length,
        veryHigh: confidences.filter(c => c >= 0.95).length,
      },
      fraudFlags: this.fraudFlags,
      fraudRate: pubProofs.length > 0 ? this.fraudFlags / pubProofs.length : 0,
      proofsIssued: pubProofs.length,
      proofsRevoked: revProofs.length,
      proofsExpired: expProofs.length,
    };
  }

  getConfidenceDistribution(): MetricsSnapshot['confidenceBuckets'] {
    const pubProofs = this.proofs.filter(p => p.state === 'PUBLISHED');
    const confidences = pubProofs.map(p => p.confidence);
    return {
      low: confidences.filter(c => c < 0.5).length,
      medium: confidences.filter(c => c >= 0.5 && c < 0.8).length,
      high: confidences.filter(c => c >= 0.8 && c < 0.95).length,
      veryHigh: confidences.filter(c => c >= 0.95).length,
    };
  }

  getDailyTrend(_days: number): MetricsSnapshot[] {
    return [this.getSnapshot()];
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _engine: AttentionMetrics | null = null;

export function getAttentionMetrics(): AttentionMetrics {
  if (!_engine) _engine = new AttentionMetricsEngine();
  return _engine;
}

export function setAttentionMetrics(engine: AttentionMetrics): void {
  _engine = engine;
}
