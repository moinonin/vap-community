import { InMemorySettlementEngine, getSettlementEngine, setSettlementEngine, createSettlement, prepareSettlement, reconcileSettlement, type RewardPayout } from './src/index';

const engine = new InMemorySettlementEngine();
setSettlementEngine(engine);

console.log('Engine from getSettlementEngine() === local engine:', getSettlementEngine() === engine);

const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
console.log('Created settlement:', settlement.settlementId);

const payouts: RewardPayout[] = [{
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
  rewardId: 'payout-1',
  createdAt: new Date().toISOString(),
  status: 'PENDING',
}];

engine.addPayoutsToSettlement(settlement.settlementId, payouts);
console.log('Added payouts');

prepareSettlement(settlement.settlementId);
console.log('Prepared settlement');

const ledgerEntries = engine.getLedgerEntries(settlement.settlementId);
console.log('Ledger entries:');
for (const e of ledgerEntries) {
  console.log(`  ${e.type} | ${e.account} | debit: ${e.debitMicros} | credit: ${e.creditMicros} | rewardId: ${e.rewardId}`);
}

const report = reconcileSettlement(settlement.settlementId);
console.log('\nReconciliation report:');
console.log('  isBalanced:', report.isBalanced);
console.log('  expectedTotalMicros:', report.expectedTotalMicros);
console.log('  actualTotalMicros:', report.actualTotalMicros);
console.log('  discrepancyMicros:', report.discrepancyMicros);
console.log('  discrepancies:', report.discrepancies);
