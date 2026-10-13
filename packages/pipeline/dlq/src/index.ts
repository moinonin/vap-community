/**
 * Dead Letter Queue (DLQ)
 *
 * Stores evidence that failed processing for later retry or analysis:
 * - Retry with exponential backoff
 * - Max retry limit (default 3)
 * - Reason tracking for each failure
 * - Replay mechanism for retry attempts
 *
 * @module @verified-attention/pipeline-dlq
 */

/**
 * DLQ entry — a failed evidence item with metadata
 */
export interface DLQEntry {
  id: string;
  evidence: any;
  originalError: string;
  retryCount: number;
  maxRetries: number;
  firstFailedAt: number;
  lastFailedAt: number;
  nextRetryAt: number;
  failureReasons: string[];
  status: DLQStatus;
}

/**
 * DLQ entry status
 */
export enum DLQStatus {
  PENDING = 'PENDING',
  RETRYING = 'RETRYING',
  PERMANENTLY_FAILED = 'PERMANENTLY_FAILED',
  REPROCESSED = 'REPROCESSED',
}

/**
 * DLQ configuration
 */
export interface DLQConfig {
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
}

export const DEFAULT_DLQ_CONFIG: DLQConfig = {
  maxRetries: 3,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 60000,
};

/**
 * Generate a unique ID for DLQ entries
 */
function generateId(): string {
  return `dlq-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Compute exponential backoff delay
 */
function computeRetryDelay(retryCount: number, config: DLQConfig): number {
  const delay = config.baseRetryDelayMs * Math.pow(2, retryCount);
  return Math.min(delay, config.maxRetryDelayMs);
}

/**
 * In-memory DLQ implementation
 * (Production: use Redis Streams, Kafka, or AWS SQS)
 */
export class DeadLetterQueue {
  private entries = new Map<string, DLQEntry>();
  private config: DLQConfig;

  constructor(config: Partial<DLQConfig> = {}) {
    this.config = { ...DEFAULT_DLQ_CONFIG, ...config };
  }

  /**
   * Add a failed evidence item to the DLQ
   */
  add(evidence: any, error: string): DLQEntry {
    const id = generateId();
    const now = Date.now();
    const entry: DLQEntry = {
      id,
      evidence,
      originalError: error,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      firstFailedAt: now,
      lastFailedAt: now,
      nextRetryAt: now + computeRetryDelay(0, this.config),
      failureReasons: [error],
      status: DLQStatus.PENDING,
    };
    this.entries.set(id, entry);
    return entry;
  }

  /**
   * Record a retry attempt failure
   */
  recordRetryFailure(id: string, error: string): DLQEntry | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;

    entry.retryCount++;
    entry.lastFailedAt = Date.now();
    entry.failureReasons.push(error);

    if (entry.retryCount >= entry.maxRetries) {
      entry.status = DLQStatus.PERMANENTLY_FAILED;
      entry.nextRetryAt = -1;
    } else {
      entry.status = DLQStatus.RETRYING;
      entry.nextRetryAt = Date.now() + computeRetryDelay(entry.retryCount, this.config);
    }

    return entry;
  }

  /**
   * Mark an entry as successfully reprocessed
   */
  markReprocessed(id: string): DLQEntry | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    entry.status = DLQStatus.REPROCESSED;
    return entry;
  }

  /**
   * Get entries ready for retry (nextRetryAt <= now)
   */
  getReadyForRetry(): DLQEntry[] {
    const now = Date.now();
    return Array.from(this.entries.values()).filter(
      e => e.status === DLQStatus.PENDING || (e.status === DLQStatus.RETRYING && e.nextRetryAt <= now)
    );
  }

  /**
   * Get entries by status
   */
  getByStatus(status: DLQStatus): DLQEntry[] {
    return Array.from(this.entries.values()).filter(e => e.status === status);
  }

  /**
   * Get a single entry by ID
   */
  get(id: string): DLQEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Get all entries
   */
  getAll(): DLQEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Remove an entry
   */
  remove(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * Get DLQ statistics
   */
  getStats(): DLQStats {
    const entries = Array.from(this.entries.values());
    return {
      total: entries.length,
      pending: entries.filter(e => e.status === DLQStatus.PENDING).length,
      retrying: entries.filter(e => e.status === DLQStatus.RETRYING).length,
      permanentlyFailed: entries.filter(e => e.status === DLQStatus.PERMANENTLY_FAILED).length,
      reprocessed: entries.filter(e => e.status === DLQStatus.REPROCESSED).length,
    };
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
  }
}

/**
 * DLQ statistics
 */
export interface DLQStats {
  total: number;
  pending: number;
  retrying: number;
  permanentlyFailed: number;
  reprocessed: number;
}

export default {
  DeadLetterQueue,
  DLQStatus,
  DEFAULT_DLQ_CONFIG,
};
