/**
 * Pseudonymisation (VAE Sprint 15)
 *
 * Pseudonymise session IDs and strip PII from evidence.
 * Makes data unlinkable to individuals while preserving analytical utility.
 */

import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export const PseudonymisationConfigSchema = z.object({
  salt: z.string().min(16), // Minimum 16 bytes for HMAC
  algorithm: z.enum(['HMAC_SHA256', 'HMAC_SHA512', 'FARM_FINGERPRINT']).default('HMAC_SHA256'),
  // Fields to pseudonymise
  fieldsToPseudonymise: z.array(z.string()).default([
    'sessionId',
    'userId',
    'deviceId',
    'clientId',
    'userAgent',
  ]),
  // Fields to strip (remove entirely)
  fieldsToStrip: z.array(z.string()).default([
    'user.email',
    'user.phone',
    'user.address',
    'user.ipAddress',
    'ipAddress',
  ]),
  // Whether to use a consistent mapping (deterministic) or one-time random
  deterministic: z.boolean().default(true),
  // Reserve key for reversal (store securely!)
  reversible: z.boolean().default(false),
});

export type PseudonymisationConfig = z.infer<typeof PseudonymisationConfigSchema>;

export const PseudonymisedRecordSchema = z.object({
  originalId: z.string().optional(),
  pseudonymisedId: z.string().min(1),
  pseudonymisedAt: z.string().datetime(),
  saltVersion: z.string().optional(),
});

export type PseudonymisedRecord = z.infer<typeof PseudonymisedRecordSchema>;

export const PseudonymisationResultSchema = z.object({
  originalData: z.record(z.unknown()),
  pseudonymisedData: z.record(z.unknown()),
  mappings: z.array(PseudonymisedRecordSchema),
  fieldsStripped: z.number().int().nonnegative(),
  fieldsPseudonymised: z.number().int().nonnegative(),
  piiDetected: z.number().int().nonnegative(),
  isPseudonymised: z.boolean(),
});

export type PseudonymisationResult = z.infer<typeof PseudonymisationResultSchema>;

export interface PseudonymisationService {
  configure(config: PseudonymisationConfig): void;
  pseudonymise(data: Record<string, unknown>): PseudonymisationResult;
  pseudonymiseBatch(data: Record<string, unknown>[]): PseudonymisationResult[];
  pseudonymiseField(value: string, salt?: string): string;
  isPseudonymised(value: string): boolean;
  reversePseudonymisation(_pseudonym: string): string | undefined; // Only if reversible
  getMapping(originalId: string): PseudonymisedRecord | undefined;
  clearMappingCache(): void;
}

// ─── Pseudonymisation Service ─────────────────────────────────────────────────

export class PseudonymisationServiceImpl implements PseudonymisationService {
  private config: PseudonymisationConfig;
  private mappings = new Map<string, PseudonymisedRecord>(); // originalId -> mapping
  private reverseMappings = new Map<string, string>(); // pseudonymisedId -> originalId

  constructor() {
    this.config = {
      salt: randomBytes(16).toString('hex'),
      algorithm: 'HMAC_SHA256',
      fieldsToPseudonymise: ['sessionId', 'userId', 'deviceId', 'clientId', 'userAgent'],
      fieldsToStrip: ['user.email', 'user.phone', 'user.address', 'user.ipAddress', 'ipAddress'],
      deterministic: true,
      reversible: false,
    };
  }

  configure(config: PseudonymisationConfig): void {
    this.config = config;
    if (config.reversible) {
      // Clear existing mappings if switching to reversible
      this.mappings.clear();
      this.reverseMappings.clear();
    }
  }

