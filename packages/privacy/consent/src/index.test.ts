/**
 * Consent Management Tests (VAE Sprint 15)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getConsentManager, type ConsentManager } from './index';
import type { ConsentType, ConsentRecord } from './index';

describe('Consent Management', () => {
  let manager: ConsentManager;

  beforeEach(() => {
    vi.resetModules();
    manager = getConsentManager();
  });

  it('records consent', () => {
    const record = manager.recordConsent({
      sessionId: 'sess-1',
      userId: 'user-1',
      type: 'ANALYTICS' as ConsentType,
      status: 'GRANTED',
      ipAddress: '192.168.1.1',
      consentMethod: 'WEB_FORM',
    });

    expect(record.id).toMatch(/^consent_/);
    expect(record.sessionId).toBe('sess-1');
    expect(record.userId).toBe('user-1');
    expect(record.type).toBe('ANALYTICS');
    expect(record.status).toBe('GRANTED');
    expect(record.timestamp).toBeDefined();
  });

  it('checks if consent exists', () => {
    manager.recordConsent({
      sessionId: 'sess-1',
      userId: 'user-1',
      type: 'ANALYTICS' as ConsentType,
      status: 'GRANTED',
      consentMethod: 'WEB_FORM',
    });

    expect(manager.hasConsent('sess-1', 'ANALYTICS')).toBe(true);
    expect(manager.hasConsent('sess-1', 'ADVERTISING')).toBe(false);
  });

  it('withdraws consent', () => {
    manager.recordConsent({
      sessionId: 'sess-1',
      userId: 'user-1',
      type: 'ANALYTICS' as ConsentType,
      status: 'GRANTED',
      consentMethod: 'WEB_FORM',
    });

    const withdrawn = manager.withdrawConsent('sess-1', 'ANALYTICS', 'User requested withdrawal');
    expect(withdrawn).toBeDefined();
    expect(withdrawn?.status).toBe('WITHDRAWN');
    expect(withdrawn?.withdrawalReason).toBe('User requested withdrawal');
  });

  it('returns undefined when withdrawing non-existent consent', () => {
    const withdrawn = manager.withdrawConsent('nonexistent', 'ANALYTICS');
    expect(withdrawn).toBeUndefined();
  });

  it('gets consent by session', () => {
    manager.recordConsent({
      sessionId: 'sess-1',
      userId: 'user-1',
      type: 'ANALYTICS' as ConsentType,
      status: 'GRANTED',
      consentMethod: 'WEB_FORM',
    });

    const result = manager.getConsentBySession('sess-1');
    expect(result.records).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.granted).toBe(1);
  });

  it('gets consent by user', () => {
    manager.recordConsent({
      sessionId: 'sess-1',
      userId: 'user-1',
      type: 'ANALYTICS' as ConsentType,
      status: 'GRANTED',
      consentMethod: 'WEB_FORM',
    });
    manager.recordConsent({
      sessionId: 'sess-2',
      userId: 'user-1',
      type: 'ADVERTISING' as ConsentType,
      status: 'DENIED',
      consentMethod: 'WEB_FORM',
    });

    const result = manager.getConsentByUser('user-1');
    expect(result.total).toBe(2);
    expect(result.granted).toBe(1);
    expect(result.denied).toBe(1);
  });

  it('gets all consent with filtering', () => {
    manager.recordConsent({
      sessionId: 'sess-1',
      userId: 'user-1',
      type: 'ANALYTICS' as ConsentType,
      status: 'GRANTED',
      consentMethod: 'WEB_FORM',
    });
    manager.recordConsent({
      sessionId: 'sess-2',
      userId: 'user-2',
      type: 'ANALYTICS' as ConsentType,
      status: 'DENIED',
      consentMethod: 'WEB_FORM',
    });

    const result = manager.getAllConsent({ status: 'GRANTED' });
    expect(result.total).toBe(1);
    expect(result.granted).toBe(1);
  });

  it('filters by consent type', () => {
    manager.recordConsent({
      sessionId: 'sess-1',
      userId: 'user-1',
      type: 'ANALYTICS' as ConsentType,
      status: 'GRANTED',
      consentMethod: 'WEB_FORM',
    });
    manager.recordConsent({
      sessionId: 'sess-2',
      userId: 'user-1',
      type: 'ADVERTISING' as ConsentType,
      status: 'GRANTED',
      consentMethod: 'WEB_FORM',
    });

    const result = manager.getAllConsent({ type: 'ANALYTICS' });
    expect(result.total).toBe(1);
    expect(result.records[0].type).toBe('ANALYTICS');
  });

  it('checks any consent for session', () => {
    manager.recordConsent({
      sessionId: 'sess-1',
      userId: 'user-1',
      type: 'ANALYTICS' as ConsentType,
      status: 'GRANTED',
      consentMethod: 'WEB_FORM',
    });

    expect(manager.hasAnyConsent('sess-1', ['ANALYTICS', 'ADVERTISING'])).toBe(true);
    expect(manager.hasAnyConsent('sess-1', ['ADVERTISING'])).toBe(false);
  });

  it('gets consent stats', () => {
    manager.recordConsent({
      sessionId: 'sess-1',
      userId: 'user-1',
      type: 'ANALYTICS' as ConsentType,
      status: 'GRANTED',
      consentMethod: 'WEB_FORM',
    });
    manager.recordConsent({
      sessionId: 'sess-2',
      userId: 'user-2',
      type: 'ANALYTICS' as ConsentType,
      status: 'DENIED',
      consentMethod: 'WEB_FORM',
    });

    const stats = manager.getConsentStats();
    expect(stats.totalRecords).toBe(2);
    expect(stats.grantedCount).toBe(1);
    expect(stats.deniedCount).toBe(1);
    expect(stats.byType.ANALYTICS).toBeDefined();
  });

  it('returns empty results for non-existent session', () => {
    const result = manager.getConsentBySession('nonexistent');
    expect(result.total).toBe(0);
    expect(result.records).toHaveLength(0);
  });

  it('consent record has correct structure', () => {
    const record = manager.recordConsent({
      sessionId: 'sess-1',
      userId: 'user-1',
      type: 'ANALYTICS' as ConsentType,
      status: 'GRANTED',
      consentMethod: 'WEB_FORM',
    });

    expect(record).toHaveProperty('id');
    expect(record).toHaveProperty('sessionId');
    expect(record).toHaveProperty('userId');
    expect(record).toHaveProperty('type');
    expect(record).toHaveProperty('status');
    expect(record).toHaveProperty('timestamp');
    expect(record).toHaveProperty('consentMethod');
  });

  it('multiple consents for same session/type return latest', () => {
    manager.recordConsent({
      sessionId: 'sess-1',
      userId: 'user-1',
      type: 'ANALYTICS' as ConsentType,
      status: 'GRANTED',
      consentMethod: 'WEB_FORM',
    });

    // Wait a tiny bit to ensure different timestamp
    setTimeout(() => {}, 1);

    manager.recordConsent({
      sessionId: 'sess-1',
      userId: 'user-1',
      type: 'ANALYTICS' as ConsentType,
      status: 'DENIED',
      consentMethod: 'WEB_FORM',
    });

    const consent = manager.getConsent('sess-1', 'ANALYTICS');
    expect(consent?.status).toBe('DENIED');
  });
});

describe('Consent Management - Consent Types', () => {
  it('supports all consent types', () => {
    const types = ['ANALYTICS', 'PERSONALIZATION', 'ADVERTISING', 'DATA_SHARING', 'RESEARCH', 'MARKETING', 'ESSENTIAL'];
    const manager = getConsentManager();

    for (const type of types) {
      manager.recordConsent({
        sessionId: 'sess-1',
        userId: 'user-1',
        type: type as ConsentType,
        status: 'GRANTED',
        consentMethod: 'WEB_FORM',
      });
    }

    const result = manager.getConsentByUser('user-1');
    expect(result.total).toBe(7);
  });
});
