/**
 * Unit tests for Validation Pipeline stage
 * Tests schema validation, timestamp sanity, replay protection, session binding
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateEvidence,
  validateAgainstSession,
  InMemoryReplayCache,
  ValidationErrorCode,
  DEFAULT_TIMESTAMP_CONSTRAINTS,
  type TimestampConstraints,
  type ReplayCache,
  type ValidationResult,
} from './validation';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const VALID_EVIDENCE_ID = 'urn:vap:evidence:550e8400-e29b-41d4-a716-446655440000';
const VALID_SESSION_ID = 'urn:vap:session:550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_HASH = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const VALID_SIG = 'MEUCIQD1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd';

const validProvenance = {
  observationIds: [VALID_UUID],
  observationHash: VALID_HASH,
  sourceId: 'source-001',
};

function makeValidEvidence(overrides: Record<string, unknown> = {}) {
  return {
    evidenceId: VALID_EVIDENCE_ID,
    sessionId: VALID_SESSION_ID,
    sourceId: 'source-001',
    timestamp: new Date().toISOString(),
    evidenceType: 'E-CUSTOM',
    confidence: 0.8,
    payload: { foo: 'bar' },
    provenance: validProvenance,
    signature: VALID_SIG,
    ...overrides,
  };
}

// ─── DEFAULT_TIMESTAMP_CONSTRAINTS ─────────────────────────────────────────

describe('DEFAULT_TIMESTAMP_CONSTRAINTS', () => {
  it('should have maxAgeMs of 24 hours', () => {
    expect(DEFAULT_TIMESTAMP_CONSTRAINTS.maxAgeMs).toBe(24 * 60 * 60 * 1000);
  });

  it('should have maxFutureMs of 5 minutes', () => {
    expect(DEFAULT_TIMESTAMP_CONSTRAINTS.maxFutureMs).toBe(5 * 60 * 1000);
  });

  it('should have minIntervalMs of 10ms', () => {
    expect(DEFAULT_TIMESTAMP_CONSTRAINTS.minIntervalMs).toBe(10);
  });
});

// ─── ValidationErrorCode ───────────────────────────────────────────────────

describe('ValidationErrorCode', () => {
  it('should export all expected codes', () => {
    expect(ValidationErrorCode.SCHEMA_INVALID).toBe('SCHEMA_INVALID');
    expect(ValidationErrorCode.EVIDENCE_EXPIRED).toBe('EVIDENCE_EXPIRED');
    expect(ValidationErrorCode.FUTURE_TIMESTAMP).toBe('FUTURE_TIMESTAMP');
    expect(ValidationErrorCode.DUPLICATE_EVIDENCE).toBe('DUPLICATE_EVIDENCE');
    expect(ValidationErrorCode.INVALID_SESSION).toBe('INVALID_SESSION');
    expect(ValidationErrorCode.MALFORMED_ID).toBe('MALFORMED_ID');
  });
});

// ─── InMemoryReplayCache ───────────────────────────────────────────────────

describe('InMemoryReplayCache', () => {
  let cache: InMemoryReplayCache;

  beforeEach(() => {
    cache = new InMemoryReplayCache();
  });

  it('should return false for unseen id', async () => {
    expect(await cache.has('new-id')).toBe(false);
  });

  it('should return true after adding id', async () => {
    await cache.add('id-1');
    expect(await cache.has('id-1')).toBe(true);
  });

  it('should report correct size', async () => {
    expect(await cache.size()).toBe(0);
    await cache.add('a');
    await cache.add('b');
    expect(await cache.size()).toBe(2);
  });

  it('should prune entries exceeding maxSize', async () => {
    for (let i = 0; i < 5; i++) await cache.add(`id-${i}`);
    expect(await cache.size()).toBe(5);
    await cache.prune(3);
    expect(await cache.size()).toBe(3);
  });

  it('should handle empty cache prune', async () => {
    await cache.prune(10);
    expect(await cache.size()).toBe(0);
  });
});

// ─── validateEvidence ──────────────────────────────────────────────────────

describe('validateEvidence', () => {
  it('should return valid:true for well-formed evidence', () => {
    const result = validateEvidence(makeValidEvidence());
    expect(result.valid).toBe(true);
    expect(result.evidenceId).toBe(VALID_EVIDENCE_ID);
    expect(result.errors).toBeUndefined();
  });

  it('should return valid:false for missing evidenceId', () => {
    const ev = makeValidEvidence({ evidenceId: undefined });
    const result = validateEvidence(ev);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should return valid:false for invalid confidence', () => {
    const ev = makeValidEvidence({ confidence: 1.5 });
    const result = validateEvidence(ev);
    expect(result.valid).toBe(false);
  });

  it('should return valid:false for missing signature', () => {
    const ev = makeValidEvidence({ signature: undefined });
    const result = validateEvidence(ev);
    expect(result.valid).toBe(false);
  });

  it('should return valid:false for invalid evidenceType', () => {
    const ev = makeValidEvidence({ evidenceType: 'E-BOGUS' });
    const result = validateEvidence(ev);
    expect(result.valid).toBe(false);
  });

  it('should reject future timestamp beyond maxFutureMs', () => {
    const futureTs = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min future
    const ev = makeValidEvidence({ timestamp: futureTs });
    const result = validateEvidence(ev);
    expect(result.valid).toBe(false);
    expect(result.errors!.some(e => e.code === 'FUTURE_TIME')).toBe(true);
  });

  it('should accept future timestamp within maxFutureMs', () => {
    const nearFutureTs = new Date(Date.now() + 60 * 1000).toISOString(); // 1 min future
    const ev = makeValidEvidence({ timestamp: nearFutureTs });
    const result = validateEvidence(ev);
    expect(result.valid).toBe(true);
  });

  it('should reject old timestamp beyond maxAgeMs', () => {
    const oldTs = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
    const ev = makeValidEvidence({ timestamp: oldTs });
    const result = validateEvidence(ev);
    expect(result.valid).toBe(false);
    expect(result.errors!.some(e => e.code === 'EVIDENCE_EXPIRED')).toBe(true);
  });

  it('should accept old timestamp within maxAgeMs', () => {
    const recentTs = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const ev = makeValidEvidence({ timestamp: recentTs });
    const result = validateEvidence(ev);
    expect(result.valid).toBe(true);
  });

  it('should accept custom constraints', () => {
    const oldTs = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
    const ev = makeValidEvidence({ timestamp: oldTs });
    // Default maxAgeMs is 24h, so 2h is OK
    const result = validateEvidence(ev, { maxAgeMs: 60 * 60 * 1000 }); // maxAge 1h
    expect(result.valid).toBe(false);
  });

  it('should return unknown evidenceId for non-object input', () => {
    const result = validateEvidence('not-an-object');
    expect(result.valid).toBe(false);
    expect(result.evidenceId).toBe('unknown');
  });

  it('should return errors array with code/message/path', () => {
    const ev = makeValidEvidence({ confidence: 'not-a-number' });
    const result = validateEvidence(ev);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toHaveProperty('code');
    expect(result.errors![0]).toHaveProperty('message');
  });
});

// ─── validateAgainstSession ──────────────────────────────────────────────

describe('validateAgainstSession', () => {
  it('should pass for ACTIVE session with valid evidence', () => {
    const evidenceResult = validateEvidence(makeValidEvidence());
    const sessionResult = validateAgainstSession(evidenceResult, 'ACTIVE');
    expect(sessionResult.valid).toBe(true);
  });

  it('should pass for CREATED session with valid evidence', () => {
    const evidenceResult = validateEvidence(makeValidEvidence());
    const sessionResult = validateAgainstSession(evidenceResult, 'CREATED');
    expect(sessionResult.valid).toBe(true);
  });

  it('should fail for ENDED session', () => {
    const evidenceResult = validateEvidence(makeValidEvidence());
    const sessionResult = validateAgainstSession(evidenceResult, 'ENDED');
    expect(sessionResult.valid).toBe(false);
    expect(sessionResult.errors.some(e => e.code === 'INVALID_SESSION')).toBe(true);
  });

  it('should fail for EXPIRED session', () => {
    const evidenceResult = validateEvidence(makeValidEvidence());
    const sessionResult = validateAgainstSession(evidenceResult, 'EXPIRED');
    expect(sessionResult.valid).toBe(false);
    expect(sessionResult.errors.some(e => e.code === 'INVALID_SESSION')).toBe(true);
  });

  it('should carry forward prior validation errors', () => {
    const evidenceResult = validateEvidence(makeValidEvidence({ confidence: 1.5 }));
    const sessionResult = validateAgainstSession(evidenceResult, 'ACTIVE');
    expect(sessionResult.valid).toBe(false);
    expect(sessionResult.errors.length).toBeGreaterThan(0);
  });

  it('should combine prior errors with session error', () => {
    const evidenceResult = validateEvidence(makeValidEvidence({ confidence: 1.5 }));
    const sessionResult = validateAgainstSession(evidenceResult, 'CLOSED');
    expect(sessionResult.valid).toBe(false);
    expect(sessionResult.errors.some(e => e.code === 'INVALID_SESSION')).toBe(true);
  });
});

// ─── Type/interface sanity ─────────────────────────────────────────────────

describe('Type exports', () => {
  it('TimestampConstraints interface should be usable', () => {
    const tc: TimestampConstraints = { maxAgeMs: 1000, maxFutureMs: 500, minIntervalMs: 5 };
    expect(tc.maxAgeMs).toBe(1000);
  });

  it('ReplayCache interface should be usable', () => {
    const cache: ReplayCache = new InMemoryReplayCache();
    expect(cache).toBeDefined();
  });

  it('ValidationResult interface should be usable', () => {
    const r: ValidationResult = { valid: true, evidenceId: 'x', errors: [] };
    expect(r.valid).toBe(true);
  });
});