  pseudonymise(data: Record<string, unknown>): PseudonymisationResult {
    const originalData = JSON.parse(JSON.stringify(data)); // Deep clone
    const pseudonymisedData = JSON.parse(JSON.stringify(data));
    const mappings: PseudonymisedRecord[] = [];
    let fieldsStripped = 0;
    let fieldsPseudonymised = 0;
    let piiDetected = 0;

    // Strip PII fields
    for (const fieldPath of this.config.fieldsToStrip) {
      const value = this.getNestedValue(pseudonymisedData, fieldPath);
      if (value !== undefined && value !== null) {
        this.stripField(pseudonymisedData, fieldPath);
        fieldsStripped++;
        piiDetected++;
      }
    }

    // Pseudonymise fields
    for (const fieldPath of this.config.fieldsToPseudonymise) {
      const value = this.getNestedValue(pseudonymisedData, fieldPath);
      if (typeof value === 'string' && value.length > 0) {
        const pseudonym = this.pseudonymiseField(value);
        this.setNestedValue(pseudonymisedData, fieldPath, pseudonym);
        fieldsPseudonymised++;

        if (this.config.reversible) {
          const mapping: PseudonymisedRecord = {
            originalId: value,
            pseudonymisedId: pseudonym,
            pseudonymisedAt: new Date().toISOString(),
            saltVersion: this.config.salt.slice(0, 8),
          };
          this.mappings.set(value, mapping);
          this.reverseMappings.set(pseudonym, value);
          mappings.push(mapping);
        }
      }
    }

    return {
      originalData,
      pseudonymisedData,
      mappings,
      fieldsStripped,
      fieldsPseudonymised,
      piiDetected,
      isPseudonymised: fieldsPseudonymised > 0 || fieldsStripped > 0,
    };
  }

  pseudonymiseBatch(data: Record<string, unknown>[]): PseudonymisationResult[] {
    return data.map(d => this.pseudonymise(d));
  }

  pseudonymiseField(value: string, salt?: string): string {
    const saltToUse = salt || this.config.salt;

    if (this.config.algorithm === 'HMAC_SHA256') {
      const hmac = createHash('sha256');
      hmac.update(saltToUse);
      hmac.update(value);
      return `pseudo_${hmac.digest('hex')}`;
    } else if (this.config.algorithm === 'HMAC_SHA512') {
      const hmac = createHash('sha512');
      hmac.update(saltToUse);
      hmac.update(value);
      return `pseudo_${hmac.digest('hex').slice(0, 64)}`;
    } else if (this.config.algorithm === 'FARM_FINGERPRINT') {
      // Simpified farm fingerprint (deterministic hash)
      let hash = 0;
      const input = saltToUse + value;
      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `pseudo_farm_${Math.abs(hash).toString(16)}`;
    }

    return value;
  }

  isPseudonymised(value: string): boolean {
    return value.startsWith('pseudo_');
  }

  reversePseudonymisation(pseudonym: string): string | undefined {
    if (!this.config.reversible) {
      return undefined; // Not reversible
    }
    return this.reverseMappings.get(pseudonym);
  }

  getMapping(originalId: string): PseudonymisedRecord | undefined {
    return this.mappings.get(originalId);
  }

  clearMappingCache(): void {
    this.mappings.clear();
    this.reverseMappings.clear();
  }

  private stripField(data: Record<string, unknown>, path: string): void {
    const parts = path.split('.');
    let current: any = data;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) return;
      current = current[parts[i]!];
    }

    if (current && typeof current === 'object' && !(current instanceof Array)) {
      delete current[parts[parts.length - 1]!];
    }
  }

  private setNestedValue(data: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: any = data;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        // Create intermediate objects if they don't exist
        current[parts[i]!] = {};
        current = current[parts[i]!];
        continue;
      }
      current = current[parts[i]!];
    }

    if (current && typeof current === 'object' && !(current instanceof Array)) {
      current[parts[parts.length - 1]!] = value;
    }
  }

  private getNestedValue(data: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: any = data;
    for (const part of parts) {
      if (!current || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _service: PseudonymisationService | null = null;

export function getPseudonymisationService(): PseudonymisationService {
  if (!_service) {
    _service = new PseudonymisationServiceImpl();
  }
  return _service;
}

export function setPseudonymisationService(service: PseudonymisationService): void {
  _service = service;
}
