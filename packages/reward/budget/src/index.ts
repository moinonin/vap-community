/**
 * Budget Allocation Engine (VAE Sprint 12)
 *
 * Manages budget pacing, caps, rollover, and exhaustion:
 * - Pacing: even spend over campaign duration
 * - Caps: daily, weekly, monthly, per-campaign, global
 * - Rollover: unused budget carries to next period
 * - Exhaustion: automatic campaign pausing when budget depleted
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const BudgetPeriodSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CAMPAIGN', 'LIFETIME']);
export type BudgetPeriod = z.infer<typeof BudgetPeriodSchema>;

export const BudgetStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'EXHAUSTED', 'ROLLED_OVER', 'EXPIRED']);
export type BudgetStatus = z.infer<typeof BudgetStatusSchema>;

export const BudgetConfigSchema = z.object({
  // Total budget in micros
  totalBudgetMicros: z.number().int().positive(),
  // Currency (ISO 4217)
  currency: z.string().length(3).default('USD'),
  // Budget period for pacing
  period: BudgetPeriodSchema.default('CAMPAIGN'),
  // Pacing strategy
  pacingStrategy: z.enum(['EVEN', 'FRONT_LOADED', 'BACK_LOADED', 'CUSTOM']).default('EVEN'),
  // Custom pacing curve (for CUSTOM strategy)
  customPacingCurve: z.array(z.object({
    periodStart: z.number().int().min(0).max(1), // 0.0 to 1.0 of campaign duration
    spendPercent: z.number().min(0).max(1),     // 0.0 to 1.0 of total budget
  })).optional(),
  // Cap per period (as percentage of total budget)
  periodCapPercent: z.number().min(0).max(100).default(100),
  // Rollover settings
  rollover: z.object({
    enabled: z.boolean().default(false),
    maxRolloverPercent: z.number().min(0).max(100).default(50),
    maxRolloverPeriods: z.number().int().positive().default(3),
  }).default({}),
  // Exhaustion behavior
  onExhaustion: z.enum(['PAUSE_CAMPAIGN', 'ALERT_ONLY', 'AUTO_REPLENISH']).default('PAUSE_CAMPAIGN'),
  // Auto-replenishment
  autoReplenish: z.object({
    enabled: z.boolean().default(false),
    thresholdPercent: z.number().min(0).max(100).default(10),
    replenishAmountMicros: z.number().int().positive().optional(),
    maxReplenishCount: z.number().int().nonnegative().default(0),
  }).default({}),
  // Minimum reserve (never spend below this)
  reservePercent: z.number().min(0).max(50).default(0),
});

export type BudgetConfig = z.infer<typeof BudgetConfigSchema>;

export const BudgetStateSchema = z.object({
  budgetId: z.string().min(1),
  campaignId: z.string().min(1),
  config: BudgetConfigSchema,
  // Current state
  status: BudgetStatusSchema.default('ACTIVE'),
  // Allocation tracking
  totalBudgetMicros: z.number().int().positive(),
  allocatedMicros: z.number().int().nonnegative().default(0),
  spentMicros: z.number().int().nonnegative().default(0),
  committedMicros: z.number().int().nonnegative().default(0), // Reserved for pending rewards
  // Period tracking
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  periodNumber: z.number().int().nonnegative().default(0),
  // Rollover tracking
  rolloverBalanceMicros: z.number().int().nonnegative().default(0),
  rolloverPeriodsUsed: z.number().int().nonnegative().default(0),
  // Replenishment tracking
  replenishCount: z.number().int().nonnegative().default(0),
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  exhaustedAt: z.string().datetime().optional(),
});

export type BudgetState = z.infer<typeof BudgetStateSchema>;

export const AllocationRequestSchema = z.object({
  budgetId: z.string().min(1),
  amountMicros: z.number().int().positive(),
  purpose: z.enum(['REWARD', 'OPERATIONAL', 'RESERVE', 'REPLENISH']),
  referenceId: z.string().optional(), // rewardId, campaignId, etc.
  metadata: z.record(z.unknown()).default({}),
});

export type AllocationRequest = z.infer<typeof AllocationRequestSchema>;

export const AllocationResultSchema = z.object({
  success: z.boolean(),
  allocationId: z.string().optional(),
  allocatedMicros: z.number().int().nonnegative().default(0),
  remainingMicros: z.number().int().nonnegative().default(0),
  deniedReason: z.string().optional(),
  newStatus: z.string().optional(),
});

export type AllocationResult = z.infer<typeof AllocationResultSchema>;

export const SpendRequestSchema = z.object({
  budgetId: z.string().min(1),
  amountMicros: z.number().int().positive(),
  rewardId: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
});

export type SpendRequest = z.infer<typeof SpendRequestSchema>;

export const SpendResultSchema = z.object({
  success: z.boolean(),
  transactionId: z.string().optional(),
  spentMicros: z.number().int().nonnegative().default(0),
  remainingMicros: z.number().int().nonnegative().default(0),
  deniedReason: z.string().optional(),
  newStatus: z.string().optional(),
});

export type SpendResult = z.infer<typeof SpendResultSchema>;

export interface BudgetAllocator {
  createBudget(campaignId: string, config: BudgetConfig): BudgetState;
  getBudget(budgetId: string): BudgetState | undefined;
  getBudgetByCampaign(campaignId: string): BudgetState | undefined;
  allocate(request: AllocationRequest): AllocationResult;
  spend(request: SpendRequest): SpendResult;
  commitSpend(budgetId: string, amountMicros: number, rewardId: string): SpendResult;
  releaseCommitment(budgetId: string, amountMicros: number): boolean;
  advancePeriod(budgetId: string): BudgetState | undefined;
  getPacingReport(budgetId: string): PacingReport | undefined;
  updateConfig(budgetId: string, config: Partial<BudgetConfig>): BudgetState | undefined;
  pauseBudget(budgetId: string): BudgetState | undefined;
  resumeBudget(budgetId: string): BudgetState | undefined;
}

export interface PacingReport {
  budgetId: string;
  campaignId: string;
  status: BudgetStatus;
  totalBudgetMicros: number;
  spentMicros: number;
  allocatedMicros: number;
  committedMicros: number;
  availableMicros: number;
  utilizationPercent: number;
  currentPeriod: {
    start: string;
    end: string;
    periodNumber: number;
    spentInPeriodMicros: number;
    periodBudgetMicros: number;
    periodUtilizationPercent: number;
  };
  projectedExhaustionDate: string | null;
  onTrack: boolean;
  recommendedDailySpendMicros: number;
}

// ─── In-Memory Budget Allocator ──────────────────────────────────────────────

export class InMemoryBudgetAllocator implements BudgetAllocator {
  private budgets: Map<string, BudgetState> = new Map();
  private budgetCounter = 0;
  private spendLog: Array<{
    budgetId: string;
    amountMicros: number;
    rewardId: string;
    timestamp: string;
    status: 'COMMITTED' | 'SPENT' | 'RELEASED';
  }> = [];

  createBudget(campaignId: string, config: BudgetConfig): BudgetState {
    const budgetId = `budget_${Date.now()}_${++this.budgetCounter}`;
    const now = new Date();
    
    // Calculate period boundaries
    const { start, end } = this.calculatePeriodBounds(now, config.period);

    const state: BudgetState = {
      budgetId,
      campaignId,
      config,
      status: 'ACTIVE',
      totalBudgetMicros: config.totalBudgetMicros,
      allocatedMicros: 0,
      spentMicros: 0,
      committedMicros: 0,
      currentPeriodStart: start.toISOString(),
      currentPeriodEnd: end.toISOString(),
      periodNumber: 0,
      rolloverBalanceMicros: 0,
      rolloverPeriodsUsed: 0,
      replenishCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.budgets.set(budgetId, state);
    return state;
  }

  getBudget(budgetId: string): BudgetState | undefined {
    return this.budgets.get(budgetId);
  }

  getBudgetByCampaign(campaignId: string): BudgetState | undefined {
    for (const budget of this.budgets.values()) {
      if (budget.campaignId === campaignId) return budget;
    }
    return undefined;
  }

  allocate(request: AllocationRequest): AllocationResult {
    const budget = this.budgets.get(request.budgetId);
    if (!budget) {
      return { success: false, deniedReason: 'Budget not found', allocatedMicros: 0, remainingMicros: 0 };
    }

    if (budget.status !== 'ACTIVE') {
      return { 
        success: false, 
        deniedReason: `Budget status is ${budget.status}`, 
        allocatedMicros: 0, 
        remainingMicros: budget.totalBudgetMicros - budget.allocatedMicros 
      };
    }

    const availableMicros = budget.totalBudgetMicros - budget.allocatedMicros - budget.committedMicros;
    if (request.amountMicros > availableMicros) {
      return { 
        success: false, 
        deniedReason: 'Insufficient budget available', 
        allocatedMicros: 0, 
        remainingMicros: availableMicros 
      };
    }

    const allocationId = `alloc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    budget.allocatedMicros += request.amountMicros;
    budget.updatedAt = new Date().toISOString();

    return {
      success: true,
      allocationId,
      allocatedMicros: request.amountMicros,
      remainingMicros: availableMicros - request.amountMicros,
      newStatus: budget.status,
    };
  }

  spend(request: SpendRequest): SpendResult {
    const budget = this.budgets.get(request.budgetId);
    if (!budget) {
      return { success: false, deniedReason: 'Budget not found', spentMicros: 0, remainingMicros: 0 };
    }

    if (budget.status !== 'ACTIVE') {
      return { 
        success: false, 
        deniedReason: `Budget status is ${budget.status}`, 
        spentMicros: 0, 
        remainingMicros: budget.totalBudgetMicros - budget.spentMicros 
      };
    }

    const availableMicros = budget.totalBudgetMicros - budget.spentMicros - budget.committedMicros;
    if (request.amountMicros > availableMicros) {
      return { 
        success: false, 
        deniedReason: 'Insufficient available budget', 
        spentMicros: 0, 
        remainingMicros: availableMicros 
      };
    }

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    budget.spentMicros += request.amountMicros;
    budget.committedMicros = Math.max(0, budget.committedMicros - request.amountMicros);
    budget.updatedAt = new Date().toISOString();

    this.spendLog.push({
      budgetId: request.budgetId,
      amountMicros: request.amountMicros,
      rewardId: request.rewardId,
      timestamp: new Date().toISOString(),
      status: 'SPENT',
    });

    // Check for exhaustion
    const newStatus = this.checkExhaustion(budget);

    return {
      success: true,
      transactionId,
      spentMicros: request.amountMicros,
      remainingMicros: budget.totalBudgetMicros - budget.spentMicros,
      newStatus,
    };
  }

  commitSpend(budgetId: string, amountMicros: number, rewardId: string): SpendResult {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      return { success: false, deniedReason: 'Budget not found', spentMicros: 0, remainingMicros: 0 };
    }

    if (budget.status !== 'ACTIVE') {
      return { 
        success: false, 
        deniedReason: `Budget status is ${budget.status}`, 
        spentMicros: 0, 
        remainingMicros: budget.totalBudgetMicros - budget.spentMicros 
      };
    }

    const availableMicros = budget.totalBudgetMicros - budget.allocatedMicros - budget.committedMicros;
    if (amountMicros > availableMicros) {
      return { 
        success: false, 
        deniedReason: 'Insufficient available budget for commitment', 
        spentMicros: 0, 
        remainingMicros: availableMicros 
      };
    }

    budget.committedMicros += amountMicros;
    budget.updatedAt = new Date().toISOString();

    this.spendLog.push({
      budgetId,
      amountMicros,
      rewardId,
      timestamp: new Date().toISOString(),
      status: 'COMMITTED',
    });

    return {
      success: true,
      transactionId: `commit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      spentMicros: 0, // Not actually spent yet
      remainingMicros: budget.totalBudgetMicros - budget.allocatedMicros - budget.committedMicros,
      newStatus: budget.status,
    };
  }

  releaseCommitment(budgetId: string, amountMicros: number): boolean {
    const budget = this.budgets.get(budgetId);
    if (!budget) return false;

    budget.committedMicros = Math.max(0, budget.committedMicros - amountMicros);
    budget.updatedAt = new Date().toISOString();

    this.spendLog.push({
      budgetId,
      amountMicros,
      rewardId: 'released',
      timestamp: new Date().toISOString(),
      status: 'RELEASED',
    });

    return true;
  }

  advancePeriod(budgetId: string): BudgetState | undefined {
    const budget = this.budgets.get(budgetId);
    if (!budget) return undefined;

    const config = budget.config;
    const now = new Date();
    const { start, end } = this.calculatePeriodBounds(now, config.period);

    // Handle rollover
    if (config.rollover.enabled) {
      const unspentInPeriod = this.getPeriodBudgetMicros(budget) - this.getSpentInPeriodMicros(budget);
      if (unspentInPeriod > 0 && budget.rolloverPeriodsUsed < config.rollover.maxRolloverPeriods) {
        const rolloverAmount = Math.min(
          unspentInPeriod,
          Math.floor(budget.config.totalBudgetMicros * config.rollover.maxRolloverPercent / 100)
        );
        budget.rolloverBalanceMicros += rolloverAmount;
        budget.rolloverPeriodsUsed += 1;
      }
    }

    // Advance period
    budget.currentPeriodStart = start.toISOString();
    budget.currentPeriodEnd = end.toISOString();
    budget.periodNumber += 1;
    budget.updatedAt = new Date().toISOString();

    // Check if campaign period ended
    const periodEnd = new Date(budget.currentPeriodEnd).getTime();
    if (Date.now() > periodEnd && config.period === 'CAMPAIGN') {
      budget.status = 'EXPIRED';
    }

    return budget;
  }

  getPacingReport(budgetId: string): PacingReport | undefined {
    const budget = this.budgets.get(budgetId);
    if (!budget) return undefined;

    const config = budget.config;
    const availableMicros = budget.totalBudgetMicros - budget.spentMicros - budget.committedMicros;
    const utilizationPercent = (budget.spentMicros / budget.totalBudgetMicros) * 100;

    const periodBudgetMicros = this.getPeriodBudgetMicros(budget);
    const spentInPeriodMicros = this.getSpentInPeriodMicros(budget);
    const periodUtilizationPercent = periodBudgetMicros > 0 
      ? (spentInPeriodMicros / periodBudgetMicros) * 100 
      : 0;

    // Project exhaustion
    const spentPerDay = this.calculateDailySpendRate(budget);
    let projectedExhaustionDate: string | null = null;
    if (spentPerDay > 0) {
      const daysRemaining = availableMicros / spentPerDay;
      const projectedDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);
      projectedExhaustionDate = projectedDate.toISOString();
    }

    // On track check (within 10% of even pacing)
    const expectedUtilization = this.getExpectedUtilization(budget);
    const onTrack = Math.abs(utilizationPercent - expectedUtilization) <= 10;

    // Recommended daily spend to finish on time
    const remainingPeriods = this.getRemainingPeriods(budget);
    const recommendedDailySpendMicros = remainingPeriods > 0 
      ? Math.floor(availableMicros / (remainingPeriods * this.getDaysPerPeriod(budget.config.period)))
      : 0;

    return {
      budgetId: budget.budgetId,
      campaignId: budget.campaignId,
      status: budget.status,
      totalBudgetMicros: budget.totalBudgetMicros,
      spentMicros: budget.spentMicros,
      allocatedMicros: budget.allocatedMicros,
      committedMicros: budget.committedMicros,
      availableMicros,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
      currentPeriod: {
        start: budget.currentPeriodStart,
        end: budget.currentPeriodEnd,
        periodNumber: budget.periodNumber,
        spentInPeriodMicros,
        periodBudgetMicros,
        periodUtilizationPercent: Math.round(periodUtilizationPercent * 100) / 100,
      },
      projectedExhaustionDate,
      onTrack,
      recommendedDailySpendMicros,
    };
  }

  updateConfig(budgetId: string, config: Partial<BudgetConfig>): BudgetState | undefined {
    const budget = this.budgets.get(budgetId);
    if (!budget) return undefined;

    budget.config = { ...budget.config, ...config };
    budget.updatedAt = new Date().toISOString();
    return budget;
  }

  pauseBudget(budgetId: string): BudgetState | undefined {
    const budget = this.budgets.get(budgetId);
    if (!budget) return undefined;

    budget.status = 'PAUSED';
    budget.updatedAt = new Date().toISOString();
    return budget;
  }

  resumeBudget(budgetId: string): BudgetState | undefined {
    const budget = this.budgets.get(budgetId);
    if (!budget) return undefined;

    budget.status = 'ACTIVE';
    budget.updatedAt = new Date().toISOString();
    return budget;
  }

  // ─── Private Helper Methods ────────────────────────────────────────────────

  private calculatePeriodBounds(date: Date, period: BudgetPeriod): { start: Date; end: Date } {
    const start = new Date(date);
    let end = new Date(date);

    switch (period) {
      case 'DAILY':
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);
        break;
      case 'WEEKLY':
        start.setUTCHours(0, 0, 0, 0);
        start.setUTCDate(start.getUTCDate() - start.getUTCDay());
        end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 6);
        end.setUTCHours(23, 59, 59, 999);
        break;
      case 'MONTHLY':
        start.setUTCDate(1);
        start.setUTCHours(0, 0, 0, 0);
        end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);
        end.setUTCDate(0);
        end.setUTCHours(23, 59, 59, 999);
        break;
      case 'CAMPAIGN':
      case 'LIFETIME':
        // For campaign/lifetime, period is the whole campaign
        // We'll use a very far future date
        end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 10); // 10 years
        break;
    }

    return { start, end };
  }

  private getPeriodBudgetMicros(budget: BudgetState): number {
    const config = budget.config;
    if (config.period === 'CAMPAIGN' || config.period === 'LIFETIME') {
      return budget.totalBudgetMicros;
    }
    // For periodic budgets, divide total by number of periods
    const totalPeriods = this.getTotalPeriods(budget);
    return Math.floor(budget.totalBudgetMicros / totalPeriods);
  }

  private getSpentInPeriodMicros(budget: BudgetState): number {
    // Simplified: assume even spend within period
    // In reality, would query spend log filtered by period
    const periodBudget = this.getPeriodBudgetMicros(budget);
    const periodProgress = this.getPeriodProgress(budget);
    return Math.floor(budget.spentMicros * periodProgress);
  }

  private getPeriodProgress(budget: BudgetState): number {
    const start = new Date(budget.currentPeriodStart).getTime();
    const end = new Date(budget.currentPeriodEnd).getTime();
    const now = Date.now();
    
    if (now <= start) return 0;
    if (now >= end) return 1;
    
    return (now - start) / (end - start);
  }

  private getTotalPeriods(budget: BudgetState): number {
    const config = budget.config;
    const campaignDurationDays = this.getCampaignDurationDays(budget);
    
    switch (config.period) {
      case 'DAILY': return campaignDurationDays;
      case 'WEEKLY': return Math.ceil(campaignDurationDays / 7);
      case 'MONTHLY': return Math.ceil(campaignDurationDays / 30);
      case 'CAMPAIGN': return 1;
      case 'LIFETIME': return 1;
      default: return 1;
    }
  }

  private getRemainingPeriods(budget: BudgetState): number {
    const total = this.getTotalPeriods(budget);
    return Math.max(0, total - budget.periodNumber - 1);
  }

  private getDaysPerPeriod(period: BudgetPeriod): number {
    switch (period) {
      case 'DAILY': return 1;
      case 'WEEKLY': return 7;
      case 'MONTHLY': return 30;
      case 'CAMPAIGN':
      case 'LIFETIME': return this.getCampaignDurationDays(this.budgets.values().next().value!);
      default: return 30;
    }
  }

  private getCampaignDurationDays(budget: BudgetState): number {
    // Simplified: assume 30 days if no end date
    // In reality, would use campaign start/end dates
    return 30;
  }

  private calculateDailySpendRate(budget: BudgetState): number {
    const daysSinceStart = (Date.now() - new Date(budget.createdAt).getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceStart <= 0) return 0;
    return budget.spentMicros / daysSinceStart;
  }

  private getExpectedUtilization(budget: BudgetState): number {
    const progress = this.getPeriodProgress(budget);
    // Even pacing = progress * 100
    // Front-loaded = higher early, back-loaded = lower early
    const config = budget.config;
    switch (config.pacingStrategy) {
      case 'EVEN':
        return progress * 100;
      case 'FRONT_LOADED':
        return Math.min(progress * 150, 100); // Spend 50% faster early
      case 'BACK_LOADED':
        return Math.max(progress * 50, 10); // Spend 50% slower early
      case 'CUSTOM':
        // Would use custom curve
        return progress * 100;
      default:
        return progress * 100;
    }
  }

  private checkExhaustion(budget: BudgetState): string {
    const availableMicros = budget.totalBudgetMicros - budget.spentMicros - budget.committedMicros;
    const reserveMicros = Math.floor(budget.totalBudgetMicros * budget.config.reservePercent / 100);
    
    if (availableMicros <= reserveMicros) {
      budget.status = 'EXHAUSTED';
      budget.exhaustedAt = new Date().toISOString();
      
      if (budget.config.onExhaustion === 'PAUSE_CAMPAIGN') {
        budget.status = 'PAUSED'; // Or could be a separate campaign pause
      } else if (budget.config.onExhaustion === 'AUTO_REPLENISH' && budget.config.autoReplenish.enabled) {
        // Trigger replenishment
        if (budget.replenishCount < budget.config.autoReplenish.maxReplenishCount) {
          const replenishAmount = budget.config.autoReplenish.replenishAmountMicros 
            || Math.floor(budget.totalBudgetMicros * 0.1);
          budget.totalBudgetMicros += replenishAmount;
          budget.replenishCount += 1;
          budget.status = 'ACTIVE';
        }
      }
      
      return budget.status;
    }
    
    return budget.status;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _budgetAllocator: BudgetAllocator | null = null;

export function getBudgetAllocator(): BudgetAllocator {
  if (!_budgetAllocator) {
    _budgetAllocator = new InMemoryBudgetAllocator();
  }
  return _budgetAllocator;
}

export function setBudgetAllocator(allocator: BudgetAllocator): void {
  _budgetAllocator = allocator;
}

// ─── Convenience Functions ────────────────────────────────────────────────────

/**
 * Create a new budget for a campaign.
 */
export function createBudget(campaignId: string, config: BudgetConfig): BudgetState {
  return getBudgetAllocator().createBudget(campaignId, config);
}

/**
 * Get budget by ID.
 */
export function getBudget(budgetId: string): BudgetState | undefined {
  return getBudgetAllocator().getBudget(budgetId);
}

/**
 * Get budget by campaign ID.
 */
export function getBudgetByCampaign(campaignId: string): BudgetState | undefined {
  return getBudgetAllocator().getBudgetByCampaign(campaignId);
}

/**
 * Allocate budget for a reward.
 */
export function allocateBudget(request: AllocationRequest): AllocationResult {
  return getBudgetAllocator().allocate(request);
}

/**
 * Spend budget for a reward.
 */
export function spendBudget(request: SpendRequest): SpendResult {
  return getBudgetAllocator().spend(request);
}

/**
 * Get pacing report for a budget.
 */
export function getPacingReport(budgetId: string) {
  return getBudgetAllocator().getPacingReport(budgetId);
}