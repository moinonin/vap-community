/**
 * HTTP application entrypoint for the VAE API service (Sprint 3 skeleton).
 *
 * Sprint 3 wires only the Session routes; later sprints add Evidence,
 * Proof, Verification, Policy. The Node http server is a thin adapter
 * around matchSessionRoute.
 */

import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { matchSessionRoute, type HttpMethod, type RouteRequest } from './sessions/router';
import { SessionController } from './sessions/controller';
import { SessionStore } from './sessions/store';
import { EvidenceController } from './evidence/controller';
import { POLICIES_PREFIX } from './policies/index';
import { matchEvidenceRoute } from './evidence/router';
import { matchProofsRoute } from './proofs/router';
import { matchPolicyRoute } from './policies/index';
import { matchAuthRoute } from './auth/router';
import { matchPrivacyRoute } from './privacy/router';
import { externalEvidenceRouter } from './evidence/external';



export interface ApiServer {
  listen(port: number, host?: string): void;
  close(): Promise<void>;
}

export function createServer(sessionStore: SessionStore = new SessionStore()): ApiServer {
  // Controllers share the session store so evidence ingestion resolves sessions
  const controller = new SessionController(sessionStore);
  const evidenceController = new EvidenceController(undefined, sessionStore);
  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = req.url ?? '/';
    const method = (req.method ?? 'GET').toUpperCase() as HttpMethod;

    // Health check endpoint
    if (url === '/health' || url === '/v1/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', service: 'vae-api', timestamp: new Date().toISOString() }));
      return;
    }

    let body: unknown = undefined;
    if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw) {
        try { body = JSON.parse(raw); } catch { body = undefined; }
      }
    }

    const routeReq: RouteRequest = { method, path: url, body };

    // 0. Auth routes (Authorization header forwarded for /v1/auth/me)
    const authRes = await matchAuthRoute({ ...routeReq, headers: { authorization: req.headers.authorization } });
    if (authRes) {
      res.statusCode = authRes.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(authRes.body));
      return;
    }

    // 1. Evidence routes (shared controller/store)
    const externalRes = await externalEvidenceRouter(routeReq);
    if (externalRes) {
      res.statusCode = externalRes.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(externalRes.body));
      return;
    }

    const evidenceRes = await matchEvidenceRoute(routeReq, evidenceController);

    if (evidenceRes) {
      res.statusCode = evidenceRes.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(evidenceRes.body));
      return;
    }

    // 2. Proofs routes
    const proofsRes = await matchProofsRoute(routeReq);
    if (proofsRes) {
      res.statusCode = proofsRes.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(proofsRes.body));
      return;
    }

    // 3. Policies routes (matchPolicyRoute 404s non-policy paths instead of returning null)
    if (url.startsWith(POLICIES_PREFIX)) {
      const policyRes = matchPolicyRoute(routeReq);
      res.statusCode = policyRes.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(policyRes.body));
      return;
    }

    // 4. Privacy routes
    const privacyRes = await matchPrivacyRoute(routeReq);
    if (privacyRes) {
      res.statusCode = privacyRes.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(privacyRes.body));
      return;
    }

    // 5. Sessions routes (fallback / default route handler)
    const response = matchSessionRoute(routeReq, controller);
    res.statusCode = response.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(response.body));
  });

  return {
    listen(port, host = '0.0.0.0') {
      server.listen(port, host);
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  };
}
