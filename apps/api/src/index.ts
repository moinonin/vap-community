/**
 * Public entrypoint for @verified-attention/api (Sprint 3).
 */

import { createServer, type ApiServer } from './app';
export { createServer, type ApiServer };
export { SessionController, type HttpResponse } from './sessions/controller';
export { SessionStore, SessionNotFoundError, InvalidTransitionError } from './sessions/store';
export { matchSessionRoute, type RouteRequest, type HttpMethod } from './sessions/router';

// Auto-start when executed directly (e.g. node dist/index.js)
const isMain = process.argv[1] && (
  process.argv[1].endsWith('index.js') ||
  process.argv[1].endsWith('index.mjs') ||
  process.argv[1].endsWith('index.ts')
);

if (isMain) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const server = createServer();
  server.listen(port, host);
  console.log(`[vae-api] Server running at http://${host}:${port}`);
}

