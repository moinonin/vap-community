/**
 * Correlation Middleware (S2.3)
 * Propagates x-correlation-id across requests for distributed tracing.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

export function correlationMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): void {
  const headerName = (process.env.CORRELATION_HEADER || 'x-correlation-id') as string;
  const incoming = req.headers[headerName.toLowerCase()] || req.headers[headerName];
  const correlationId = (Array.isArray(incoming) ? incoming[0] : incoming) || `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  
  // Set on request (available to downstream handlers)
  (req as Record<string, unknown>)[headerName] = correlationId;
  
  // Propagate back in response
  res.setHeader(headerName, correlationId);
  
  next();
}
