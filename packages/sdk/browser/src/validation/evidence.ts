/**
 * Light pre-send validation of evidence records.
 *
 * Duplicates the core zod schema fields (packages/core/src/evidence.ts +
 * common.ts) at the subset the SDK actually produces. Core itself isn't
 * imported at runtime because its modules pull in node:crypto, which must
 * not land in a browser bundle; types are imported type-only elsewhere.
 */

import { z } from 'zod';

const TimestampSchema = z.string().datetime({ offset: true });
const Id = z.string().min(1);

/** Mirrors the API's IngestEvidenceRequestSchema + core EvidenceSchema fields. */
export const OutgoingEvidenceSchema = z.object({
  evidenceId: z.string().regex(/^urn:vap:evidence:[a-zA-Z0-9_-]+$/),
  sessionId: z.string().regex(/^urn:vap:session:[a-zA-Z0-9_-]+$/),
  sourceId: Id,
  timestamp: TimestampSchema,
  evidenceType: z.enum(['E-INTERACTION', 'E-VISIBLE', 'E-DURATION', 'E-CONTEXT', 'E-CUSTOM']),
  confidence: z.number().min(0).max(1),
  payload: z.record(z.unknown()),
  provenance: z.object({
    observationIds: z.array(z.string()).min(1),
    observationHash: z.string().min(1),
    sourceId: Id,
    collectionMethod: z.string().optional(),
  }),
  signature: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export type OutgoingEvidence = z.infer<typeof OutgoingEvidenceSchema>;

export interface ValidationResult {
  ok: boolean;
  errors?: Array<{ path: string; message: string }>;
}

export function validateEvidence(evidence: unknown): ValidationResult {
  const parsed = OutgoingEvidenceSchema.safeParse(evidence);
  if (parsed.success) return { ok: true };
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  };
}
