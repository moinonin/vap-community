/**
 * Data Minimisation (VAE Sprint 15)
 *
 * Enforce data minimisation: schema validation, field stripping, PII detection.
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const DataCategorySchema = z.enum([
  'PERSONAL_IDENTIFYING',
  'SENSITIVE_PERSONAL',
  'CONTEXTUAL',
  'BEHAVIORAL',
  'TECHNICAL',
  'DERIVED',
  'ANONYMOUS',
]);
export type DataCategory = z.infer<typeof DataCategorySchema>;

export const PIIFieldSchema = z.object({
  fieldPath: z.string().min(1), // e.g., 'user.email'
  category: DataCategorySchema,
  sensitivity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  required: z.boolean().default(false),
  minimisation: z.enum(['STRIP', 'HASH', 'AGGREGATE', 'RETAIN']).default('STRIP'),
  retentionDays: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
});

export type PIIField = z.infer<typeof PIIFieldSchema>;

export const MinimisationPolicySchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  jurisdiction: z.array(z.enum(['GDPR', 'CCPA', 'LGPD', 'OTHER'])).default(['GDPR']),
  fields: z.array(PIIFieldSchema),
  // Global settings
  stripUnknownFields: z.boolean().default(true),
  maxFieldDepth: z.number().int().positive().default(5),
  maxRecordSizeBytes: z.number().int().positive().default(1048576),
  createdAt: z.string().datetime(),
  effectiveAt: z.string().datetime().optional(),
});

export type MinimisationPolicy = z.infer<typeof MinimisationPolicySchema>;

export const MinimisationResultSchema = z.object({
  originalSize: z.number().int().nonnegative(),
  minimisedSize: z.number().int().nonnegative(),
  fieldsStripped: z.number().int().nonnegative(),
  fieldsHashed: z.number().int().nonnegative(),
  fieldsAggregated: z.number().int().nonnegative(),
  piiDetected: z.number().int().nonnegative(),
  violations: z.array(z.object({
    fieldPath: z.string(),
    reason: z.string(),
    severity: z.enum(['WARNING', 'ERROR', 'CRITICAL']),
  })).default([]),
  isCompliant: z.boolean(),
});

export type MinimisationResult = z.infer<typeof MinimisationResultSchema>;

export interface DataMinimiser {
  loadPolicy(policy: MinimisationPolicy): void;
  getActivePolicy(): MinimisationPolicy | undefined;
  minimise(data: Record<string, unknown>, policyName?: string): Record<string, unknown>;
  minimiseBatch(data: Record<string, unknown>[], policyName?: string): MinimisationResult[];
  analyse(data: Record<string, unknown>): MinimisationResult;
  addPolicyField(policyName: string, field: PIIField): void;
  removePolicyField(policyName: string, fieldPath: string): void;
  listPolicies(): string[];
}

// ─── Field Stripping & Hashing ────────────────────────────────────────────────

function stripField(data: Record<string, unknown>, path: string): void {
  const parts = path.split('.');
  let current: any = data;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!current || typeof current !== 'object') return;
    current = current[parts[i]!];
  }

  if (current && typeof current === 'object') {
    delete current[parts[parts.length - 1]!];
  }
}

function hashField(data: Record<string, unknown>, path: string): void {
  const parts = path.split('.');
  let current: any = data;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!current || typeof current !== 'object') return;
    current = current[parts[i]!];
  }

  const fieldName = parts[parts.length - 1]!;
  if (current && fieldName in current) {
    const value = current[fieldName];
    if (typeof value === 'string') {
      // Simple hash for demonstration
      let hash = 0;
      for (let i = 0; i < value.length; i++) {
        const char = value.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      current[fieldName] = `hashed_${Math.abs(hash).toString(16)}`;
    }
  }
}

function detectPII(data: Record<string, unknown>, prefix: string = ''): PIIField[] {
  const piiFields: PIIField[] = [];
  const piiIndicators = [
    'email', 'mail', 'address', 'phone', 'mobile', 'telephone',
    'name', 'firstname', 'lastname', 'fullname',
    'ssn', 'social', 'nationalid', 'passport',
    'birth', 'dob', 'dateofbirth',
    'credit', 'card', 'bank', 'account', 'iban',
    'ip', 'ipaddress', 'mac', 'deviceid', 'fingerprint',
    'location', 'lat', 'lon', 'coordinate',
    'gender', 'race', 'ethnicity', 'religion',
  ];

  for (const [key, value] of Object.entries(data)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      piiFields.push(...detectPII(value as Record<string, unknown>, fieldPath));
    } else {
      const lowerKey = key.toLowerCase();
      if (piiIndicators.some(indicator => lowerKey.includes(indicator))) {
        piiFields.push({
          fieldPath,
          category: 'PERSONAL_IDENTIFYING' as DataCategory,
          sensitivity: 'MEDIUM',
          required: false,
          minimisation: 'STRIP',
          description: `Potential PII field: ${key}`,
        });
      }
    }
  }

  return piiFields;
}

// ─── Data Minimiser Implementation ────────────────────────────────────────────

export class DataMinimiserImpl implements DataMinimiser {
  private policies = new Map<string, MinimisationPolicy>();
  private activePolicyName: string | null = null;

  loadPolicy(policy: MinimisationPolicy): void {
    this.policies.set(policy.name, policy);
    if (!this.activePolicyName) {
      this.activePolicyName = policy.name;
    }
  }

  getActivePolicy(): MinimisationPolicy | undefined {
    if (!this.activePolicyName) return undefined;
    return this.policies.get(this.activePolicyName);
  }

  minimise(data: Record<string, unknown>, policyName?: string): Record<string, unknown> {
    const policy = policyName
      ? this.policies.get(policyName)
      : this.getActivePolicy();

    if (!policy) {
      // No policy configured — return data as-is
      return data;
    }

    const result = JSON.parse(JSON.stringify(data)); // Deep clone
    this.applyPolicy(result, policy);
    return result;
  }

  minimiseBatch(
    data: Record<string, unknown>[],
    policyName?: string
  ): MinimisationResult[] {
    return data.map(d => this.analyse(d, policyName));
  }

  analyse(data: Record<string, unknown>, policyName?: string): MinimisationResult {
    const policy = policyName
      ? this.policies.get(policyName)
      : this.getActivePolicy();

    const original = JSON.stringify(data);
    const originalSize = original.length;
    const violations: MinimisationResult['violations'] = [];

    // Detect PII
    const detectedPII = detectPII(data);
    let fieldsStripped = 0;
    let fieldsHashed = 0;
    let fieldsAggregated = 0;

    // Apply policy if available
    if (policy) {
      for (const field of policy.fields) {
        const value = this.getNestedValue(data, field.fieldPath);

        // Check for violations
        if (field.required && value === undefined || value === null) {
          violations.push({
            fieldPath: field.fieldPath,
            reason: `Required field '${field.fieldPath}' is missing`,
            severity: 'ERROR',
          });
        }

        // Apply minimisation
        if (value !== undefined && value !== null) {
          switch (field.minimisation) {
            case 'STRIP':
              stripField(data, field.fieldPath);
              fieldsStripped++;
              break;
            case 'HASH':
              hashField(data, field.fieldPath);
              fieldsHashed++;
              break;
            case 'AGGREGATE':
              // Simplified: just mark as aggregated
              fieldsAggregated++;
              break;
            case 'RETAIN':
              // Keep as-is
              break;
          }
        }
      }

      // Strip unknown fields if configured
      if (policy.stripUnknownFields) {
        const policyFieldPaths = new Set(policy.fields.map(f => f.fieldPath));
        this.stripUnknownFields(data, '', policyFieldPaths);
      }
    }

    // Run PII detection on minimised data
    const minimisedPII = detectPII(data);
    const piiDetected = minimisedPII.length;

    // Check for remaining PII if policy exists
    if (policy) {
      for (const field of minimisedPII) {
        const policyField = policy.fields.find(f => f.fieldPath === field.fieldPath);
        if (!policyField || policyField.minimisation === 'STRIP') {
          violations.push({
            fieldPath: field.fieldPath,
            reason: `PII field '${field.fieldPath}' not properly minimised`,
            severity: 'WARNING',
          });
        }
      }
    }

    const minimisedSize = JSON.stringify(data).length;

    return {
      originalSize,
      minimisedSize,
      fieldsStripped,
      fieldsHashed,
      fieldsAggregated,
      piiDetected,
      violations: violations.filter(v => v.severity !== 'WARNING').length > 0 ? violations : [],
      isCompliant: violations.filter(v => v.severity === 'ERROR' || v.severity === 'CRITICAL').length === 0,
    };
  }

  addPolicyField(policyName: string, field: PIIField): void {
    const policy = this.policies.get(policyName);
    if (!policy) throw new Error(`Policy '${policyName}' not found`);

    const existingIndex = policy.fields.findIndex(f => f.fieldPath === field.fieldPath);
    if (existingIndex >= 0) {
      policy.fields[existingIndex] = field;
    } else {
      policy.fields.push(field);
    }
  }

  removePolicyField(policyName: string, fieldPath: string): void {
    const policy = this.policies.get(policyName);
    if (!policy) throw new Error(`Policy '${policyName}' not found`);

    policy.fields = policy.fields.filter(f => f.fieldPath !== fieldPath);
  }

  listPolicies(): string[] {
    return Array.from(this.policies.keys());
  }

  private applyPolicy(data: Record<string, unknown>, policy: MinimisationPolicy): void {
    for (const field of policy.fields) {
      const value = this.getNestedValue(data, field.fieldPath);
      if (value === undefined || value === null) continue;

      switch (field.minimisation) {
        case 'STRIP':
          stripField(data, field.fieldPath);
          break;
        case 'HASH':
          hashField(data, field.fieldPath);
          break;
        case 'AGGREGATE':
          // Simplified: mark as aggregated
          break;
        case 'RETAIN':
          // Keep as-is
          break;
      }
    }

    if (policy.stripUnknownFields) {
      const policyFieldPaths = new Set(policy.fields.map(f => f.fieldPath));
      this.stripUnknownFields(data, '', policyFieldPaths);
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

  private stripUnknownFields(
    data: Record<string, unknown>,
    prefix: string,
    allowedPaths: Set<string>
  ): void {
    for (const [key, value] of Object.entries(data)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.stripUnknownFields(value as Record<string, unknown>, fieldPath, allowedPaths);
      } else if (!allowedPaths.has(fieldPath) && !allowedPaths.has('*')) {
        delete data[key];
      }
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _minimiser: DataMinimiser | null = null;

export function getDataMinimiser(): DataMinimiser {
  if (!_minimiser) {
    _minimiser = new DataMinimiserImpl();
    // Load default GDPR policy
    _minimiser.loadPolicy({
      name: 'gdpr-minimal',
      version: '1.0',
      description: 'GDPR data minimisation policy',
      jurisdiction: ['GDPR'],
      fields: [
        { fieldPath: 'user.email', category: 'PERSONAL_IDENTIFYING', sensitivity: 'HIGH', required: false, minimisation: 'HASH' },
        { fieldPath: 'user.phone', category: 'PERSONAL_IDENTIFYING', sensitivity: 'HIGH', required: false, minimisation: 'STRIP' },
        { fieldPath: 'user.address', category: 'PERSONAL_IDENTIFYING', sensitivity: 'HIGH', required: false, minimisation: 'STRIP' },
        { fieldPath: 'user.ipAddress', category: 'TECHNICAL', sensitivity: 'MEDIUM', required: false, minimisation: 'STRIP' },
        { fieldPath: 'device.id', category: 'TECHNICAL', sensitivity: 'MEDIUM', required: false, minimisation: 'HASH' },
      ],
      stripUnknownFields: true,
      maxFieldDepth: 5,
      maxRecordSizeBytes: 1048576,
      createdAt: new Date().toISOString(),
      effectiveAt: new Date().toISOString(),
    });
  }
  return _minimiser;
}

export function setDataMinimiser(minimiser: DataMinimiser): void {
  _minimiser = minimiser;
}
