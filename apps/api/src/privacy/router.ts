/**
 * Privacy (GDPR data subject rights) URL matcher — thin dependency-free adapter
 * around DataSubjectRightsHandler, mirroring sessions/router.ts style.
 */

import { getDataSubjectRightsHandler, type DataSubjectRequest } from './index';
import type { HttpResponse } from '../evidence/controller';
import type { RouteRequest } from '../sessions/router';

const PRIVACY_PREFIX = '/v1/privacy';

/**
 * Match an incoming request to a Privacy route.
 * Returns null when the path is not under /v1/privacy (caller tries other routers).
 */
export async function matchPrivacyRoute(request: RouteRequest): Promise<HttpResponse | null> {
  const { method, path, body } = request;
  if (!path.startsWith(PRIVACY_PREFIX)) {
    return null;
  }

  const segments = path.slice(PRIVACY_PREFIX.length).split('/').filter(Boolean);
  const handler = getDataSubjectRightsHandler();

  // POST /v1/privacy/access
  if (method === 'POST' && segments.length === 1 && segments[0] === 'access') {
    const req = asRequest(body);
    if (!req) return badBody();
    return { status: 200, body: await handler.accessRequest(req) };
  }

  // POST /v1/privacy/rectification
  if (method === 'POST' && segments.length === 1 && segments[0] === 'rectification') {
    const req = asRequest(body);
    if (!req) return badBody();
    const corrections = (body as any)?.corrections ?? {};
    return { status: 200, body: await handler.rectificationRequest(req, corrections) };
  }

  // POST /v1/privacy/erasure
  if (method === 'POST' && segments.length === 1 && segments[0] === 'erasure') {
    const req = asRequest(body);
    if (!req) return badBody();
    return { status: 200, body: await handler.erasureRequest(req) };
  }

  // POST /v1/privacy/portability
  if (method === 'POST' && segments.length === 1 && segments[0] === 'portability') {
    const req = asRequest(body);
    if (!req) return badBody();
    return { status: 200, body: await handler.portabilityRequest(req) };
  }

  return { status: 404, body: { error: { code: 'NOT_FOUND', message: `${path} not found` } } };
}

function asRequest(body: unknown): DataSubjectRequest | null {
  if (body && typeof body === 'object' && typeof (body as any).userId === 'string') {
    return body as DataSubjectRequest;
  }
  return null;
}

function badBody(): HttpResponse {
  return { status: 400, body: { error: { code: 'INVALID_BODY', message: 'userId required' } } };
}
