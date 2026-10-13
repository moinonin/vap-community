/**
 * Unit tests for Session model (VAP Section 6)
 * Tests session lifecycle, state machine, guards, and helpers
 */

import { describe, it, expect } from 'vitest';
import {
  SessionSchema,
  SessionStateSchema,
  SessionConfigSchema,
  SessionParticipantSchema,
  SessionEventType,
  createSession,
  addEvidenceToSession,
  transitionSessionState,
  isSessionExpired,
  sessionHeartbeat,
  type Session,
  type SessionState,
} from './session';
import { SessionState as SessionStateEnum } from './common';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const VALID_CONTENT_ID = 'urn:vap:content:article-12345';
const VALID_VIEWER_HASH = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

function makeSession(overrides: Partial<Session> = {}): Session {
  const now = new Date().toISOString();
  return {
    sessionId: 'urn:vap:session:550e8400-e29b-41d4-a716-446655440000',
    contentId: VALID_CONTENT_ID,
    participant: {
      viewerIdHash: VALID_VIEWER_HASH,
      consentId: 'consent-001',
      preferences: { theme: 'dark' },
    },
    config: {
      timeoutMs: 30 * 60 * 1000,
      requiredEvidenceTypes: ['E-INTERACTION', 'E-VISIBLE'],
      minConfidence: 0.7,
      maxDurationMs: 2 * 60 * 60 * 1000,
      allowedSources: ['browser-sdk-v1'],
    },
    state: 'CREATED' as SessionState,
    evidenceIds: [],
    claimIds: [],
    startedAt: now,
    lastActivityAt: now,
    ...overrides,
  };
}

// ─── SessionSchema ────────────────────────────────────────────────────────

