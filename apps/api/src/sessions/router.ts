/**
 * Minimal URL matcher for Sprint 3's five session routes.
 *
 * Sprint 3 keeps the HTTP surface small and dependency-free. A real
 * router (Express/Hono/Fastify) arrives in Sprint 19 (Public API
 * Stabilisation); for now the controller is exercised via tests and
 * through this thin matcher.
 */

import { SessionController, type HttpResponse } from './controller';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RouteRequest {
  method: HttpMethod;
  path: string;
  body?: unknown;
}

export interface MatchedRoute {
  handler: () => HttpResponse;
}

const SESSIONS_PREFIX = '/v1/sessions';

/**
 * Match an incoming request to a Session route.
 * Returns null when no route matches (caller emits 404).
 */
export function matchSessionRoute(
  request: RouteRequest,
  controller: SessionController = new SessionController()
): HttpResponse {
  const { method, path, body } = request;

  if (!path.startsWith(SESSIONS_PREFIX)) {
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: `${path} not found` } } };
  }

  // Strip the prefix; trailing segments give the verb and params.
  const rest = path.slice(SESSIONS_PREFIX.length);
  const segments = rest.split('/').filter(Boolean);

  // POST /v1/sessions
  if (method === 'POST' && segments.length === 0) {
    return controller.create(body);
  }
  // GET /v1/sessions
  if (method === 'GET' && segments.length === 0) {
    return controller.list();
  }
  // GET/PATCH /v1/sessions/:id
  if ((method === 'GET' || method === 'PATCH') && segments.length === 1) {
    const sessionId = segments[0]!;
    return method === 'GET'
      ? controller.get(sessionId)
      : controller.update(sessionId, body);
  }
  // POST /v1/sessions/:id/close
  if (method === 'POST' && segments.length === 2 && segments[1] === 'close') {
    return controller.close(segments[0]!);
  }
  // POST /v1/sessions/:id/expire
  if (method === 'POST' && segments.length === 2 && segments[1] === 'expire') {
    return controller.expire(segments[0]!);
  }

  return { status: 404, body: { error: { code: 'NOT_FOUND', message: `${method} ${path} not found` } } };
}

export { SESSIONS_PREFIX };
