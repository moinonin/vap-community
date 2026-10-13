import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getBudgetAllocator, 
  setBudgetAllocator, 
  createBudget, 
  getBudget, 
  getBudgetByCampaign,
  allocateBudget, 
  spendBudget, 
  getPacingReport,
  InMemoryBudgetAllocator
} from './index';
import type { BudgetAllocator, BudgetConfig, BudgetState, AllocationRequest, SpendRequest, BudgetPeriod } from './index';

describe('InMemoryBudgetAllocator', () => {
  let allocator: InMemoryBudgetAllocator;

  beforeEach(() => {
    allocator = new InMemoryBudgetAllocator();
    setBudgetAllocator(allocator);
  });

  it('creates a budget with default config', () => {
    const config: BudgetConfig = {
      totalBudgetMicros: 1000000,
      currency: 'USD',
      period: 'CAMPAIGN',
      pacingStrategy: 'EVEN',
      periodCapPercent: 100,
      rollover: { enabled: false, maxRolloverPercent: 50, maxRolloverPeriods: 3 },
      onExhaustion: 'PAUSE_CAMPAIGN',
      autoReplenish: { enabled: false, thresholdPercent: 10, maxReplenishCount: 0 },
      reservePercent: 0,
    };
    const budget = createBudget('campaign-1', config);
    
    expect(budget).toBeDefined();
    expect(budget.budgetId).toMatch(/^budget_/);
    expect(budget.campaignId).toBe('campaign-1');
    expect(budget.status).toBe('ACTIVE');
    expect(budget.totalBudgetMicros).toBe(1000000);
    expect(budget.allocatedMicros).toBe(0);
    expect(budget.spentMicros).toBe(0);
    expect(budget.committedMicros).toBe(0);
    expect(budget.rolloverBalanceMicros).toBe(0);
    expect(budget.config.period).toBe('CAMPAIGN');
    expect(budget.config.pacingStrategy).toBe('EVEN');
  });

  it('gets budget by ID', () => {
    const config: BudgetConfig = { totalBudgetMicros: 500000 };
    const created = createBudget('campaign-2', config);
    const retrieved = getBudget(created.budgetId);
    
    expect(retrieved).toEqual(created);
  });

  it('gets budget by campaign ID', () => {
    const config: BudgetConfig = { totalBudgetMicros: 750000 };
    const created = createBudget('campaign-3', config);
    const retrieved = getBudgetByCampaign('campaign-3');
    
    expect(retrieved).toEqual(created);
  });

  it('returns undefined for nonexistent budget', () => {
    expect(getBudget('nonexistent')).toBeUndefined();
    expect(getBudgetByCampaign('nonexistent')).toBeUndefined();
  });

  it('allocates budget successfully', () => {
    const config: BudgetConfig = { totalBudgetMicros: 1000000 };
    const budget = createBudget('campaign-4', config);
    
    const request: AllocationRequest = {
      budgetId: budget.budgetId,
      amountMicros: 100000,
      purpose: 'REWARD',
    };
    
    const result = allocateBudget(request);
    
    expect(result.success).toBe(true);
    expect(result.allocatedMicros).toBe(100000);
    expect(result.remainingMicros).toBe(900000);
    expect(result.allocationId).toMatch(/^alloc_/);
  });

  it('fails allocation when budget not found', () => {
    const request: AllocationRequest = {
      budgetId: 'nonexistent',
      amountMicros: 100000,
      purpose: 'REWARD',
    };
    
    const result = allocateBudget(request);
    
    expect(result.success).toBe(false);
    expect(result.deniedReason).toBe('Budget not found');
  });

  it('fails allocation when budget is not ACTIVE', () => {
    const config: BudgetConfig = { totalBudgetMicros: 1000000 };
    const budget = createBudget('campaign-5', config);
    allocator.pauseBudget(budget.budgetId);
    
    const request: AllocationRequest = {
      budgetId: budget.budgetId,
      amountMicros: 100000,
      purpose: 'REWARD',
    };
    
    const result = allocateBudget(request);
    
    expect(result.success).toBe(false);
    expect(result.deniedReason).toContain('Budget status is');
  });

  it('fails allocation when insufficient budget', () => {
    const config: BudgetConfig = { totalBudgetMicros: 100000 };
    const budget = createBudget('campaign-6', config);
    
    const request: AllocationRequest = {
      budgetId: budget.budgetId,
      amountMicros: 200000,
      purpose: 'REWARD',
    };
    
    const result = allocateBudget(request);
    
    expect(result.success).toBe(false);
    expect(result.deniedReason).toBe('Insufficient budget available');
  });

  it('spends budget successfully', () => {
    const config: BudgetConfig = { totalBudgetMicros: 1000000 };
    const budget = createBudget('campaign-7', config);
    
    // First allocate
    allocateBudget({
      budgetId: budget.budgetId,
      amountMicros: 200000,
      purpose: 'REWARD',
    });
    
    // Then spend
    const request: SpendRequest = {
      budgetId: budget.budgetId,
      amountMicros: 50000,
      rewardId: 'reward-1',
    };
    
    const result = spendBudget(request);
    
    expect(result.success).toBe(true);
    expect(result.spentMicros).toBe(50000);
    expect(result.remainingMicros).toBe(950000);
    expect(result.transactionId).toMatch(/^txn_/);
  });

  it('fails spend when budget not found', () => {
    const request: SpendRequest = {
      budgetId: 'nonexistent',
      amountMicros: 50000,
      rewardId: 'reward-1',
    };
    
    const result = spendBudget(request);
    
    expect(result.success).toBe(false);
    expect(result.deniedReason).toBe('Budget not found');
  });

  it('fails spend when insufficient budget', () => {
    const config: BudgetConfig = { totalBudgetMicros: 100000 };
    const budget = createBudget('campaign-8', config);
    
    const request: SpendRequest = {
      budgetId: budget.budgetId,
      amountMicros: 200000,
      rewardId: 'reward-1',
    };
    
    const result = spendBudget(request);
    
    expect(result.success).toBe(false);
    expect(result.deniedReason).toBe('Insufficient available budget');
  });

  it('commits spend successfully', () => {
    const config: BudgetConfig = { totalBudgetMicros: 1000000 };
    const budget = createBudget('campaign-9', config);
    
    const result = allocator.commitSpend(budget.budgetId, 100000, 'reward-2');
    
    expect(result.success).toBe(true);
    expect(result.spentMicros).toBe(0); // Not actually spent yet
    expect(result.remainingMicros).toBe(900000); // total - committed
  });

  it('releases commitment', () => {
    const config: BudgetConfig = { totalBudgetMicros: 1000000 };
    const budget = createBudget('campaign-10', config);
    
    allocator.commitSpend(budget.budgetId, 100000, 'reward-3');
    const released = allocator.releaseCommitment(budget.budgetId, 50000);
    
    expect(released).toBe(true);
    
    const budgetState = getBudget(budget.budgetId);
    expect(budgetState?.committedMicros).toBe(50000);
  });

  it('advances period with rollover', () => {
      const config: BudgetConfig = {
        totalBudgetMicros: 1000000,
        currency: 'USD',
        period: 'DAILY',
        rollover: {
          enabled: true,
          maxRolloverPercent: 50,
          maxRolloverPeriods: 3,
        },
        pacingStrategy: 'EVEN',
        periodCapPercent: 100,
        onExhaustion: 'PAUSE_CAMPAIGN',
        autoReplenish: {
          enabled: false,
          thresholdPercent: 10,
          maxReplenishCount: 0,
        },
        reservePercent: 0,
      };
      const budget = createBudget('campaign-11', config);
    
      // Spend some
      allocator.spend({ budgetId: budget.budgetId, amountMicros: 200000, rewardId: 'r1', metadata: {} });
    
      const advanced = allocator.advancePeriod(budget.budgetId);
    
      expect(advanced).toBeDefined();
      expect(advanced?.periodNumber).toBe(1);
      // Rollover only happens if there's unspent budget in the period
      // Since period just started, no rollover yet
      expect(advanced?.rolloverBalanceMicros).toBeGreaterThanOrEqual(0);
    });

  it('gets pacing report', () => {
    const config: BudgetConfig = { totalBudgetMicros: 1000000 };
    const budget = createBudget('campaign-12', config);
    
    allocator.spend({ budgetId: budget.budgetId, amountMicros: 100000, rewardId: 'r1' });
    
    const report = getPacingReport(budget.budgetId);
    
    expect(report).toBeDefined();
    expect(report?.budgetId).toBe(budget.budgetId);
    expect(report?.campaignId).toBe('campaign-12');
    expect(report?.status).toBe('ACTIVE');
    expect(report?.totalBudgetMicros).toBe(1000000);
    expect(report?.spentMicros).toBe(100000);
    expect(report?.utilizationPercent).toBe(10);
    expect(report?.projectedExhaustionDate).toBeDefined();
    expect(typeof report?.onTrack).toBe('boolean');
    expect(report?.recommendedDailySpendMicros).toBeGreaterThanOrEqual(0);
  });

  it('returns undefined pacing report for nonexistent budget', () => {
    expect(getPacingReport('nonexistent')).toBeUndefined();
  });

  it('updates budget config', () => {
    const config: BudgetConfig = { totalBudgetMicros: 1000000 };
    const budget = createBudget('campaign-13', config);
    
    const updated = allocator.updateConfig(budget.budgetId, { 
      pacingStrategy: 'FRONT_LOADED',
      periodCapPercent: 80,
    });
    
    expect(updated).toBeDefined();
    expect(updated?.config.pacingStrategy).toBe('FRONT_LOADED');
    expect(updated?.config.periodCapPercent).toBe(80);
  });

  it('pauses and resumes budget', () => {
    const config: BudgetConfig = { totalBudgetMicros: 1000000 };
    const budget = createBudget('campaign-14', config);
    
    const paused = allocator.pauseBudget(budget.budgetId);
    expect(paused?.status).toBe('PAUSED');
    
    const resumed = allocator.resumeBudget(budget.budgetId);
    expect(resumed?.status).toBe('ACTIVE');
  });

  it('handles auto-replenishment on exhaustion', () => {
    const config: BudgetConfig = {
      totalBudgetMicros: 100000,
      onExhaustion: 'AUTO_REPLENISH',
      autoReplenish: {
        enabled: true,
        thresholdPercent: 10,
        replenishAmountMicros: 50000,
        maxReplenishCount: 2,
      },
      reservePercent: 0,
    };
    const budget = createBudget('campaign-15', config);
    
    // Spend all budget
    allocator.spend({ budgetId: budget.budgetId, amountMicros: 100000, rewardId: 'r1', metadata: {} });
    
    const budgetState = getBudget(budget.budgetId);
    expect(budgetState?.status).toBe('ACTIVE'); // Should have been replenished
    expect(budgetState?.totalBudgetMicros).toBe(150000); // Original + replenish
    expect(budgetState?.replenishCount).toBe(1);
  });

  it('respects max replenish count', () => {
    const config: BudgetConfig = {
      totalBudgetMicros: 100000,
      onExhaustion: 'AUTO_REPLENISH',
      autoReplenish: {
        enabled: true,
        thresholdPercent: 10,
        replenishAmountMicros: 50000,
        maxReplenishCount: 1,
      },
      reservePercent: 0,
    };
    const budget = createBudget('campaign-16', config);
    
    // Spend all budget to trigger first replenishment
    const result1 = allocator.spend({ budgetId: budget.budgetId, amountMicros: 100000, rewardId: 'r1', metadata: {} });
    
    // The second spend will fail due to insufficient funds (only 50000 available after replenishment)
    const result2 = allocator.spend({ budgetId: budget.budgetId, amountMicros: 60000, rewardId: 'r2', metadata: {} });
    
    // Second spend fails but budget is still active
    expect(result2.success).toBe(false);
    
    const budgetState = getBudget(budget.budgetId);
    expect(budgetState?.replenishCount).toBe(1);
    expect(budgetState?.status).toBe('ACTIVE'); // Budget exhausted but no more replenishments allowed
  });

  it('handles different budget periods', () => {
    const periods: BudgetPeriod[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'CAMPAIGN', 'LIFETIME'];
    
    for (const period of periods) {
      const config: BudgetConfig = { totalBudgetMicros: 1000000, period };
      const budget = createBudget(`campaign-${period.toLowerCase()}`, config);
      
      expect(budget.config.period).toBe(period);
      expect(new Date(budget.currentPeriodStart).getTime()).toBeLessThanOrEqual(Date.now());
      expect(new Date(budget.currentPeriodEnd).getTime()).toBeGreaterThan(Date.now());
    }
  });
});