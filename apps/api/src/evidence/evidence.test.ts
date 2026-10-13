/**
 * Evidence ingestion API tests (Sprint 2 gap closure).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EvidenceController } from './controller';
import { matchEvidenceRoute } from './router';
import { SessionStore } from '../sessions/store';
import { createEvidenceStore } from '@verified-attention/store';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_HASH = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

function makeEvidence(sessionId: string, evidenceId = `urn:vap:evidence:${VALID_UUID}`) {
  return {
    evidenceId,
    sessionId,
    sourceId: 'source-001',
    timestamp: new Date().toISOString(),
    evidenceType: 'E-CUSTOM',
    confidence: 0.8,
    payload: { evidenceType: 'CUSTOM', foo: 'bar' },
    provenance: {
      observationIds: [VALID_UUID],
      observationHash: VALID_HASH,
      sourceId: 'source-001',
    },
    signature: 'MEUCIQD1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
  };
}

function makeSession(store: SessionStore) {
  return store.create({
    contentId: 'content-1',
    participant: { viewerIdHash: 'sha256:abc123def456' } as any,
  });
}

describe('EvidenceController', () => {
  let sessions: SessionStore;
  let controller: EvidenceController;

  beforeEach(() => {
    sessions = new SessionStore();
    controller = new EvidenceController(createEvidenceStore(), sessions);
  });

  it('ingests valid evidence and returns 201', async () => {
    const session = makeSession(sessions);
    const res = await controller.ingest(makeEvidence(session.sessionId));
    expect(res.status).toBe(201);
    expect((res.body as any).evidenceId).toBe(`urn:vap:evidence:${VALID_UUID}`);
  });

  it('rejects invalid payloads with 400', async () => {
    const res = await controller.ingest({ not: 'evidence' });
    expect(res.status).toBe(400);
    expect((res.body as any).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for an unknown session', async () => {
    const res = await controller.ingest(makeEvidence('urn:vap:session:nonexistent'));
    expect(res.status).toBe(404);
  });

  it('rejects duplicate evidence with 409', async () => {
    const session = makeSession(sessions);
    const ev = makeEvidence(session.sessionId);
    await controller.ingest(ev);
    const res = await controller.ingest(ev);
    expect(res.status).toBe(409);
    expect((res.body as any).error.code).toBe('DUPLICATE_EVIDENCE');
  });

  it('rejects evidence that fails schema validation with 422', async () => {
    const session = makeSession(sessions);
    const res = await controller.ingest(makeEvidence(session.sessionId, 'not-a-valid-id'));
    expect(res.status).toBe(422);
    expect((res.body as any).error.code).toBe('EVIDENCE_REJECTED');
  });

  it('accepts numeric timestamps (normalized downstream)', async () => {
    const session = makeSession(sessions);
    const res = await controller.ingest({
      ...makeEvidence(session.sessionId),
      timestamp: Date.now(),
    });
    expect(res.status).toBe(201);
  });

  it('gets ingested evidence by id', async () => {
    const session = makeSession(sessions);
    await controller.ingest(makeEvidence(session.sessionId));
    const res = await controller.get(`urn:vap:evidence:${VALID_UUID}`);
    expect(res.status).toBe(200);
    expect((res.body as any).sessionId).toBe(session.sessionId);
  });

  it('returns 404 for unknown evidence id', async () => {
    const res = await controller.get('urn:vap:evidence:nonexistent');
    expect(res.status).toBe(404);
  });

  it('lists evidence by session', async () => {
    const session = makeSession(sessions);
    await controller.ingest(makeEvidence(session.sessionId));
    await controller.ingest({
      ...makeEvidence(session.sessionId),
      evidenceId: `urn:vap:evidence:650e8400-e29b-41d4-a716-446655440000`,
    });
    const res = await controller.listBySession(session.sessionId);
    expect(res.status).toBe(200);
    expect((res.body as any).total).toBe(2);
  });
});

describe('matchEvidenceRoute', () => {
  let sessions: SessionStore;
  let controller: EvidenceController;

  beforeEach(() => {
    sessions = new SessionStore();
    controller = new EvidenceController(createEvidenceStore(), sessions);
  });

  it('returns null for unrelated paths', async () => {
    expect(await matchEvidenceRoute({ method: 'GET', path: '/v1/sessions' }, controller)).toBeNull();
  });

  it('routes POST /v1/evidence to ingest', async () => {
    const session = makeSession(sessions);
    const res = await matchEvidenceRoute(
      { method: 'POST', path: '/v1/evidence', body: makeEvidence(session.sessionId) },
      controller,
    );
    expect(res?.status).toBe(201);
  });

  it('routes GET /v1/evidence/:id', async () => {
    const session = makeSession(sessions);
    await controller.ingest(makeEvidence(session.sessionId));
    const res = await matchEvidenceRoute(
      { method: 'GET', path: `/v1/evidence/urn:vap:evidence:${VALID_UUID}` },
      controller,
    );
    expect(res?.status).toBe(200);
  });

  it('routes GET /v1/evidence?sessionId=...', async () => {
    const session = makeSession(sessions);
    await controller.ingest(makeEvidence(session.sessionId));
    const res = await matchEvidenceRoute(
      { method: 'GET', path: `/v1/evidence?sessionId=${session.sessionId}` },
      controller,
    );
    expect(res?.status).toBe(200);
    expect((res?.body as any).total).toBe(1);
  });

  it('returns 404 for unmatched evidence paths', async () => {
    const res = await matchEvidenceRoute({ method: 'DELETE', path: '/v1/evidence/x' }, controller);
    expect(res?.status).toBe(404);
  });
});
