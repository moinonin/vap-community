/**
 * Settlement Preparation Engine (VAE Sprint 12)
 *
 * Prepares settlement for reward payouts:
 * - Ledger entries (double-entry bookkeeping)
 * - Export formats (CSV, JSON, Parquet, SQL)
 * - Reconciliation (balance verification, discrepancy detection)
 * - Audit trail for financial compliance
 */

import { z } from 'zod';
import type { Campaign } from '@verified-attention/reward-campaigns';
import type { EligibilityResult } from '@verified-attention/reward-eligibility';
import type { PricingResult } from '@verified-attention/reward-pricing';
import type { BudgetState } from '@verified-attention/reward-budget';

// ─── Types ────────────────────────────────────────────────────────────────────

export const SettlementStatusSchema = z.enum([
  'PENDING',
  'PREPARING',
  'READY',
  'EXPORTED',
  'RECONCILED',
  'FAILED',
  'CANCELLED',
]);

export type SettlementStatus = z.infer<typeof SettlementStatusSchema>;

export const LedgerEntryTypeSchema = z.enum([
  'REWARD_PAYOUT',
  'CAMPAIGN_FUNDING',
  'BUDGET_ALLOCATION',
  'BUDGET_SPEND',
  'BUDGET_COMMITMENT',
  'BUDGET_RELEASE',
  'ROLLOVER',
  'REPLENISHMENT',
  'FEE',
  'ADJUSTMENT',
  'REFUND',
]);

export type LedgerEntryType = z.infer<typeof LedgerEntryTypeSchema>;

export const LedgerEntrySchema = z.object({
  entryId: z.string().min(1),
  settlementId: z.string().min(1),
  timestamp: z.string().datetime(),
  type: LedgerEntryTypeSchema,
  // Double-entry: debit/credit
  account: z.string().min(1),
  debitMicros: z.number().int().nonnegative().default(0),
  creditMicros: z.number().int().nonnegative().default(0),
  currency: z.string().length(3).default('USD'),
  // References
  campaignId: z.string().optional(),
  rewardId: z.string().optional(),
  budgetId: z.string().optional(),
  // Description
  description: z.string(),
  // Balance after this entry
  balanceAfterMicros: z.number().int(),
});

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const SettlementSchema = z.object({
  settlementId: z.string().min(1),
  campaignId: z.string().min(1),
  status: SettlementStatusSchema.default('PENDING'),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  // Aggregated amounts
  totalRewards: z.number().int().nonnegative().default(0),
  totalRewardsMicros: z.number().int().nonnegative().default(0),
  totalFeesMicros: z.number().int().nonnegative().default(0),
  netPayoutMicros: z.number().int().nonnegative().default(0),
  // Counts
  rewardCount: z.number().int().nonnegative().default(0),
  uniqueRecipients: z.number().int().nonnegative().default(0),
  uniqueVerifiers: z.number().int().nonnegative().default(0),
  // Status tracking
  preparedAt: z.string().datetime().optional(),
  exportedAt: z.string().datetime().optional(),
  reconciledAt: z.string().datetime().optional(),
  failedAt: z.string().datetime().optional(),
  failureReason: z.string().optional(),
  // Export info
  exportFormat: z.enum(['CSV', 'JSON', 'PARQUET', 'SQL']).optional(),
  exportPath: z.string().optional(),
  // Reconciliation
  reconciliation: z.object({
    expectedTotalMicros: z.number().int().nonnegative().default(0),
    actualTotalMicros: z.number().int().nonnegative().default(0),
    discrepancyMicros: z.number().int().default(0),
    isBalanced: z.boolean().default(false),
    checkedAt: z.string().datetime().optional(),
    checkedBy: z.string().optional(),
  }).optional(),
  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().optional(),
});

export type Settlement = z.infer<typeof SettlementSchema>;

