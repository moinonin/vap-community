/**
 * @verified-attention/verifier
 *
 * VAE verification service - handles verification execution, replay, review queue, proof generation.
 */

// Re-export review queue
export { InMemoryReviewQueue, getReviewQueue, setReviewQueue } from './review-queue/index.js';
export type { ReviewItem, CreateReviewItemInput, ReviewDecisionInput, ReviewQueueStats, ReviewAgingReport, ReviewQueueFilters } from './review-queue/index.js';

// Re-export replay
export { InMemoryReplayService, getReplayService, setReplayService, replayVerification } from './replay/index.js';
export type { ReplayRequest, ReplayResult } from './replay/index.js';

// Re-export proof generation
export { 
  InMemoryProofStorage, 
  InMemoryProofGenerationPipeline, 
  getProofGenerationPipeline, 
  setProofGenerationPipeline, 
  generateProof 
} from './proof-gen/index.js';
export type { ProofGenerationJob, ProofGenerationResult, ProofQueueStats, ProofGenerationPipeline, ProofStorage, ProofSigner } from './proof-gen/index.js';