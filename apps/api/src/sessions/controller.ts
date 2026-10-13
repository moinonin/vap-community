/**
 * Session API controller (Sprint 3 deliverable).
 *
 * Pure request -> response handlers. Returns { status, body } so tests
 * exercise the controller directly without binding a TCP socket. The
 * router/app layer is responsible for serialising to HTTP.
 */

import { z } from 'zod';
import { SessionSchema, SessionParticipantSchema, SessionConfigSchema, ContentIdSchema } from '@verified-attention/core';
import {
  SessionStore,
  SessionNotFoundError,
  InvalidTransitionError
} from './store';

export interface HttpResponse {
  status: number;
  body: unknown;
}

import type { CreateSessionInput, UpdateSessionInput } from './store';

const CreateSessionRequestSchema = z.object({
  contentId: ContentIdSchema,
  participant: SessionParticipantSchema,
  config: SessionConfigSchema.optional(),
  metadata: z.record(z.unknown()).optional()
});

const UpdateSessionRequestSchema = z.object({
  config: SessionConfigSchema.optional(),
  participant: SessionParticipantSchema.optional(),
  metadata: z.record(z.unknown()).optional()
});

function toCreateSessionInput(data: z.infer<typeof CreateSessionRequestSchema>): CreateSessionInput {
  return {
    contentId: data.contentId,
    participant: data.participant as any,
    config: data.config as any,
    metadata: data.metadata,
  };
}

function toUpdateSessionInput(data: z.infer<typeof UpdateSessionRequestSchema>): UpdateSessionInput {
  return {
    config: data.config as any,
    participant: data.participant as any,
    metadata: data.metadata,
  };
}

export class SessionController {
  constructor(private readonly store: SessionStore = new SessionStore()) {}

  create(body: unknown): HttpResponse {
    const parsed = CreateSessionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return { status: 400, body: errorBody('VALIDATION_ERROR', parsed.error.message) };
    }
    const session = this.store.create(toCreateSessionInput(parsed.data));
    return { status: 201, body: session };
  }

  get(sessionId: string): HttpResponse {
    const session = this.store.get(sessionId);
    if (!session) return { status: 404, body: errorBody('NOT_FOUND', `session ${sessionId} not found`) };
    return { status: 200, body: session };
  }

  list(): HttpResponse {
    return { status: 200, body: { items: this.store.list() } };
  }

  update(sessionId: string, body: unknown): HttpResponse {
    const parsed = UpdateSessionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return { status: 400, body: errorBody('VALIDATION_ERROR', parsed.error.message) };
    }
    try {
      const session = this.store.update(sessionId, toUpdateSessionInput(parsed.data));
      return { status: 200, body: session };
    } catch (err) {
      return mapDomainError(err);
    }
  }

  close(sessionId: string): HttpResponse {
    try {
      const session = this.store.close(sessionId);
      return { status: 200, body: session };
    } catch (err) {
      return mapDomainError(err);
    }
  }

  expire(sessionId: string): HttpResponse {
    try {
      const session = this.store.expire(sessionId);
      return { status: 200, body: session };
    } catch (err) {
      return mapDomainError(err);
    }
  }
}

function errorBody(code: string, message: string): unknown {
  return { error: { code, message } };
}

function mapDomainError(err: unknown): HttpResponse {
  if (err instanceof SessionNotFoundError) {
    return { status: 404, body: errorBody('NOT_FOUND', err.message) };
  }
  if (err instanceof InvalidTransitionError) {
    return { status: 409, body: errorBody('INVALID_TRANSITION', err.message) };
  }
  return { status: 500, body: errorBody('INTERNAL', (err as Error)?.message ?? 'unknown error') };
}

// Re-export schema for router/openapi consumers.
export { CreateSessionRequestSchema, UpdateSessionRequestSchema, SessionSchema };
