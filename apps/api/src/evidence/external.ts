/**
 * External Observation Ingestion Controller & Route (Sprint 16, Unit 5)
 * Conforms to SPEC-0020 (Omni-Channel Social & Brand Space Verification).
 * Exposes POST /v1/evidence/external with strict zero-PII sanitization.
 */

import { z } from 'zod';
import crypto from 'node:crypto';
import type { RouteRequest } from '../sessions/router';
import type { HttpResponse } from './controller';

export const ExternalEvidenceSchema = z.object({
  platform: z.string().min(1),
  archetype: z.enum(['feed', 'video', 'article']),
  contentUri: z.string().min(1),
  organizationId: z.string().optional(),
  dwellTimeMs: z.number().nonnegative(),
  activeFocusRatio: z.number().min(0).max(1),
  interactionEntropy: z.number().min(0).max(1),
  viewportCoverageRatio: z.number().min(0).max(1),
  readingVelocityWpm: z.number().optional(),
  mediaTelemetry: z
    .object({
      playDurationMs: z.number().optional(),
      audioActive: z.boolean().optional(),
      playbackRate: z.number().optional(),
      completionPercentage: z.number().optional()
    })
    .optional(),
  clientSignature: z.string().optional(),
  timestamp: z.string().datetime().optional()
});

export type ExternalEvidenceInput = z.infer<typeof ExternalEvidenceSchema>;

/** Strip sensitive tracking query parameters to enforce Section 17 Zero-PII compliance */
export function sanitizeContentUri(rawUri: string): string {
  try {
    if (rawUri.startsWith('http://') || rawUri.startsWith('https://')) {
      const url = new URL(rawUri);
      // Strip tracking query parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref', 'source'];
      for (const p of trackingParams) {
        url.searchParams.delete(p);
      }
      return url.toString();
    }
    return rawUri;
  } catch {
    return rawUri;
  }
}

export class ExternalEvidenceController {
  private inMemoryStore: Map<string, ExternalEvidenceInput & { evidenceId: string; ingestedAt: string }> = new Map();

  public async ingest(body: unknown): Promise<HttpResponse> {
    const parse = ExternalEvidenceSchema.safeParse(body);
    if (!parse.success) {
      return {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid external observation payload',
            details: parse.error.issues
          }
        }
      };
    }

    const payload = parse.data;
    const sanitizedUri = sanitizeContentUri(payload.contentUri);

    // Calculate baseline confidence
    let confidence = 0.5;
    if (payload.archetype === 'feed') {
      const velocityPenalty = (payload.readingVelocityWpm || 0) > 900 ? 0.3 : 1.0;
      confidence = Number(
        (payload.activeFocusRatio * 0.4 + payload.interactionEntropy * 0.3 + payload.viewportCoverageRatio * 0.3 * velocityPenalty).toFixed(2)
      );
    } else if (payload.archetype === 'video') {
      const audioBonus = payload.mediaTelemetry?.audioActive ? 0.2 : 0.0;
      confidence = Number((payload.activeFocusRatio * 0.5 + payload.interactionEntropy * 0.3 + audioBonus).toFixed(2));
    } else if (payload.archetype === 'article') {
      confidence = Number((payload.activeFocusRatio * 0.4 + payload.viewportCoverageRatio * 0.4 + payload.interactionEntropy * 0.2).toFixed(2));
    }

    confidence = Math.min(1.0, Math.max(0.0, confidence));

    const evidenceId = `urn:vap:evidence:external:${crypto.randomUUID()}`;
    const stored = {
      ...payload,
      contentUri: sanitizedUri,
      evidenceId,
      confidence,
      ingestedAt: new Date().toISOString()
    };

    this.inMemoryStore.set(evidenceId, stored);

    return {
      status: 201,
      body: {
        status: 'accepted',
        evidenceId,
        platform: payload.platform,
        archetype: payload.archetype,
        contentUri: sanitizedUri,
        confidence,
        timestamp: stored.ingestedAt
      }
    };
  }

  public get(id: string): HttpResponse {
    const found = this.inMemoryStore.get(id);
    if (!found) {
      return {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: `Evidence ${id} not found` } }
      };
    }
    return { status: 200, body: found };
  }

  public list(): HttpResponse {
    return {
      status: 200,
      body: {
        total: this.inMemoryStore.size,
        items: Array.from(this.inMemoryStore.values())
      }
    };
  }
}

export const defaultExternalController = new ExternalEvidenceController();

/** Route matcher for POST /v1/evidence/external and GET /v1/evidence/external */
export async function externalEvidenceRouter(
  request: RouteRequest,
  controller: ExternalEvidenceController = defaultExternalController
): Promise<HttpResponse | null> {
  const { method, path, body } = request;
  const pathname = path.split('?')[0] ?? '';

  if (pathname === '/v1/evidence/external') {
    if (method === 'POST') {
      return controller.ingest(body);
    }
    if (method === 'GET') {
      return controller.list();
    }
  }

  if (pathname.startsWith('/v1/evidence/external/')) {
    const id = pathname.slice('/v1/evidence/external/'.length);
    if (method === 'GET') {
      return controller.get(decodeURIComponent(id));
    }
  }

  return null;
}

