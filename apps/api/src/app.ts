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
import { matchEvidenceRoute } from './evidence/router';
import { matchProofsRoute } from './proofs/router';
import { matchPolicyRoute } from './policies/index';
import { matchPrivacyRoute } from './privacy/router';

export interface ApiServer {
  listen(port: number, host?: string): void;
  close(): Promise<void>;
}

export function createServer(controller: SessionController = new SessionController()): ApiServer {
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

    // 1. Evidence routes
    const evidenceRes = await matchEvidenceRoute(routeReq);
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

    // 3. Policies routes
    const policyRes = matchPolicyRoute(routeReq);
    if (policyRes) {
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
