/**
 * Minimal URL matcher for evidence ingestion routes (Sprint 2 gap closure).
 * Mirrors sessions/router.ts — a thin, dependency-free matcher exercised via
 * tests and the http adapter in app.ts.
 */

import { EvidenceController, type HttpResponse } from './controller';
import type { RouteRequest } from '../sessions/router';

const EVIDENCE_PREFIX = '/v1/evidence';

/**
 * Match an incoming request to an Evidence route.
 * Returns null when the path is not under /v1/evidence (caller tries other routers).
 */
export async function matchEvidenceRoute(
  request: RouteRequest,
  controller: EvidenceController = new EvidenceController()
): Promise<HttpResponse | null> {
  const { method, path, body } = request;

  // Split query string: GET /v1/evidence?sessionId=...
  const [pathname, queryString] = path.split('?');

  if (!pathname!.startsWith(EVIDENCE_PREFIX)) {
    return null;
  }

  const rest = pathname!.slice(EVIDENCE_PREFIX.length);
  const segments = rest.split('/').filter(Boolean).map(decodeURIComponent);

  // POST /v1/evidence
  if (method === 'POST' && segments.length === 0) {
    return controller.ingest(body);
  }

  // GET /v1/evidence/:id
  if (method === 'GET' && segments.length === 1) {
    return controller.get(segments[0]!);
  }

  // GET /v1/evidence?sessionId=...
  if (method === 'GET' && segments.length === 0 && queryString) {
    const sessionId = new URLSearchParams(queryString).get('sessionId');
    if (sessionId) {
      return controller.listBySession(sessionId);
    }
  }

  return { status: 404, body: { error: { code: 'NOT_FOUND', message: `${path} not found` } } };
}
