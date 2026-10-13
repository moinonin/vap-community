/**
 * Security Middleware (VAE Sprint 14)
 *
 * Security headers, CSP, rate limiting, WAF rules for the API.
 */

import type { Request, Response, NextFunction } from 'express';
import { getAuthManager } from '@verified-attention/auth';
import { getRBAC, type UserContext } from '@verified-attention/auth/rbac';

/** An Express Request carrying an authenticated user context (set by authMiddleware). */
type AuthedRequest = Request & { user?: { principalId: string; scopes: string[] } };

// ─── Security Headers ─────────────────────────────────────────────────────────

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
};

export function applySecurityHeaders(res: Response): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(key, value);
  }
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

export interface RateLimiter {
  isAllowed(identifier: string, limit: number, windowMs: number): boolean;
  getRemaining(identifier: string, limit: number): number;
  getResetTime(identifier: string, windowMs: number): number;
}

export class InMemoryRateLimiter implements RateLimiter {
  private requests = new Map<string, { count: number; resetAt: number }>();

  isAllowed(identifier: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now > record.resetAt) {
      this.requests.set(identifier, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (record.count >= limit) {
      return false;
    }

    record.count++;
    return true;
  }

  getRemaining(identifier: string, limit: number): number {
    const record = this.requests.get(identifier);
    if (!record) return limit;
    return Math.max(0, limit - record.count);
  }

  getResetTime(identifier: string, windowMs: number): number {
    const record = this.requests.get(identifier);
    if (!record) return Date.now() + windowMs;
    return record.resetAt;
  }
}

// ─── WAF Rules ────────────────────────────────────────────────────────────────

export interface WAFRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
  query: Record<string, string>;
}

export interface WAFResult {
  allowed: boolean;
  blockedReason?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class SimpleWAF {
  private blockedPatterns = [
    { pattern: /<script[^>]*>/i, reason: 'XSS attempt detected', severity: 'HIGH' as const },
    { pattern: /javascript:/i, reason: 'JavaScript protocol detected', severity: 'HIGH' as const },
    { pattern: /on\w+\s*=/i, reason: 'Event handler detected', severity: 'HIGH' as const },
    { pattern: /union\s+select/i, reason: 'SQL injection attempt', severity: 'CRITICAL' as const },
    { pattern: /;\s*drop\s+table/i, reason: 'SQL injection attempt', severity: 'CRITICAL' as const },
    { pattern: /\.\.\/|\.\.\//g, reason: 'Path traversal attempt', severity: 'HIGH' as const },
    { pattern: /%00|\0/g, reason: 'Null byte injection', severity: 'HIGH' as const },
  ];

  inspect(req: WAFRequest): WAFResult {
    const allInput = [
      req.method,
      req.path,
      Object.values(req.headers).join(' '),
      req.body ? JSON.stringify(req.body) : '',
      Object.values(req.query).join(' '),
    ].join(' ');

    for (const rule of this.blockedPatterns) {
      if (rule.pattern.test(allInput)) {
        return {
          allowed: false,
          blockedReason: rule.reason,
          severity: rule.severity,
        };
      }
    }

    return { allowed: true };
  }
}

// ─── Auth + RBAC Middleware Factory ──────────────────────────────────────────

let _rateLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!_rateLimiter) {
    _rateLimiter = new InMemoryRateLimiter();
  }
  return _rateLimiter;
}

export function setRateLimiter(limiter: RateLimiter): void {
  _rateLimiter = limiter;
}

// ─── Middleware: Security Headers ─────────────────────────────────────────────

export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  applySecurityHeaders(res);
  next();
}

// ─── Middleware: Rate Limiting ────────────────────────────────────────────────

export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
  options?: { limit?: number; windowMs?: number; identifier?: string }
): void {
  const limit = options?.limit || 100;
  const windowMs = options?.windowMs || 60000;
  const identifier = options?.identifier || req.ip || 'anonymous';

  const limiter = getRateLimiter();
  if (!limiter.isAllowed(identifier, limit, windowMs)) {
    res.status(429).json({
      error: 'Too Many Requests',
      retryAfter: Math.ceil((limiter.getResetTime(identifier, windowMs) - Date.now()) / 1000),
    });
    return;
  }

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', limiter.getRemaining(identifier, limit));
  next();
}

// ─── Middleware: Authentication (API Key) ─────────────────────────────────────

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ error: 'Missing authentication credentials' });
    return;
  }

  const manager = getAuthManager();
  const result = await manager.validateRequest({
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v ?? '')])),
    method: req.method,
    path: req.path,
    remoteAddress: req.ip || 'unknown',
  });

  if (!result.authenticated) {
    res.status(401).json({ error: result.error || 'Authentication failed' });
    return;
  }

  // Attach user context to request
  (req as AuthedRequest).user = {
    principalId: result.principalId || 'anonymous',
    scopes: result.scopes,
  };
  next();
}

// ─── Middleware: Authorization (RBAC) ─────────────────────────────────────────

export async function rbacMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
  resource: string,
  action: string
): Promise<void> {
  const userContext: UserContext = {
    principalId: req.user?.principalId || 'anonymous',
    roles: [],
    scopes: req.user?.scopes || [],
    ownedResources: [],
  };

  const rbac = getRBAC();
  const result = rbac.authorize({
    user: userContext,
    resource,
    action: action as any,
    scope: 'GLOBAL',
  });

  if (!result.allowed) {
    res.status(403).json({
      error: 'Forbidden',
      reason: result.deniedReason,
    });
    return;
  }

  next();
}

// ─── Middleware: WAF ──────────────────────────────────────────────────────────

export function wafMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const waf = new SimpleWAF();
  const result = waf.inspect({
    method: req.method,
    path: req.path,
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v ?? '')])),
    body: req.body as Record<string, unknown> | undefined,
    query: req.query as unknown as Record<string, string>,
  });

  if (!result.allowed) {
    res.status(403).json({
      error: 'Request blocked by WAF',
      reason: result.blockedReason,
      severity: result.severity,
    });
    return;
  }

  next();
}
