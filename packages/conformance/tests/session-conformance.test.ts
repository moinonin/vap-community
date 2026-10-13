/**
 * Session Model Conformance Tests (VAP Section 6)
 * Tests session state machine, transitions, guards, and lifecycle
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
  SessionState,
  type Session,
  type SessionConfig,
  type SessionParticipant,
} from '@verified-attention/core';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const VALID_CONTENT_ID = 'urn:vap:content:article-12345';
const VALID_VIEWER_HASH = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

const baseSession: Session = {
  sessionId: 'urn:vap:session:550e8400-e29b-41d4-a716-446655440000',
  contentId: 'urn:vap:content:article-12345',
  participant: { viewerIdHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' },
  config: { timeoutMs: 30 * 60 * 1000, requiredEvidenceTypes: ['E-INTERACTION', 'E-VISIBLE'], minConfidence: 0.7 },
  state: SessionState.CREATED,
  evidenceIds: [],
  claimIds: [],
  startedAt: '2024-01-15T10:30:00.123456Z',
  lastActivityAt: '2024-01-15T10:30:00.123456Z',
};

function makeSession(overrides: Partial<Session> = {}): Session {
  return { ...baseSession, ...overrides };
}

// ─── SessionSchema ──────────────────────────────────────────────────────────

describe('SessionSchema', () => {
  it('should validate complete session', () => {
    const session = makeSession();
    const result = SessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it('should reject missing sessionId', () => {
    const session = { ...baseSession, sessionId: '' };
    expect(SessionSchema.safeParse(session).success).toBe(false);
  });

  it('should reject invalid sessionId format', () => {
    const session = { ...baseSession, sessionId: 'invalid-id' };
    expect(SessionSchema.safeParse(session).success).toBe(false);
  });

  it('should reject missing contentId', () => {
    const session = { ...baseSession, contentId: '' };
    expect(SessionSchema.safeParse(session).success).toBe(false);
  });

  it('should reject missing participant', () => {
    const session = { ...baseSession, participant: undefined as any };
    expect(SessionSchema.safeParse(session).success).toBe(false);
  });

  it('should reject participant without viewerIdHash', () => {
    const session = { ...baseSession, participant: { consentId: 'c1' } as any };
    expect(SessionSchema.safeParse(session).success).toBe(false);
  });

  it('should reject invalid state', () => {
    const session = { ...baseSession, state: 'INVALID' as any };
    expect(SessionSchema.safeParse(session).success).toBe(false);
  });

  it('should default evidenceIds and claimIds to empty arrays', () => {
    const session = { ...baseSession, evidenceIds: undefined as any, claimIds: undefined as any };
    const result = SessionSchema.safeParse(session);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.evidenceIds).toEqual([]);
      expect(result.data.claimIds).toEqual([]);
    }
  });

  it('should accept optional proofId', () => {
    const session = { ...baseSession, proofId: 'urn:vap:proof:abc123' };
    expect(SessionSchema.safeParse(session).success).toBe(true);
  });

  it('should accept optional timestamps', () => {
    const session = { 
      ...baseSession,
      expiredAt: '2024-01-15T10:30:05.123456Z',
      verifiedAt: '2024-01-15T10:30:05.123456Z',
      certifiedAt: '2024-01-15T10:31:00.123456Z',
    };
    expect(SessionSchema.safeParse(session).success).toBe(true);
  });

  it('should accept optional metadata', () => {
    const session = { ...baseSession, metadata: { source: 'web', campaign: 'summer-2024' } };
    expect(SessionSchema.safeParse(session).success).toBe(true);
  });
});

// ─── SessionConfigSchema ───────────────────────────────────────────────────

describe('SessionConfigSchema', () => {
  it('should validate complete config', () => {
    const config = {
      timeoutMs: 30 * 60 * 1000,
      requiredEvidenceTypes: ['E-INTERACTION', 'E-VISIBLE'],
      minConfidence: 0.8,
      maxDurationMs: 2 * 60 * 60 * 1000,
      allowedSources: ['browser-sdk-v1'],
    };
    expect(SessionConfigSchema.safeParse(config).success).toBe(true);
  });

  it('should accept empty object (defaults)', () => {
    expect(SessionConfigSchema.safeParse({}).success).toBe(true);
  });

  it('should reject negative timeoutMs', () => {
    expect(SessionConfigSchema.safeParse({ timeoutMs: -100 }).success).toBe(false);
  });

  it('should reject minConfidence > 1', () => {
    expect(SessionConfigSchema.safeParse({ minConfidence: 1.5 }).success).toBe(false);
  });

  it('should reject minConfidence < 0', () => {
    expect(SessionConfigSchema.safeParse({ minConfidence: -0.1 }).success).toBe(false);
  });

  it('should apply default timeoutMs', () => {
    const config = SessionConfigSchema.parse({});
    expect(config.timeoutMs).toBe(30 * 60 * 1000);
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

// ─── SessionEventType ──────────────────────────────────────────────────────

describe('SessionEventType enum', () => {
  it('should export all expected events', () => {
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

// ─── createSession helper ──────────────────────────────────────────────────

describe('createSession helper', () => {
  it('should create session with generated sessionId', () => {
    const session = createSession({
      contentId: 'urn:vap:content:article-12345',
      config: { timeoutMs: 60000, minConfidence: 0.9 },
      participant: { viewerIdHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' },
    });
    expect(session.sessionId).toMatch(/^urn:vap:session:[0-9a-f-]{36}$/);
  });

  it('should set initial state to CREATED', () => {
    const session = createSession({
      contentId: 'urn:vap:content:article-12345',
      config: { timeoutMs: 60000, minConfidence: 0.9 },
      participant: { viewerIdHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' },
    });
    expect(session.state).toBe(SessionState.CREATED);
  });

  it('should set startedAt and lastActivityAt to now', () => {
    const session = createSession({
      contentId: 'urn:vap:content:article-12345',
      config: { timeoutMs: 60000, minConfidence: 0.9 },
      participant: { viewerIdHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' },
    });
    expect(session.startedAt).toBeDefined();
    expect(session.lastActivityAt).toBeDefined();
    expect(session.startedAt).toBe(session.lastActivityAt);
  });

  it('should initialize empty evidenceIds and claimIds', () => {
    const session = createSession({
      contentId: 'urn:vap:content:article-12345',
      config: { timeoutMs: 60000, minConfidence: 0.9 },
      participant: { viewerIdHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' },
    });
    expect(session.evidenceIds).toEqual([]);
    expect(session.claimIds).toEqual([]);
  });

  it('should copy provided config and participant', () => {
    const config = { timeoutMs: 60000, minConfidence: 0.9 };
    const participant = { viewerIdHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', consentId: 'c1' };
    const session = createSession({ contentId: 'urn:vap:content:article-12345', config, participant });
    expect(session.config).toEqual(config);
    expect(session.participant).toEqual(participant);
  });

  it('should accept custom timestamp', () => {
    const customTs = '2025-06-01T00:00:00.000Z';
    const session = createSession({
      contentId: 'urn:vap:content:article-12345',
      config: { timeoutMs: 60000, minConfidence: 0.9 },
      participant: { viewerIdHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' },
      timestamp: customTs,
    });
    expect(session.startedAt).toBe(customTs);
  });
});

// ─── addEvidenceToSession helper ───────────────────────────────────────────

describe('addEvidenceToSession helper', () => {
  it('should add evidence ID to session', () => {
    const session = { ...baseSession, evidenceIds: [] };
    const newSession = addEvidenceToSession(session, 'urn:vap:evidence:abc123');
    expect(newSession.evidenceIds).toContain('urn:vap:evidence:abc123');
    expect(newSession.evidenceIds.length).toBe(1);
  });

  it('should not duplicate evidence ID', () => {
    const session = { ...baseSession, evidenceIds: ['urn:vap:evidence:abc123'] };
    const newSession = addEvidenceToSession(session, 'urn:vap:evidence:abc123');
    expect(newSession.evidenceIds.length).toBe(1);
  });

  it('should update lastActivityAt', () => {
    const session = { ...baseSession, lastActivityAt: '2024-01-15T10:00:00.000Z' };
    const newSession = addEvidenceToSession(session, 'urn:vap:evidence:new');
    expect(newSession.lastActivityAt).not.toBe('2024-01-15T10:00:00.000Z');
  });

  it('should not mutate original session', () => {
    const session = { ...baseSession, evidenceIds: [] };
    addEvidenceToSession(session, 'urn:vap:evidence:new');
    expect(session.evidenceIds.length).toBe(0);
  });
});

// ─── transitionSessionState helper ─────────────────────────────────────────

describe('transitionSessionState helper', () => {
  const transitionBaseSession = makeSession({ state: SessionState.CREATED });

  it('should allow CREATED -> ACTIVE', () => {
    const session = { ...transitionBaseSession, state: SessionState.CREATED };
    const newSession = transitionSessionState(session, SessionState.ACTIVE);
    expect(newSession.state).toBe(SessionState.ACTIVE);
  });

  it('should allow CREATED -> CANCELLED', () => {
    const session = { ...transitionBaseSession, state: SessionState.CREATED };
    const newSession = transitionSessionState(session, SessionState.CANCELLED);
    expect(newSession.state).toBe(SessionState.CANCELLED);
  });

  it('should allow ACTIVE -> EXPIRED', () => {
    const session = { ...transitionBaseSession, state: SessionState.ACTIVE };
    const newSession = transitionSessionState(session, SessionState.EXPIRED);
    expect(newSession.state).toBe(SessionState.EXPIRED);
    expect(newSession.expiredAt).toBeDefined();
  });

  it('should allow ACTIVE -> VERIFIED', () => {
    const session = { ...transitionBaseSession, state: SessionState.ACTIVE };
    const newSession = transitionSessionState(session, SessionState.VERIFIED);
    expect(newSession.state).toBe(SessionState.VERIFIED);
    expect(newSession.verifiedAt).toBeDefined();
  });

  it('should allow ACTIVE -> CANCELLED', () => {
    const session = { ...transitionBaseSession, state: SessionState.ACTIVE };
    const newSession = transitionSessionState(session, SessionState.CANCELLED);
    expect(newSession.state).toBe(SessionState.CANCELLED);
  });

  it('should allow VERIFIED -> CERTIFIED', () => {
    const session = { ...transitionBaseSession, state: SessionState.VERIFIED };
    const newSession = transitionSessionState(session, SessionState.CERTIFIED);
    expect(newSession.state).toBe(SessionState.CERTIFIED);
    expect(newSession.certifiedAt).toBeDefined();
  });

  it('should allow VERIFIED -> EXPIRED', () => {
    const session = { ...transitionBaseSession, state: SessionState.VERIFIED };
    const newSession = transitionSessionState(session, SessionState.EXPIRED);
    expect(newSession.state).toBe(SessionState.EXPIRED);
    expect(newSession.expiredAt).toBeDefined();
  });

  it('should reject invalid transition CREATED -> VERIFIED', () => {
    const session = { ...transitionBaseSession, state: SessionState.CREATED };
    expect(() => transitionSessionState(session, SessionState.VERIFIED)).toThrow('Invalid state transition');
  });

  it('should reject invalid transition ACTIVE -> CREATED', () => {
    const session = { ...transitionBaseSession, state: SessionState.ACTIVE };
    expect(() => transitionSessionState(session, SessionState.CREATED)).toThrow('Invalid state transition');
  });

  it('should reject transitions from terminal states', () => {
    const terminalStates = [SessionState.CERTIFIED, SessionState.EXPIRED, SessionState.CANCELLED];
    for (const state of terminalStates) {
      const session = { ...transitionBaseSession, state } as any;
      expect(() => transitionSessionState(session, SessionState.ACTIVE)).toThrow('Invalid state transition');
    }
  });

  it('should set verifiedAt on VERIFIED transition', () => {
    const session = { ...transitionBaseSession, state: SessionState.ACTIVE, verifiedAt: undefined };
    const newSession = transitionSessionState(session, SessionState.VERIFIED);
    expect(newSession.verifiedAt).toBeDefined();
  });

  it('should set certifiedAt on CERTIFIED transition', () => {
    const session = { ...transitionBaseSession, state: SessionState.VERIFIED, certifiedAt: undefined };
    const newSession = transitionSessionState(session, SessionState.CERTIFIED);
    expect(newSession.certifiedAt).toBeDefined();
  });

  it('should set expiredAt on EXPIRED transition', () => {
    const session = { ...transitionBaseSession, state: SessionState.ACTIVE, expiredAt: undefined };
    const newSession = transitionSessionState(session, SessionState.EXPIRED);
    expect(newSession.expiredAt).toBeDefined();
  });

  it('should update lastActivityAt on transition', () => {
    const session = { ...transitionBaseSession, state: SessionState.CREATED, lastActivityAt: '2024-01-15T10:00:00.000Z' };
    const newSession = transitionSessionState(session, SessionState.ACTIVE);
    expect(newSession.lastActivityAt).not.toBe('2024-01-15T10:00:00.000Z');
  });

  it('should not mutate original session', () => {
    const session = { ...transitionBaseSession, state: SessionState.CREATED };
    transitionSessionState(session, SessionState.ACTIVE);
    expect(session.state).toBe(SessionState.CREATED);
  });
});

// ─── isSessionExpired helper ───────────────────────────────────────────────

describe('isSessionExpired helper', () => {
  const expiredBaseSession = { ...baseSession, state: SessionState.CREATED };

  it('should return true for EXPIRED state', () => {
      const session = { ...expiredBaseSession, state: SessionState.EXPIRED };
      expect(isSessionExpired(session)).toBe(true);
    });

    it('should return true for CERTIFIED state', () => {
      const session = { ...expiredBaseSession, state: SessionState.CERTIFIED };
      expect(isSessionExpired(session)).toBe(true);
    });

    it('should return true for CANCELLED state', () => {
      const session = { ...expiredBaseSession, state: SessionState.CANCELLED };
      expect(isSessionExpired(session)).toBe(true);
    });

    it('should return false for ACTIVE state with recent activity', () => {
      const session = { ...expiredBaseSession, state: SessionState.ACTIVE, lastActivityAt: new Date().toISOString() };
      expect(isSessionExpired(session)).toBe(false);
    });

    it('should return true for ACTIVE state past timeout', () => {
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      const session = { ...expiredBaseSession, state: SessionState.ACTIVE, lastActivityAt: oldTime };
      expect(isSessionExpired(session)).toBe(true);
    });

    it('should return false for ACTIVE state within timeout', () => {
      const recentTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
      const session = { ...expiredBaseSession, state: SessionState.ACTIVE, lastActivityAt: recentTime };
      expect(isSessionExpired(session)).toBe(false);
    });

    it('should use startedAt when lastActivityAt missing', () => {
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const session = { ...expiredBaseSession, state: SessionState.ACTIVE, lastActivityAt: undefined, startedAt: oldTime };
      expect(isSessionExpired(session)).toBe(true);
    });

    it('should respect custom timeoutMs', () => {
      const session = {
        ...expiredBaseSession,
        state: SessionState.ACTIVE,
        config: { timeoutMs: 60000 },
        lastActivityAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
      };
      expect(isSessionExpired(session)).toBe(true);
    });
});

// ─── sessionHeartbeat helper ───────────────────────────────────────────────

describe('sessionHeartbeat helper', () => {
  const baseSession = makeSession({ state: SessionState.ACTIVE });

  it('should update lastActivityAt to now', () => {
    const session = { ...baseSession, lastActivityAt: '2024-01-15T10:00:00.000Z' };
    const newSession = sessionHeartbeat(session);
    expect(newSession.lastActivityAt).not.toBe('2024-01-15T10:00:00.000Z');
  });

  it('should preserve other fields', () => {
    const session = { ...baseSession, state: SessionState.ACTIVE, config: { timeoutMs: 60000 } };
    const newSession = sessionHeartbeat(session);
    expect(newSession.state).toBe(SessionState.ACTIVE);
    expect(newSession.config.timeoutMs).toBe(60000);
    expect(newSession.evidenceIds).toEqual([]);
  });

  it('should not mutate original session', () => {
    const session = { ...baseSession, lastActivityAt: '2024-01-15T10:00:00.000Z' };
    sessionHeartbeat(session);
    expect(session.lastActivityAt).toBe('2024-01-15T10:00:00.000Z');
  });
});

// ─── SessionStateSchema ────────────────────────────────────────────────────

describe('SessionStateSchema', () => {
  it('should validate CREATED', () => {
    expect(SessionStateSchema.safeParse(SessionState.CREATED).success).toBe(true);
  });

  it('should validate ACTIVE', () => {
    expect(SessionStateSchema.safeParse(SessionState.ACTIVE).success).toBe(true);
  });

  it('should validate EXPIRED', () => {
    expect(SessionStateSchema.safeParse(SessionState.EXPIRED).success).toBe(true);
  });

  it('should validate VERIFIED', () => {
    expect(SessionStateSchema.safeParse(SessionState.VERIFIED).success).toBe(true);
  });

  it('should validate CERTIFIED', () => {
    expect(SessionStateSchema.safeParse(SessionState.CERTIFIED).success).toBe(true);
  });

  it('should validate CANCELLED', () => {
    expect(SessionStateSchema.safeParse(SessionState.CANCELLED).success).toBe(true);
  });

  it('should reject invalid state', () => {
    expect(SessionStateSchema.safeParse('INVALID').success).toBe(false);
  });
});

// ─── Exports ────────────────────────────────────────────────────────────────

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