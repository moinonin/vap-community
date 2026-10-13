/**
 * Encryption at Rest (VAE Sprint 14)
 *
 * Encryption for evidence store, proof store, and analytics warehouse.
 */

import { z } from 'zod';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export const EncryptionAlgorithmSchema = z.enum(['AES_256_GCM', 'AES_256_CBC', 'CHACHA20_POLY1305']);
export type EncryptionAlgorithm = z.infer<typeof EncryptionAlgorithmSchema>;

export const EncryptionConfigSchema = z.object({
  algorithm: EncryptionAlgorithmSchema,
  keyRotationDays: z.number().int().positive().default(90),
  enabled: z.boolean().default(true),
  // Key identifiers for different data stores
  keys: z.record(z.string(), z.object({
    keyId: z.string().min(1),
    algorithm: EncryptionAlgorithmSchema,
  })).default({
    evidenceStore: { keyId: 'key-evidence-1', algorithm: 'AES_256_GCM' },
    proofStore: { keyId: 'key-proof-1', algorithm: 'AES_256_GCM' },
    analyticsWarehouse: { keyId: 'key-analytics-1', algorithm: 'AES_256_GCM' },
  }),
});

export type EncryptionConfig = z.infer<typeof EncryptionConfigSchema>;

export const EncryptedDataSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  tag: z.string().optional(),
  keyId: z.string().min(1),
  algorithm: EncryptionAlgorithmSchema,
  encryptedAt: z.string().datetime(),
});

export type EncryptedData = z.infer<typeof EncryptedDataSchema>;

export interface EncryptionAtRest {
  configure(config: EncryptionConfig): void;
  encrypt(dataStore: string, plaintext: string): EncryptedData;
  decrypt(dataStore: string, encrypted: EncryptedData): string;
  rotateKey(dataStore: string): void;
  getKeyId(dataStore: string): string;
  isEnabled(): boolean;
}

// ─── Encryption Engine ────────────────────────────────────────────────────────

export class EncryptionAtRestEngine implements EncryptionAtRest {
  private config: EncryptionConfig;
  private keys = new Map<string, string>(); // keyId -> base64 key

  constructor() {
    this.config = {
      algorithm: 'AES_256_GCM',
      keyRotationDays: 90,
      enabled: true,
      keys: {
        evidenceStore: { keyId: 'key-evidence-1', algorithm: 'AES_256_GCM' },
        proofStore: { keyId: 'key-proof-1', algorithm: 'AES_256_GCM' },
        analyticsWarehouse: { keyId: 'key-analytics-1', algorithm: 'AES_256_GCM' },
      },
    };

    // Initialize default keys
    for (const [, keyInfo] of this.config.keys) {
      this.keys.set(keyInfo.keyId, this.generateKey());
    }
  }

  configure(config: EncryptionConfig): void {
    this.config = config;
    // Initialize keys for new data stores
    for (const [, keyInfo] of config.keys) {
      if (!this.keys.has(keyInfo.keyId)) {
        this.keys.set(keyInfo.keyId, this.generateKey());
      }
    }
  }

  encrypt(dataStore: string, plaintext: string): EncryptedData {
    if (!this.config.enabled) {
      return {
        ciphertext: plaintext,
        iv: '',
        keyId: 'none',
        algorithm: 'AES_256_GCM',
        encryptedAt: new Date().toISOString(),
      };
    }

    const keyInfo = this.config.keys[dataStore];
    if (!keyInfo) {
      throw new Error(`No encryption key configured for data store: ${dataStore}`);
    }

    const keyId = keyInfo.keyId;
    const key = Buffer.from(this.keys.get(keyId)!, 'base64');
    const iv = randomBytes(16);

    let cipher;
    switch (keyInfo.algorithm) {
      case 'AES_256_GCM':
        cipher = createCipheriv('aes-256-gcm', key, iv);
        break;
      case 'AES_256_CBC':
        cipher = createCipheriv('aes-256-cbc', key, iv);
        break;
      case 'CHACHA20_POLY1305':
        cipher = createCipheriv('chacha20-poly1305', key, iv);
        break;
      default:
        throw new Error(`Unsupported algorithm: ${keyInfo.algorithm}`);
    }

    let ciphertext: Buffer;
    let tag: Buffer | undefined;

    if (keyInfo.algorithm === 'AES_256_GCM') {
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      tag = cipher.getAuthTag();
      ciphertext = Buffer.concat([encrypted, tag]);
    } else {
      ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    }

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag ? tag.toString('base64') : undefined,
      keyId,
      algorithm: keyInfo.algorithm,
      encryptedAt: new Date().toISOString(),
    };
  }

  decrypt(dataStore: string, encrypted: EncryptedData): string {
    if (!this.config.enabled) {
      return encrypted.ciphertext;
    }

    const keyInfo = this.config.keys[dataStore];
    if (!keyInfo) {
      throw new Error(`No encryption key configured for data store: ${dataStore}`);
    }

    const keyId = encrypted.keyId;
    const key = Buffer.from(this.keys.get(keyId)!, 'base64');
    const iv = Buffer.from(encrypted.iv, 'base64');

    let decipher;
    switch (encrypted.algorithm) {
      case 'AES_256_GCM':
        decipher = createDecipheriv('aes-256-gcm', key, iv);
        if (encrypted.tag) {
          decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
        }
        break;
      case 'AES_256_CBC':
        decipher = createDecipheriv('aes-256-cbc', key, iv);
        break;
      case 'CHACHA20_POLY1305':
        decipher = createDecipheriv('chacha20-poly1305', key, iv);
        break;
      default:
        throw new Error(`Unsupported algorithm: ${encrypted.algorithm}`);
    }

    const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return plaintext.toString('utf8');
  }

  rotateKey(dataStore: string): void {
    const keyInfo = this.config.keys[dataStore];
    if (!keyInfo) return;

    const newKey = this.generateKey();
    this.keys.set(keyInfo.keyId, newKey);
  }

  getKeyId(dataStore: string): string {
    const keyInfo = this.config.keys[dataStore];
    return keyInfo?.keyId || 'none';
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  private generateKey(): string {
    // Generate a 256-bit key and return as base64
    return randomBytes(32).toString('base64');
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _engine: EncryptionAtRest | null = null;

export function getEncryptionAtRest(): EncryptionAtRest {
  if (!_engine) {
    _engine = new EncryptionAtRestEngine();
  }
  return _engine;
}

export function setEncryptionAtRest(engine: EncryptionAtRest): void {
  _engine = engine;
}
