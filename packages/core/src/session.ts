/**
 * Session types and schemas (VAP Section 6)
 * 
 * A session represents a bounded, authenticated attention interaction 
 * between a viewer and content. A session may span minutes, hours, or days.
 */

import { z } from 'zod';
import {
  TimestampSchema,
  SessionIdSchema,
  ContentIdSchema,
  SourceIdSchema,
  SessionStateSchema as SessionStateSchemaImport,
  EvidenceIdSchema
} from './common';
import { randomUUID } from 'crypto';

// Re-export SessionState type from common
export type SessionState = z.infer<typeof SessionStateSchemaImport>;
export const SessionStateSchema = SessionStateSchemaImport;

// Session states
export const SessionStateValue = {
  CREATED: 'CREATED',
  ACTIVE: 'ACTIVE', 
  EXPIRED: 'EXPIRED',
  VERIFIED: 'VERIFIED',
  CERTIFIED: 'CERTIFIED',
  CANCELLED: 'CANCELLED'
} as const;

/**
 * Session configuration / policy
 */
export const SessionConfigSchema = z.object({
  // Session timeout in milliseconds
  timeoutMs: z.number().int().positive().default(30 * 60 * 1000), // 30 min default
  // Required evidence types for verification
  requiredEvidenceTypes: z.array(z.string()).optional(),
  // Minimum confidence threshold
  minConfidence: z.number().min(0).max(1).optional(),
  // Maximum session duration
  maxDurationMs: z.number().int().positive().optional(),
  // Allowed sources
  allowedSources: z.array(z.string()).optional()
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

/**
 * Session participant (viewer) - pseudonymized
 */
export const SessionParticipantSchema = z.object({
  // Hashed viewer identifier (never raw PII)
  viewerIdHash: z.string().min(1),
  // Optional consent record reference
  consentId: z.string().optional(),
  // Viewer preferences for this session
  preferences: z.record(z.unknown()).optional()
});

export type SessionParticipant = z.infer<typeof SessionParticipantSchema>;

/**
 * Complete Session object (VAP Section 6)
 */
export const SessionSchema = z.object({
  sessionId: SessionIdSchema,
  contentId: ContentIdSchema,
  participant: SessionParticipantSchema,
  config: SessionConfigSchema.default({}),
  state: SessionStateSchemaImport,
  // Evidence references
  evidenceIds: z.array(EvidenceIdSchema).default([]),
  // Claim references
  claimIds: z.array(z.string()).default([]),
  // Proof reference (when certified)
  proofId: z.string().optional(),
  // Timestamps
  startedAt: TimestampSchema,
  lastActivityAt: TimestampSchema.optional(),
  expiredAt: TimestampSchema.optional(),
  verifiedAt: TimestampSchema.optional(),
  certifiedAt: TimestampSchema.optional(),
  // Metadata
  metadata: z.record(z.unknown()).optional()
});

export type Session = z.infer<typeof SessionSchema>;

/**
 * Session lifecycle events
 */
export enum SessionEventType {
  CREATED = 'SESSION_CREATED',
  STARTED = 'SESSION_STARTED',
  EVIDENCE_ADDED = 'EVIDENCE_ADDED',
  STATE_CHANGED = 'STATE_CHANGED',
  VERIFICATION_REQUESTED = 'VERIFICATION_REQUESTED',
  VERIFICATION_COMPLETED = 'VERIFICATION_COMPLETED',
  EXPIRED = 'SESSION_EXPIRED',
  CERTIFIED = 'SESSION_CERTIFIED',
  CANCELLED = 'SESSION_CANCELLED'
}

/**
 * Create a new session
 */
export function createSession(
  params: Omit<Session, 'sessionId' | 'startedAt' | 'state' | 'evidenceIds' | 'claimIds'> & { timestamp?: string }
): Session {
  const now = new Date().toISOString();

  return {
    ...params,
    sessionId: `urn:vap:session:${randomUUID()}`,
    startedAt: params.timestamp ?? now,
    state: 'CREATED' as SessionState,
    evidenceIds: [],
    claimIds: [],
    lastActivityAt: params.timestamp ?? now
  };
}

/**
 * Add evidence to session
 */
export function addEvidenceToSession(session: Session, evidenceId: string): Session {
  if (session.evidenceIds.includes(evidenceId)) {
    return session;
  }
  return {
    ...session,
    evidenceIds: [...session.evidenceIds, evidenceId],
    lastActivityAt: new Date().toISOString()
  };
}

/**
 * Transition session state
 */
export function transitionSessionState(
  session: Session, 
  newState: z.infer<typeof SessionStateSchema>
): Session {
  // Valid transitions
  const validTransitions: Record<string, string[]> = {
    CREATED: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['EXPIRED', 'VERIFIED', 'CANCELLED'],
    VERIFIED: ['CERTIFIED', 'EXPIRED'],
    CERTIFIED: [],
    EXPIRED: [],
    CANCELLED: []
  };
  
  if (!validTransitions[session.state]?.includes(newState)) {
    throw new Error(`Invalid state transition: ${session.state} -> ${newState}`);
  }
  
  return {
    ...session,
    state: newState,
    lastActivityAt: new Date().toISOString(),
    ...(newState === 'VERIFIED' && { verifiedAt: new Date().toISOString() }),
    ...(newState === 'CERTIFIED' && { certifiedAt: new Date().toISOString() }),
    ...(newState === 'EXPIRED' && { expiredAt: new Date().toISOString() })
  };
}

/**
 * Check if session is expired based on timeout
 */
export function isSessionExpired(session: Session): boolean {
  if (['EXPIRED', 'CERTIFIED', 'CANCELLED'].includes(session.state)) {
    return true;
  }
  
  const lastActivity = session.lastActivityAt 
    ? new Date(session.lastActivityAt).getTime() 
    : new Date(session.startedAt).getTime();
  const timeout = session.config.timeoutMs;
  
  return Date.now() - lastActivity > timeout;
}

/**
 * Session heartbeat - updates last activity time
 */
export function sessionHeartbeat(session: Session): Session {
  return {
    ...session,
    lastActivityAt: new Date().toISOString()
  };
}