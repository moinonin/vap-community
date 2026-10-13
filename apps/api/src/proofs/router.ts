/**
 * Proof retrieval URL matcher — thin dependency-free adapter around
 * ProofAPIHandler, mirroring sessions/router.ts style.
 */

import { ProofAPIHandler, type ProofAPI, type ProofFilter } from './index';
import type { HttpResponse } from '../evidence/controller';
import type { RouteRequest } from '../sessions/router';

const PROOFS_PREFIX = '/v1/proofs';

/**
 * Match an incoming request to a Proof route.
 * Returns null when the path is not under /v1/proofs (caller tries other routers).
 */
export async function matchProofsRoute(
  request: RouteRequest,
  api: ProofAPI = new ProofAPIHandler(),
): Promise<HttpResponse | null> {
  const { method, path } = request;
  const [pathname, queryString] = path.split('?');

  if (!pathname!.startsWith(PROOFS_PREFIX)) {
    return null;
  }

  const segments = pathname!.slice(PROOFS_PREFIX.length).split('/').filter(Boolean).map(decodeURIComponent);
  const query = new URLSearchParams(queryString ?? '');
  const filter: ProofFilter = {
    sessionId: query.get('sessionId') ?? undefined,
    contentId: query.get('contentId') ?? undefined,
    verifierId: query.get('verifierId') ?? undefined,
    state: query.get('state') ?? undefined,
    from: query.get('from') ?? undefined,
    to: query.get('to') ?? undefined,
    limit: query.get('limit') ? Number(query.get('limit')) : undefined,
    offset: query.get('offset') ? Number(query.get('offset')) : undefined,
  };

  // GET /v1/proofs/:proofId
  if (method === 'GET' && segments.length === 1) {
    const proof = await api.getByProofId(segments[0]!);
    if (!proof) {
      return { status: 404, body: { error: { code: 'NOT_FOUND', message: `proof ${segments[0]} not found` } } };
    }
    return { status: 200, body: proof };
  }

  // GET /v1/proofs?sessionId|contentId|verifierId|state|from|to|limit|offset=...
  if (method === 'GET' && segments.length === 0) {
    if (filter.sessionId) {
      return { status: 200, body: { items: await api.getBySession(filter.sessionId, filter) } };
    }
    if (filter.contentId) {
      return { status: 200, body: { items: await api.getByContent(filter.contentId, filter) } };
    }
    if (filter.verifierId) {
      return { status: 200, body: { items: await api.getByVerifier(filter.verifierId, filter) } };
    }
    const result = await api.search(filter);
    return { status: 200, body: result };
  }

  return { status: 404, body: { error: { code: 'NOT_FOUND', message: `${path} not found` } } };
}
