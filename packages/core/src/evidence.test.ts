/**
 * Unit tests for Evidence model (VAP Section 5)
 * Tests all 5 evidence types, validation, serialization, and helper functions
 */

import { describe, it, expect } from 'vitest';
import {
  EvidenceSchema,
  EvidenceProvenanceSchema,
  EvidenceMetadataSchema,
  EvidenceStateSchema,
  EvidenceWithStateSchema,
  EvidenceValidationResultSchema,
  EvidenceState,
  InteractionEvidencePayloadSchema,
  VisibilityEvidencePayloadSchema,
  DurationEvidencePayloadSchema,
  ContextEvidencePayloadSchema,
  CustomEvidencePayloadSchema,
  createEvidence,
  validateEvidence,
  computeEvidenceHash,
  type Evidence,
  type EvidenceValidationResult,
  type EvidenceProvenance,
  type EvidenceMetadata,
  type EvidenceWithState,
} from './evidence';
import {
  TimestampSchema,
  UUIDSchema,
  SessionIdSchema,
  SourceIdSchema,
  EvidenceIdSchema,
  HashSchema,
  SignatureSchema,
} from './common';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const VALID_EVIDENCE_ID = 'urn:vap:evidence:550e8400-e29b-41d4-a716-446655440000';
const VALID_SESSION_ID = 'urn:vap:session:550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_HASH = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const VALID_SIG = 'MEUCIQD1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd';
const VALID_TS = '2024-01-15T10:30:00.123456Z';

const validProvenance = {
  observationIds: [VALID_UUID],
  observationHash: VALID_HASH,
  sourceId: 'source-001',
};

const baseEvidence = {
  evidenceId: VALID_EVIDENCE_ID,
  sessionId: VALID_SESSION_ID,
  sourceId: 'source-001',
  timestamp: VALID_TS,
  confidence: 0.85,
  provenance: validProvenance,
  signature: VALID_SIG,
};

// ─── Evidence Schema (top-level) ───────────────────────────────────────────

