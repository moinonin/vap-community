import { createHash } from 'crypto';
import type { Evidence } from '@verified-attention/core';

/**
 * Deduplication result for a piece of evidence
 */
export interface DeduplicationResult {
  /** The evidence ID if deduplicated, or null if new */
  evidenceId: string | null;
  /** Whether this is a duplicate */
  isDuplicate: boolean;
  /** The content hash used for deduplication */
  contentHash: string;
  /** The session ID this was deduplicated against */
  sessionId: string | null;
}

/**
 * In-memory deduplication store (use Redis in production)
 */
export interface DeduplicationStore {
  /** Check if content hash exists */
  has(hash: string): boolean;
  /** Get evidence ID by content hash */
  get(hash: string): string | undefined;
  /** Store content hash -> evidence ID mapping */
  set(hash: string, evidenceId: string): void;
  /** Store session-based deduplication */
  setSession(sessionId: string, evidenceId: string): void;
  /** Check session-based deduplication */
  getSession(sessionId: string): string | undefined;
}

/**
 * In-memory implementation (use Redis for production)
 */
export class InMemoryDeduplicationStore implements DeduplicationStore {
  private contentMap = new Map<string, string>();
  private sessionMap = new Map<string, string>();

  has(hash: string): boolean {
    return this.contentMap.has(hash);
  }

  get(hash: string): string | undefined {
    return this.contentMap.get(hash);
  }

  set(hash: string, evidenceId: string): void {
    this.contentMap.set(hash, evidenceId);
  }

  setSession(sessionId: string, evidenceId: string): void {
    this.sessionMap.set(sessionId, evidenceId);
  }

  getSession(sessionId: string): string | undefined {
    return this.sessionMap.get(sessionId);
  }
}

/**
 * Compute content hash for deduplication
 * Uses xxhash for speed (SHA-256 for stronger guarantees)
 */
export function computeContentHash(evidence: Evidence): string {
  // Create a stable representation for hashing
  const hashInput = JSON.stringify({
    type: evidence.evidenceType,
    payload: evidence.payload,
    // Include session ID for session-scoped deduplication
    // but NOT observation IDs (those are unique per observation)
    provenance: {
      sourceId: evidence.provenance.sourceId,
      collectionMethod: evidence.provenance.collectionMethod,
      // Exclude observationIds and observationHash from hash input
    },
  });

  // Use xxhash for speed (production would use xxhashjs or native)
  return createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Deduplication pipeline stage
 * Checks if evidence has already been processed (content-hash + session)
 */
export class DeduplicationStage {
  constructor(private store: DeduplicationStore = new InMemoryDeduplicationStore()) {}

  /**
   * Process evidence through deduplication
   * Returns deduplication result and sets evidence state
   */
  async process(evidence: Evidence): Promise<DeduplicationResult> {
    const contentHash = computeContentHash(evidence);
    const sessionId = (evidence as any).sessionId ?? (evidence as any).metadata?.sessionId ?? null;

    // First check session-based deduplication (fast path)
    if (sessionId) {
      const sessionEvidenceId = this.store.getSession(sessionId);
      if (sessionEvidenceId) {
        return {
          evidenceId: sessionEvidenceId,
          isDuplicate: true,
          contentHash,
          sessionId,
        };
      }
    }

    // Then check content-hash deduplication
    const existingEvidenceId = this.store.get(contentHash);
    if (existingEvidenceId) {
      // Also store session mapping for future fast lookups
      if (sessionId) {
        this.store.setSession(sessionId, existingEvidenceId);
      }
      return {
        evidenceId: existingEvidenceId,
        isDuplicate: true,
        contentHash,
        sessionId,
      };
    }

    // New evidence - store both content hash and session
    // (evidenceId will be assigned by the pipeline after this stage)
    const newEvidenceId = (evidence as any).evidenceId ?? (evidence as any).id; // Use the evidence's own ID

    this.store.set(contentHash, newEvidenceId);
    if (sessionId) {
      this.store.setSession(sessionId, newEvidenceId);
    }

    return {
      evidenceId: newEvidenceId,
      isDuplicate: false,
      contentHash,
      sessionId,
    };
  }

  /**
   * Reset the store (for testing)
   */
  reset(): void {
    if (this.store instanceof InMemoryDeduplicationStore) {
      this.store['contentMap'].clear();
      this.store['sessionMap'].clear();
    }
  }
}

/**
 * Create deduplication stage with default in-memory store
 */
export function createDeduplicationStage(): DeduplicationStage {
  return new DeduplicationStage();
}

export default {
  DeduplicationStage,
  InMemoryDeduplicationStore,
  computeContentHash,
  createDeduplicationStage,
};