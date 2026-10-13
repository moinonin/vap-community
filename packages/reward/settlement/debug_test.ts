import { InMemorySettlementEngine, getSettlementEngine, setSettlementEngine, createSettlement, prepareSettlement, reconcileSettlement, type RewardPayout } from './src/index';

const engine = new InMemorySettlementEngine();
setSettlementEngine(engine);

const settlement = createSettlement('campaign-1', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');

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
prepareSettlement(settlement.settlementId);

const ledgerEntries = engine.getLedgerEntries(settlement.settlementId);
console.log('Ledger entries:');
for (const e of ledgerEntries) {
  console.log(`  ${e.type} | ${e.account} | debit: ${e.debitMicros} | credit: ${e.creditMicros} | rewardId: ${e.rewardId}`);
}

const payoutIds = new Set(payouts.map(p => p.payoutId));
console.log('\nPayout IDs:', payoutIds);

console.log('\nChecking reconciliation logic:');
const expectedTotalMicros = payouts.reduce((sum, p) => sum + p.netAmountMicros, 0);
console.log('expectedTotalMicros:', expectedTotalMicros);

const actualTotalMicros = ledgerEntries
  .filter(e => e.type === 'REWARD_PAYOUT' && e.account === 'PAYABLE')
  .reduce((sum, e) => sum + e.creditMicros, 0);
console.log('actualTotalMicros:', actualTotalMicros);

console.log('\nChecking missing payouts:');
for (const entry of ledgerEntries) {
  if (entry.type === 'REWARD_PAYOUT' && entry.rewardId && !payoutIds.has(entry.rewardId)) {
    console.log('MISSING_PAYOUT:', entry.rewardId);
  }
}

console.log('\nChecking missing ledger entries:');
for (const payout of payouts) {
  const hasLedgerEntry = ledgerEntries.some(e => e.rewardId === payout.payoutId);
  console.log(`payout ${payout.payoutId} has ledger entry: ${hasLedgerEntry}`);
}
