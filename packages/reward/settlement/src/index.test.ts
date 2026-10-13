import { describe, it, expect, beforeEach } from 'vitest';
import {
  setSettlementEngine,
  createSettlement,
  prepareSettlement,
  exportSettlement,
  reconcileSettlement,
  getSettlementSummary,
  getLedgerEntriesByCampaign,
  getPayoutsByRecipient,
  InMemorySettlementEngine,
  type SettlementEngine,
  type RewardPayout,
} from './index';

describe('Settlement Engine', () => {
  let engine: SettlementEngine;

  beforeEach(() => {
    engine = new InMemorySettlementEngine();
    setSettlementEngine(engine);
  });

  describe('createSettlement', () => {
    it('creates a settlement with pending status', () => {
      const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      
      expect(settlement).toBeDefined();
      expect(settlement.settlementId).toMatch(/^settlement_/);
      expect(settlement.campaignId).toBe('campaign-1');
      expect(settlement.status).toBe('PENDING');
      expect(settlement.periodStart).toBe('2024-01-01T00:00:00.000Z');
      expect(settlement.periodEnd).toBe('2024-01-31T23:59:59.999Z');
      expect(settlement.totalRewards).toBe(0);
      expect(settlement.totalRewardsMicros).toBe(0);
      expect(settlement.totalFeesMicros).toBe(0);
      expect(settlement.netPayoutMicros).toBe(0);
      expect(settlement.rewardCount).toBe(0);
      expect(settlement.uniqueRecipients).toBe(0);
      expect(settlement.uniqueVerifiers).toBe(0);
      expect(settlement.createdAt).toBeDefined();
      expect(settlement.updatedAt).toBeDefined();
    });

    it('can retrieve settlement by id', () => {
      const created = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      const retrieved = engine.getSettlement(created.settlementId);
      
      expect(retrieved).toEqual(created);
    });

    it('can retrieve settlements by campaign', () => {
      createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      createSettlement('campaign-1', '2024-02-01T00:00:00.000Z', '2024-02-29T23:59:59.999Z');
      createSettlement('campaign-2', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      
      const campaign1Settlements = engine.getSettlementsByCampaign('campaign-1');
      expect(campaign1Settlements.length).toBe(2);
      expect(campaign1Settlements.every(s => s.campaignId === 'campaign-1')).toBe(true);
    });
  });

  describe('addPayoutsToSettlement', () => {
    it('adds payouts and updates aggregates', () => {
      const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      
      const payouts: RewardPayout[] = [
        {
          payoutId: 'payout-1',
          settlementId: settlement.settlementId,
          campaignId: 'campaign-1',
          recipientId: 'viewer-1',
          recipientType: 'VIEWER',
          grossAmountMicros: 100000,
          feeMicros: 10000,
          netAmountMicros: 90000,
          currency: 'USD',
          proofId: 'proof-1',
          verifierId: 'verifier-1',
          contentId: 'content-1',
          sessionId: 'session-1',
          createdAt: new Date().toISOString(),
          status: 'PENDING',
        },
        {
          payoutId: 'payout-2',
          settlementId: settlement.settlementId,
          campaignId: 'campaign-1',
          recipientId: 'viewer-2',
          recipientType: 'VIEWER',
          grossAmountMicros: 200000,
          feeMicros: 20000,
          netAmountMicros: 180000,
          currency: 'USD',
          proofId: 'proof-2',
          verifierId: 'verifier-1',
          contentId: 'content-2',
          sessionId: 'session-2',
          rewardId: 'payout-2',
          createdAt: new Date().toISOString(),
          status: 'PENDING',
        },
      ];
      
      const updated = engine.addPayoutsToSettlement(settlement.settlementId, payouts);
      
      expect(updated.totalRewards).toBe(2);
      expect(updated.totalRewardsMicros).toBe(300000);
      expect(updated.totalFeesMicros).toBe(30000);
      expect(updated.netPayoutMicros).toBe(270000);
      expect(updated.rewardCount).toBe(2);
      expect(updated.uniqueRecipients).toBe(2);
      expect(updated.uniqueVerifiers).toBe(1);
    });

    it('throws for non-existent settlement', () => {
      const payouts: RewardPayout[] = [{
        payoutId: 'payout-1',
        settlementId: 'non-existent',
        campaignId: 'campaign-1',
        rewardId: 'payout-1',
        recipientId: 'viewer-1',
        recipientType: 'VIEWER',
        grossAmountMicros: 100000,
        feeMicros: 10000,
        netAmountMicros: 90000,
        currency: 'USD',
        proofId: 'proof-1',
        verifierId: 'verifier-1',
        contentId: 'content-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      }];

      expect(() => engine.addPayoutsToSettlement('non-existent', payouts)).toThrow('not found');
    });
  });

  describe('prepareSettlement', () => {
    it('prepares settlement and creates ledger entries', () => {
      const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      
      const payouts: RewardPayout[] = [{
        payoutId: 'payout-1',
        settlementId: settlement.settlementId,
        campaignId: 'campaign-1',
        rewardId: 'payout-1',
        recipientId: 'viewer-1',
        recipientType: 'VIEWER',
        grossAmountMicros: 100000,
        feeMicros: 10000,
        netAmountMicros: 90000,
        currency: 'USD',
        proofId: 'proof-1',
        verifierId: 'verifier-1',
        contentId: 'content-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      }];

      engine.addPayoutsToSettlement(settlement.settlementId, payouts);
      const prepared = prepareSettlement(settlement.settlementId);
      
      expect(prepared.status).toBe('READY');
      expect(prepared.preparedAt).toBeDefined();
      
      const ledgerEntries = engine.getLedgerEntries(settlement.settlementId);
      expect(ledgerEntries.length).toBeGreaterThan(0);
      
      // Should have REWARDS_EXPENSE debit and PAYABLE credit entries
      const expenseEntry = ledgerEntries.find(e => e.account === 'REWARDS_EXPENSE');
      const payableEntry = ledgerEntries.find(e => e.account === 'PAYABLE');
      expect(expenseEntry).toBeDefined();
      expect(payableEntry).toBeDefined();
      expect(expenseEntry?.debitMicros).toBe(90000);
      expect(payableEntry?.creditMicros).toBe(90000);
    });

    it('throws if settlement not in PENDING status', () => {
      const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      prepareSettlement(settlement.settlementId); // First prepare
      
      expect(() => prepareSettlement(settlement.settlementId)).toThrow('not in PENDING status');
    });
  });

  describe('exportSettlement', () => {
    it('exports settlement to CSV', async () => {
      const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      
      const payouts: RewardPayout[] = [{
        payoutId: 'payout-1',
        settlementId: settlement.settlementId,
        campaignId: 'campaign-1',
        rewardId: 'payout-1',
        recipientId: 'viewer-1',
        recipientType: 'VIEWER',
        grossAmountMicros: 100000,
        feeMicros: 10000,
        netAmountMicros: 90000,
        currency: 'USD',
        proofId: 'proof-1',
        verifierId: 'verifier-1',
        contentId: 'content-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      }];
      
      engine.addPayoutsToSettlement(settlement.settlementId, payouts);
      prepareSettlement(settlement.settlementId);
      
      const csv = await exportSettlement(settlement.settlementId, { format: 'CSV' });
      
      expect(csv).toContain('SETTLEMENT');
      expect(csv).toContain(settlement.settlementId);
      expect(csv).toContain('PAYOUT');
      expect(csv).toContain('payout-1');
      expect(csv).toContain('LEDGER');
    });

    it('exports settlement to JSON', async () => {
      const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      
      const payouts: RewardPayout[] = [{
        payoutId: 'payout-1',
        settlementId: settlement.settlementId,
        campaignId: 'campaign-1',
        rewardId: 'payout-1',
        recipientId: 'viewer-1',
        recipientType: 'VIEWER',
        grossAmountMicros: 100000,
        feeMicros: 10000,
        netAmountMicros: 90000,
        currency: 'USD',
        proofId: 'proof-1',
        verifierId: 'verifier-1',
        contentId: 'content-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      }];
      
      engine.addPayoutsToSettlement(settlement.settlementId, payouts);
      prepareSettlement(settlement.settlementId);
      
      const json = await exportSettlement(settlement.settlementId, { format: 'JSON' });
      
      const parsed = JSON.parse(json);
      expect(parsed.settlement.settlementId).toBe(settlement.settlementId);
      expect(parsed.payouts.length).toBe(1);
      expect(parsed.ledgerEntries.length).toBeGreaterThan(0);
      expect(parsed.exportedAt).toBeDefined();
    });

    it('exports settlement to SQL', async () => {
      const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      
      const payouts: RewardPayout[] = [{
        payoutId: 'payout-1',
        settlementId: settlement.settlementId,
        campaignId: 'campaign-1',
        rewardId: 'payout-1',
        recipientId: 'viewer-1',
        recipientType: 'VIEWER',
        grossAmountMicros: 100000,
        feeMicros: 10000,
        netAmountMicros: 90000,
        currency: 'USD',
        proofId: 'proof-1',
        verifierId: 'verifier-1',
        contentId: 'content-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      }];
      
      engine.addPayoutsToSettlement(settlement.settlementId, payouts);
      prepareSettlement(settlement.settlementId);
      
      const sql = await exportSettlement(settlement.settlementId, { format: 'SQL' });
      
      expect(sql).toContain('INSERT INTO settlements');
      expect(sql).toContain(settlement.settlementId);
      expect(sql).toContain('INSERT INTO payouts');
      expect(sql).toContain('INSERT INTO ledger_entries');
    });

    it('throws if settlement not ready', async () => {
      const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      
      await expect(exportSettlement(settlement.settlementId, { format: 'CSV' })).rejects.toThrow('not ready');
    });
  });

  describe('reconcileSettlement', () => {
    it('reconciles balanced settlement', () => {
      const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      
      const payouts: RewardPayout[] = [{
        payoutId: 'payout-1',
        settlementId: settlement.settlementId,
        campaignId: 'campaign-1',
        rewardId: 'payout-1',
        recipientId: 'viewer-1',
        recipientType: 'VIEWER',
        grossAmountMicros: 100000,
        feeMicros: 10000,
        netAmountMicros: 90000,
        currency: 'USD',
        proofId: 'proof-1',
        verifierId: 'verifier-1',
        contentId: 'content-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      }];

      engine.addPayoutsToSettlement(settlement.settlementId, payouts);
      prepareSettlement(settlement.settlementId);
      const report = reconcileSettlement(settlement.settlementId);
      
      expect(report.isBalanced).toBe(true);
      expect(report.discrepancyMicros).toBe(0);
      expect(report.discrepancies.length).toBe(0);
      expect(report.expectedTotalMicros).toBe(90000);
      expect(report.actualTotalMicros).toBe(90000);
      expect(settlement.status).toBe('RECONCILED');
    });

    it('detects missing payout in ledger', () => {
      const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      
      const payouts: RewardPayout[] = [{
        payoutId: 'payout-1',
        settlementId: settlement.settlementId,
        campaignId: 'campaign-1',
        rewardId: 'payout-1',
        recipientId: 'viewer-1',
        recipientType: 'VIEWER',
        grossAmountMicros: 100000,
        feeMicros: 10000,
        netAmountMicros: 90000,
        currency: 'USD',
        proofId: 'proof-1',
        verifierId: 'verifier-1',
        contentId: 'content-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      }];
      
      engine.addPayoutsToSettlement(settlement.settlementId, payouts);
      prepareSettlement(settlement.settlementId);
      
      // Manually add a ledger entry referencing a reward that doesn't exist in payouts
      // Access private ledger via type assertion
      const internalEngine = engine as unknown as { ledger: any[] };
      internalEngine.ledger.push({
        entryId: `ledger_extra_${Date.now()}`,
        settlementId: settlement.settlementId,
        timestamp: new Date().toISOString(),
        type: 'REWARD_PAYOUT',
        account: 'PAYABLE',
        debitMicros: 0,
        creditMicros: 50000,
        currency: 'USD',
        campaignId: 'campaign-1',
        rewardId: 'non-existent-reward',
        budgetId: undefined,
        description: 'Extra ledger entry',
        balanceAfterMicros: 0,
      });
      
      const report = reconcileSettlement(settlement.settlementId);
      
      expect(report.isBalanced).toBe(false);
      expect(report.discrepancies.some(d => d.type === 'MISSING_PAYOUT')).toBe(true);
      expect(settlement.status).toBe('FAILED');
    });
  });

  describe('getLedgerEntriesByCampaign', () => {
    it('returns ledger entries for campaign', () => {
      const settlement1 = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      const settlement2 = createSettlement('campaign-2', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      
      const payouts: RewardPayout[] = [{
        payoutId: 'payout-1',
        settlementId: settlement1.settlementId,
        campaignId: 'campaign-1',
        rewardId: 'payout-1',
        recipientId: 'viewer-1',
        recipientType: 'VIEWER',
        grossAmountMicros: 100000,
        feeMicros: 10000,
        netAmountMicros: 90000,
        currency: 'USD',
        proofId: 'proof-1',
        verifierId: 'verifier-1',
        contentId: 'content-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      }];
      
      engine.addPayoutsToSettlement(settlement1.settlementId, payouts);
      prepareSettlement(settlement1.settlementId);
      
      const entries = getLedgerEntriesByCampaign('campaign-1');
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every(e => {
        const s = engine.getSettlement(e.settlementId);
        return s?.campaignId === 'campaign-1';
      })).toBe(true);
    });
  });

  describe('getPayoutsByRecipient', () => {
    it('returns payouts for recipient', () => {
      const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      
      const payouts: RewardPayout[] = [
        {
          payoutId: 'payout-1',
          settlementId: settlement.settlementId,
          campaignId: 'campaign-1',
          recipientId: 'viewer-1',
          recipientType: 'VIEWER',
          grossAmountMicros: 100000,
          feeMicros: 10000,
          netAmountMicros: 90000,
          currency: 'USD',
          proofId: 'proof-1',
          verifierId: 'verifier-1',
          contentId: 'content-1',
          sessionId: 'session-1',
          createdAt: new Date().toISOString(),
          status: 'PENDING',
        },
        {
          payoutId: 'payout-2',
          settlementId: settlement.settlementId,
          campaignId: 'campaign-1',
          rewardId: 'payout-2',
          recipientId: 'viewer-1',
          recipientType: 'VIEWER',
          grossAmountMicros: 200000,
          feeMicros: 20000,
          netAmountMicros: 180000,
          currency: 'USD',
          proofId: 'proof-2',
          verifierId: 'verifier-1',
          contentId: 'content-2',
          sessionId: 'session-2',
          createdAt: new Date().toISOString(),
          status: 'PENDING',
        },
      ];
      
      engine.addPayoutsToSettlement(settlement.settlementId, payouts);
      
      const recipientPayouts = getPayoutsByRecipient('viewer-1');
      expect(recipientPayouts.length).toBe(2);
      expect(recipientPayouts.every(p => p.recipientId === 'viewer-1')).toBe(true);
    });
  });

  describe('getSettlementSummary', () => {
    it('returns summary for campaign', () => {
      const settlement1 = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
      const settlement2 = createSettlement('campaign-1', '2024-02-01T00:00:00.000Z', '2024-02-29T23:59:59.999Z');
      
      const payouts1: RewardPayout[] = [{
        payoutId: 'payout-1',
        settlementId: settlement1.settlementId,
        campaignId: 'campaign-1',
        rewardId: 'payout-1',
        recipientId: 'viewer-1',
        recipientType: 'VIEWER',
        grossAmountMicros: 100000,
        feeMicros: 10000,
        netAmountMicros: 90000,
        currency: 'USD',
        proofId: 'proof-1',
        verifierId: 'verifier-1',
        contentId: 'content-1',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        status: 'PENDING',
        }];

        const payouts2: RewardPayout[] = [{
        payoutId: 'payout-2',
        settlementId: settlement2.settlementId,
        campaignId: 'campaign-1',
        rewardId: 'payout-2',
        recipientId: 'viewer-2',
        recipientType: 'VIEWER',
        grossAmountMicros: 200000,
        feeMicros: 20000,
        netAmountMicros: 180000,
        currency: 'USD',
        proofId: 'proof-2',
        verifierId: 'verifier-1',
        contentId: 'content-2',
        sessionId: 'session-2',
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      }];
      
      engine.addPayoutsToSettlement(settlement1.settlementId, payouts1);
      engine.addPayoutsToSettlement(settlement2.settlementId, payouts2);
      
      const summary = getSettlementSummary('campaign-1');
      
      expect(summary.campaignId).toBe('campaign-1');
      expect(summary.totalSettlements).toBe(2);
      expect(summary.totalRewards).toBe(2);
      expect(summary.totalRewardsMicros).toBe(300000);
      expect(summary.totalFeesMicros).toBe(30000);
      expect(summary.netPayoutMicros).toBe(270000);
      expect(summary.totalRewardCount).toBe(2);
      expect(summary.uniqueRecipients).toBe(2);
    });
  });
});