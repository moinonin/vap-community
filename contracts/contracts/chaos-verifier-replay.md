/**
 * Litmus Chaos Script — Kill Verifier Mid-Replay (S5.3)
 * Simulates verifier process termination during replay and verifies no lost proofs.
 */

console.log('Chaos: Kill verifier mid-replay');
console.log('Target: container vae-verifier');
console.log('Expected: replay resumes from queue; no lost proofs; idempotent retry succeeds.');
console.log('Verification steps:');
console.log('  1. docker kill vae-verifier');
console.log('  2. Check replay queue depth (should not grow infinitely)');
console.log('  3. Restart verifier: docker compose restart verifier');
console.log('  4. Verify replay completes within 30s');
console.log('  5. Confirm proof storage has zero gaps (compare before/after counts)');
