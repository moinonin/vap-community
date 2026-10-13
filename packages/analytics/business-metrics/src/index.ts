/**
 * Business Metrics (VAE Sprint 13)
 *
 * Reward payout, campaign ROI, and publisher yield metrics.
 */

import { z } from 'zod';
import type { Campaign } from '@verified-attention/reward-campaigns';
import type { Settlement } from '@verified-attention/reward-settlement';

// ─── Types ────────────────────────────────────────────────────────────────────

export const BusinessMetricsSnapshotSchema = z.object({
  timestamp: z.string().datetime(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  // Reward metrics
  totalRewardsPayout: z.number().int().nonnegative(),
  totalRewardsCount: z.number().int().nonnegative(),
  avgRewardAmount: z.number().int().nonnegative(),
  uniqueRecipients: z.number().int().nonnegative(),
  // Campaign metrics
  activeCampaigns: z.number().int().nonnegative(),
  totalCampaignBudget: z.number().int().nonnegative(),
  totalCampaignSpend: z.number().int().nonnegative(),
  avgCampaignROI: z.number().min(0).max(1),
  // Publisher metrics
  totalPublisherYield: z.number().int().nonnegative(),
  avgPublisherYield: z.number().int().nonnegative(),
  topPerformingPublishers: z.array(z.object({
    publisherId: z.string().min(1),
    yield: z.number().int().nonnegative(),
    contentCount: z.number().int().nonnegative(),
  })),
  // Platform metrics
  platformRevenue: z.number().int().nonnegative(),
  platformFees: z.number().int().nonnegative(),
  platformMargin: z.number().min(0).max(1),
});

export type BusinessMetricsSnapshot = z.infer<typeof BusinessMetricsSnapshotSchema>;

export interface BusinessMetrics {
  recordPayout(amountMicros: number, recipientId: string, campaignId: string): void;
  recordCampaign(campaign: Campaign): void;
  updateCampaignSpend(campaignId: string, spentMicros: number): void;
  recordPublisherYield(publisherId: string, yieldMicros: number, contentCount: number): void;
  recordPlatformRevenue(revenueMicros: number, feesMicros: number): void;
  getSnapshot(windowStart?: string, windowEnd?: string): BusinessMetricsSnapshot;
  getTopPublishers(limit?: number): BusinessMetricsSnapshot['topPerformingPublishers'];
  getDailyTrend(days: number): BusinessMetricsSnapshot[];
}

// ─── In-Memory Business Metrics ───────────────────────────────────────────────

export class BusinessMetricsEngine implements BusinessMetrics {
  private payouts: Array<{
    amountMicros: number;
    recipientId: string;
    campaignId: string;
    timestamp: string;
  }> = [];
  private campaigns = new Map<string, Campaign>();
  private campaignSpend = new Map<string, number>();
  private publisherYields = new Map<string, { yield: number; count: number }>();
  private platformRevenue = 0;
  private platformFees = 0;

  recordPayout(amountMicros: number, recipientId: string, campaignId: string): void {
    this.payouts.push({
      amountMicros,
      recipientId,
      campaignId,
      timestamp: new Date().toISOString(),
    });
  }

  recordCampaign(campaign: Campaign): void {
    this.campaigns.set(campaign.campaignId, campaign);
  }

  updateCampaignSpend(campaignId: string, spentMicros: number): void {
    const current = this.campaignSpend.get(campaignId) || 0;
    this.campaignSpend.set(campaignId, current + spentMicros);
  }

  recordPublisherYield(publisherId: string, yieldMicros: number, contentCount: number): void {
    const existing = this.publisherYields.get(publisherId) || { yield: 0, count: 0 };
    existing.yield += yieldMicros;
    existing.count += contentCount;
    this.publisherYields.set(publisherId, existing);
  }

  recordPlatformRevenue(revenueMicros: number, feesMicros: number): void {
    this.platformRevenue += revenueMicros;
    this.platformFees += feesMicros;
  }

  getSnapshot(windowStart?: string, windowEnd?: string): BusinessMetricsSnapshot {
    const now = new Date().toISOString();
    const windowStartStr = windowStart || this.getWindowStart(now, 1);
    const windowEndStr = windowEnd || now;

    const payoutsInWindow = this.payouts.filter(p => {
      if (windowStart && p.timestamp < windowStart) return false;
      if (windowEnd && p.timestamp > windowEnd) return false;
      return true;
    });

    const totalPayout = payoutsInWindow.reduce((sum, p) => sum + p.amountMicros, 0);
    const uniqueRecipients = new Set(payoutsInWindow.map(p => p.recipientId)).size;
    const avgReward = payoutsInWindow.length > 0
      ? totalPayout / payoutsInWindow.length
      : 0;

    const activeCampaigns = Array.from(this.campaigns.values())
      .filter(c => c.status === 'ACTIVE').length;

    const totalBudget = Array.from(this.campaigns.values())
      .reduce((sum, c) => sum + c.budget.totalBudgetMicros, 0);

    const totalSpend = Array.from(this.campaignSpend.values()).reduce((sum, s) => sum + s, 0);

    // ROI = (revenue - cost) / cost, capped at 0-1
    const roi = totalBudget > 0
      ? Math.min(1, Math.max(0, (totalSpend - totalBudget) / totalBudget))
      : 0;

    const publisherEntries = Array.from(this.publisherYields.entries());
    const totalPublisherYield = publisherEntries.reduce((sum, [, v]) => sum + v.yield, 0);
    const avgPublisherYield = publisherEntries.length > 0
      ? totalPublisherYield / publisherEntries.length
      : 0;

    const topPublishers = publisherEntries
      .sort(([, a], [, b]) => b.yield - a.yield)
      .slice(0, 10)
      .map(([id, v]) => ({
        publisherId: id,
        yield: v.yield,
        contentCount: v.count,
      }));

    const margin = this.platformRevenue > 0
      ? this.platformFees / this.platformRevenue
      : 0;

    return {
      timestamp: now,
      windowStart: windowStartStr,
      windowEnd: windowEndStr,
      totalRewardsPayout: totalPayout,
      totalRewardsCount: payoutsInWindow.length,
      avgRewardAmount: Math.round(avgReward),
      uniqueRecipients,
      activeCampaigns,
      totalCampaignBudget: totalBudget,
      totalCampaignSpend: totalSpend,
      avgCampaignROI: roi,
      totalPublisherYield,
      avgPublisherYield: Math.round(avgPublisherYield),
      topPerformingPublishers: topPublishers,
      platformRevenue: this.platformRevenue,
      platformFees: this.platformFees,
      platformMargin: margin,
    };
  }

  getTopPublishers(limit?: number): BusinessMetricsSnapshot['topPerformingPublishers'] {
    const entries = Array.from(this.publisherYields.entries());
    return entries
      .sort(([, a], [, b]) => b.yield - a.yield)
      .slice(0, limit || 10)
      .map(([id, v]) => ({
        publisherId: id,
        yield: v.yield,
        contentCount: v.count,
      }));
  }

  getDailyTrend(days: number): BusinessMetricsSnapshot[] {
    const result: BusinessMetricsSnapshot[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();

      result.push(this.getSnapshot(dayStart, dayEnd));
    }

    return result;
  }

  private getWindowStart(date: string, daysBack: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() - daysBack);
    return d.toISOString();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _engine: BusinessMetrics | null = null;

export function getBusinessMetrics(): BusinessMetrics {
  if (!_engine) {
    _engine = new BusinessMetricsEngine();
  }
  return _engine;
}

export function setBusinessMetrics(engine: BusinessMetrics): void {
  _engine = engine;
}