describe('EvidenceSchema', () => {
  it('should validate complete E-INTERACTION evidence', () => {
    const evidence = {
      ...baseEvidence,
      evidenceType: 'E-INTERACTION',
      payload: { clickCount: 5, avgScrollVelocity: 1.2 },
    };
    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  it('should validate complete E-VISIBLE evidence', () => {
    const evidence = {
      ...baseEvidence,
      evidenceType: 'E-VISIBLE',
      payload: { visibleDurationMs: 5000, maxVisibilityRatio: 0.9, avgVisibilityRatio: 0.5 },
    };
    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  it('should validate complete E-DURATION evidence', () => {
    const evidence = {
      ...baseEvidence,
      evidenceType: 'E-DURATION',
      payload: { sessionStartTime: 1000, activeDurationMs: 45000 },
    };
    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  it('should validate complete E-CONTEXT evidence', () => {
    const evidence = {
      ...baseEvidence,
      evidenceType: 'E-CONTEXT',
      payload: { platform: 'browser', userAgent: 'Mozilla/5.0' },
    };
    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  it('should validate complete E-CUSTOM evidence', () => {
    const evidence = {
      ...baseEvidence,
      evidenceType: 'E-CUSTOM',
      payload: { anyField: 'anyValue', nested: { foo: 1 } },
    };
    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  it('should reject invalid evidenceId format', () => {
    const evidence = {
      ...baseEvidence,
      evidenceType: 'E-INTERACTION',
      payload: { clickCount: 5 },
      evidenceId: 'invalid-id',
    };
    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
  });

  it('should reject confidence out of range', () => {
    const evidence = {
      ...baseEvidence,
      evidenceType: 'E-CUSTOM',
      payload: { foo: 'bar' },
      confidence: 1.5,
    };
    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
  });

  it('should reject negative confidence', () => {
    const evidence = {
      ...baseEvidence,
      evidenceType: 'E-CUSTOM',
      payload: { foo: 'bar' },
      confidence: -0.1,
    };
    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
  });

  it('should reject invalid evidenceType', () => {
    const evidence = {
      ...baseEvidence,
      evidenceType: 'E-BOGUS',
      payload: { foo: 'bar' },
    };
    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
  });

  it('should reject missing signature', () => {
    const evidence = {
      evidenceId: VALID_EVIDENCE_ID,
      sessionId: VALID_SESSION_ID,
      sourceId: 'source-001',
      timestamp: VALID_TS,
      evidenceType: 'E-CUSTOM',
      confidence: 0.5,
      payload: { foo: 'bar' },
      provenance: validProvenance,
    };
    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
  });

  it('should reject empty observationIds array', () => {
    const evidence = {
      ...baseEvidence,
      evidenceType: 'E-CUSTOM',
      payload: { foo: 'bar' },
      provenance: { ...validProvenance, observationIds: [] },
    };
    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(false);
  });

  it('should accept optional metadata', () => {
    const evidence = {
      ...baseEvidence,
      evidenceType: 'E-CUSTOM',
      payload: { foo: 'bar' },
      metadata: { policyId: 'pol-001', qualityScore: 0.9 },
    };
    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });
});

// ─── Payload schemas ───────────────────────────────────────────────────────

describe('InteractionEvidencePayloadSchema', () => {
  it('should validate empty payload (all optional)', () => {
    const payload = {};
    expect(InteractionEvidencePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('should validate full interaction payload', () => {
    const payload = {
      avgScrollVelocity: 1.5,
      scrollDirectionChanges: 3,
      clickCount: 10,
      keyPressCount: 50,
      interactionDurationMs: 30000,
      readingPauses: [{ startTime: 100, durationMs: 500, position: 0.5 }],
      engagementScore: 0.75,
    };
    expect(InteractionEvidencePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('should reject engagementScore out of range', () => {
    const payload = { engagementScore: 1.5 };
    expect(InteractionEvidencePayloadSchema.safeParse(payload).success).toBe(false);
  });
});

describe('VisibilityEvidencePayloadSchema', () => {
  it('should validate complete visibility payload', () => {
    const payload = {
      visibleDurationMs: 10000,
      maxVisibilityRatio: 1.0,
      avgVisibilityRatio: 0.6,
      viewportIntersections: [{ timestamp: 1000, ratio: 0.5 }],
    };
    expect(VisibilityEvidencePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('should reject missing visibleDurationMs', () => {
    const payload = { maxVisibilityRatio: 1.0, avgVisibilityRatio: 0.5 };
    expect(VisibilityEvidencePayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('should reject maxVisibilityRatio > 1', () => {
    const payload = { visibleDurationMs: 1000, maxVisibilityRatio: 1.5, avgVisibilityRatio: 0.5 };
    expect(VisibilityEvidencePayloadSchema.safeParse(payload).success).toBe(false);
  });
});

describe('DurationEvidencePayloadSchema', () => {
  it('should validate complete duration payload', () => {
    const payload = {
      sessionStartTime: 1000,
      sessionEndTime: 46000,
      activeDurationMs: 45000,
      idleDurationMs: 5000,
      heartbeatCount: 45,
    };
    expect(DurationEvidencePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('should reject missing sessionStartTime', () => {
    const payload = { activeDurationMs: 1000 };
    expect(DurationEvidencePayloadSchema.safeParse(payload).success).toBe(false);
  });
});

describe('ContextEvidencePayloadSchema', () => {
  it('should validate browser context', () => {
    const payload = {
      platform: 'browser',
      userAgent: 'Mozilla/5.0',
      viewportSize: { width: 1920, height: 1080 },
      timezone: 'UTC',
    };
    expect(ContextEvidencePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('should validate mobile context', () => {
    const payload = { platform: 'mobile', devicePixelRatio: 2.0 };
    expect(ContextEvidencePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('should reject invalid platform', () => {
    const payload = { platform: 'iot' };
    expect(ContextEvidencePayloadSchema.safeParse(payload).success).toBe(false);
  });
});

describe('CustomEvidencePayloadSchema', () => {
  it('should accept arbitrary fields', () => {
    expect(CustomEvidencePayloadSchema.safeParse({ anyField: 'anyValue' }).success).toBe(true);
  });

  it('should accept nested objects', () => {
    expect(CustomEvidencePayloadSchema.safeParse({ nested: { foo: 1 } }).success).toBe(true);
  });

  it('should accept empty object', () => {
    expect(CustomEvidencePayloadSchema.safeParse({}).success).toBe(true);
  });
});

// ─── EvidenceProvenanceSchema ──────────────────────────────────────────────

describe('EvidenceProvenanceSchema', () => {
  it('should validate complete provenance', () => {
    const p = {
      observationIds: [VALID_UUID, '12345678-1234-1234-1234-123456789012'],
      observationHash: VALID_HASH,
      sourceId: 'source-001',
      collectionMethod: 'sdk' as const,
    };
    expect(EvidenceProvenanceSchema.safeParse(p).success).toBe(true);
  });

  it('should validate without optional collectionMethod', () => {
    const p = { observationIds: [VALID_UUID], observationHash: VALID_HASH, sourceId: 'source-001' };
    expect(EvidenceProvenanceSchema.safeParse(p).success).toBe(true);
  });

  it('should reject empty observationIds', () => {
    const p = { observationIds: [], observationHash: VALID_HASH, sourceId: 'source-001' };
    expect(EvidenceProvenanceSchema.safeParse(p).success).toBe(false);
  });

  it('should reject invalid observationHash length', () => {
    const p = { observationIds: [VALID_UUID], observationHash: 'short', sourceId: 'source-001' };
    expect(EvidenceProvenanceSchema.safeParse(p).success).toBe(false);
  });

  it('should reject invalid collectionMethod', () => {
    const p = {
      observationIds: [VALID_UUID],
      observationHash: VALID_HASH,
      sourceId: 'source-001',
      collectionMethod: 'unknown',
    };
    expect(EvidenceProvenanceSchema.safeParse(p).success).toBe(false);
  });
});

// ─── EvidenceMetadataSchema ────────────────────────────────────────────────

describe('EvidenceMetadataSchema', () => {
  it('should validate complete metadata', () => {
    const m = { policyId: 'pol-001', collectionPolicyVersion: '1.0', qualityScore: 0.9, completenessScore: 0.8 };
    expect(EvidenceMetadataSchema.safeParse(m).success).toBe(true);
  });

  it('should validate empty object (all optional)', () => {
    expect(EvidenceMetadataSchema.safeParse({}).success).toBe(true);
  });

  it('should reject qualityScore > 1', () => {
    expect(EvidenceMetadataSchema.safeParse({ qualityScore: 1.5 }).success).toBe(false);
  });

  it('should reject completenessScore < 0', () => {
    expect(EvidenceMetadataSchema.safeParse({ completenessScore: -0.1 }).success).toBe(false);
  });
});

// ─── EvidenceStateSchema ───────────────────────────────────────────────────

describe('EvidenceStateSchema', () => {
  it('should validate PROPOSED', () => {
    expect(EvidenceStateSchema.safeParse('PROPOSED').success).toBe(true);
  });

  it('should validate VALIDATED', () => {
    expect(EvidenceStateSchema.safeParse('VALIDATED').success).toBe(true);
  });

  it('should validate INDEXED', () => {
    expect(EvidenceStateSchema.safeParse('INDEXED').success).toBe(true);
  });

  it('should validate ARCHIVED', () => {
    expect(EvidenceStateSchema.safeParse('ARCHIVED').success).toBe(true);
  });

  it('should validate DISCARDED', () => {
    expect(EvidenceStateSchema.safeParse('DISCARDED').success).toBe(true);
  });

  it('should reject invalid state', () => {
    expect(EvidenceStateSchema.safeParse('UNKNOWN').success).toBe(false);
  });

  it('EvidenceState enum should export all 5 states', () => {
    expect(EvidenceState.PROPOSED).toBe('PROPOSED');
    expect(EvidenceState.VALIDATED).toBe('VALIDATED');
    expect(EvidenceState.INDEXED).toBe('INDEXED');
    expect(EvidenceState.ARCHIVED).toBe('ARCHIVED');
    expect(EvidenceState.DISCARDED).toBe('DISCARDED');
  });
});

// ─── EvidenceWithStateSchema ──────────────────────────────────────────────

describe('EvidenceWithStateSchema', () => {
  it('should validate evidence with state', () => {
    const e = {
      ...baseEvidence,
      evidenceType: 'E-CUSTOM',
      payload: { foo: 'bar' },
      state: 'VALIDATED',
      validatedAt: '2024-01-15T10:30:05.123456Z',
    };
    expect(EvidenceWithStateSchema.safeParse(e).success).toBe(true);
  });

  it('should accept INDEXED with indexedAt', () => {
    const e = {
      ...baseEvidence,
      evidenceType: 'E-CUSTOM',
      payload: { foo: 'bar' },
      state: 'INDEXED',
      indexedAt: '2024-01-15T10:31:00.123456Z',
    };
    expect(EvidenceWithStateSchema.safeParse(e).success).toBe(true);
  });

  it('should accept ARCHIVED with archivedAt', () => {
    const e = {
      ...baseEvidence,
      evidenceType: 'E-CUSTOM',
      payload: { foo: 'bar' },
      state: 'ARCHIVED',
      archivedAt: '2024-01-15T11:00:00.123456Z',
    };
    expect(EvidenceWithStateSchema.safeParse(e).success).toBe(true);
  });

  it('should reject missing state', () => {
    const e = { ...baseEvidence, evidenceType: 'E-CUSTOM', payload: { foo: 'bar' } };
    expect(EvidenceWithStateSchema.safeParse(e).success).toBe(false);
  });
});

// ─── EvidenceValidationResultSchema ───────────────────────────────────────

describe('EvidenceValidationResultSchema', () => {
  it('should validate successful validation result', () => {
    const r = { valid: true, evidenceId: VALID_EVIDENCE_ID };
    expect(EvidenceValidationResultSchema.safeParse(r).success).toBe(true);
  });

  it('should validate failed validation result with errors', () => {
    const r = {
      valid: false,
      evidenceId: VALID_EVIDENCE_ID,
      errors: [
        { code: 'SCHEMA_INVALID', message: 'Invalid evidenceType', path: ['evidenceType'] },
        { code: 'CONFIDENCE_OUT_OF_RANGE', message: 'Confidence must be 0-1', path: ['confidence'] },
      ],
      warnings: ['Low confidence score'],
    };
    expect(EvidenceValidationResultSchema.safeParse(r).success).toBe(true);
  });

  it('should validate result without optional errors/warnings', () => {
    const r = { valid: false, evidenceId: VALID_EVIDENCE_ID };
    expect(EvidenceValidationResultSchema.safeParse(r).success).toBe(true);
  });

  it('should reject missing valid field', () => {
    const r = { evidenceId: VALID_EVIDENCE_ID };
    expect(EvidenceValidationResultSchema.safeParse(r).success).toBe(false);
  });
});

// ─── createEvidence helper ─────────────────────────────────────────────────

describe('createEvidence helper', () => {
  it('should create evidence with generated ID and timestamp', () => {
    const params = {
      sessionId: VALID_SESSION_ID,
      sourceId: 'source-001',
      evidenceType: 'E-INTERACTION' as const,
      confidence: 0.8,
      payload: { clickCount: 5 },
      provenance: validProvenance,
    };
    const evidence = createEvidence(params);
    expect(evidence.evidenceId).toMatch(/^urn:vap:evidence:[0-9a-f-]{36}$/);
    expect(evidence.timestamp).toBeDefined();
    expect(evidence.sessionId).toBe(params.sessionId);
    expect(evidence.sourceId).toBe(params.sourceId);
    expect(evidence.evidenceType).toBe('E-INTERACTION');
    expect(evidence.confidence).toBe(0.8);
    expect(evidence.payload).toEqual({ clickCount: 5 });
    expect(evidence.provenance).toEqual(params.provenance);
    // signature is omitted
    expect(evidence).not.toHaveProperty('signature');
  });

  it('should accept custom timestamp', () => {
    const params = {
      sessionId: VALID_SESSION_ID,
      sourceId: 'source-001',
      evidenceType: 'E-CUSTOM' as const,
      confidence: 0.5,
      payload: { foo: 'bar' },
      provenance: validProvenance,
      timestamp: '2025-06-01T00:00:00.000Z',
    };
    const evidence = createEvidence(params);
    expect(evidence.timestamp).toBe('2025-06-01T00:00:00.000Z');
  });

  it('should generate unique evidenceId on each call', () => {
    const params = {
      sessionId: VALID_SESSION_ID,
      sourceId: 'source-001',
      evidenceType: 'E-CUSTOM' as const,
      confidence: 0.5,
      payload: { foo: 'bar' },
      provenance: validProvenance,
    };
    const a = createEvidence(params);
    const b = createEvidence(params);
    expect(a.evidenceId).not.toBe(b.evidenceId);
  });
});

// ─── validateEvidence helper ───────────────────────────────────────────────

describe('validateEvidence helper', () => {
  it('should return valid:true for valid evidence', () => {
    const evidence = {
      ...baseEvidence,
      evidenceType: 'E-INTERACTION',
      payload: { clickCount: 5 },
    };
    const result = validateEvidence(evidence);
    expect(result.valid).toBe(true);
    expect(result.evidenceId).toBe(VALID_EVIDENCE_ID);
    expect(result.errors).toBeUndefined();
  });

  it('should return valid:false with errors for invalid evidence', () => {
    const invalid = {
      evidenceId: 'invalid-id',
      sessionId: 'invalid-session',
      sourceId: 'source-001',
      timestamp: 'not-a-date',
      evidenceType: 'E-BOGUS',
      confidence: 1.5,
      payload: {},
      provenance: validProvenance,
      signature: 'too-short',
    };
    const result = validateEvidence(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should return unknown evidenceId when field missing', () => {
    const result = validateEvidence({ foo: 'bar' });
    expect(result.valid).toBe(false);
    expect(result.evidenceId).toBe('unknown');
  });
});

// ─── computeEvidenceHash helper ────────────────────────────────────────────

describe('computeEvidenceHash helper', () => {
  it('should return a string (stub implementation)', () => {
    const evidence: Evidence = {
      ...baseEvidence,
      evidenceType: 'E-CUSTOM',
      payload: { foo: 'bar' },
    } as Evidence;
    const hash = computeEvidenceHash(evidence);
    expect(typeof hash).toBe('string');
  });
});

// ─── Common schemas (re-exported) ──────────────────────────────────────────

describe('Common Schemas (re-exported)', () => {
  it('should validate TimestampSchema with RFC3339 format', () => {
    const validTs = ['2024-01-15T10:30:00.123456Z', '2024-01-15T10:30:00.123456+00:00', '2024-01-15T10:30:00.123456-08:00'];
    for (const ts of validTs) {
      expect(TimestampSchema.safeParse(ts).success).toBe(true);
    }
  });

  it('should validate UUIDSchema', () => {
    expect(UUIDSchema.safeParse(VALID_UUID).success).toBe(true);
    expect(UUIDSchema.safeParse('invalid-uuid').success).toBe(false);
  });

  it('should validate URN schemas', () => {
    expect(EvidenceIdSchema.safeParse(VALID_EVIDENCE_ID).success).toBe(true);
    expect(SessionIdSchema.safeParse(VALID_SESSION_ID).success).toBe(true);
    expect(SourceIdSchema.safeParse('source-001').success).toBe(true);
  });

  it('should validate HashSchema (64 hex chars)', () => {
    expect(HashSchema.safeParse(VALID_HASH).success).toBe(true);
    expect(HashSchema.safeParse('not-a-hash').success).toBe(false);
    expect(HashSchema.safeParse('a1b2c3').success).toBe(false);
  });
});

// ─── Exports sanity ───────────────────────────────────────────────────────

describe('Exports', () => {
  it('should export all expected schemas and helpers', () => {
    expect(EvidenceSchema).toBeDefined();
    expect(EvidenceProvenanceSchema).toBeDefined();
    expect(EvidenceMetadataSchema).toBeDefined();
    expect(EvidenceStateSchema).toBeDefined();
    expect(EvidenceWithStateSchema).toBeDefined();
    expect(EvidenceValidationResultSchema).toBeDefined();
    expect(EvidenceState).toBeDefined();
    expect(createEvidence).toBeDefined();
    expect(validateEvidence).toBeDefined();
    expect(computeEvidenceHash).toBeDefined();
  });

  it('should export all payload schemas', () => {
    expect(InteractionEvidencePayloadSchema).toBeDefined();
    expect(VisibilityEvidencePayloadSchema).toBeDefined();
    expect(DurationEvidencePayloadSchema).toBeDefined();
    expect(ContextEvidencePayloadSchema).toBeDefined();
    expect(CustomEvidencePayloadSchema).toBeDefined();
  });
});
