/**
 * Fraud Metrics Tests (VAE Sprint 13)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getFraudMetrics } from './index';

describe('Fraud Metrics', () => {
  let fraudMetrics;

  beforeEach(() => {
    vi.resetModules();
    fraudMetrics = getFraudMetrics();
  });

  it('starts with empty snapshot', () => {
    const snap = fraudMetrics.getSnapshot();
    expect(snap.totalFlags).toBe(0);
    expect(snap.confirmedFraud).toBe(0);
    expect(snap.falsePositives).toBe(0);
    expect(snap.detectionRate).toBe(0);
    expect(snap.precision).toBe(0);
  });

  it('records flags and calculates detection rate', () => {
    fraudMetrics.recordFlag('vec-1', 'Click farm', true);
    fraudMetrics.recordFlag('vec-2', 'Bot network', true);
    fraudMetrics.recordFlag('vec-3', 'False alarm', false);

    const snap = fraudMetrics.getSnapshot();
    expect(snap.totalFlags).toBe(3);
    expect(snap.confirmedFraud).toBe(2);
    expect(snap.falsePositives).toBe(1);
    expect(snap.detectionRate).toBe(2 / 3);
    expect(snap.precision).toBe(2 / 3);
  });

  it('confirms fraud and adds loss prevented', () => {
    fraudMetrics.recordFlag('vec-1', 'Click farm', false);
    fraudMetrics.confirmFraud('vec-1');

    const snap = fraudMetrics.getSnapshot();
    expect(snap.confirmedFraud).toBe(1);
    expect(snap.fraudLossPrevented).toBe(100000);
  });

  it('vector summary includes all vectors', () => {
    fraudMetrics.recordFlag('vec-1', 'Click farm', true);
    fraudMetrics.recordFlag('vec-2', 'Bot network', false);

    const summary = fraudMetrics.getVectorSummary();
    expect(summary.length).toBe(2);
  });

  it('getDailyTrend returns snapshot', () => {
    fraudMetrics.recordFlag('vec-1', 'Test', true);
    const trend = fraudMetrics.getDailyTrend(7);
    expect(trend).toHaveLength(7);
  });
});
