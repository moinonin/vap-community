/**
 * Multi-Archetype Social Attention Verification Policy (Sprint 16, Unit 6)
 * Conforms to SPEC-0020 (Omni-Channel Social & Brand Space Verification).
 */

import crypto from 'node:crypto';

export type Archetype = 'feed' | 'video' | 'article';

export interface SocialEvidenceInput {
  platform: string;
  archetype: Archetype;
  contentUri: string;
  organizationId?: string;
  dwellTimeMs: number;
  activeFocusRatio: number; // 0.0 to 1.0
  interactionEntropy: number; // 0.0 to 1.0
  viewportCoverageRatio: number; // 0.0 to 1.0
  readingVelocityWpm?: number;
  mediaTelemetry?: {
    playDurationMs?: number;
    audioActive?: boolean;
    playbackRate?: number;
    completionPercentage?: number;
  };
}

export interface SocialVerificationResult {
  verified: boolean;
  outcome: 'VERIFIED' | 'REJECTED' | 'FLAGGED_BOT';
  confidence: number;
  proofUrn?: string;
  reasons: string[];
  penalties: string[];
}

export class SocialAttentionPolicy {
  public readonly policyId = 'policy:social-attention-v1';
  public readonly name = 'Omni-Channel Social & Brand Space Attention Policy';

  public evaluate(input: SocialEvidenceInput): SocialVerificationResult {
    const reasons: string[] = [];
    const penalties: string[] = [];

    let score = 0;

    switch (input.archetype) {
      case 'feed': {
        // Feed weights: Dwell (40%), Focus (30%), Velocity Integrity (20%), Entropy (10%)
        const dwellFactor = Math.min(1.0, input.dwellTimeMs / 10000); // 10s is optimal read dwell
        const focusFactor = input.activeFocusRatio;
        const entropyFactor = input.interactionEntropy;

        let velocityFactor = 1.0;
        if (input.readingVelocityWpm && input.readingVelocityWpm > 900) {
          velocityFactor = 0.1;
          penalties.push(`Unrealistic reading velocity: ${input.readingVelocityWpm} WPM (>900 WPM bot cap)`);
        } else if (input.readingVelocityWpm && input.readingVelocityWpm > 600) {
          velocityFactor = 0.6;
          penalties.push(`High reading velocity: ${input.readingVelocityWpm} WPM`);
        }

        score = dwellFactor * 0.4 + focusFactor * 0.3 + velocityFactor * 0.2 + entropyFactor * 0.1;
        reasons.push(`Feed dwell: ${input.dwellTimeMs}ms (factor ${dwellFactor.toFixed(2)})`);
        break;
      }

      case 'video': {
        // Video weights: Focus (50%), Playback & Scrub Integrity (30%), Dwell (20%)
        const focusFactor = input.activeFocusRatio;
        const dwellFactor = Math.min(1.0, (input.mediaTelemetry?.playDurationMs || input.dwellTimeMs) / 30000);
        let playbackFactor = input.interactionEntropy; // includes scrub & speed penalty

        if (input.mediaTelemetry?.playbackRate && input.mediaTelemetry.playbackRate > 2.5) {
          playbackFactor *= 0.3;
          penalties.push(`Abnormal video playback rate: ${input.mediaTelemetry.playbackRate}x`);
        }

        if (input.activeFocusRatio < 0.4) {
          penalties.push(`Background tab video streaming detected (focus ratio: ${input.activeFocusRatio})`);
        }

        const audioBonus = input.mediaTelemetry?.audioActive ? 0.05 : 0.0;
        score = focusFactor * 0.5 + playbackFactor * 0.3 + dwellFactor * 0.2 + audioBonus;
        reasons.push(`Video active watch time: ${input.dwellTimeMs}ms`);
        break;
      }

      case 'article': {
        // Article weights: Scroll Progression (35%), Paragraph Dwell (35%), Focus (20%), Entropy (10%)
        const scrollFactor = input.viewportCoverageRatio; // scroll progression
        const dwellFactor = Math.min(1.0, input.dwellTimeMs / 45000); // 45s baseline
        const focusFactor = input.activeFocusRatio;
        const entropyFactor = input.interactionEntropy;

        score = scrollFactor * 0.35 + dwellFactor * 0.35 + focusFactor * 0.2 + entropyFactor * 0.1;
        reasons.push(`Article progression: ${(scrollFactor * 100).toFixed(0)}%, dwell: ${input.dwellTimeMs}ms`);
        break;
      }
    }

    const confidence = Number(Math.min(1.0, Math.max(0.0, score)).toFixed(2));

    if (penalties.some((p) => p.includes('bot cap'))) {
      return {
        verified: false,
        outcome: 'FLAGGED_BOT',
        confidence: Math.min(0.2, confidence),
        reasons,
        penalties
      };
    }

    if (confidence >= 0.65) {
      const digest = crypto
        .createHash('sha256')
        .update(`${input.platform}:${input.contentUri}:${input.dwellTimeMs}:${confidence}`)
        .digest('hex')
        .slice(0, 16);
      const proofUrn = `urn:vap:proof:social:${input.platform}:${digest}`;

      return {
        verified: true,
        outcome: 'VERIFIED',
        confidence,
        proofUrn,
        reasons,
        penalties
      };
    }

    return {
      verified: false,
      outcome: 'REJECTED',
      confidence,
      reasons,
      penalties
    };
  }
}
