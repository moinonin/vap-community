import { describe, it, expect, vi } from 'vitest';
import { VerifiedAttention } from '../dist/index.mjs';

describe('VerifiedAttention', () => {
  it('should create an instance with valid config', () => {
    const va = new VerifiedAttention({
      policyId: 'pol_reading_30s',
      contentId: 'article_12345',
      onProof: vi.fn(),
      autoStart: false,
    });
    expect(va).toBeInstanceOf(VerifiedAttention);
  });

  it('should start a session and return session ID', () => {
    const va = new VerifiedAttention({
      policyId: 'pol_reading_30s',
      contentId: 'article_12345',
      onProof: vi.fn(),
      autoStart: false,
    });
    const sessionId = va.startSession();
    expect(sessionId).toMatch(/^urn:vap:session:/);
    expect(va.getIsActive()).toBe(true);
  });

  it('should get session ID', () => {
    const va = new VerifiedAttention({
      policyId: 'pol_reading_30s',
      contentId: 'article_12345',
      onProof: vi.fn(),
      autoStart: false,
    });
    const sessionId = va.startSession();
    expect(va.getSessionId()).toBe(sessionId);
  });
});