export const RewardPayoutSchema = z.object({
  payoutId: z.string().min(1),
  settlementId: z.string().min(1),
  campaignId: z.string().min(1),
  rewardId: z.string().min(1),
  // Recipient info
  recipientId: z.string().min(1), // viewer/user ID
  recipientType: z.enum(['VIEWER', 'PUBLISHER', 'VERIFIER', 'PLATFORM']),
  // Amounts
  grossAmountMicros: z.number().int().positive(),
  feeMicros: z.number().int().nonnegative().default(0),
  netAmountMicros: z.number().int().nonnegative().default(0),
  currency: z.string().length(3).default('USD'),
  // References
  proofId: z.string().min(1),
  verifierId: z.string().min(1),
  contentId: z.string().min(1),
  sessionId: z.string().min(1),
  // Pricing breakdown
  pricingBreakdown: z.object({
    basePriceMicros: z.number().int().positive(),
    contentTypeMultiplier: z.number().positive(),
    qualityTierMultiplier: z.number().positive(),
    confidenceMultiplier: z.number().positive(),
    marketMultiplier: z.number().positive(),
    engagementMultiplier: z.number().positive(),
    publisherMultiplier: z.number().positive(),
  }).optional(),
  // Metadata
  createdAt: z.string().datetime(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']).default('PENDING'),
});

export type RewardPayout = z.infer<typeof RewardPayoutSchema>;

export const ExportFormatSchema = z.enum(['CSV', 'JSON', 'PARQUET', 'SQL']);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const ExportOptionsSchema = z.object({
  format: ExportFormatSchema.default('CSV'),
  includeHeaders: z.boolean().default(true),
  delimiter: z.string().default(','),
  dateFormat: z.enum(['ISO', 'UNIX', 'YYYY-MM-DD']).default('ISO'),
  fields: z.array(z.string()).optional(), // specific fields to export
  filter: z.object({
    campaignIds: z.array(z.string()).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    recipientIds: z.array(z.string()).optional(),
    statuses: z.array(z.string()).optional(),
  }).optional(),
});

export type ExportOptions = z.infer<typeof ExportOptionsSchema>;

export const ReconciliationReportSchema = z.object({
  settlementId: z.string().min(1),
  campaignId: z.string().min(1),
  isBalanced: z.boolean(),
  expectedTotalMicros: z.number().int().nonnegative(),
  actualTotalMicros: z.number().int().nonnegative(),
  discrepancyMicros: z.number().int(),
  discrepancyPercent: z.number(),
  discrepancies: z.array(z.object({
    type: z.enum(['MISSING_PAYOUT', 'DUPLICATE_PAYOUT', 'AMOUNT_MISMATCH', 'MISSING_LEDGER_ENTRY']),
    description: z.string(),
    expectedMicros: z.number().int(),
    actualMicros: z.number().int(),
    referenceIds: z.array(z.string()),
  })),
  checkedAt: z.string().datetime(),
  checkedBy: z.string().optional(),
});

export type ReconciliationReport = z.infer<typeof ReconciliationReportSchema>;

export interface SettlementEngine {
  createSettlement(campaignId: string, periodStart: string, periodEnd: string): Settlement;
  getSettlement(settlementId: string): Settlement | undefined;
  getSettlementsByCampaign(campaignId: string): Settlement[];
  addPayoutsToSettlement(settlementId: string, payouts: RewardPayout[]): Settlement;
  prepareSettlement(settlementId: string): Settlement;
  exportSettlement(settlementId: string, options: ExportOptions): Promise<string>;
  reconcileSettlement(settlementId: string): ReconciliationReport;
  getLedgerEntries(settlementId: string): LedgerEntry[];
  getLedgerEntriesByCampaign(campaignId: string, dateFrom?: string, dateTo?: string): LedgerEntry[];
  getPayoutsByRecipient(recipientId: string, dateFrom?: string, dateTo?: string): RewardPayout[];
  getSettlementSummary(campaignId: string, dateFrom?: string, dateTo?: string): SettlementSummary;
}

export interface SettlementSummary {
  campaignId: string;
  totalSettlements: number;
  totalRewards: number;
  totalRewardsMicros: number;
  totalFeesMicros: number;
  netPayoutMicros: number;
  totalRewardCount: number;
  uniqueRecipients: number;
  periodStart: string;
  periodEnd: string;
}

// ─── In-Memory Settlement Engine ────────────────────────────────────────────

export class InMemorySettlementEngine implements SettlementEngine {
  private settlements: Map<string, Settlement> = new Map();
  private payouts: Map<string, RewardPayout[]> = new Map(); // settlementId -> payouts
  private ledger: LedgerEntry[] = [];
  private settlementCounter = 0;

  createSettlement(campaignId: string, periodStart: string, periodEnd: string): Settlement {
    const settlementId = `settlement_${Date.now()}_${++this.settlementCounter}`;
    const now = new Date().toISOString();

    const settlement: Settlement = {
      settlementId,
      campaignId,
      status: 'PENDING',
      periodStart,
      periodEnd,
      totalRewards: 0,
      totalRewardsMicros: 0,
      totalFeesMicros: 0,
      netPayoutMicros: 0,
      rewardCount: 0,
      uniqueRecipients: 0,
      uniqueVerifiers: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.settlements.set(settlementId, settlement);
    this.payouts.set(settlementId, []);
    return settlement;
  }

  getSettlement(settlementId: string): Settlement | undefined {
    return this.settlements.get(settlementId);
  }

  getSettlementsByCampaign(campaignId: string): Settlement[] {
    return Array.from(this.settlements.values()).filter(s => s.campaignId === campaignId);
  }

  addPayoutsToSettlement(settlementId: string, payouts: RewardPayout[]): Settlement {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) {
      throw new Error(`Settlement ${settlementId} not found`);
    }

    const existingPayouts = this.payouts.get(settlementId) || [];
    const allPayouts = [...existingPayouts, ...payouts];
    this.payouts.set(settlementId, allPayouts);

    // Update settlement aggregates
    settlement.totalRewards = allPayouts.length;
    settlement.totalRewardsMicros = allPayouts.reduce((sum, p) => sum + p.grossAmountMicros, 0);
    settlement.totalFeesMicros = allPayouts.reduce((sum, p) => sum + p.feeMicros, 0);
    settlement.netPayoutMicros = allPayouts.reduce((sum, p) => sum + p.netAmountMicros, 0);
    settlement.rewardCount = allPayouts.length;
    settlement.uniqueRecipients = new Set(allPayouts.map(p => p.recipientId)).size;
    settlement.uniqueVerifiers = new Set(allPayouts.map(p => p.verifierId)).size;
    settlement.updatedAt = new Date().toISOString();

    return settlement;
  }

  prepareSettlement(settlementId: string): Settlement {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) {
      throw new Error(`Settlement ${settlementId} not found`);
    }

    if (settlement.status !== 'PENDING') {
      throw new Error(`Settlement ${settlementId} is not in PENDING status`);
    }

    settlement.status = 'PREPARING';
    settlement.preparedAt = new Date().toISOString();
    settlement.updatedAt = new Date().toISOString();

    // Create ledger entries for the settlement
    this.createLedgerEntries(settlement);

    settlement.status = 'READY';
    settlement.updatedAt = new Date().toISOString();

    return settlement;
  }

  async exportSettlement(settlementId: string, options: { format: 'CSV' | 'JSON' | 'PARQUET' | 'SQL'; includeHeaders?: boolean; delimiter?: string; dateFormat?: 'ISO' | 'UNIX' | 'YYYY-MM-DD'; fields?: string[]; filter?: { campaignIds?: string[]; dateFrom?: string; dateTo?: string; recipientIds?: string[]; statuses?: string[] } }): Promise<string> {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) {
      throw new Error(`Settlement ${settlementId} not found`);
    }

    if (settlement.status !== 'READY') {
      throw new Error(`Settlement ${settlementId} is not ready for export`);
    }

    const payouts = this.payouts.get(settlementId) || [];
    const ledgerEntries = this.ledger.filter(e => e.settlementId === settlementId);

    let output: string;

    switch (options.format) {
      case 'CSV':
        output = this.exportToCSV(settlement, payouts, ledgerEntries, options);
        break;
      case 'JSON':
        output = this.exportToJSON(settlement, payouts, ledgerEntries, options);
        break;
      case 'PARQUET':
        // Parquet export would require a library like parquetjs
        output = this.exportToJSON(settlement, payouts, ledgerEntries, options) + '\n// Note: PARQUET export requires parquetjs library';
        break;
      case 'SQL':
        output = this.exportToSQL(settlement, payouts, ledgerEntries, options);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    settlement.status = 'EXPORTED';
    settlement.exportedAt = new Date().toISOString();
    settlement.exportFormat = options.format;
    settlement.updatedAt = new Date().toISOString();

    return output;
  }

  reconcileSettlement(settlementId: string): {
    settlementId: string;
    campaignId: string;
    isBalanced: boolean;
    expectedTotalMicros: number;
    actualTotalMicros: number;
    discrepancyMicros: number;
    discrepancyPercent: number;
    discrepancies: Array<{ type: 'MISSING_PAYOUT' | 'DUPLICATE_PAYOUT' | 'AMOUNT_MISMATCH' | 'MISSING_LEDGER_ENTRY'; description: string; expectedMicros: number; actualMicros: number; referenceIds: string[] }>;
    checkedAt: string;
    checkedBy?: string;
  } {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) {
      throw new Error(`Settlement ${settlementId} not found`);
    }

    const payouts = this.payouts.get(settlementId) || [];
    const ledgerEntries = this.ledger.filter(e => e.settlementId === settlementId);

    // Calculate expected total from payouts
    const expectedTotalMicros = payouts.reduce((sum, p) => sum + p.netAmountMicros, 0);

    // Calculate actual total from ledger (credit entries for reward payouts)
    const actualTotalMicros = ledgerEntries
      .filter(e => e.type === 'REWARD_PAYOUT' && e.account === 'PAYABLE')
      .reduce((sum, e) => sum + e.creditMicros, 0);

    const discrepancyMicros = actualTotalMicros - expectedTotalMicros;
    const discrepancyPercent = expectedTotalMicros > 0 
      ? (Math.abs(discrepancyMicros) / expectedTotalMicros) * 100 
      : 0;

    const discrepancies: Array<{
      type: 'MISSING_PAYOUT' | 'DUPLICATE_PAYOUT' | 'AMOUNT_MISMATCH' | 'MISSING_LEDGER_ENTRY';
      description: string;
      expectedMicros: number;
      actualMicros: number;
      referenceIds: string[];
    }> = [];

    // Check for missing payouts (in ledger but not in payouts)
    const payoutIds = new Set(payouts.map(p => p.payoutId));
    for (const entry of ledgerEntries) {
      if (entry.type === 'REWARD_PAYOUT' && entry.rewardId && !payoutIds.has(entry.rewardId)) {
        discrepancies.push({
          type: 'MISSING_PAYOUT',
          description: `Ledger entry references reward ${entry.rewardId} not found in payouts`,
          expectedMicros: entry.creditMicros,
          actualMicros: 0,
          referenceIds: [entry.entryId, entry.rewardId!],
        });
      }
    }

    // Check for missing ledger entries (payouts without ledger entries)
    for (const payout of payouts) {
      const hasLedgerEntry = ledgerEntries.some(e => e.rewardId === payout.payoutId);
      if (!hasLedgerEntry) {
        discrepancies.push({
          type: 'MISSING_LEDGER_ENTRY',
          description: `Payout ${payout.payoutId} has no corresponding ledger entry`,
          expectedMicros: payout.netAmountMicros,
          actualMicros: 0,
          referenceIds: [payout.payoutId],
        });
      }
    }

    // Check for amount mismatches
    for (const payout of payouts) {
      const entry = ledgerEntries.find(e => e.rewardId === payout.payoutId && e.type === 'REWARD_PAYOUT' && e.account === 'PAYABLE');
      if (entry && entry.creditMicros !== payout.netAmountMicros) {
        discrepancies.push({
          type: 'AMOUNT_MISMATCH',
          description: `Amount mismatch for payout ${payout.payoutId}`,
          expectedMicros: payout.netAmountMicros,
          actualMicros: entry.creditMicros,
          referenceIds: [payout.payoutId, entry.entryId],
        });
      }
    }

    // Check for duplicate payouts
    const payoutIdCounts = new Map<string, number>();
    for (const payout of payouts) {
      payoutIdCounts.set(payout.payoutId, (payoutIdCounts.get(payout.payoutId) || 0) + 1);
    }
    for (const [payoutId, count] of payoutIdCounts) {
      if (count > 1) {
        discrepancies.push({
          type: 'DUPLICATE_PAYOUT',
          description: `Duplicate payout ID ${payoutId} found ${count} times`,
          expectedMicros: 0,
          actualMicros: 0,
          referenceIds: [payoutId],
        });
      }
    }

    const isBalanced = discrepancies.length === 0 && discrepancyMicros === 0;

    const report = {
      settlementId,
      campaignId: settlement.campaignId,
      isBalanced,
      expectedTotalMicros,
      actualTotalMicros,
      discrepancyMicros,
      discrepancyPercent: expectedTotalMicros > 0 ? (Math.abs(discrepancyMicros) / expectedTotalMicros) * 100 : 0,
      discrepancies,
      checkedAt: new Date().toISOString(),
    };

    // Update settlement with reconciliation results
    settlement.reconciliation = {
      expectedTotalMicros,
      actualTotalMicros,
      discrepancyMicros,
      isBalanced,
      checkedAt: report.checkedAt,
    };
    settlement.status = isBalanced ? 'RECONCILED' : 'FAILED';
    settlement.updatedAt = new Date().toISOString();

    return report;
  }

  getLedgerEntries(settlementId: string): LedgerEntry[] {
    return this.ledger.filter(e => e.settlementId === settlementId);
  }

  getLedgerEntriesByCampaign(campaignId: string, dateFrom?: string, dateTo?: string): LedgerEntry[] {
    let entries = this.ledger.filter(e => {
      const settlement = this.settlements.get(e.settlementId);
      return settlement?.campaignId === campaignId;
    });

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      entries = entries.filter(e => new Date(e.timestamp).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime();
      entries = entries.filter(e => new Date(e.timestamp).getTime() <= to);
    }

    return entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  getPayoutsByRecipient(recipientId: string, dateFrom?: string, dateTo?: string): RewardPayout[] {
    const payouts: RewardPayout[] = [];
    for (const settlementPayouts of this.payouts.values()) {
      payouts.push(...settlementPayouts);
    }

    let filtered = payouts.filter(p => p.recipientId === recipientId);

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      filtered = filtered.filter(p => new Date(p.createdAt).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime();
      filtered = filtered.filter(p => new Date(p.createdAt).getTime() <= to);
    }

    return filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  getSettlementSummary(campaignId: string, dateFrom?: string, dateTo?: string): {
    campaignId: string;
    totalSettlements: number;
    totalRewards: number;
    totalRewardsMicros: number;
    totalFeesMicros: number;
    netPayoutMicros: number;
    totalRewardCount: number;
    uniqueRecipients: number;
    periodStart: string;
    periodEnd: string;
  } {
    const settlements = this.getSettlementsByCampaign(campaignId)
      .filter(s => {
        if (dateFrom && new Date(s.periodStart).getTime() < new Date(dateFrom).getTime()) return false;
        if (dateTo && new Date(s.periodEnd).getTime() > new Date(dateTo).getTime()) return false;
        return true;
      });

    const totalRewards = settlements.reduce((sum, s) => sum + s.totalRewards, 0);
    const totalRewardsMicros = settlements.reduce((sum, s) => sum + s.totalRewardsMicros, 0);
    const totalFeesMicros = settlements.reduce((sum, s) => sum + s.totalFeesMicros, 0);
    const netPayoutMicros = settlements.reduce((sum, s) => sum + s.netPayoutMicros, 0);
    const totalRewardCount = settlements.reduce((sum, s) => sum + s.rewardCount, 0);
    const allRecipients = new Set<string>();
    for (const s of settlements) {
      const payouts = this.payouts.get(s.settlementId) || [];
      for (const p of payouts) allRecipients.add(p.recipientId);
    }

    return {
      campaignId,
      totalSettlements: settlements.length,
      totalRewards,
      totalRewardsMicros,
      totalFeesMicros,
      netPayoutMicros,
      totalRewardCount,
      uniqueRecipients: allRecipients.size,
      periodStart: settlements.length > 0 ? settlements[0]!.periodStart : new Date().toISOString(),
      periodEnd: settlements.length > 0 ? settlements[settlements.length - 1]!.periodEnd : new Date().toISOString(),
    };
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  private createLedgerEntries(settlement: Settlement): void {
    const payouts = this.payouts.get(settlement.settlementId) || [];
    const timestamp = new Date().toISOString();

    for (const payout of payouts) {
      // Entry 1: Debit REWARDS_EXPENSE, Credit PAYABLE
      this.ledger.push({
        entryId: `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        settlementId: settlement.settlementId,
        timestamp,
        type: 'REWARD_PAYOUT',
        account: 'REWARDS_EXPENSE',
        debitMicros: payout.netAmountMicros,
        creditMicros: 0,
        currency: payout.currency,
        campaignId: settlement.campaignId,
        rewardId: payout.payoutId,
        budgetId: undefined,
        description: `Reward payout for ${payout.payoutId}`,
        balanceAfterMicros: 0, // Would need running balance
      });

      this.ledger.push({
        entryId: `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        settlementId: settlement.settlementId,
        timestamp,
        type: 'REWARD_PAYOUT',
        account: 'PAYABLE',
        debitMicros: 0,
        creditMicros: payout.netAmountMicros,
        currency: payout.currency,
        campaignId: settlement.campaignId,
        rewardId: payout.payoutId,
        budgetId: undefined,
        description: `Payable for reward ${payout.payoutId}`,
        balanceAfterMicros: 0,
      });

      // Fee entry if applicable
      if (payout.feeMicros > 0) {
        this.ledger.push({
          entryId: `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          settlementId: settlement.settlementId,
          timestamp,
          type: 'FEE',
          account: 'FEE_REVENUE',
          debitMicros: 0,
          creditMicros: payout.feeMicros,
          currency: payout.currency,
          campaignId: settlement.campaignId,
          rewardId: payout.payoutId,
          budgetId: undefined,
          description: `Platform fee for reward ${payout.payoutId}`,
          balanceAfterMicros: 0,
        });

        this.ledger.push({
          entryId: `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          settlementId: settlement.settlementId,
          timestamp,
          type: 'FEE',
          account: 'PAYABLE',
          debitMicros: payout.feeMicros,
          creditMicros: 0,
          currency: payout.currency,
          campaignId: settlement.campaignId,
          rewardId: payout.payoutId,
          budgetId: undefined,
          description: `Fee payable for reward ${payout.payoutId}`,
          balanceAfterMicros: 0,
        });
      }
    }
  }

  // ─── Export Methods ────────────────────────────────────────────────────────

  private exportToCSV(
    settlement: Settlement,
    payouts: RewardPayout[],
    ledgerEntries: LedgerEntry[],
    options: { includeHeaders?: boolean; delimiter?: string; dateFormat?: 'ISO' | 'UNIX' | 'YYYY-MM-DD'; fields?: string[] }
  ): string {
    const delimiter = options.delimiter || ',';
    const includeHeaders = options.includeHeaders !== false;
    const formatDate = (date: string) => {
      if (options.dateFormat === 'UNIX') return Math.floor(new Date(date).getTime() / 1000).toString();
      if (options.dateFormat === 'YYYY-MM-DD') return date.split('T')[0];
      return date;
    };

    let csv = '';

    // Settlement header
    if (includeHeaders) {
      csv += `SETTLEMENT${delimiter}SETTLEMENT_ID${delimiter}CAMPAIGN_ID${delimiter}STATUS${delimiter}PERIOD_START${delimiter}PERIOD_END${delimiter}TOTAL_REWARDS${delimiter}TOTAL_REWARDS_MICROS${delimiter}TOTAL_FEES_MICROS${delimiter}NET_PAYOUT_MICROS${delimiter}REWARD_COUNT${delimiter}UNIQUE_RECIPIENTS${delimiter}CREATED_AT\n`;
    }
    csv += `SETTLEMENT${delimiter}${settlement.settlementId}${delimiter}${settlement.campaignId}${delimiter}${settlement.status}${delimiter}${formatDate(settlement.periodStart)}${delimiter}${formatDate(settlement.periodEnd)}${delimiter}${settlement.totalRewards}${delimiter}${settlement.totalRewardsMicros}${delimiter}${settlement.totalFeesMicros}${delimiter}${settlement.netPayoutMicros}${delimiter}${settlement.rewardCount}${delimiter}${settlement.uniqueRecipients}${delimiter}${formatDate(settlement.createdAt)}\n\n`;

    // Payouts
    if (includeHeaders) {
      csv += `PAYOUT${delimiter}PAYOUT_ID${delimiter}SETTLEMENT_ID${delimiter}CAMPAIGN_ID${delimiter}RECIPIENT_ID${delimiter}RECIPIENT_TYPE${delimiter}GROSS_AMOUNT_MICROS${delimiter}FEE_MICROS${delimiter}NET_AMOUNT_MICROS${delimiter}CURRENCY${delimiter}PROOF_ID${delimiter}VERIFIER_ID${delimiter}CONTENT_ID${delimiter}SESSION_ID${delimiter}CREATED_AT\n`;
    }
    for (const payout of payouts) {
      csv += `PAYOUT${delimiter}${payout.payoutId}${delimiter}${payout.settlementId}${delimiter}${payout.campaignId}${delimiter}${payout.recipientId}${delimiter}${payout.recipientType}${delimiter}${payout.grossAmountMicros}${delimiter}${payout.feeMicros}${delimiter}${payout.netAmountMicros}${delimiter}${payout.currency}${delimiter}${payout.proofId}${delimiter}${payout.verifierId}${delimiter}${payout.contentId}${delimiter}${payout.sessionId}${delimiter}${formatDate(payout.createdAt)}\n`;
    }
    csv += '\n';

    // Ledger entries
    if (includeHeaders) {
      csv += `LEDGER${delimiter}ENTRY_ID${delimiter}SETTLEMENT_ID${delimiter}TIMESTAMP${delimiter}TYPE${delimiter}ACCOUNT${delimiter}DEBIT_MICROS${delimiter}CREDIT_MICROS${delimiter}CURRENCY${delimiter}CAMPAIGN_ID${delimiter}REWARD_ID${delimiter}BUDGET_ID${delimiter}DESCRIPTION\n`;
    }
    for (const entry of ledgerEntries) {
      csv += `LEDGER${delimiter}${entry.entryId}${delimiter}${entry.settlementId}${delimiter}${formatDate(entry.timestamp)}${delimiter}${entry.type}${delimiter}${entry.account}${delimiter}${entry.debitMicros}${delimiter}${entry.creditMicros}${delimiter}${entry.currency}${delimiter}${entry.campaignId || ''}${delimiter}${entry.rewardId || ''}${delimiter}${entry.budgetId || ''}${delimiter}${entry.description}\n`;
    }

    return csv;
  }

  private exportToJSON(
    settlement: Settlement,
    payouts: RewardPayout[],
    ledgerEntries: LedgerEntry[],
    _options: { fields?: string[] }
  ): string {
    const output = {
      settlement,
      payouts,
      ledgerEntries,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(output, null, 2);
  }

  private exportToSQL(
    settlement: Settlement,
    payouts: RewardPayout[],
    ledgerEntries: LedgerEntry[],
    options: { delimiter?: string }
  ): string {
    const delimiter = options.delimiter || ';';
    let sql = `-- Settlement Export\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n\n`;

    // Settlement table
    sql += `INSERT INTO settlements (settlement_id, campaign_id, status, period_start, period_end, total_rewards, total_rewards_micros, total_fees_micros, net_payout_micros, reward_count, unique_recipients, unique_verifiers, created_at, updated_at) VALUES\n`;
    sql += `('${settlement.settlementId}', '${settlement.campaignId}', '${settlement.status}', '${settlement.periodStart}', '${settlement.periodEnd}', ${settlement.totalRewards}, ${settlement.totalRewardsMicros}, ${settlement.totalFeesMicros}, ${settlement.netPayoutMicros}, ${settlement.rewardCount}, ${settlement.uniqueRecipients}, ${settlement.uniqueVerifiers}, '${settlement.createdAt}', '${settlement.updatedAt}')${delimiter}\n\n`;

    // Payouts table
    if (payouts.length > 0) {
      sql += `INSERT INTO payouts (payout_id, settlement_id, campaign_id, recipient_id, recipient_type, gross_amount_micros, fee_micros, net_amount_micros, currency, proof_id, verifier_id, content_id, session_id, created_at, status) VALUES\n`;
      const values = payouts.map(p => `('${p.payoutId}', '${p.settlementId}', '${p.campaignId}', '${p.recipientId}', '${p.recipientType}', ${p.grossAmountMicros}, ${p.feeMicros}, ${p.netAmountMicros}, '${p.currency}', '${p.proofId}', '${p.verifierId}', '${p.contentId}', '${p.sessionId}', '${p.createdAt}', '${p.status}')`);
      sql += values.join(`,\n`) + `${delimiter}\n\n`;
    }

    // Ledger entries table
    if (ledgerEntries.length > 0) {
      sql += `INSERT INTO ledger_entries (entry_id, settlement_id, timestamp, type, account, debit_micros, credit_micros, currency, campaign_id, reward_id, budget_id, description, balance_after_micros) VALUES\n`;
      const values = ledgerEntries.map(e => `('${e.entryId}', '${e.settlementId}', '${e.timestamp}', '${e.type}', '${e.account}', ${e.debitMicros}, ${e.creditMicros}, '${e.currency}', '${e.campaignId || 'NULL'}', '${e.rewardId || 'NULL'}', '${e.budgetId || 'NULL'}', '${e.description.replace(/'/g, "''")}', ${e.balanceAfterMicros})`);
      sql += values.join(`,\n`) + `${delimiter}\n`;
    }

    return sql;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _settlementEngine: SettlementEngine | null = null;

export function getSettlementEngine(): SettlementEngine {
  if (!_settlementEngine) {
    _settlementEngine = new InMemorySettlementEngine();
  }
  return _settlementEngine;
}

export function setSettlementEngine(engine: SettlementEngine): void {
  _settlementEngine = engine;
}

// ─── Convenience Functions ────────────────────────────────────────────────────

/**
 * Create a new settlement for a campaign period.
 */
export function createSettlement(campaignId: string, periodStart: string, periodEnd: string): Settlement {
  return getSettlementEngine().createSettlement(campaignId, periodStart, periodEnd);
}

/**
 * Prepare a settlement (generates ledger entries).
 */
export function prepareSettlement(settlementId: string): Settlement {
  return getSettlementEngine().prepareSettlement(settlementId);
}

/**
 * Export a settlement to a string.
 */
export function exportSettlement(settlementId: string, options: ExportOptions): Promise<string> {
  return getSettlementEngine().exportSettlement(settlementId, options);
}

/**
 * Reconcile a settlement.
 */
export function reconcileSettlement(settlementId: string): ReconciliationReport {
  return getSettlementEngine().reconcileSettlement(settlementId);
}

/**
 * Get settlement summary for a campaign.
 */
export function getSettlementSummary(campaignId: string, dateFrom?: string, dateTo?: string) {
  return getSettlementEngine().getSettlementSummary(campaignId, dateFrom, dateTo);
}

/**
 * Get ledger entries for a campaign.
 */
export function getLedgerEntriesByCampaign(campaignId: string, dateFrom?: string, dateTo?: string): LedgerEntry[] {
  return getSettlementEngine().getLedgerEntriesByCampaign(campaignId, dateFrom, dateTo);
}

/**
 * Get payouts by recipient.
 */
export function getPayoutsByRecipient(recipientId: string, dateFrom?: string, dateTo?: string): RewardPayout[] {
  return getSettlementEngine().getPayoutsByRecipient(recipientId, dateFrom, dateTo);
}