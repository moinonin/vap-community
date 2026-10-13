/**
 * Auth Tests (VAE Sprint 14)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAuthManager, type AuthManager, APIKeyAuthProvider, JWTAuthProvider, type AuthResult, type AuthConfig } from './index';

vi.mock('crypto', () => ({ createHmac: () => ({ update: () => ({ digest: () => 'mock' }) }) }));

describe('Auth', () => {
  let manager;

  beforeEach(() => {
    vi.resetModules();
    manager = getAuthManager();
  });

  it('has default providers registered', () => {
    const providers = manager.listProviders();
    expect(providers).toContain('api-key');
    expect(providers).toContain('jwt');
  });

  it('API key authentication succeeds with valid key', async () => {
    const result = await manager.authenticate('api-key', { apiKey: 'test-api-key-1' });
    expect(result.authenticated).toBe(true);
    expect(result.principalId).toBe('user-1');
  });

  it('API key authentication fails with invalid key', async () => {
    const result = await manager.authenticate('api-key', { apiKey: 'invalid-key-123' });
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('Invalid API key');
  });

  it('JWT authentication succeeds with valid credentials', async () => {
    const result = await manager.authenticate('jwt', { username: 'test', password: 'test' });
    expect(result.authenticated).toBe(true);
    expect(result.principalId).toBe('test');
  });

  it('JWT authentication fails with invalid credentials', async () => {
    const result = await manager.authenticate('jwt', { username: 'wrong', password: 'wrong' });
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('Invalid credentials');
  });

  it('validates request with API key header', async () => {
    const ctx = { headers: { 'X-API-Key': 'test-api-key-1' }, method: 'GET', path: '/proofs', remoteAddress: '127.0.0.1' };
    const result = await manager.validateRequest(ctx);
    expect(result.authenticated).toBe(true);
    expect(result.principalId).toBe('user-1');
  });

  it('validates request with Bearer token', async () => {
    const ctx = { headers: { Authorization: 'Bearer token1234567890' }, method: 'GET', path: '/proofs', remoteAddress: '127.0.0.1' };
    const result = await manager.validateRequest(ctx);
    expect(result.authenticated).toBe(true);
    expect(result.principalId).toBe('jwt-user');
  });

  it('returns unauthenticated for missing credentials', async () => {
    const ctx = { headers: {}, method: 'GET', path: '/proofs', remoteAddress: '127.0.0.1' };
    const result = await manager.validateRequest(ctx);
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('No authentication');
  });

  it('API key provider validates API key directly', async () => {
    const config = { provider: 'API_KEY', apiKeyHeader: 'X-API-Key' };
    const provider = new APIKeyAuthProvider(config);
    const result = await provider.validateApiKey('test-api-key-1');
    expect(result.authenticated).toBe(true);
  });

  it('JWT provider introspects valid token', async () => {
    const config = { provider: 'JWT', jwtAlgorithm: 'HS256' };
    const provider = new JWTAuthProvider(config);
    const result = await provider.introspect('validtoken12345678');
    expect(result.authenticated).toBe(true);
  });

  it('JWT provider rejects short token', async () => {
    const config = { provider: 'JWT', jwtAlgorithm: 'HS256' };
    const provider = new JWTAuthProvider(config);
    const result = await provider.introspect('short');
    expect(result.authenticated).toBe(false);
  });
});
