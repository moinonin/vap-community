import { describe, it, expect } from 'vitest';
import { ExternalEvidenceController, externalEvidenceRouter, sanitizeContentUri } from './external';

describe('External Evidence Ingestion API (Sprint 16, Unit 5)', () => {
  it('strips tracking query parameters from contentUri to enforce Zero-PII', () => {
    const dirty = 'https://www.linkedin.com/feed/update/urn:li:activity:12345?utm_source=newsletter&utm_medium=email&fbclid=abcde&ref=share';
    const clean = sanitizeContentUri(dirty);
    expect(clean).toBe('https://www.linkedin.com/feed/update/urn:li:activity:12345');
    expect(clean).not.toContain('utm_source');
    expect(clean).not.toContain('fbclid');
  });

  it('accepts and ingests a valid external observation payload', async () => {
    const controller = new ExternalEvidenceController();
    const payload = {
      platform: 'linkedin',
      archetype: 'feed',
      contentUri: 'urn:li:activity:72518293819238',
      dwellTimeMs: 15000,
      activeFocusRatio: 0.95,
      interactionEntropy: 0.8,
      viewportCoverageRatio: 0.85,
      readingVelocityWpm: 320
    };

    const res = await controller.ingest(payload);
    expect(res.status).toBe(201);
    expect((res.body as any).status).toBe('accepted');
    expect((res.body as any).evidenceId).toContain('urn:vap:evidence:external:');
    expect((res.body as any).confidence).toBeGreaterThan(0.5);
  });

  it('rejects an invalid payload with 400 VALIDATION_ERROR', async () => {
    const controller = new ExternalEvidenceController();
    const res = await controller.ingest({
      platform: '', // invalid empty platform
      archetype: 'invalid_archetype',
      dwellTimeMs: -10 // invalid negative dwell
    });

    expect(res.status).toBe(400);
    expect((res.body as any).error.code).toBe('VALIDATION_ERROR');
  });

  it('handles HTTP routing via externalEvidenceRouter', async () => {
    const controller = new ExternalEvidenceController();
    const payload = {
      platform: 'youtube',
      archetype: 'video',
      contentUri: 'urn:vap:content:youtube:video:dQw4w9WgXcQ',
      dwellTimeMs: 60000,
      activeFocusRatio: 1.0,
      interactionEntropy: 0.9,
      viewportCoverageRatio: 1.0,
      mediaTelemetry: {
        playDurationMs: 60000,
        audioActive: true,
        completionPercentage: 80
      }
    };

    const postRes = await externalEvidenceRouter({
      method: 'POST',
      path: '/v1/evidence/external',
      body: payload
    }, controller);

    expect(postRes).not.toBeNull();
    expect(postRes?.status).toBe(201);
    const evidenceId = (postRes?.body as any).evidenceId;

    const getRes = await externalEvidenceRouter({
      method: 'GET',
      path: `/v1/evidence/external/${encodeURIComponent(evidenceId)}`
    }, controller);

    expect(getRes).not.toBeNull();
    expect(getRes?.status).toBe(200);
    expect((getRes?.body as any).platform).toBe('youtube');
  });
});
