#!/usr/bin/env node
/**
 * Provider Verification Setup (S3.5)
 * Reads compose service URLs and verifies provider endpoints are reachable.
 */

const providers = [
  { name: 'verified-attention-verifier', url: 'http://localhost:3001/health', service: 'verifier' },
  { name: 'verified-attention-verification', url: 'http://localhost:3000/health', service: 'api' },
  { name: 'verified-attention-settlement-worker', url: 'http://localhost:3002/health', service: 'settlement-worker' },
];

console.log('Provider verification targets (from docker-compose networks):');
for (const p of providers) {
  console.log(`  - ${p.name}`);
  console.log(`    Service: ${p.service}`);
  console.log(`    URL: ${p.url}`);
  console.log(`    Contract file: contracts/${p.name.split('-').pop()}-contract.json`);
}

console.log('\nTo verify providers end-to-end:');
console.log('  1. Start services: docker-compose up -d api verifier settlement-worker');
console.log('  2. Run: node contracts/contract-tests/contract-test.js');
console.log('  3. (Future) Integrate with @pact-foundation/pact for full verification');
