import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAuditLog, getAuditLog, setAuditLog, type AuditEntry, type CreateAuditEntryInput } from './index';

describe('InMemoryAuditLog', () => {
  let auditLog: InMemoryAuditLog;

  beforeEach(() => {
    auditLog = new InMemoryAuditLog();
  });

  it('should append an audit entry', () => {
    const input: CreateAuditEntryInput = {
      sessionId: 'session-123',
      policyId: 'policy-456',
      outcome: 'PASS',
      confidence: 0.85,
      evidenceHash: 'abc123',
      evidenceCount: 5,
      evidenceTypes: ['E-INTERACTION', 'E-VISIBLE'],
      policyVersion: 1,
      passedChecks: ['evidence_present', 'fraud_below_threshold'],
      failedChecks: [],
      warnings: [],
    };

    const entry = auditLog.append(input);

    expect(entry).toBeDefined();
    expect(entry.sessionId).toBe('session-123');
    expect(entry.policyId).toBe('policy-456');
    expect(entry.outcome).toBe('PASS');
    expect(entry.confidence).toBe(0.85);
    expect(entry.evidenceHash).toBe('abc123');
    expect(entry.entryId).toMatch(/^audit_\d+_[a-z0-9]+$/);
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(entry.entryHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should maintain chain integrity with previousHash', () => {
    const input1: CreateAuditEntryInput = {
      sessionId: 'session-1',
      policyId: 'policy-1',
      outcome: 'PASS',
      confidence: 0.8,
      evidenceHash: 'hash1',
      evidenceCount: 3,
      evidenceTypes: ['E-INTERACTION'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: [],
      warnings: [],
    };

    const input2: CreateAuditEntryInput = {
      sessionId: 'session-2',
      policyId: 'policy-1',
      outcome: 'FAIL',
      confidence: 0.2,
      evidenceHash: 'hash2',
      evidenceCount: 1,
      evidenceTypes: ['E-VISIBLE'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: ['insufficient_evidence'],
      warnings: [],
    };

    const entry1 = auditLog.append(input1);
    const entry2 = auditLog.append(input2);

    expect(entry1.previousHash).toBe('');
    expect(entry2.previousHash).toBe(entry1.entryHash);
  });

  it('should get an entry by ID', () => {
    const input: CreateAuditEntryInput = {
      sessionId: 'session-get',
      policyId: 'policy-get',
      outcome: 'INCONCLUSIVE',
      confidence: 0.5,
      evidenceHash: 'get-hash',
      evidenceCount: 2,
      evidenceTypes: ['E-INTERACTION'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: [],
      warnings: [],
    };

    const entry = auditLog.append(input);
    const retrieved = auditLog.get(entry.entryId);

    expect(retrieved).toEqual(entry);
  });

  it('should return undefined for non-existent entry', () => {
    const retrieved = auditLog.get('non-existent-id');
    expect(retrieved).toBeUndefined();
  });

  it('should query entries by sessionId', () => {
    const input1: CreateAuditEntryInput = {
      sessionId: 'query-session',
      policyId: 'policy-a',
      outcome: 'PASS',
      confidence: 0.9,
      evidenceHash: 'h1',
      evidenceCount: 3,
      evidenceTypes: ['E-INTERACTION'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: [],
      warnings: [],
    };

    const input2: CreateAuditEntryInput = {
      sessionId: 'other-session',
      policyId: 'policy-b',
      outcome: 'FAIL',
      confidence: 0.1,
      evidenceHash: 'h2',
      evidenceCount: 1,
      evidenceTypes: ['E-VISIBLE'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: ['low_confidence'],
      warnings: [],
    };

    auditLog.append(input1);
    auditLog.append(input2);

    const results = auditLog.query({ sessionId: 'query-session' });
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe('query-session');
  });

  it('should query entries by policyId', () => {
    const input: CreateAuditEntryInput = {
      sessionId: 'policy-query',
      policyId: 'specific-policy',
      outcome: 'PASS',
      confidence: 0.75,
      evidenceHash: 'policy-hash',
      evidenceCount: 4,
      evidenceTypes: ['E-INTERACTION', 'E-VISIBLE'],
      policyVersion: 2,
      passedChecks: [],
      failedChecks: [],
      warnings: [],
    };

    auditLog.append(input);

    const results = auditLog.query({ policyId: 'specific-policy' });
    expect(results).toHaveLength(1);
    expect(results[0].policyId).toBe('specific-policy');
  });

  it('should query entries by outcome', () => {
    auditLog.append({
      sessionId: 's1',
      policyId: 'p1',
      outcome: 'PASS',
      confidence: 0.9,
      evidenceHash: 'h1',
      evidenceCount: 3,
      evidenceTypes: ['E-INTERACTION'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: [],
      warnings: [],
    });

    auditLog.append({
      sessionId: 's2',
      policyId: 'p1',
      outcome: 'FAIL',
      confidence: 0.2,
      evidenceHash: 'h2',
      evidenceCount: 1,
      evidenceTypes: ['E-VISIBLE'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: ['low_confidence'],
      warnings: [],
    });

    const passResults = auditLog.query({ outcome: 'PASS' });
    const failResults = auditLog.query({ outcome: 'FAIL' });

    expect(passResults).toHaveLength(1);
    expect(failResults).toHaveLength(1);
  });

  it('should compute correct stats', () => {
    auditLog.append({
      sessionId: 'stats-s1',
      policyId: 'p1',
      outcome: 'PASS',
      confidence: 0.9,
      evidenceHash: 'h1',
      evidenceCount: 3,
      evidenceTypes: ['E-INTERACTION'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: [],
      warnings: [],
    });

    auditLog.append({
      sessionId: 'stats-s2',
      policyId: 'p1',
      outcome: 'FAIL',
      confidence: 0.2,
      evidenceHash: 'h2',
      evidenceCount: 1,
      evidenceTypes: ['E-VISIBLE'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: ['low_confidence'],
      warnings: [],
    });

    auditLog.append({
      sessionId: 'stats-s3',
      policyId: 'p1',
      outcome: 'INCONCLUSIVE',
      confidence: 0.5,
      evidenceHash: 'h3',
      evidenceCount: 2,
      evidenceTypes: ['E-INTERACTION', 'E-VISIBLE'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: [],
      warnings: ['manual_review_needed'],
    });

    const stats = auditLog.getStats();

    expect(stats.totalEntries).toBe(3);
    expect(stats.byOutcome.PASS).toBe(1);
    expect(stats.byOutcome.FAIL).toBe(1);
    expect(stats.byOutcome.INCONCLUSIVE).toBe(1);
    expect(stats.avgConfidence).toBeCloseTo(0.5333, 3);
    expect(stats.timeRange).not.toBeNull();
  });

  it('should verify chain integrity', () => {
    auditLog.append({
      sessionId: 'chain-1',
      policyId: 'p1',
      outcome: 'PASS',
      confidence: 0.8,
      evidenceHash: 'h1',
      evidenceCount: 2,
      evidenceTypes: ['E-INTERACTION'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: [],
      warnings: [],
    });

    auditLog.append({
      sessionId: 'chain-2',
      policyId: 'p1',
      outcome: 'PASS',
      confidence: 0.7,
      evidenceHash: 'h2',
      evidenceCount: 3,
      evidenceTypes: ['E-INTERACTION', 'E-VISIBLE'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: [],
      warnings: [],
    });

    const verification = auditLog.verifyChain();

    expect(verification.valid).toBe(true);
    expect(verification.totalChecked).toBe(2);
    expect(verification.firstEntryHash).toBeDefined();
    expect(verification.lastEntryHash).toBeDefined();
  });

  it('should detect broken chain', () => {
    const entry1 = auditLog.append({
      sessionId: 'break-1',
      policyId: 'p1',
      outcome: 'PASS',
      confidence: 0.8,
      evidenceHash: 'h1',
      evidenceCount: 2,
      evidenceTypes: ['E-INTERACTION'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: [],
      warnings: [],
    });

    const entry2 = auditLog.append({
      sessionId: 'break-2',
      policyId: 'p1',
      outcome: 'PASS',
      confidence: 0.7,
      evidenceHash: 'h2',
      evidenceCount: 3,
      evidenceTypes: ['E-INTERACTION'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: [],
      warnings: [],
    });

    // Tamper with the chain by modifying the second entry's previousHash
    (entry2 as any).previousHash = 'tampered-hash';

    const verification = auditLog.verifyChain();

    expect(verification.valid).toBe(false);
    expect(verification.brokenAt).toBe(1);
  });

  it('should get chain head', () => {
    auditLog.append({
      sessionId: 'head-1',
      policyId: 'p1',
      outcome: 'PASS',
      confidence: 0.8,
      evidenceHash: 'h1',
      evidenceCount: 2,
      evidenceTypes: ['E-INTERACTION'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: [],
      warnings: [],
    });

    const head = auditLog.getChainHead();
    expect(head).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should export range', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    auditLog.append({
      sessionId: 'range-1',
      policyId: 'p1',
      outcome: 'PASS',
      confidence: 0.8,
      evidenceHash: 'h1',
      evidenceCount: 2,
      evidenceTypes: ['E-INTERACTION'],
      policyVersion: 1,
      passedChecks: [],
      failedChecks: [],
      warnings: [],
    });

    const results = auditLog.exportRange(yesterday, tomorrow);
    expect(results).toHaveLength(1);
  });
});

describe('AuditLog Factory', () => {
  it('should return singleton instance', () => {
    const log1 = getAuditLog();
    const log2 = getAuditLog();
    expect(log1).toBe(log2);
  });

  it('should allow setting custom implementation', () => {
    const customLog = new InMemoryAuditLog();
    setAuditLog(customLog);
    expect(getAuditLog()).toBe(customLog);
  });
});