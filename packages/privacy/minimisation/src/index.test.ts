/**
 * Data Minimisation Tests (VAE Sprint 15)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDataMinimiser, type DataMinimiser } from './index';
import type { MinimisationPolicy, PIIField } from './index';

describe('Data Minimisation', () => {
  let minimiser: DataMinimiser;

  beforeEach(() => {
    vi.resetModules();
    minimiser = getDataMinimiser();
  });

  it('loads a policy and minimises data', () => {
    const policy: MinimisationPolicy = {
      name: 'test-policy',
      version: '1.0',
      description: 'Test policy',
      jurisdiction: ['GDPR'],
      fields: [
        { fieldPath: 'user.email', category: 'PERSONAL_IDENTIFYING', sensitivity: 'HIGH', required: false, minimisation: 'STRIP' },
        { fieldPath: 'user.phone', category: 'PERSONAL_IDENTIFYING', sensitivity: 'HIGH', required: false, minimisation: 'STRIP' },
      ],
      stripUnknownFields: false,
      maxFieldDepth: 5,
      maxRecordSizeBytes: 1048576,
      createdAt: new Date().toISOString(),
    };

    minimiser.loadPolicy(policy);
    const result = minimiser.minimise({
      user: { email: 'test@example.com', phone: '+1234567890', name: 'John' },
      content: 'Hello world',
    });

    expect(result.user.email).toBeUndefined();
    expect(result.user.phone).toBeUndefined();
    expect(result.user.name).toBe('John');
    expect(result.content).toBe('Hello world');
  });

  it('returns original data when no policy is loaded', () => {
    const data = { user: { email: 'test@example.com' }, content: 'Hello' };
    const result = minimiser.minimise(data);
    expect(result).toEqual(data);
  });

  it('analyses data and detects PII', () => {
    const data = {
      user: { email: 'test@example.com', phone: '+1234567890' },
      content: 'Hello world',
    };

    const result = minimiser.analyse(data);
    expect(result.piiDetected).toBeGreaterThan(0);
    expect(result.originalSize).toBeGreaterThan(0);
    expect(result.minimisedSize).toBeGreaterThan(0);
    expect(result.isCompliant).toBeDefined();
  });

  it('minimises batch of data', () => {
    const policy: MinimisationPolicy = {
      name: 'batch-policy',
      version: '1.0',
      jurisdiction: ['GDPR'],
      fields: [
        { fieldPath: 'user.email', category: 'PERSONAL_IDENTIFYING', sensitivity: 'HIGH', required: false, minimisation: 'STRIP' },
      ],
      stripUnknownFields: false,
      maxFieldDepth: 5,
      maxRecordSizeBytes: 1048576,
      createdAt: new Date().toISOString(),
    };

    minimiser.loadPolicy(policy);
    const data = [
      { user: { email: 'a@test.com' }, content: 'One' },
      { user: { email: 'b@test.com' }, content: 'Two' },
    ];

    const results = minimiser.minimiseBatch(data);
    expect(results).toHaveLength(2);
    expect(results[0].fieldsStripped).toBeGreaterThan(0);
    expect(results[1].fieldsStripped).toBeGreaterThan(0);
  });

  it('adds a policy field', () => {
    const policy: MinimisationPolicy = {
      name: 'editable-policy',
      version: '1.0',
      jurisdiction: ['GDPR'],
      fields: [
        { fieldPath: 'user.email', category: 'PERSONAL_IDENTIFYING', sensitivity: 'HIGH', required: false, minimisation: 'STRIP' },
      ],
      stripUnknownFields: false,
      maxFieldDepth: 5,
      maxRecordSizeBytes: 1048576,
      createdAt: new Date().toISOString(),
    };

    minimiser.loadPolicy(policy);
    const newField: PIIField = {
      fieldPath: 'user.phone',
      category: 'PERSONAL_IDENTIFYING',
      sensitivity: 'HIGH',
      required: false,
      minimisation: 'STRIP',
    };

    minimiser.addPolicyField('editable-policy', newField);
    const updatedPolicy = minimiser.getActivePolicy();
    expect(updatedPolicy?.fields).toHaveLength(2);
    expect(updatedPolicy?.fields[1].fieldPath).toBe('user.phone');
  });

  it('removes a policy field', () => {
    const policy: MinimisationPolicy = {
      name: 'removable-policy',
      version: '1.0',
      jurisdiction: ['GDPR'],
      fields: [
        { fieldPath: 'user.email', category: 'PERSONAL_IDENTIFYING', sensitivity: 'HIGH', required: false, minimisation: 'STRIP' },
        { fieldPath: 'user.phone', category: 'PERSONAL_IDENTIFYING', sensitivity: 'HIGH', required: false, minimisation: 'STRIP' },
      ],
      stripUnknownFields: false,
      maxFieldDepth: 5,
      maxRecordSizeBytes: 1048576,
      createdAt: new Date().toISOString(),
    };

    minimiser.loadPolicy(policy);
    minimiser.removePolicyField('removable-policy', 'user.phone');
    const updatedPolicy = minimiser.getActivePolicy();
    expect(updatedPolicy?.fields).toHaveLength(1);
    expect(updatedPolicy?.fields[0].fieldPath).toBe('user.email');
  });

  it('lists policies', () => {
    const policy1: MinimisationPolicy = {
      name: 'policy-1',
      version: '1.0',
      jurisdiction: ['GDPR'],
      fields: [],
      stripUnknownFields: false,
      maxFieldDepth: 5,
      maxRecordSizeBytes: 1048576,
      createdAt: new Date().toISOString(),
    };
    const policy2: MinimisationPolicy = {
      name: 'policy-2',
      version: '1.0',
      jurisdiction: ['GDPR'],
      fields: [],
      stripUnknownFields: false,
      maxFieldDepth: 5,
      maxRecordSizeBytes: 1048576,
      createdAt: new Date().toISOString(),
    };

    minimiser.loadPolicy(policy1);
    minimiser.loadPolicy(policy2);
    const policies = minimiser.listPolicies();
    expect(policies).toContain('policy-1');
    expect(policies).toContain('policy-2');
  });

  it('strips unknown fields when configured', () => {
    const policy: MinimisationPolicy = {
      name: 'strict-policy',
      version: '1.0',
      jurisdiction: ['GDPR'],
      fields: [
        { fieldPath: 'user.name', category: 'PERSONAL_IDENTIFYING', sensitivity: 'MEDIUM', required: true, minimisation: 'RETAIN' },
      ],
      stripUnknownFields: true,
      maxFieldDepth: 5,
      maxRecordSizeBytes: 1048576,
      createdAt: new Date().toISOString(),
    };

    minimiser.loadPolicy(policy);
    const result = minimiser.minimise({
      user: { name: 'John', email: 'john@test.com', phone: '+123' },
      extraField: 'should be removed',
    });

    expect(result.user.name).toBe('John');
    // Unknown fields at root should be stripped
    expect(result.extraField).toBeUndefined();
  });

  it('detects PII fields in nested objects', () => {
    const data = {
      user: {
        profile: {
          email: 'test@example.com',
          address: { street: '123 Main St', city: 'NYC' },
        },
      },
    };

    const result = minimiser.analyse(data);
    expect(result.piiDetected).toBeGreaterThan(0);
  });

  it('hash minimisation transforms field values', () => {
    const policy: MinimisationPolicy = {
      name: 'hash-policy',
      version: '1.0',
      jurisdiction: ['GDPR'],
      fields: [
        { fieldPath: 'user.email', category: 'PERSONAL_IDENTIFYING', sensitivity: 'HIGH', required: false, minimisation: 'HASH' },
      ],
      stripUnknownFields: false,
      maxFieldDepth: 5,
      maxRecordSizeBytes: 1048576,
      createdAt: new Date().toISOString(),
    };

    minimiser.loadPolicy(policy);
    const result = minimiser.minimise({
      user: { email: 'test@example.com' },
    });

    expect(result.user.email).toMatch(/^hashed_/);
    expect(result.user.email).not.toBe('test@example.com');
  });
});

describe('Data Minimisation - Default Policy', () => {
  it('has a default GDPR policy loaded', () => {
    const minimiser = getDataMinimiser();
    const policy = minimiser.getActivePolicy();
    expect(policy).toBeDefined();
    expect(policy?.name).toBe('gdpr-minimal');
    expect(policy?.jurisdiction).toContain('GDPR');
    expect(policy?.fields.length).toBeGreaterThan(0);
  });

  it('default policy has email hashing', () => {
    const minimiser = getDataMinimiser();
    const result = minimiser.minimise({
      user: { email: 'test@example.com' },
      sessionId: 'sess-123',
    });

    expect(result.user.email).toMatch(/^hashed_/);
    expect(result.sessionId).toBe('sess-123');
  });
});
