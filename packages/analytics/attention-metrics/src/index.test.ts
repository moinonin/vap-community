/**
 * Attention Metrics Tests (VAE Sprint 13)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAttentionMetrics } from './index';
import type { Proof, ProofState } from '@verified-attention/core';

describe('Attention Metrics', () => {
  let metrics;

  beforeEach(() => {
    vi.resetModules();
    metrics = getAttentionMetrics();
  });

  it('starts with empty snapshot', () => {
    const snap = metrics.getSnapshot();
    expect(snap.totalSessions).toBe(0);
    expect(snap.verifiedSessions).toBe(0);
    expect(snap.avgConfidence).toBe(0);
    expect(snap.proofsIssued).toBe(0);
  });

  it('records sessions and calculates verification rate', () => {
    metrics.recordSession(100, 80);
    const snap = metrics.getSnapshot();
    expect(snap.totalSessions).toBe(100);
    expect(snap.verifiedSessions).toBe(80);
    expect(snap.verificationRate).toBe(0.8);
  });

  it('records proofs and calculates confidence stats', () => {
    const proofs: Proof[] = [
      { proofId: 'p1', sessionId: 's1', contentId: 'c1', confidence: 0.3, evidenceHash: 'h1', verifierId: 'v1', state: 'PUBLISHED' as ProofState, issuedAt: new Date().toISOString(), metadata: {}, baseMetadata: {} },
      { proofId: 'p2', sessionId: 's2', contentId: 'c2', confidence: 0.7, evidenceHash: 'h2', verifierId: 'v2', state: 'PUBLISHED' as ProofState, issuedAt: new Date().toISOString(), metadata: {}, baseMetadata: {} },
      { proofId: 'p3', sessionId: 's3', contentId: 'c3', confidence: 0.95, evidenceHash: 'h3', verifierId: 'v3', state: 'PUBLISHED' as ProofState, issuedAt: new Date().toISOString(), metadata: {}, baseMetadata: {} },
    ];

    for (const p of proofs) metrics.recordProof(p);
    const snap = metrics.getSnapshot();
    expect(snap.proofsIssued).toBe(3);
    expect(snap.avgConfidence).toBeCloseTo(0.65, 1);
    expect(snap.confidenceBuckets.low).toBe(1);
    expect(snap.confidenceBuckets.medium).toBe(1);
    expect(snap.confidenceBuckets.veryHigh).toBe(1);
  });

  it('records fraud flags', () => {
    metrics.recordFraudFlag(5);
    const snap = metrics.getSnapshot();
    expect(snap.fraudFlags).toBe(5);
  });

  it('confidence distribution buckets proofs correctly', () => {
    const proofs: Proof[] = [
      { proofId: 'p1', sessionId: 's1', contentId: 'c1', confidence: 0.3, evidenceHash: 'h1', verifierId: 'v1', state: 'PUBLISHED' as ProofState, issuedAt: new Date().toISOString(), metadata: {}, baseMetadata: {} },
      { proofId: 'p2', sessionId: 's2', contentId: 'c2', confidence: 0.6, evidenceHash: 'h2', verifierId: 'v2', state: 'PUBLISHED' as ProofState, issuedAt: new Date().toISOString(), metadata: {}, baseMetadata: {} },
      { proofId: 'p3', sessionId: 's3', contentId: 'c3', confidence: 0.85, evidenceHash: 'h3', verifierId: 'v3', state: 'PUBLISHED' as ProofState, issuedAt: new Date().toISOString(), metadata: {}, baseMetadata: {} },
      { proofId: 'p4', sessionId: 's4', contentId: 'c4', confidence: 0.96, evidenceHash: 'h4', verifierId: 'v4', state: 'PUBLISHED' as ProofState, issuedAt: new Date().toISOString(), metadata: {}, baseMetadata: {} },
    ];

    for (const p of proofs) metrics.recordProof(p);
    const dist = metrics.getConfidenceDistribution();
    expect(dist.low).toBe(1);
    expect(dist.medium).toBe(1);
    expect(dist.high).toBe(1);
    expect(dist.veryHigh).toBe(1);
  });

  it('only counts PUBLISHED proofs for confidence', () => {
    metrics.recordProof({ proofId: 'p1', sessionId: 's1', contentId: 'c1', confidence: 0.9, evidenceHash: 'h1', verifierId: 'v1', state: 'REVOKED' as ProofState, issuedAt: new Date().toISOString(), metadata: {}, baseMetadata: {} });
    const dist = metrics.getConfidenceDistribution();
    expect(dist.low).toBe(0);
    expect(dist.medium).toBe(0);
    expect(dist.high).toBe(0);
    expect(dist.veryHigh).toBe(0);
  });

  it('getDailyTrend returns snapshot', () => {
    const trend = metrics.getDailyTrend(7);
    expect(trend).toHaveLength(7);
  });

  it('snapshot includes revocation and expiry counts', () => {
    metrics.recordProof({ proofId: 'p1', sessionId: 's1', contentId: 'c1', confidence: 0.5, evidenceHash: 'h1', verifierId: 'v1', state: 'REVOKED' as ProofState, issuedAt: new Date().toISOString(), metadata: {}, baseMetadata: {} });
    metrics.recordProof({ proofId: 'p2', sessionId: 's2', contentId: 'c2', confidence: 0.5, evidenceHash: 'h2', verifierId: 'v2', state: 'EXPIRED' as ProofState, issuedAt: new Date().toISOString(), metadata: {}, baseMetadata: {} });
    const snap = metrics.getSnapshot();
    expect(snap.proofsRevoked).toBe(1);
    expect(snap.proofsExpired).toBe(1);
  });
});
