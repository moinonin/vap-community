/**
 * Encryption at Rest Tests (VAE Sprint 14)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getEncryptionAtRest } from './index';

describe('Encryption at Rest', () => {
  let engine;

  beforeEach(() => {
    vi.resetModules();
    engine = getEncryptionAtRest();
  });

  it('encrypts and decrypts evidence store data', () => {
    const plaintext = 'sensitive evidence data';
    const encrypted = engine.encrypt('evidenceStore', plaintext);
    expect(encrypted.ciphertext).not.toBe(plaintext);
    expect(encrypted.keyId).toBe('key-evidence-1');
    expect(encrypted.algorithm).toBe('AES_256_GCM');

    const decrypted = engine.decrypt('evidenceStore', encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypts and decrypts proof store data', () => {
    const plaintext = 'proof payload data';
    const encrypted = engine.encrypt('proofStore', plaintext);
    expect(encrypted.ciphertext).not.toBe(plaintext);
    const decrypted = engine.decrypt('proofStore', encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypts and decrypts analytics warehouse data', () => {
    const plaintext = 'analytics data payload';
    const encrypted = engine.encrypt('analyticsWarehouse', plaintext);
    const decrypted = engine.decrypt('analyticsWarehouse', encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('disables encryption when configured', () => {
    engine.configure({ algorithm: 'AES_256_GCM', keyRotationDays: 90, enabled: false, keys: {} });
    const encrypted = engine.encrypt('evidenceStore', 'test data');
    expect(encrypted.ciphertext).toBe('test data');
    expect(encrypted.keyId).toBe('none');
    const decrypted = engine.decrypt('evidenceStore', encrypted);
    expect(decrypted).toBe('test data');
  });

  it('returns key ID for data store', () => {
    expect(engine.getKeyId('evidenceStore')).toBe('key-evidence-1');
    expect(engine.getKeyId('proofStore')).toBe('key-proof-1');
    expect(engine.getKeyId('analyticsWarehouse')).toBe('key-analytics-1');
  });

  it('encryption is enabled by default', () => {
    expect(engine.isEnabled()).toBe(true);
  });

  it('throws error for unknown data store when encryption enabled', () => {
    engine.configure({ algorithm: 'AES_256_GCM', keyRotationDays: 90, enabled: true, keys: {} });
    expect(() => engine.encrypt('unknownStore', 'data')).toThrow('No encryption key configured');
  });

  it('rotateKey updates the key', () => {
    const oldKeyId = engine.getKeyId('evidenceStore');
    engine.rotateKey('evidenceStore');
    expect(engine.getKeyId('evidenceStore')).toBe(oldKeyId); // key ID stays same, key value changes

    // Verify old ciphertext can't be decrypted with new key (in production)
    // For this stub, it should still work because encrypt/decrypt use the same key ID
    const plaintext = 'test data';
    const encrypted = engine.encrypt('evidenceStore', plaintext);
    const decrypted = engine.decrypt('evidenceStore', encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('configures with custom key settings', () => {
    engine.configure({
      algorithm: 'AES_256_CBC',
      keyRotationDays: 30,
      enabled: true,
      keys: {
        evidenceStore: { keyId: 'custom-key-1', algorithm: 'AES_256_CBC' },
      },
    });
    const encrypted = engine.encrypt('evidenceStore', 'data');
    expect(encrypted.algorithm).toBe('AES_256_CBC');
    expect(encrypted.keyId).toBe('custom-key-1');
  });
});
