/**
 * In-memory Session store (Sprint 3 deliverable).
 *
 * Wraps the pure functions exported from @verified-attention/core/session
 * so the API layer can perform CRUD on Session objects without touching
 * the underlying state machine logic.
 *
 * The store is intentionally in-memory: Sprint 3 is a skeleton API.
 * Sprint 7+ will swap this for the append-only store in packages/store.
 */

import {
  createSession,
  transitionSessionState,
  sessionHeartbeat,
  isSessionExpired,
  type Session,
  type SessionConfig,
  type SessionParticipant,
  type SessionState
} from '@verified-attention/core';

export interface CreateSessionInput {
  contentId: string;
  participant: SessionParticipant;
  config?: SessionConfig;
  metadata?: Record<string, unknown>;
}

export interface UpdateSessionInput {
  config?: SessionConfig;
  participant?: SessionParticipant;
  metadata?: Record<string, unknown>;
}

export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  create(input: CreateSessionInput): Session {
    const session = createSession({
      contentId: input.contentId,
      participant: input.participant,
      config: input.config ?? { timeoutMs: 30 * 60 * 1000 },
      metadata: input.metadata
    });
    this.sessions.set(session.sessionId, session);
    return this.clone(session);
  }

  get(sessionId: string): Session | undefined {
    const s = this.sessions.get(sessionId);
    return s ? this.clone(s) : undefined;
  }

  list(): Session[] {
    return Array.from(this.sessions.values()).map((s) => this.clone(s));
  }

  update(sessionId: string, patch: UpdateSessionInput): Session {
    const existing = this.sessions.get(sessionId);
    if (!existing) throw new SessionNotFoundError(sessionId);
    if (isTerminalState(existing.state)) {
      throw new InvalidTransitionError(
        `cannot update session ${sessionId} in terminal state ${existing.state}`
      );
    }
    const updated: Session = {
      ...existing,
      ...(patch.config !== undefined ? { config: patch.config } : {}),
      ...(patch.participant !== undefined ? { participant: patch.participant } : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      lastActivityAt: new Date().toISOString()
    };
    this.sessions.set(sessionId, updated);
    return this.clone(updated);
  }

  close(sessionId: string): Session {
    return this.transition(sessionId, 'CANCELLED' as SessionState);
  }

  expire(sessionId: string): Session {
    const existing = this.sessions.get(sessionId);
    if (!existing) throw new SessionNotFoundError(sessionId);
    // Only allow expire from ACTIVE or VERIFIED per VAP state machine.
    if (existing.state === 'ACTIVE' || existing.state === 'VERIFIED') {
      return this.transition(sessionId, 'EXPIRED' as SessionState);
    }
    if (existing.state === 'EXPIRED') return this.clone(existing);
    throw new InvalidTransitionError(
      `cannot expire session ${sessionId} in state ${existing.state}`
    );
  }

  heartbeat(sessionId: string): Session {
    const existing = this.sessions.get(sessionId);
    if (!existing) throw new SessionNotFoundError(sessionId);
    const beat = sessionHeartbeat(existing);
    this.sessions.set(sessionId, beat);
    return this.clone(beat);
  }

  /** True if the live clock says the session should expire. */
  isExpired(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) throw new SessionNotFoundError(sessionId);
    return isSessionExpired(s);
  }

  /** Test-only helper: reset store between suites. */
  clear(): void {
    this.sessions.clear();
  }

  private transition(sessionId: string, newState: Session['state']): Session {
    const existing = this.sessions.get(sessionId);
    if (!existing) throw new SessionNotFoundError(sessionId);
    try {
      const next = transitionSessionState(existing, newState);
      this.sessions.set(sessionId, next);
      return this.clone(next);
    } catch (err) {
      throw new InvalidTransitionError(
        (err as Error).message ?? `invalid transition ${existing.state} -> ${newState}`
      );
    }
  }

  private clone(s: Session): Session {
    return JSON.parse(JSON.stringify(s)) as Session;
  }
}

export class SessionNotFoundError extends Error {
  constructor(public readonly sessionId: string) {
    super(`session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

export function isTerminalState(state: Session['state']): boolean {
  return state === 'EXPIRED' || state === 'CERTIFIED' || state === 'CANCELLED';
}
