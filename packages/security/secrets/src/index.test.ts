/**
 * Security Secrets Tests (VAE Sprint 14)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSecretsManager } from './index';
import type { SecretType } from './index';

describe('Secrets Manager', () => {
  let manager;

  beforeEach(() => {
    vi.resetModules();
    manager = getSecretsManager();
  });

  it('creates a secret', () => {
    const secret = manager.createSecret({ name: 'test-api-key', type: 'API_KEY' as SecretType, value: 'secret-value-123', tags: ['test'] });
    expect(secret.id).toMatch(/^secret_/);
    expect(secret.name).toBe('test-api-key');
    expect(secret.value).toBe('secret-value-123');
    expect(secret.version).toBe(1);
  });

  it('retrieves a secret by name', () => {
    manager.createSecret({ name: 'ret-test', type: 'PASSWORD' as SecretType, value: 'password123', tags: [] });
    const secret = manager.getSecret('ret-test');
    expect(secret).toBeDefined();
    expect(secret?.value).toBe('password123');
  });

  it('returns undefined for non-existent secret', () => {
    expect(manager.getSecret('nonexistent')).toBeUndefined();
  });

  it('lists secrets with filter', () => {
    manager.createSecret({ name: 'key-1', type: 'API_KEY' as SecretType, value: 'v1', tags: ['prod'] });
    manager.createSecret({ name: 'key-2', type: 'API_KEY' as SecretType, value: 'v2', tags: ['dev'] });
    const apiKeys = manager.listSecrets({ type: 'API_KEY' });
    expect(apiKeys.length).toBe(2);
    const prodSecrets = manager.listSecrets({ tags: ['prod'] });
    expect(prodSecrets.length).toBe(1);
  });

  it('updates a secret', () => {
    manager.createSecret({ name: 'update-test', type: 'API_KEY' as SecretType, value: 'old', tags: [] });
    const updated = manager.updateSecret('update-test', 'new');
    expect(updated?.value).toBe('new');
    expect(updated?.version).toBe(2);
  });

  it('rotates a secret', () => {
    manager.createSecret({ name: 'rotate-test', type: 'API_KEY' as SecretType, value: 'original', tags: [] });
    const rotated = manager.rotateSecret('rotate-test');
    expect(rotated?.value).toMatch(/^rotated_/);
    expect(rotated?.version).toBe(2);
    expect(rotated?.rotationPolicy?.autoRotate).toBe(true);
  });

  it('deletes a secret', () => {
    manager.createSecret({ name: 'delete-test', type: 'API_KEY' as SecretType, value: 'x', tags: [] });
    expect(manager.deleteSecret('delete-test')).toBe(true);
    expect(manager.getSecret('delete-test')).toBeUndefined();
  });

  it('encrypts and decrypts (stub)', () => {
    expect(manager.encrypt('plaintext')).toBe('plaintext');
    expect(manager.decrypt('ciphertext')).toBe('ciphertext');
  });
});
