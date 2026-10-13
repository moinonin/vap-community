/**
 * Secrets Manager (VAE Sprint 14)
 *
 * Vault/cloud secrets management with rotation support.
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const SecretTypeSchema = z.enum(['API_KEY', 'PASSWORD', 'CERTIFICATE', 'TOKEN', 'CRYPTOGRAPHIC_KEY']);
export type SecretType = z.infer<typeof SecretTypeSchema>;

export const SecretSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: SecretTypeSchema,
  value: z.string().min(1),
  version: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  rotationPolicy: z.object({
    autoRotate: z.boolean().default(false),
    rotationIntervalDays: z.number().int().positive().optional(),
    maxAgeDays: z.number().int().positive().optional(),
  }).optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export type Secret = z.infer<typeof SecretSchema>;

export const SecretReferenceSchema = z.object({
  name: z.string().min(1),
  version: z.number().int().nonnegative().optional(),
});

export type SecretReference = z.infer<typeof SecretReferenceSchema>;

export interface SecretsManager {
  createSecret(secret: Omit<Secret, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Secret;
  getSecret(name: string, version?: number): Secret | undefined;
  getSecretValue(name: string, version?: number): string | undefined;
  listSecrets(filter?: { type?: SecretType; tags?: string[] }): Secret[];
  updateSecret(name: string, value: string, rotate?: boolean): Secret | undefined;
  rotateSecret(name: string): Secret | undefined;
  deleteSecret(name: string): boolean;
  decrypt(encryptedValue: string): string;
  encrypt(plainValue: string): string;
}

// ─── In-Memory Secrets Manager ────────────────────────────────────────────────

export class SecretsManagerImpl implements SecretsManager {
  private secrets = new Map<string, Secret>();
  private secretCounter = 0;

  createSecret(
    input: Omit<Secret, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Secret {
    const now = new Date().toISOString();
    const secret: Secret = {
      ...input,
      id: `secret_${Date.now()}_${++this.secretCounter}`,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.secrets.set(secret.name, secret);
    return secret;
  }

  getSecret(name: string, version?: number): Secret | undefined {
    const secret = this.secrets.get(name);
    if (!secret) return undefined;
    if (version !== undefined && secret.version !== version) return undefined;
    return secret;
  }

  getSecretValue(name: string, version?: number): string | undefined {
    const secret = this.getSecret(name, version);
    if (!secret) return undefined;
    return secret.value;
  }

  listSecrets(filter?: { type?: SecretType; tags?: string[] }): Secret[] {
    let secrets = Array.from(this.secrets.values());

    if (filter?.type) {
      secrets = secrets.filter(s => s.type === filter.type);
    }
    if (filter?.tags && filter.tags.length > 0) {
      secrets = secrets.filter(s =>
        s.tags.some(t => filter.tags!.includes(t))
      );
    }

    return secrets.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  updateSecret(name: string, value: string, rotate: boolean = false): Secret | undefined {
    const existing = this.secrets.get(name);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const newVersion = existing.version + 1;

    const updated: Secret = {
      ...existing,
      value,
      version: newVersion,
      updatedAt: now,
    };

    if (rotate) {
      updated.rotationPolicy = {
        autoRotate: true,
        rotationIntervalDays: 30,
        ...existing.rotationPolicy,
      };
    }

    this.secrets.set(name, updated);
    return updated;
  }

  rotateSecret(name: string): Secret | undefined {
    const existing = this.secrets.get(name);
    if (!existing) return undefined;

    // Generate a new value (in production, use proper key generation)
    const newValue = `rotated_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    return this.updateSecret(name, newValue, true);
  }

  deleteSecret(name: string): boolean {
    return this.secrets.delete(name);
  }

  decrypt(encryptedValue: string): string {
    // In production, use proper decryption
    // For now, return as-is (stub)
    return encryptedValue;
  }

  encrypt(plainValue: string): string {
    // In production, use proper encryption
    // For now, return as-is (stub)
    return plainValue;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _manager: SecretsManager | null = null;

export function getSecretsManager(): SecretsManager {
  if (!_manager) {
    _manager = new SecretsManagerImpl();
  }
  return _manager;
}

export function setSecretsManager(manager: SecretsManager): void {
  _manager = manager;
}
