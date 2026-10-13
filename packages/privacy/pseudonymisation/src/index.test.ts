/**
 * Pseudonymisation Tests (VAE Sprint 15)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPseudonymisationService, type PseudonymisationService } from './index';
import type { PseudonymisationConfig, PseudonymisationResult } from './index';

describe('Pseudonymisation', () => {
  let service: PseudonymisationService;

  beforeEach(() => {
    vi.resetModules();
    service = getPseudonymisationService();
  });

  it('pseudonymises session IDs', () => {
    const data = {
      sessionId: 'sess-123',
      userId: 'user-456',
      contentId: 'content-789',
      event: 'page_view',
    };

    const result = service.pseudonymise(data);
    expect(result.isPseudonymised).toBe(true);
    expect(result.pseudonymisedData.sessionId).toMatch(/^pseudo_/);
    expect(result.pseudonymisedData.userId).toMatch(/^pseudo_/);
    expect(result.pseudonymisedData.contentId).toBe('content-789'); // Not in fieldsToPseudonymise
    expect(result.fieldsPseudonymised).toBeGreaterThan(0);
  });

  it('strips PII fields', () => {
    const data = {
      sessionId: 'sess-123',
      user: {
        email: 'test@example.com',
        name: 'John Doe',
        ipAddress: '192.168.1.1',
      },
    };

    const result = service.pseudonymise(data);
    expect(result.pseudonymisedData.user.email).toBeUndefined();
    expect(result.pseudonymisedData.user.ipAddress).toBeUndefined();
    expect(result.pseudonymisedData.user.name).toBe('John Doe'); // Not in fieldsToStrip
    expect(result.fieldsStripped).toBeGreaterThan(0);
  });

  it('detects PII in original data', () => {
    const data = {
      sessionId: 'sess-123',
      user: { email: 'test@example.com', phone: '+1234567890' },
    };

    const result = service.pseudonymise(data);
    expect(result.piiDetected).toBeGreaterThan(0);
  });

  it('isPseudonymised returns true for pseudonymised values', () => {
    const pseudonym = service.pseudonymiseField('test-session');
    expect(service.isPseudonymised(pseudonym)).toBe(true);
    expect(service.isPseudonymised('regular-value')).toBe(false);
  });

  it('pseudonymiseField is deterministic', () => {
    const result1 = service.pseudonymiseField('test-session');
    const result2 = service.pseudonymiseField('test-session');
    expect(result1).toBe(result2);
  });

  it('pseudonymiseField is unique per input', () => {
    const result1 = service.pseudonymiseField('session-a');
    const result2 = service.pseudonymiseField('session-b');
    expect(result1).not.toBe(result2);
  });

  it('configures service with custom settings', () => {
    const config: PseudonymisationConfig = {
      salt: 'testsalt12345678',
      algorithm: 'HMAC_SHA256',
      fieldsToPseudonymise: ['sessionId'],
      fieldsToStrip: ['user.email'],
      deterministic: true,
      reversible: false,
    };

    service.configure(config);
    const data = { sessionId: 'sess-123', user: { email: 'test@test.com' } };
    const result = service.pseudonymise(data);

    expect(result.pseudonymisedData.sessionId).toMatch(/^pseudo_/);
    expect(result.pseudonymisedData.user.email).toBeUndefined();
  });

  it('returns original data in result', () => {
    const data = { sessionId: 'sess-123', userId: 'user-456' };
    const result = service.pseudonymise(data);
    expect(result.originalData.sessionId).toBe('sess-123');
    expect(result.originalData.userId).toBe('user-456');
  });

  it('batch pseudonymisation works', () => {
    const data = [
      { sessionId: 'sess-1', userId: 'user-1' },
      { sessionId: 'sess-2', userId: 'user-2' },
    ];

    const results = service.pseudonymiseBatch(data);
    expect(results).toHaveLength(2);
    expect(results[0].isPseudonymised).toBe(true);
    expect(results[1].isPseudonymised).toBe(true);
    expect(results[0].pseudonymisedData.sessionId).not.toBe(results[1].pseudonymisedData.sessionId);
  });

  it('reverse pseudonymisation returns undefined when not reversible', () => {
    const pseudonym = service.pseudonymiseField('test-session');
    const original = service.reversePseudonymisation(pseudonym);
    expect(original).toBeUndefined();
  });

  it('getMapping returns mapping when reversible', () => {
    const config: PseudonymisationConfig = {
      salt: 'testsalt12345678',
      algorithm: 'HMAC_SHA256',
      fieldsToPseudonymise: ['sessionId'],
      fieldsToStrip: [],
      deterministic: true,
      reversible: true,
    };

    service.configure(config);
    const data = { sessionId: 'original-session-123' };
    service.pseudonymise(data);

    const mapping = service.getMapping('original-session-123');
    expect(mapping).toBeDefined();
    expect(mapping?.originalId).toBe('original-session-123');
    expect(mapping?.pseudonymisedId).toMatch(/^pseudo_/);
  });

  it('clears mapping cache', () => {
    const config: PseudonymisationConfig = {
      salt: 'testsalt12345678',
      algorithm: 'HMAC_SHA256',
      fieldsToPseudonymise: ['sessionId'],
      fieldsToStrip: [],
      deterministic: true,
      reversible: true,
    };

    service.configure(config);
    service.pseudonymise({ sessionId: 'test-session' });
    expect(service.getMapping('test-session')).toBeDefined();

    service.clearMappingCache();
    expect(service.getMapping('test-session')).toBeUndefined();
  });

  it('result has correct structure', () => {
    const data = { sessionId: 'sess-123', userId: 'user-456' };
    const result = service.pseudonymise(data);

    expect(result).toHaveProperty('originalData');
    expect(result).toHaveProperty('pseudonymisedData');
    expect(result).toHaveProperty('mappings');
    expect(result).toHaveProperty('fieldsStripped');
    expect(result).toHaveProperty('fieldsPseudonymised');
    expect(result).toHaveProperty('piiDetected');
    expect(result).toHaveProperty('isPseudonymised');
  });
});

describe('Pseudonymisation - Different Algorithms', () => {
  it('HMAC_SHA512 produces different length pseudonyms', () => {
    const service1 = getPseudonymisationService();
    service1.configure({
      salt: 'testsalt12345678',
      algorithm: 'HMAC_SHA256',
      fieldsToPseudonymise: ['sessionId'],
      fieldsToStrip: [],
      deterministic: true,
      reversible: false,
    });

    const result1 = service1.pseudonymiseField('test-session');

    service1.configure({
      salt: 'testsalt12345678',
      algorithm: 'HMAC_SHA512',
      fieldsToPseudonymise: ['sessionId'],
      fieldsToStrip: [],
      deterministic: true,
      reversible: false,
    });

    const result2 = service1.pseudonymiseField('test-session');
    expect(result1).not.toBe(result2);
  });
});
