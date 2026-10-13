/**
 * Litmus Chaos Script — Partition API ↔ Settlement (S5.4)
 * Simulates network partition between api and settlement-worker.
 */

console.log('Chaos: Partition api and settlement-worker');
console.log('Method: docker network disconnect / iptables DROP');
console.log('Expected: settlement queue accumulates; no data loss; drains on reconnect.');
console.log('Verification steps:');
console.log('  1. Block traffic: docker network disconnect vae-net vae-api');
console.log('  2. Submit settlement job; confirm queued (not lost)');
console.log('  3. Reconnect: docker network connect vae-net vae-api');
console.log('  4. Verify settlement processes within 60s');
console.log('  5. Check reconciliation report: discrepancyMicros = 0');
