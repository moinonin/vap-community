/**
 * Evidence pipeline: validation stage
 * 
 * Validates incoming evidence against VAP Section 5 requirements:
 * - Schema validity (all required fields present, types correct)
 * - Timestamp sanity (not future, not too old, monotonically increasing per-source)
 * - Replay protection (no duplicate evidence IDs)
 * - Session binding (evidence references a valid, active session)
 */

import { z } from 'zod';
import {
  EvidenceSchema,
  EvidenceValidationResultSchema,
  type EvidenceValidationResult,
  TimestampSchema,
  EvidenceIdSchema
} from '@verified-attention/core';

/**
 * Timestamp validation constraints
 */
export interface TimestampConstraints {
  maxAgeMs: number;
  maxFutureMs: number;
  minIntervalMs: number;
}

export const DEFAULT_TIMESTAMP_CONSTRAINTS: TimestampConstraints = {
  maxAgeMs: 24 * 60 * 60 * 1000,
  maxFutureMs: 5 * 60 * 1000,
  minIntervalMs: 10
};

/**
 * Validation error codes following VAP conventions
 */
export enum ValidationErrorCode {
  SCHEMA_INVALID = 'SCHEMA_INVALID',
  EVIDENCE_EXPIRED = 'EVIDENCE_EXPIRED',
  FUTURE_TIMESTAMP = 'FUTURE_TIMESTAMP',
  DUPLICATE_EVIDENCE = 'DUPLICATE_EVIDENCE',
  INVALID_SESSION = 'INVALID_SESSION',
  DUPLICATE_INTERVAL = 'DUPLICATE_INTERVAL',
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  MALFORMED_ID = 'MALFORMED_ID'
}

/**
 * Validation result with structured errors
 */
export interface ValidationResult {
  valid: boolean;
  evidenceId: string;
  errors: Array<{
    code: ValidationErrorCode;
    message: string;
    field?: string;
  }>;
}

/**
 * Replay cache interface
 */
export interface ReplayCache {
  has(id: string): Promise<boolean>;
  add(id: string): Promise<void>;
  prune(maxSize: number): Promise<void>;
  size(): Promise<number>;
}

/**
 * In-memory evidence store for replay protection
 */
export class InMemoryReplayCache implements ReplayCache {
  private cache = new Map<string, true>();

  async has(id: string): Promise<boolean> {
    return this.cache.has(id);
  }

  async add(id: string, _: boolean = true): Promise<void> {
    this.cache.set(id, true);
  }

  async prune(maxSize: number): Promise<void> {
    while (this.cache.size > maxSize) {
      const key = this.cache.keys().next().value;
      if (key) this.cache.delete(key);
    }
  }

  async size(): Promise<number> {
    return this.cache.size;
  }
}

/**
 * Evidence validation function - validates raw evidence object
 */
export function validateEvidence(
  evidence: unknown,
  constraints?: Partial<TimestampConstraints>
): z.infer<typeof EvidenceValidationResultSchema> {
  const c = { ...DEFAULT_TIMESTAMP_CONSTRAINTS, ...constraints };
  const errors: Array<{ code: string; message: string; path?: Array<string | number> }> = [];

  // Schema validation
  const result = EvidenceSchema.safeParse(evidence);
  if (!result.success) {
    return {
      valid: false,
      evidenceId: (evidence as any)?.evidenceId ?? 'unknown',
      errors: result.error.issues.map(i => ({ code: i.code, message: i.message, path: i.path }))
    };
  }

  const ev = result.data;
  if (ev.evidenceId === 'unknown') {
    errors.push({ code: 'MALFORMED_ID', message: 'evidenceId is missing or invalid' });
  }

  // Timestamp sanity check
  const now = Date.now();
  const evidenceTs = new Date(ev.timestamp).getTime();

  if (evidenceTs > now + c.maxFutureMs) {
    errors.push({
      code: 'FUTURE_TIME',
      message: `evidence timestamp is ${evidenceTs - now}ms in the future (max ${c.maxFutureMs}ms)`
    });
  }

  if (now - evidenceTs > c.maxAgeMs) {
    errors.push({
      code: 'EVIDENCE_EXPIRED',
      message: `evidence timestamp is ${now - evidenceTs}ms old (max ${c.maxAgeMs}ms)`
    });
  }

  return {
    valid: errors.length === 0,
    evidenceId: ev.evidenceId,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Advanced check: validate evidence against session state
 */
export function validateAgainstSession(
  evidence: EvidenceValidationResult,
  sessionState: string
): { valid: boolean; evidenceId: string; errors: Array<{ code: string; message: string; field?: string }> } {
  const result: { valid: boolean; evidenceId: string; errors: Array<{ code: string; message: string; field?: string }> } = {
    valid: evidence.valid,
    evidenceId: evidence.evidenceId,
    errors: evidence.errors?.map(e => ({
      code: e.code as any,
      message: e.message,
      field: Array.isArray(e.path) ? e.path.join('.') : undefined
    })) || []
  };

  // Session must be active to accept evidence
  if (sessionState !== 'ACTIVE' && sessionState !== 'CREATED') {
    result.valid = false;
    result.errors.push({
      code: 'INVALID_SESSION',
      message: `Session is in state '${sessionState}'; evidence only accepted for ACTIVE/CREATED`
    });
  }

  return result;
}