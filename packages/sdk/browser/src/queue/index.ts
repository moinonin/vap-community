/**
 * Offline-tolerant batching queue for evidence.
 *
 * - In-memory deque + optional StorageAdapter (localStorage) persistence so
 *   queued evidence survives reloads.
 * - Flushes on an interval, on batch size, and on explicit flush().
 * - Retries transient failures (network, 5xx, 429) with exponential backoff;
 *   drops 4xx permanently (the server rejected it — retrying won't help).
 */

import { ApiError } from '../api/client';
import type { StorageAdapter, TimerAdapter } from '../types';
import { validateEvidence } from '../validation/evidence';

interface QueuedItem {
  evidence: unknown;
  attempts: number;
}

export interface EvidenceQueueOptions {
  batchSize?: number;
  flushIntervalMs?: number;
  storage?: StorageAdapter | null;
  storageKey?: string;
  timers?: TimerAdapter;
  onError?: (error: unknown) => void;
  /** send() posts one evidence record; provided by ApiClient. */
  send: (evidence: unknown) => Promise<string>;
  now?: () => number;
}

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

const defaultTimers: TimerAdapter = { setInterval, clearInterval };

export class EvidenceQueue {
  private items: QueuedItem[] = [];
  private flushing = false;
  private timerId: unknown;
  private nextFlushAllowedAt = 0;

  private readonly batchSize: number;
  private readonly storageKey: string;
  private readonly timers: TimerAdapter;
  private readonly now: () => number;

  constructor(private readonly opts: EvidenceQueueOptions) {
    this.batchSize = opts.batchSize ?? 10;
    this.storageKey = opts.storageKey ?? 'vap:evidence-queue';
    this.timers = opts.timers ?? defaultTimers;
    this.now = opts.now ?? (() => Date.now());
    this.restore();
  }

  get size(): number {
    return this.items.length;
  }

  start(flushIntervalMs = 10_000): void {
    this.stopTimer();
    this.timerId = this.timers.setInterval(() => void this.flush(), flushIntervalMs);
  }

  stopTimer(): void {
    if (this.timerId !== undefined) {
      this.timers.clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }

  /**
   * Enqueue one evidence record after pre-send validation.
   * Invalid records are dropped (never sent); returns false.
   */
  enqueue(evidence: unknown): boolean {
    const result = validateEvidence(evidence);
    if (!result.ok) {
      this.opts.onError?.(
        new Error(
          `evidence failed pre-send validation: ${result.errors
            ?.map((e) => `${e.path}: ${e.message}`)
            .join('; ')}`,
        ),
      );
      return false;
    }
    this.items.push({ evidence, attempts: 0 });
    this.persist();
    if (this.items.length >= this.batchSize) void this.flush();
    return true;
  }

  /** Flush pending items. Safe to call concurrently (re-entrant calls no-op). */
  async flush(): Promise<void> {
    if (this.flushing || this.items.length === 0) return;
    if (this.now() < this.nextFlushAllowedAt) return;
    this.flushing = true;
    try {
      while (this.items.length > 0) {
        const item = this.items[0]!;
        try {
          await this.opts.send(item.evidence);
          this.items.shift();
        } catch (err) {
          const status = err instanceof ApiError ? err.status : 0;
          const permanent = err instanceof ApiError && status >= 400 && status < 500 && status !== 429;
          if (permanent || item.attempts + 1 >= MAX_ATTEMPTS) {
            this.items.shift();
            this.opts.onError?.(
              new Error(
                `evidence dropped after ${item.attempts + 1} attempt(s): ${
                  (err as Error)?.message ?? 'unknown'
                }`,
              ),
            );
            continue;
          }
          item.attempts += 1;
          const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (item.attempts - 1));
          this.nextFlushAllowedAt = this.now() + backoff;
          break; // stop this flush cycle; timer will retry later
        }
      }
    } finally {
      this.flushing = false;
      this.persist();
    }
  }

  private persist(): void {
    const storage = this.opts.storage ?? undefined;
    if (!storage) return;
    try {
      if (this.items.length === 0) {
        storage.removeItem(this.storageKey);
      } else {
        storage.setItem(this.storageKey, JSON.stringify(this.items));
      }
    } catch (err) {
      this.opts.onError?.(err); // e.g. quota exceeded — queue keeps working in memory
    }
  }

  private restore(): void {
    const storage = this.opts.storage ?? undefined;
    if (!storage) return;
    try {
      const raw = storage.getItem(this.storageKey);
      if (!raw) return;
      const items = JSON.parse(raw) as QueuedItem[];
      if (Array.isArray(items)) {
        this.items = items.filter(
          (i) => i && typeof i === 'object' && validateEvidence(i.evidence).ok,
        );
      }
    } catch {
      this.items = []; // corrupted persistence — start clean
    }
  }
}
