/**
 * Evidence ingestion API controller (Sprint 2 gap closure).
 *
 * Follows the SessionController pattern: pure request -> response handlers
 * returning { status, body }. Ingestion routes raw evidence through the
 * verification pipeline (validation -> normalization -> append-only store).
 */

import { z } from 'zod';
import { Pipeline, type PipelineResult } from '@verified-attention/pipeline';
import { createEvidenceStore, type EvidenceStore } from '@verified-attention/store';
import { SessionStore } from '../sessions/store';

export interface HttpResponse {
  status: number;
  body: unknown;
}

const IngestEvidenceRequestSchema = z.object({
  evidenceId: z.string().min(1),
  sessionId: z.string().min(1),
  sourceId: z.string().min(1),
  timestamp: z.union([z.string(), z.number()]),
  evidenceType: z.string().min(1),
  confidence: z.number().min(0).max(1),
  payload: z.unknown(),
  provenance: z.object({
    observationIds: z.array(z.string()),
    observationHash: z.string().min(1),
    sourceId: z.string().min(1),
    collectionMethod: z.string().optional(),
  }),
  signature: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export class EvidenceController {
  private readonly pipeline: Pipeline;

  constructor(
    private readonly store: EvidenceStore = createEvidenceStore(),
    private readonly sessions: SessionStore = new SessionStore(),
  ) {
    this.pipeline = new Pipeline().attachStore({
      append: async (e: any) => this.store.append(e),
    });
  }

  /** POST /v1/evidence — validate, normalize, and append evidence */
  async ingest(body: unknown): Promise<HttpResponse> {
    const parsed = IngestEvidenceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return { status: 400, body: errorBody('VALIDATION_ERROR', parsed.error.message) };
    }

    const evidence = parsed.data;
    const session = this.sessions.get(evidence.sessionId);
    if (!session) {
      return { status: 404, body: errorBody('NOT_FOUND', `session ${evidence.sessionId} not found`) };
    }

    // Normalize numeric timestamps so the store (and replay cache) see the canonical form
    const canonical = typeof evidence.timestamp === 'number'
      ? { ...evidence, timestamp: new Date(evidence.timestamp).toISOString() }
      : evidence;

    const result: PipelineResult = await this.pipeline.run(canonical, {
      sessionId: evidence.sessionId,
      sessionState: session.state,
    });

    if (!result.ok) {
      const conflicts = (result.errors ?? []).some((e: any) => e.code === 'DUPLICATE_EVIDENCE');
      return {
        status: conflicts ? 409 : 422,
        body: errorBody(
          conflicts ? 'DUPLICATE_EVIDENCE' : 'EVIDENCE_REJECTED',
          `evidence rejected at ${result.stage} stage`,
          result.errors,
        ),
      };
    }

    return { status: 201, body: { evidenceId: result.evidenceId, stage: result.stage } };
  }

  /** GET /v1/evidence/:id */
  async get(evidenceId: string): Promise<HttpResponse> {
    const evidence = await this.store.getByEvidenceId(evidenceId);
    if (!evidence) {
      return { status: 404, body: errorBody('NOT_FOUND', `evidence ${evidenceId} not found`) };
    }
    return { status: 200, body: evidence };
  }

  /** GET /v1/evidence?sessionId=... */
  async listBySession(sessionId: string): Promise<HttpResponse> {
    const items = await this.store.getBySession(sessionId);
    return { status: 200, body: { items, total: items.length } };
  }
}

function errorBody(code: string, message: string, details?: unknown): unknown {
  return { error: { code, message, ...(details !== undefined ? { details } : {}) } };
}

export { IngestEvidenceRequestSchema };
