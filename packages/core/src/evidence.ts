/**
 * Evidence types and schemas (VAP Section 5)
 * 
 * Evidence is a discrete piece of verified, immutable information derived from observations.
 * Evidence is the architectural primitive of VAP - every downstream decision is based on evidence.
 * Once evidence is produced, it MUST remain immutable.
 */

import { z } from 'zod';
import { 
  TimestampSchema, 
  UUIDSchema, 
  SessionIdSchema, 
  SourceIdSchema,
  EvidenceIdSchema,
  EvidenceTypeSchema,
  ConfidenceSchema,
  HashSchema,
  SignatureSchema,
  BaseMetadataSchema,
  zodIssuesToPlain,
  type Hash,
  type ZodIssue
} from './common';
import { randomUUID } from 'crypto';

/**
 * Evidence payload varies by evidence type
 */
export const InteractionEvidencePayloadSchema = z.object({
  // Aggregated interaction patterns
  avgScrollVelocity: z.number().optional(),
  scrollDirectionChanges: z.number().int().optional(),
  clickCount: z.number().int().optional(),
  keyPressCount: z.number().int().optional(),
  interactionDurationMs: z.number().int().optional(),
  // Reading pattern indicators
  readingPauses: z.array(z.object({
    startTime: z.number(),
    durationMs: z.number(),
    position: z.number()
  })).optional(),
  engagementScore: z.number().min(0).max(1).optional()
}).strict();

export const VisibilityEvidencePayloadSchema = z.object({
  // Content visibility proof
  visibleDurationMs: z.number().int(),
  maxVisibilityRatio: z.number().min(0).max(1),
  avgVisibilityRatio: z.number().min(0).max(1),
  viewportIntersections: z.array(z.object({
    timestamp: z.number(),
    ratio: z.number().min(0).max(1)
  })).optional()
}).strict();

export const DurationEvidencePayloadSchema = z.object({
  // Session duration evidence
  sessionStartTime: z.number(),
  sessionEndTime: z.number().optional(),
  activeDurationMs: z.number().int(),
  idleDurationMs: z.number().int().optional(),
  heartbeatCount: z.number().int().optional()
}).strict();

export const ContextEvidencePayloadSchema = z.object({
  // Environmental context
  platform: z.enum(['browser', 'mobile', 'desktop', 'server']),
  userAgent: z.string().optional(),
  viewportSize: z.object({ width: z.number(), height: z.number() }).optional(),
  devicePixelRatio: z.number().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  // Connection info
  connectionType: z.string().optional(),
  effectiveType: z.string().optional()
}).strict();

export type ContextEvidencePayload = z.infer<typeof ContextEvidencePayloadSchema>;

export const CustomEvidencePayloadSchema = z.record(z.unknown());

/**
 * Evidence payload union type - using discriminated union on evidenceType
 */
export const EvidencePayloadSchema = z.discriminatedUnion('evidenceType', [
  z.object({ evidenceType: z.literal('E-INTERACTION'), payload: InteractionEvidencePayloadSchema }),
  z.object({ evidenceType: z.literal('E-VISIBLE'), payload: VisibilityEvidencePayloadSchema }),
  z.object({ evidenceType: z.literal('E-DURATION'), payload: DurationEvidencePayloadSchema }),
  z.object({ evidenceType: z.literal('E-CONTEXT'), payload: ContextEvidencePayloadSchema }),
  z.object({ evidenceType: z.literal('E-CUSTOM'), payload: CustomEvidencePayloadSchema })
]);

// Extract payload type
export type EvidencePayload = z.infer<typeof EvidencePayloadSchema>;

/**
 * Evidence provenance - references to underlying observations
 */
export const EvidenceProvenanceSchema = z.object({
  observationIds: z.array(UUIDSchema).min(1),
  observationHash: HashSchema, // Hash of all referenced observations
  sourceId: SourceIdSchema,
  collectionMethod: z.enum(['sdk', 'api', 'partner', 'import']).optional()
});

