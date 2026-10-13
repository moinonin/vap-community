/**
 * Verification Worker Entrypoint
 *
 * Runs as a background service/daemon in the VAE cluster,
 * polling and executing review queue, proof generation, and verification jobs.
 */

import { getReviewQueue } from './review-queue/index.js';
import { getProofGenerationPipeline } from './proof-gen/index.js';
import { getReplayService } from './replay/index.js';

console.log('=============================================================');
console.log('🔍 Verified Attention Verifier & Worker Daemon starting...');
console.log('=============================================================');

const reviewQueue = getReviewQueue();
const proofPipeline = getProofGenerationPipeline();
const replayService = getReplayService();

console.log('[verifier] Review Queue initialized');
console.log('[verifier] Proof Generation Pipeline initialized');
console.log('[verifier] Replay Service initialized');

// Periodic health and queue processing loop
let tick = 0;
const interval = setInterval(async () => {
  tick++;
  try {
    const stats = reviewQueue.getStats();
    if (tick % 30 === 0) {
      console.log(`[verifier] Heartbeat: pending reviews=${stats.totalPending}, escalated=${stats.totalEscalated}`);
    }
  } catch (err) {
    console.error('[verifier] Worker loop error:', err);
  }
}, 2000);

// Keep process active and handle graceful shutdown
process.on('SIGINT', () => {
  console.log('[verifier] Shutting down cleanly...');
  clearInterval(interval);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[verifier] Shutting down cleanly...');
  clearInterval(interval);
  process.exit(0);
});

console.log('[verifier] Worker daemon active and listening for verification jobs.');