describe('SessionSchema', () => {
  it('should validate complete session', () => {
    const session = makeSession();
    const result = SessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it('should reject missing sessionId', () => {
    const session = makeSession({ sessionId: '' });
    expect(SessionSchema.safeParse(session).success).toBe(false);
  });

  it('should reject missing participant', () => {
    const session = makeSession({ participant: { viewerIdHash: '' } });
    expect(SessionSchema.safeParse(session).success).toBe(false);
  });

  it('should accept session with optional fields', () => {
    const session = makeSession({
      proofId: 'urn:vap:proof:123',
      expiredAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      metadata: { source: 'test' },
    });
    expect(SessionSchema.safeParse(session).success).toBe(true);
  });
});

// ─── SessionStateSchema ────────────────────────────────────────────────────

describe('SessionStateSchema', () => {
  it('should validate CREATED', () => {
    expect(SessionStateSchema.safeParse('CREATED').success).toBe(true);
  });

  it('should validate ACTIVE', () => {
    expect(SessionStateSchema.safeParse('ACTIVE').success).toBe(true);
  });

  it('should validate EXPIRED', () => {
    expect(SessionStateSchema.safeParse('EXPIRED').success).toBe(true);
  });

  it('should validate VERIFIED', () => {
    expect(SessionStateSchema.safeParse('VERIFIED').success).toBe(true);
  });

  it('should validate CERTIFIED', () => {
    expect(SessionStateSchema.safeParse('CERTIFIED').success).toBe(true);
  });

  it('should validate CANCELLED', () => {
    expect(SessionStateSchema.safeParse('CANCELLED').success).toBe(true);
  });

  it('should reject invalid state', () => {
    expect(SessionStateSchema.safeParse('INVALID').success).toBe(false);
  });

  it('SessionState enum exports all 6 states', () => {
    expect(SessionStateEnum.CREATED).toBe('CREATED');
    expect(SessionStateEnum.ACTIVE).toBe('ACTIVE');
    expect(SessionStateEnum.EXPIRED).toBe('EXPIRED');
    expect(SessionStateEnum.VERIFIED).toBe('VERIFIED');
    expect(SessionStateEnum.CERTIFIED).toBe('CERTIFIED');
    expect(SessionStateEnum.CANCELLED).toBe('CANCELLED');
  });
});

// ─── SessionConfigSchema ───────────────────────────────────────────────────

describe('SessionConfigSchema', () => {
  it('should validate complete config', () => {
    const config = {
      timeoutMs: 30 * 60 * 1000,
      requiredEvidenceTypes: ['E-INTERACTION'],
      minConfidence: 0.8,
      maxDurationMs: 3600000,
      allowedSources: ['sdk-v1'],
    };
    expect(SessionConfigSchema.safeParse(config).success).toBe(true);
  });

  it('should accept empty object (defaults)', () => {
    expect(SessionConfigSchema.safeParse({}).success).toBe(true);
  });

  it('should reject negative timeoutMs', () => {
    expect(SessionConfigSchema.safeParse({ timeoutMs: -1 }).success).toBe(false);
  });

  it('should reject minConfidence > 1', () => {
    expect(SessionConfigSchema.safeParse({ minConfidence: 1.5 }).success).toBe(false);
  });
});

// ─── SessionParticipantSchema ──────────────────────────────────────────────

describe('SessionParticipantSchema', () => {
  it('should validate participant with hash', () => {
    expect(SessionParticipantSchema.safeParse({ viewerIdHash: 'abc123' }).success).toBe(true);
  });

  it('should accept optional consentId', () => {
    expect(SessionParticipantSchema.safeParse({ viewerIdHash: 'abc', consentId: 'c1' }).success).toBe(true);
  });

  it('should reject empty viewerIdHash', () => {
    expect(SessionParticipantSchema.safeParse({ viewerIdHash: '' }).success).toBe(false);
  });
});

// ─── createSession helper ──────────────────────────────────────────────────

describe('createSession helper', () => {
  it('should create session with generated ID and timestamp', () => {
    const params = {
      contentId: VALID_CONTENT_ID,
      participant: { viewerIdHash: VALID_VIEWER_HASH },
      config: {},
    };
    const session = createSession(params);
    expect(session.sessionId).toMatch(/^urn:vap:session:[0-9a-f-]{36}$/);
    expect(session.startedAt).toBeDefined();
    expect(session.state).toBe('CREATED');
    expect(session.evidenceIds).toEqual([]);
    expect(session.claimIds).toEqual([]);
    expect(session.lastActivityAt).toBeDefined();
    expect(session.contentId).toBe(params.contentId);
    expect(session.participant).toEqual(params.participant);
  });

  it('should accept custom config', () => {
    const params = {
      contentId: VALID_CONTENT_ID,
      participant: { viewerIdHash: VALID_VIEWER_HASH },
      config: { timeoutMs: 60000, minConfidence: 0.9 },
    };
    const session = createSession(params);
    expect(session.config.timeoutMs).toBe(60000);
    expect(session.config.minConfidence).toBe(0.9);
  });
});

// ─── addEvidenceToSession helper ───────────────────────────────────────────

describe('addEvidenceToSession helper', () => {
  it('should add evidence ID to session', () => {
    const session = makeSession();
    const newSession = addEvidenceToSession(session, 'urn:vap:evidence:abc123');
    expect(newSession.evidenceIds).toContain('urn:vap:evidence:abc123');
    expect(newSession.evidenceIds.length).toBe(1);
  });

  it('should not duplicate evidence ID', () => {
    let session = makeSession({ evidenceIds: ['urn:vap:evidence:abc123'] });
    session = addEvidenceToSession(session, 'urn:vap:evidence:abc123');
    expect(session.evidenceIds.length).toBe(1);
  });

  it('should update lastActivityAt', () => {
    const session = makeSession({ lastActivityAt: '2024-01-15T10:00:00.000Z' });
    const newSession = addEvidenceToSession(session, 'urn:vap:evidence:new');
    expect(newSession.lastActivityAt).not.toBe('2024-01-15T10:00:00.000Z');
  });
});

// ─── transitionSessionState helper ─────────────────────────────────────────

describe('transitionSessionState helper', () => {
  it('should allow CREATED -> ACTIVE', () => {
    const session = makeSession({ state: 'CREATED' });
    const newSession = transitionSessionState(session, 'ACTIVE');
    expect(newSession.state).toBe('ACTIVE');
  });

  it('should allow CREATED -> CANCELLED', () => {
    const session = makeSession({ state: 'CREATED' });
    const newSession = transitionSessionState(session, 'CANCELLED');
    expect(newSession.state).toBe('CANCELLED');
  });

  it('should allow ACTIVE -> EXPIRED', () => {
    const session = makeSession({ state: 'ACTIVE' });
    const newSession = transitionSessionState(session, 'EXPIRED');
    expect(newSession.state).toBe('EXPIRED');
    expect(newSession.expiredAt).toBeDefined();
  });

  it('should allow ACTIVE -> VERIFIED', () => {
    const session = makeSession({ state: 'ACTIVE' });
    const newSession = transitionSessionState(session, 'VERIFIED');
    expect(newSession.state).toBe('VERIFIED');
    expect(newSession.verifiedAt).toBeDefined();
  });

  it('should allow ACTIVE -> CANCELLED', () => {
    const session = makeSession({ state: 'ACTIVE' });
    const newSession = transitionSessionState(session, 'CANCELLED');
    expect(newSession.state).toBe('CANCELLED');
  });

  it('should allow VERIFIED -> CERTIFIED', () => {
    const session = makeSession({ state: 'VERIFIED' });
    const newSession = transitionSessionState(session, 'CERTIFIED');
    expect(newSession.state).toBe('CERTIFIED');
    expect(newSession.certifiedAt).toBeDefined();
  });

  it('should allow VERIFIED -> EXPIRED', () => {
    const session = makeSession({ state: 'VERIFIED' });
    const newSession = transitionSessionState(session, 'EXPIRED');
    expect(newSession.state).toBe('EXPIRED');
  });

  it('should reject invalid transition CREATED -> VERIFIED', () => {
    const session = makeSession({ state: 'CREATED' });
    expect(() => transitionSessionState(session, 'VERIFIED')).toThrow('Invalid state transition');
  });

  it('should reject invalid transition ACTIVE -> CREATED', () => {
    const session = makeSession({ state: 'ACTIVE' });
    expect(() => transitionSessionState(session, 'CREATED')).toThrow('Invalid state transition');
  });

  it('should reject transitions from terminal states', () => {
    const terminalStates = ['CERTIFIED', 'EXPIRED', 'CANCELLED'];
    for (const state of terminalStates) {
      const session = makeSession({ state: state as SessionState });
      expect(() => transitionSessionState(session, 'ACTIVE')).toThrow('Invalid state transition');
    }
  });

  it('should set verifiedAt on VERIFIED transition', () => {
    const session = makeSession({ state: 'ACTIVE' });
    const newSession = transitionSessionState(session, 'VERIFIED');
    expect(newSession.verifiedAt).toBeDefined();
  });

  it('should set certifiedAt on CERTIFIED transition', () => {
    const session = makeSession({ state: 'VERIFIED' });
    const newSession = transitionSessionState(session, 'CERTIFIED');
    expect(newSession.certifiedAt).toBeDefined();
  });

  it('should set expiredAt on EXPIRED transition', () => {
    const session = makeSession({ state: 'ACTIVE' });
    const newSession = transitionSessionState(session, 'EXPIRED');
    expect(newSession.expiredAt).toBeDefined();
  });
});

// ─── isSessionExpired helper ───────────────────────────────────────────────

describe('isSessionExpired helper', () => {
  it('should return true for EXPIRED state', () => {
    const session = makeSession({ state: 'EXPIRED' });
    expect(isSessionExpired(session)).toBe(true);
  });

  it('should return true for CERTIFIED state', () => {
    const session = makeSession({ state: 'CERTIFIED' });
    expect(isSessionExpired(session)).toBe(true);
  });

  it('should return true for CANCELLED state', () => {
    const session = makeSession({ state: 'CANCELLED' });
    expect(isSessionExpired(session)).toBe(true);
  });

  it('should return false for ACTIVE state with recent activity', () => {
    const session = makeSession({ state: 'ACTIVE', lastActivityAt: new Date().toISOString() });
    expect(isSessionExpired(session)).toBe(false);
  });

  it('should return true for ACTIVE state past timeout', () => {
    const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
    const session = makeSession({ state: 'ACTIVE', lastActivityAt: oldTime });
    expect(isSessionExpired(session)).toBe(true);
  });

  it('should use config timeoutMs', () => {
    const session = makeSession({
      state: 'ACTIVE',
      config: { timeoutMs: 60000 },
      lastActivityAt: new Date(Date.now() - 120000).toISOString(),
    });
    expect(isSessionExpired(session)).toBe(true);
  });
});

// ─── sessionHeartbeat helper ───────────────────────────────────────────────

describe('sessionHeartbeat helper', () => {
  it('should update lastActivityAt to now', () => {
    const session = makeSession({ lastActivityAt: '2024-01-15T10:00:00.000Z' });
    const newSession = sessionHeartbeat(session);
    expect(newSession.lastActivityAt).not.toBe('2024-01-15T10:00:00.000Z');
  });

  it('should preserve other fields', () => {
    const session = makeSession({ state: 'ACTIVE' });
    const newSession = sessionHeartbeat(session);
    expect(newSession.sessionId).toBe(session.sessionId);
    expect(newSession.state).toBe('ACTIVE');
    expect(newSession.evidenceIds).toEqual(session.evidenceIds);
  });
});

// ─── SessionEventType ──────────────────────────────────────────────────────

describe('SessionEventType enum', () => {
  it('should export all event types', () => {
    expect(SessionEventType.CREATED).toBe('SESSION_CREATED');
    expect(SessionEventType.STARTED).toBe('SESSION_STARTED');
    expect(SessionEventType.EVIDENCE_ADDED).toBe('EVIDENCE_ADDED');
    expect(SessionEventType.STATE_CHANGED).toBe('STATE_CHANGED');
    expect(SessionEventType.VERIFICATION_REQUESTED).toBe('VERIFICATION_REQUESTED');
    expect(SessionEventType.VERIFICATION_COMPLETED).toBe('VERIFICATION_COMPLETED');
    expect(SessionEventType.EXPIRED).toBe('SESSION_EXPIRED');
    expect(SessionEventType.CERTIFIED).toBe('SESSION_CERTIFIED');
    expect(SessionEventType.CANCELLED).toBe('SESSION_CANCELLED');
  });
});

// ─── Exports sanity ────────────────────────────────────────────────────────

describe('Exports', () => {
  it('should export all expected schemas and helpers', () => {
    expect(SessionSchema).toBeDefined();
    expect(SessionStateSchema).toBeDefined();
    expect(SessionConfigSchema).toBeDefined();
    expect(SessionParticipantSchema).toBeDefined();
    expect(SessionEventType).toBeDefined();
    expect(createSession).toBeDefined();
    expect(addEvidenceToSession).toBeDefined();
    expect(transitionSessionState).toBeDefined();
    expect(isSessionExpired).toBeDefined();
    expect(sessionHeartbeat).toBeDefined();
  });
});