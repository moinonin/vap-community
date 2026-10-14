import { describe, it, expect } from 'vitest';
import { SocialAttentionPolicy, type SocialEvidenceInput } from './social';

describe('SocialAttentionPolicy (Sprint 16, Unit 6)', () => {
  const policy = new SocialAttentionPolicy();

  describe('Feed Archetype (LinkedIn, X, Facebook)', () => {
    it('verifies authentic human reading feed post', () => {
      const input: SocialEvidenceInput = {
        platform: 'linkedin',
        archetype: 'feed',
        contentUri: 'urn:li:activity:123456',
        dwellTimeMs: 12000, // 12 seconds
        activeFocusRatio: 1.0,
        interactionEntropy: 0.8,
        viewportCoverageRatio: 0.9,
        readingVelocityWpm: 280 // human reading speed
      };

      const result = policy.evaluate(input);
      expect(result.verified).toBe(true);
      expect(result.outcome).toBe('VERIFIED');
      expect(result.confidence).toBeGreaterThanOrEqual(0.65);
      expect(result.proofUrn).toContain('urn:vap:proof:social:linkedin:');
    });

    it('flags bot scrolling past feed at >900 WPM', () => {
      const input: SocialEvidenceInput = {
        platform: 'x',
        archetype: 'feed',
        contentUri: 'urn:vap:content:x:status:999',
        dwellTimeMs: 500, // 0.5s dwell
        activeFocusRatio: 1.0,
        interactionEntropy: 0.1,
        viewportCoverageRatio: 0.9,
        readingVelocityWpm: 4500 // >900 WPM bot
      };

      const result = policy.evaluate(input);
      expect(result.verified).toBe(false);
      expect(result.outcome).toBe('FLAGGED_BOT');
      expect(result.penalties.some((p) => p.includes('bot cap'))).toBe(true);
    });
  });

  describe('Video Archetype (YouTube, TikTok Web)', () => {
    it('verifies focused video watch session with active audio', () => {
      const input: SocialEvidenceInput = {
        platform: 'youtube',
        archetype: 'video',
        contentUri: 'urn:vap:content:youtube:video:abc123xyz',
        dwellTimeMs: 45000,
        activeFocusRatio: 0.95,
        interactionEntropy: 1.0,
        viewportCoverageRatio: 1.0,
        mediaTelemetry: {
          playDurationMs: 45000,
          audioActive: true,
          playbackRate: 1.0,
          completionPercentage: 75
        }
      };

      const result = policy.evaluate(input);
      expect(result.verified).toBe(true);
      expect(result.outcome).toBe('VERIFIED');
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      expect(result.proofUrn).toContain('urn:vap:proof:social:youtube:');
    });

    it('penalizes background tab video streaming', () => {
      const input: SocialEvidenceInput = {
        platform: 'youtube',
        archetype: 'video',
        contentUri: 'urn:vap:content:youtube:video:abc123xyz',
        dwellTimeMs: 30000,
        activeFocusRatio: 0.1, // unfocused background tab
        interactionEntropy: 0.5,
        viewportCoverageRatio: 1.0,
        mediaTelemetry: {
          playDurationMs: 30000,
          audioActive: false,
          playbackRate: 1.0
        }
      };

      const result = policy.evaluate(input);
      expect(result.verified).toBe(false);
      expect(result.outcome).toBe('REJECTED');
      expect(result.penalties.some((p) => p.includes('Background tab'))).toBe(true);
    });
  });

  describe('Article Archetype (Substack, Medium, Blogs)', () => {
    it('verifies completed longform article reading with scroll depth', () => {
      const input: SocialEvidenceInput = {
        platform: 'longform',
        archetype: 'article',
        contentUri: 'urn:vap:content:article:engineering.substack.com:p/deep-dive',
        dwellTimeMs: 60000,
        activeFocusRatio: 1.0,
        interactionEntropy: 0.85,
        viewportCoverageRatio: 0.8, // 80% scroll depth
        readingVelocityWpm: 250
      };

      const result = policy.evaluate(input);
      expect(result.verified).toBe(true);
      expect(result.outcome).toBe('VERIFIED');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.proofUrn).toContain('urn:vap:proof:social:longform:');
    });
  });
});
