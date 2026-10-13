/**
 * Verification Audit Log (VAE Sprint 10)
 *
 * Immutable, queryable audit log for verification decisions.
 * Provides tamper-evident logging with structured query capabilities.
 */

import { z } from 'zod';
import { createHash } from 'node:crypto';

// ─── Audit Entry Schema ─────────────────────────────────────────────────────

export const AuditEntrySchema = z.object({
  entryId: z.string().min(1),
  timestamp: z.string().datetime(),
  // What was verified
  sessionId: z.string().min(1),
  policyId: z.string().min(1),
  // The outcome
  outcome: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE', 'REVIEW', 'ERROR']),
  confidence: z.number().min(0).max(1),
  // Evidence used
  evidenceHash: z.string().min(1), // Hash of evidence bundle for integrity
  evidenceCount: z.number().int().nonnegative(),
  evidenceTypes: z.array(z.string()),
  // Policy applied
  policyVersion: z.number().int().nonnegative(),
  // Decision details
  passedChecks: z.array(z.string()),
  failedChecks: z.array(z.string()),
  warnings: z.array(z.string()),
  // For replay
  inputSnapshot: z.record(z.unknown()).optional(),
  // Chain integrity
  previousHash: z.string().optional(),
  entryHash: z.string().min(1),
  // Metadata
  verifierVersion: z.string().optional(),
  correlationId: z.string().optional(),
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const CreateAuditEntryInputSchema = z.object({
  sessionId: z.string().min(1),
  policyId: z.string().min(1),
  outcome: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE', 'REVIEW', 'ERROR']),
  confidence: z.number().min(0).max(1),
  evidenceHash: z.string().min(1),
  evidenceCount: z.number().int().nonnegative(),
  evidenceTypes: z.array(z.string()),
  policyVersion: z.number().int().nonnegative(),
  passedChecks: z.array(z.string()),
  failedChecks: z.array(z.string()),
  warnings: z.array(z.string()),
  inputSnapshot: z.record(z.unknown()).optional(),
  verifierVersion: z.string().optional(),
  correlationId: z.string().optional(),
});

export type CreateAuditEntryInput = z.infer<typeof CreateAuditEntryInputSchema>;

// ─── Query Types ─────────────────────────────────────────────────────────────

export interface AuditQuery {
  sessionId?: string;
  policyId?: string;
  outcome?: AuditEntry['outcome'];
  fromDate?: string;
  toDate?: string;
  minConfidence?: number;
  maxConfidence?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'confidence' | 'sessionId';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditStats {
  totalEntries: number;
  byOutcome: Record<AuditEntry['outcome'], number>;
  avgConfidence: number;
  timeRange: { earliest: string; latest: string } | null;
}

export interface AuditChainVerification {
  valid: boolean;
  brokenAt?: number;
  totalChecked: number;
  firstEntryHash: string;
  lastEntryHash: string;
}

// ─── Audit Log Interface ─────────────────────────────────────────────────────

export interface AuditLog {
  append(input: CreateAuditEntryInput): AuditEntry;
  get(entryId: string): AuditEntry | undefined;
  query(filters: AuditQuery): AuditEntry[];
  getStats(filters?: Partial<AuditQuery>): AuditStats;
  verifyChain(): AuditChainVerification;
  getChainHead(): string;
  exportRange(fromDate: string, toDate: string): AuditEntry[];
}

// ─── Hash Utility ────────────────────────────────────────────────────────────

function computeEntryHash(entry: Omit<CreateAuditEntryInput, 'entryId' | 'timestamp' | 'entryHash' | 'previousHash'> & {
  entryId: string;
  timestamp: string;
  previousHash?: string;
}): string {
  const data = JSON.stringify({
    entryId: entry.entryId,
    timestamp: entry.timestamp,
    sessionId: entry.sessionId,
    policyId: entry.policyId,
    outcome: entry.outcome,
    confidence: entry.confidence,
    evidenceHash: entry.evidenceHash,
    evidenceCount: entry.evidenceCount,
    evidenceTypes: entry.evidenceTypes,
    policyVersion: entry.policyVersion,
    passedChecks: entry.passedChecks,
    failedChecks: entry.failedChecks,
    warnings: entry.warnings,
    inputSnapshot: entry.inputSnapshot,
    verifierVersion: entry.verifierVersion,
    correlationId: entry.correlationId,
    previousHash: entry.previousHash,
  }, Object.keys(entry).sort());

  return createHash('sha256').update(data).digest('hex');
}

// ─── In-Memory Audit Log Implementation ──────────────────────────────────────

export class InMemoryAuditLog implements AuditLog {
  private entries: Map<string, AuditEntry> = new Map();
  private entryOrder: string[] = [];
  private chainHead: string = '';

  append(input: CreateAuditEntryInput): AuditEntry {
    const entryId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = new Date().toISOString();
    const previousHash = this.chainHead;

    const baseEntry = { ...input, entryId, timestamp, previousHash };
    const entryHash = computeEntryHash(baseEntry);

    const entry: AuditEntry = {
      ...baseEntry,
      entryHash,
    };

    this.entries.set(entryId, entry);
    this.entryOrder.push(entryId);
    this.chainHead = entryHash;

    return entry;
  }

  get(entryId: string): AuditEntry | undefined {
    return this.entries.get(entryId);
  }

  query(filters: AuditQuery = {}): AuditEntry[] {
    let results = Array.from(this.entries.values());

    if (filters.sessionId) {
      results = results.filter((e) => e.sessionId === filters.sessionId);
    }
    if (filters.policyId) {
      results = results.filter((e) => e.policyId === filters.policyId);
    }
    if (filters.outcome) {
      results = results.filter((e) => e.outcome === filters.outcome);
    }
    if (filters.fromDate) {
      const from = new Date(filters.fromDate).getTime();
      results = results.filter((e) => new Date(e.timestamp).getTime() >= from);
    }
    if (filters.toDate) {
      const to = new Date(filters.toDate).getTime();
      results = results.filter((e) => new Date(e.timestamp).getTime() <= to);
    }
    if (filters.minConfidence !== undefined) {
      results = results.filter((e) => e.confidence >= filters.minConfidence!);
    }
    if (filters.maxConfidence !== undefined) {
      results = results.filter((e) => e.confidence <= filters.maxConfidence!);
    }

    // Sort
    const sortBy = filters.sortBy ?? 'timestamp';
    const sortOrder = filters.sortOrder ?? 'desc';
    results.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      let diff = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        diff = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        diff = aVal - bVal;
      }
      return sortOrder === 'asc' ? diff : -diff;
    });

    // Pagination
    if (filters.offset) {
      results = results.slice(filters.offset);
    }
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  getStats(filters?: Partial<AuditQuery>): AuditStats {
    const entries = filters ? this.query(filters) : Array.from(this.entries.values());

    const byOutcome = entries.reduce(
      (acc, e) => {
        acc[e.outcome] = (acc[e.outcome] || 0) + 1;
        return acc;
      },
      {} as Record<AuditEntry['outcome'], number>
    );

    const avgConfidence = entries.length > 0
      ? entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length
      : 0;

    const timestamps = entries.map((e) => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
    const timeRange = timestamps.length > 0
      ? {
          earliest: new Date(timestamps[0]!).toISOString(),
          latest: new Date(timestamps[timestamps.length - 1]!).toISOString(),
        }
      : null;

    return {
      totalEntries: entries.length,
      byOutcome: {
        PASS: byOutcome.PASS || 0,
        FAIL: byOutcome.FAIL || 0,
        INCONCLUSIVE: byOutcome.INCONCLUSIVE || 0,
        REVIEW: byOutcome.REVIEW || 0,
        ERROR: byOutcome.ERROR || 0,
      },
      avgConfidence: Math.round(avgConfidence * 10000) / 10000,
      timeRange,
    };
  }

  verifyChain(): AuditChainVerification {
    const orderedEntries = this.entryOrder
      .map((id) => this.entries.get(id))
      .filter((e): e is AuditEntry => e !== undefined);

    if (orderedEntries.length === 0) {
      return {
        valid: true,
        totalChecked: 0,
        firstEntryHash: '',
        lastEntryHash: '',
      };
    }

    let prevHash = '';
    for (let i = 0; i < orderedEntries.length; i++) {
      const entry = orderedEntries[i]!;
      if (entry.previousHash !== prevHash) {
        return {
          valid: false,
          brokenAt: i,
          totalChecked: i + 1,
          firstEntryHash: orderedEntries[0]!.entryHash,
          lastEntryHash: this.chainHead,
        };
      }

      // Recompute hash and verify
      const recomputedHash = computeEntryHash({
        entryId: entry.entryId,
        timestamp: entry.timestamp,
        sessionId: entry.sessionId,
        policyId: entry.policyId,
        outcome: entry.outcome,
        confidence: entry.confidence,
        evidenceHash: entry.evidenceHash,
        evidenceCount: entry.evidenceCount,
        evidenceTypes: entry.evidenceTypes,
        policyVersion: entry.policyVersion,
        passedChecks: entry.passedChecks,
        failedChecks: entry.failedChecks,
        warnings: entry.warnings,
        inputSnapshot: entry.inputSnapshot,
        verifierVersion: entry.verifierVersion,
        correlationId: entry.correlationId,
        previousHash: entry.previousHash,
      });
      if (recomputedHash !== entry.entryHash) {
        return {
          valid: false,
          brokenAt: i,
          totalChecked: i + 1,
          firstEntryHash: orderedEntries[0]!.entryHash,
          lastEntryHash: this.chainHead,
        };
      }

      prevHash = entry.entryHash;
    }

    return {
      valid: true,
      totalChecked: orderedEntries.length,
      firstEntryHash: orderedEntries[0]!.entryHash,
      lastEntryHash: this.chainHead,
    };
  }

  getChainHead(): string {
    return this.chainHead;
  }

  exportRange(fromDate: string, toDate: string): AuditEntry[] {
    return this.query({ fromDate, toDate, limit: 10000 });
  }
}

// ─── Audit Log Factory ───────────────────────────────────────────────────────

let _auditLog: AuditLog | null = null;

export function getAuditLog(): AuditLog {
  if (!_auditLog) {
    _auditLog = new InMemoryAuditLog();
  }
  return _auditLog;
}

export function setAuditLog(log: AuditLog): void {
  _auditLog = log;
}