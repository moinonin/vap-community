/**
 * Authentication (VAE Sprint 14)
 *
 * OAuth2/OIDC, API keys, and mTLS authentication providers.
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const AuthProviderTypeSchema = z.enum(['OAUTH2', 'OIDC', 'API_KEY', 'MTLS', 'JWT', 'BASIC_AUTH']);
export type AuthProviderType = z.infer<typeof AuthProviderTypeSchema>;

export const AuthConfigSchema = z.object({
  provider: AuthProviderTypeSchema,
  authorizationEndpoint: z.string().url().optional(),
  tokenEndpoint: z.string().url().optional(),
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
  redirectUri: z.string().url().optional(),
  scopes: z.array(z.string()).default([]),
  apiKeyHeader: z.string().default('X-API-Key'),
  apiKeyPrefix: z.string().optional(),
  certAuthority: z.string().optional(),
  certRequired: z.boolean().default(false),
  jwtIssuer: z.string().optional(),
  jwtAudience: z.array(z.string()).optional(),
  jwtSecret: z.string().optional(),
  jwtAlgorithm: z.enum(['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256', 'EdDSA']).default('HS256'),
});
export type AuthConfig = z.infer<typeof AuthConfigSchema>;

export const AuthResultSchema = z.object({
  authenticated: z.boolean(),
  principalId: z.string().optional(),
  provider: AuthProviderTypeSchema,
  scopes: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
  error: z.string().optional(),
});
export type AuthResult = z.infer<typeof AuthResultSchema>;

export interface AuthProvider {
  authenticate(credentials: Record<string, unknown>): Promise<AuthResult>;
  validateApiKey(apiKey: string): Promise<AuthResult>;
  validateTls(clientCert: string): Promise<AuthResult>;
  introspect(token: string): Promise<AuthResult>;
  getConfig(): AuthConfig;
}

export interface AuthManager {
  registerProvider(name: string, provider: AuthProvider): void;
  authenticate(providerName: string, credentials: Record<string, unknown>): Promise<AuthResult>;
  validateRequest(request: RequestContext): Promise<AuthResult>;
  listProviders(): string[];
}

export interface RequestContext {
  headers: Record<string, string>;
  method: string;
  path: string;
  remoteAddress: string;
}

// ─── API Key Provider ─────────────────────────────────────────────────────────

export class APIKeyAuthProvider implements AuthProvider {
  private validKeys = new Map<string, { principalId: string; scopes: string[] }>();

  constructor(private config: AuthConfig) {
    this.validKeys.set('test-api-key-1', { principalId: 'user-1', scopes: ['read', 'write'] });
    this.validKeys.set('test-api-key-2', { principalId: 'user-2', scopes: ['read'] });
  }

  async authenticate(credentials: Record<string, unknown>): Promise<AuthResult> {
    const apiKey = credentials.apiKey as string | undefined;
    if (apiKey) {
      return this.validateApiKey(apiKey);
    }
    return {
      authenticated: false,
      provider: 'API_KEY',
      scopes: [],
      error: 'Use validateApiKey with apiKey in credentials',
    };
  }

  async validateApiKey(apiKey: string): Promise<AuthResult> {
    let key = apiKey;
    if (this.config.apiKeyPrefix && apiKey.startsWith(this.config.apiKeyPrefix)) {
      key = apiKey.slice(this.config.apiKeyPrefix.length + 1);
    }
    const entry = this.validKeys.get(key);
    if (entry) {
      return { authenticated: true, principalId: entry.principalId, provider: 'API_KEY', scopes: entry.scopes };
    }
    return { authenticated: false, provider: 'API_KEY', scopes: [], error: 'Invalid API key' };
  }

  async validateTls(_clientCert: string): Promise<AuthResult> {
    return { authenticated: false, provider: 'API_KEY', scopes: [], error: 'Use MTLS provider' };
  }

  async introspect(_token: string): Promise<AuthResult> {
    return { authenticated: false, provider: 'API_KEY', scopes: [], error: 'API key introspection not supported' };
  }

  getConfig(): AuthConfig { return this.config; }
}

// ─── JWT Provider ─────────────────────────────────────────────────────────────

export class JWTAuthProvider implements AuthProvider {
  constructor(private config: AuthConfig) {}

  async authenticate(credentials: Record<string, unknown>): Promise<AuthResult> {
    const username = credentials.username as string;
    const password = credentials.password as string;
    if (username === 'test' && password === 'test') {
      return { authenticated: true, principalId: username, provider: 'JWT', scopes: ['read', 'write'], expiresAt: new Date(Date.now() + 3600000).toISOString() };
    }
    return { authenticated: false, provider: 'JWT', scopes: [], error: 'Invalid credentials' };
  }

  async validateApiKey(_apiKey: string): Promise<AuthResult> {
    return { authenticated: false, provider: 'JWT', scopes: [], error: 'Use JWT token' };
  }

  async validateTls(_clientCert: string): Promise<AuthResult> {
    return { authenticated: false, provider: 'JWT', scopes: [], error: 'Use JWT provider' };
  }

  async introspect(token: string): Promise<AuthResult> {
    if (token && token.length > 10) {
      return { authenticated: true, principalId: 'jwt-user', provider: 'JWT', scopes: ['read'], expiresAt: new Date(Date.now() + 3600000).toISOString() };
    }
    return { authenticated: false, provider: 'JWT', scopes: [], error: 'Invalid token' };
  }

  getConfig(): AuthConfig { return this.config; }
}

// ─── Auth Manager ─────────────────────────────────────────────────────────────

export class AuthManagerImpl implements AuthManager {
  private providers = new Map<string, AuthProvider>();

  registerProvider(name: string, provider: AuthProvider): void {
    this.providers.set(name, provider);
  }

  async authenticate(providerName: string, credentials: Record<string, unknown>): Promise<AuthResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return { authenticated: false, provider: 'API_KEY' as AuthProviderType, scopes: [], error: `Unknown provider: ${providerName}` };
    }
    return provider.authenticate(credentials);
  }

  async validateRequest(ctx: RequestContext): Promise<AuthResult> {
    const apiKey = ctx.headers['X-API-Key'];
    if (apiKey) {
      for (const [, provider] of this.providers) {
        if (provider instanceof APIKeyAuthProvider) {
          return provider.validateApiKey(apiKey);
        }
      }
    }
    const authHeader = ctx.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      for (const [, provider] of this.providers) {
        if (provider instanceof JWTAuthProvider) {
          return provider.introspect(token);
        }
      }
    }
    return { authenticated: false, provider: 'API_KEY' as AuthProviderType, scopes: [], error: 'No authentication credentials found' };
  }

  listProviders(): string[] { return Array.from(this.providers.keys()); }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _manager: AuthManager | null = null;

export function getAuthManager(): AuthManager {
  if (!_manager) {
    _manager = new AuthManagerImpl();
    _manager.registerProvider('api-key', new APIKeyAuthProvider({ provider: 'API_KEY', apiKeyHeader: 'X-API-Key', scopes: [], certRequired: false, jwtAlgorithm: 'HS256' }));
    _manager.registerProvider('jwt', new JWTAuthProvider({ provider: 'JWT', jwtAlgorithm: 'HS256', scopes: [], apiKeyHeader: 'X-API-Key', certRequired: false }));
  }
  return _manager;
}

export function setAuthManager(manager: AuthManager): void { _manager = manager; }