export type EvidenceProvenance = z.infer<typeof EvidenceProvenanceSchema>;

/**
 * Evidence metadata (optional per VAP)
 */
export const EvidenceMetadataSchema = z.object({
  policyId: z.string().optional(),
  collectionPolicyVersion: z.string().optional(),
  qualityScore: z.number().min(0).max(1).optional(),
  completenessScore: z.number().min(0).max(1).optional()
});

export type EvidenceMetadata = z.infer<typeof EvidenceMetadataSchema>;

/**
 * Complete Evidence object (VAP Section 5)
 * MUST contain: evidence_id, session_id, source_id, timestamp, evidence_type, confidence, payload, provenance, signature
 */
export const EvidenceSchema = z.object({
  evidenceId: EvidenceIdSchema,
  sessionId: SessionIdSchema,
  sourceId: SourceIdSchema,
  timestamp: TimestampSchema,
  evidenceType: EvidenceTypeSchema,
  confidence: ConfidenceSchema,
  payload: z.union([
    InteractionEvidencePayloadSchema,
    VisibilityEvidencePayloadSchema,
    DurationEvidencePayloadSchema,
    ContextEvidencePayloadSchema,
    CustomEvidencePayloadSchema
  ]),
  provenance: EvidenceProvenanceSchema,
  signature: SignatureSchema, // Producer signature over all above fields
  metadata: EvidenceMetadataSchema.optional(),
  baseMetadata: BaseMetadataSchema.optional()
});

export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Evidence state machine (VAP Section 3)
 */
export enum EvidenceState {
  PROPOSED = 'PROPOSED',
  VALIDATED = 'VALIDATED',
  INDEXED = 'INDEXED',
  ARCHIVED = 'ARCHIVED',
  DISCARDED = 'DISCARDED'
}

export const EvidenceStateSchema = z.nativeEnum(EvidenceState);

/**
 * Evidence with lifecycle state
 */
export const EvidenceWithStateSchema = EvidenceSchema.extend({
  state: EvidenceStateSchema,
  validatedAt: TimestampSchema.optional(),
  indexedAt: TimestampSchema.optional(),
  archivedAt: TimestampSchema.optional()
});

export type EvidenceWithState = z.infer<typeof EvidenceWithStateSchema>;

/**
 * Evidence validation result
 */
export const EvidenceValidationResultSchema = z.object({
  valid: z.boolean(),
  evidenceId: EvidenceIdSchema,
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    path: z.array(z.union([z.string(), z.number()])).optional()
  })).optional(),
  warnings: z.array(z.string()).optional()
});

export type EvidenceValidationResult = z.infer<typeof EvidenceValidationResultSchema>;

/**
 * Create a new evidence object (unsigned - signature added by producer)
 */
export function createEvidence(
  params: Omit<Evidence, 'evidenceId' | 'timestamp' | 'signature'> & { timestamp?: string }
): Omit<Evidence, 'signature'> {
  return {
    ...params,
    evidenceId: `urn:vap:evidence:${randomUUID()}`,
    timestamp: params.timestamp ?? new Date().toISOString()
  } as Omit<Evidence, 'signature'>;
}

/**
 * Compute evidence integrity hash
 * VAP: sha256(id + session_id + timestamp + evidence_type + payload_hash + signature)
 */
export function computeEvidenceHash(evidence: Evidence): Hash {
  // Implementation in crypto package
  return '' as Hash;
}

/**
 * Validate evidence structure and required fields
 */
export function validateEvidence(evidence: unknown): EvidenceValidationResult {
  const result = EvidenceSchema.safeParse(evidence);
  if (!result.success) {
    return {
      valid: false,
      evidenceId: (evidence as any)?.evidenceId ?? 'unknown',
      errors: zodIssuesToPlain(result.error.issues)
    };
  }
  return { valid: true, evidenceId: result.data.evidenceId };
}