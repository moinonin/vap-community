/**
 * Ops Metrics Tests (VAE Sprint 13)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOpsMetrics } from './index';

describe('Ops Metrics', () => {
  let opsMetrics;

  beforeEach(() => {
    vi.resetModules();
    opsMetrics = getOpsMetrics();
  });

  it('starts with empty snapshot', () => {
    const snap = opsMetrics.getSnapshot();
    expect(snap.evidenceIngested).toBe(0);
    expect(snap.proofsGenerated).toBe(0);
    expect(snap.verificationsCompleted).toBe(0);
    expect(snap.errorRateEvidence).toBe(0);
  });

  it('records evidence ingestion', () => {
    opsMetrics.recordEvidenceIngestion(10, true);
    opsMetrics.recordEvidenceIngestion(20, true);
    opsMetrics.recordEvidenceIngestion(30, false);
    const snap = opsMetrics.getSnapshot();
    expect(snap.evidenceIngested).toBe(3);
    expect(snap.errorRateEvidence).toBe(1 / 3);
  });

  it('records proof generation', () => {
    opsMetrics.recordProofGeneration(100, true);
    opsMetrics.recordProofGeneration(200, false);
    const snap = opsMetrics.getSnapshot();
    expect(snap.proofsGenerated).toBe(2);
    expect(snap.errorRateProofGeneration).toBe(0.5);
  });

  it('records verification', () => {
    opsMetrics.recordVerification(50, true);
    opsMetrics.recordVerification(60, true);
    opsMetrics.recordVerification(70, true);
    const snap = opsMetrics.getSnapshot();
    expect(snap.verificationsCompleted).toBe(3);
    expect(snap.errorRateVerification).toBe(0);
  });

  it('latency percentiles work', () => {
    for (let i = 0; i < 100; i++) {
      opsMetrics.recordEvidenceIngestion(i, true);
    }
    const percentiles = opsMetrics.getLatencyPercentiles();
    expect(percentiles.evidence.p50).toBeGreaterThan(0);
    expect(percentiles.evidence.p95).toBeGreaterThan(percentiles.evidence.p50);
    expect(percentiles.evidence.p99).toBeGreaterThan(percentiles.evidence.p95);
  });

  it('updates queue depth', () => {
    opsMetrics.updateQueueDepth(10, 5, 3);
    const snap = opsMetrics.getSnapshot();
    expect(snap.queueDepthEvidence).toBe(10);
    expect(snap.queueDepthProofGen).toBe(5);
    expect(snap.queueDepthVerification).toBe(3);
  });

  it('updates system health', () => {
    opsMetrics.updateSystemHealth(50, 70, 30);
    const snap = opsMetrics.getSnapshot();
    expect(snap.cpuUsage).toBe(50);
    expect(snap.memoryUsage).toBe(70);
    expect(snap.diskUsage).toBe(30);
  });

  it('getDailyTrend returns snapshots', () => {
    opsMetrics.recordEvidenceIngestion(10, true);
    const trend = opsMetrics.getDailyTrend(7);
    expect(trend).toHaveLength(7);
  });
});
