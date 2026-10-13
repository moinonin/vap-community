/**
 * Append-only evidence store (VAP Section 3)
 *
 * Evidence stores MUST be append-only. Once evidence is written, it cannot
 * be modified, deleted, or updated. Any correction takes the form of
 * additional supplementary evidence, not edits to existing evidence.
 *
 * VAP Section 5 also requires evidence stores to be indexed by session_id and EVID.
 */

import { randomUUID } from 'crypto';

/**
 * Minimal evidence shape required by the store
 * Avoids type identity issues with core package's Evidence type
 */
export interface StoredEvidence {
  readonly evidenceId: string;
  readonly sessionId: string;
  readonly sourceId: string;
  readonly timestamp: string;
  readonly evidenceType: string;
  readonly confidence: number;
  readonly payload: unknown;
  readonly provenance: {
    observationIds: string[];
    observationHash: string;
    sourceId: string;
    collectionMethod?: string;
  };
  readonly signature: string;
  readonly metadata?: Record<string, unknown>;
  readonly baseMetadata?: {
    createdAt: string;
    updatedAt?: string;
    version: number;
    tags?: Record<string, string>;
  };
}

export type EvidenceId = string;
export type SessionId = string;

/**
 * Store options
 */
export interface EvidenceStoreOptions {
  /** Maximum entries per session (overflow protection) */
  maxEntriesPerSession?: number;
  /** Whether to emit events on append */
  emitWrite?: boolean;
}

/**
 * Abstract evidence store interface
 */
export interface EvidenceStore {
  /** Append evidence record (write-once, no update/delete) */
  append(evidence: StoredEvidence): Promise<void>;

  /** Get evidence by evidence ID (EVID) */
  getByEvidenceId(evidenceId: string): Promise<StoredEvidence | null>;

  /** Get all evidence belonging to a single session */
  getBySession(sessionId: string): Promise<StoredEvidence[]>;

  /** Get count of evidence in the store */
  count(): Promise<number>;

  /** Async iterator paging through evidence entries */
  iterate(pages: number, pageSize?: number): AsyncIterable<StoredEvidence>;
}

/**
 * In-memory evidence store for testing and local development
 */
export class InMemoryEvidenceStore implements EvidenceStore {
  private readonly _records: Map<string, StoredEvidence> = new Map();
  private readonly _index: Map<string, Set<string>> = new Map();
  private readonly maxPerSession: number;

  constructor(options?: EvidenceStoreOptions) {
    this.maxPerSession = options?.maxEntriesPerSession ?? 100_000;
  }

  async append(evidence: StoredEvidence): Promise<void> {
    // Immutability enforcement
    if (this._records.has(evidence.evidenceId)) {
      throw new EvidenceStoreError(
        `Evidence already exists: ${evidence.evidenceId}`,
        'DUPLICATE'
      );
    }

    // Session overflow
    const sessionRecords = this._index.get(evidence.sessionId);
    if (sessionRecords !== undefined && sessionRecords.size + 1 > this.maxPerSession) {
      throw new EvidenceStoreError(
        `Session ${evidence.sessionId} exceeds max entries ${this.maxPerSession}`,
        'OVERFLOW'
      );
    }

    // Write
    this._records.set(evidence.evidenceId, evidence);
    const sessionIds = this._index.get(evidence.sessionId) || new Set();
    sessionIds.add(evidence.evidenceId);
    if (!this._index.has(evidence.sessionId)) {
      this._index.set(evidence.sessionId, sessionIds);
    }
  }

  async getByEvidenceId(evidenceId: string): Promise<StoredEvidence | null> {
    const record = this._records.get(evidenceId);
    return record !== undefined ? record : null;
  }

  async getBySession(sessionId: string): Promise<StoredEvidence[]> {
    const set = this._index.get(sessionId);
    if (!set) return [];
    
    const results: StoredEvidence[] = [];
    for (const id of set) {
      const record = this._records.get(id);
      if (record !== undefined) {
        results.push(record);
      }
    }
    
    results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return results;
  }

  async count(): Promise<number> {
    return this._records.size;
  }

  async *iterate(_pages: number = 100, pageSize?: number): AsyncIterable<StoredEvidence> {
    const entries = Array.from(this._records.values());
    const limit = pageSize ?? entries.length;
    for (let i = 0; i < Math.min(entries.length, limit); i++) {
      const entry = entries[i];
      if (entry !== undefined) {
        yield entry;
      }
    }
  }
}

/**
 * Evidence store specialized errors
 */
export class EvidenceStoreError extends Error {
  readonly code: 'DUPLICATE' | 'OVERFLOW' | 'MISSING_SESSION';

  constructor(message: string, code: 'DUPLICATE' | 'OVERFLOW' | 'MISSING_SESSION') {
    super(message);
    this.code = code;
    this.name = 'EvidenceStoreError';
  }
}

/**
 * Create an in-memory evidence store with default options
 */
export function createEvidenceStore(options?: EvidenceStoreOptions): EvidenceStore {
  return new InMemoryEvidenceStore(options);
}

/**
 * Store options
 */
export interface EvidenceStoreOptions {
  /** Maximum entries per session (overflow protection) */
  maxEntriesPerSession?: number;
  /** Whether to emit events on append */
  emitWrite?: boolean;
}