/**
 * Business Metrics Tests (VAE Sprint 13)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getBusinessMetrics } from './index';

describe('Business Metrics', () => {
  let businessMetrics;

  beforeEach(() => {
    vi.resetModules();
    businessMetrics = getBusinessMetrics();
  });

  it('starts with empty snapshot', () => {
    const snap = businessMetrics.getSnapshot();
    expect(snap.totalRewardsPayout).toBe(0);
    expect(snap.totalRewardsCount).toBe(0);
    expect(snap.activeCampaigns).toBe(0);
  });

  it('records payouts and calculates totals', () => {
    businessMetrics.recordPayout(1000, 'user-1', 'camp-1');
    businessMetrics.recordPayout(2000, 'user-2', 'camp-1');
    businessMetrics.recordPayout(1500, 'user-1', 'camp-2');

    const snap = businessMetrics.getSnapshot();
    expect(snap.totalRewardsPayout).toBe(4500);
    expect(snap.totalRewardsCount).toBe(3);
    expect(snap.avgRewardAmount).toBe(1500);
    expect(snap.uniqueRecipients).toBe(2);
  });

  it('records publisher yields', () => {
    businessMetrics.recordPublisherYield('pub-1', 50000, 10);
    businessMetrics.recordPublisherYield('pub-2', 30000, 5);

    const snap = businessMetrics.getSnapshot();
    expect(snap.totalPublisherYield).toBe(80000);
    expect(snap.avgPublisherYield).toBe(40000);
    expect(snap.topPerformingPublishers).toHaveLength(2);
    expect(snap.topPerformingPublishers[0].publisherId).toBe('pub-1');
  });

  it('records platform revenue', () => {
    businessMetrics.recordPlatformRevenue(100000, 10000);
    const snap = businessMetrics.getSnapshot();
    expect(snap.platformRevenue).toBe(100000);
    expect(snap.platformFees).toBe(10000);
    expect(snap.platformMargin).toBe(0.1);
  });

  it('getDailyTrend returns snapshots', () => {
    businessMetrics.recordPayout(1000, 'user-1', 'camp-1');
    const trend = businessMetrics.getDailyTrend(7);
    expect(trend).toHaveLength(7);
  });

  it('getTopPublishers returns sorted results', () => {
    businessMetrics.recordPublisherYield('pub-a', 10000, 2);
    businessMetrics.recordPublisherYield('pub-b', 50000, 10);
    businessMetrics.recordPublisherYield('pub-c', 30000, 5);

    const top = businessMetrics.getTopPublishers(2);
    expect(top).toHaveLength(2);
    expect(top[0].publisherId).toBe('pub-b');
    expect(top[0].yield).toBe(50000);
    expect(top[1].publisherId).toBe('pub-c');
  });
});
