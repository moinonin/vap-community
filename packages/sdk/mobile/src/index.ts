/**
 * @verified-attention/mobile-sdk
 * Mobile SDK for Verified Attention Protocol (React Native)
 * 
 * Target: VAE 1.0 GA (Phase 5) - This is a skeleton implementation
 */

import { z } from 'zod';

export const VerifiedAttentionConfigSchema = z.object({
  policyId: z.string().min(1),
  contentId: z.string().min(1),
  onProof: z.function().args(z.any()).returns(z.void()),
  verifierUrl: z.string().url().optional(),
  platform: z.enum(['ios', 'android']).optional(),
  autoStart: z.boolean().default(false),
});

export type VerifiedAttentionConfig = z.infer<typeof VerifiedAttentionConfigSchema>;

export interface ProofOfAttention {
  proofId: string;
  claimId: string;
  verifierId: string;
  issuedAt: string;
  expiresAt: string;
  confidence: number;
  evidenceClasses: string[];
  policyId: string;
  modelVersion: string;
  signature: string;
  publicKey: string;
}

export type EvidenceType = 
  | 'E-INTERACTION' 
  | 'E-VISIBLE' 
  | 'E-DURATION' 
  | 'E-CONTEXT' 
  | 'E-QUALITY' 
  | 'E-FRAUD-SIGNAL';

export interface Observation {
  type: 'touch' | 'scroll' | 'gesture' | 'app_state' | 'focus_event' | 'orientation';
  timestamp: number;
  data: Record<string, unknown>;
  sessionId: string;
}

/**
 * VerifiedAttention - Mobile SDK class
 * 
 * Supports both React Native (iOS/Android) and native implementations.
 * 
 * @example
 * ```typescript
 * import { VerifiedAttention } from '@verified-attention/mobile-sdk';
 * 
 * const va = new VerifiedAttention({
 *   policyId: 'pol_reading_30s',
 *   contentId: 'article_12345',
 *   onProof: (proof) => console.log('Verified:', proof),
 *   platform: 'ios'
 * });
 * 
 * va.startSession();
 * ```
 */
export class VerifiedAttention {
  private config: VerifiedAttentionConfig;
  private sessionId: string | null = null;
  private observations: Array<{
    type: string;
    timestamp: number;
    data: Record<string, unknown>;
    sessionId: string;
  }> = [];
  private isActive = false;
  private verifierUrl: string;
  private proofListeners: ((proof: ProofOfAttention) => void)[] = [];

  constructor(config: VerifiedAttentionConfig) {
    const parsed = VerifiedAttentionConfigSchema.parse(config);
    this.config = parsed;
    this.verifierUrl = config.verifierUrl || 'https://verifier.verified-attention.org';
    
    if (config.autoStart) {
      this.startSession();
    }
  }

  startSession(): string {
    this.sessionId = this.generateSessionId();
    this.observations = [];
    this.isActive = true;
    
    // Platform-specific observation setup
    this.setupPlatformObservers();
    
    console.log(`[VerifiedAttention Mobile] Session started: ${this.sessionId}`);
    return this.sessionId;
  }

  async stopSession(): Promise<ProofOfAttention | null> {
    if (!this.isActive || !this.sessionId) {
      console.warn('[VerifiedAttention Mobile] No active session to stop');
      return null;
    }

    this.isActive = false;
    this.teardownPlatformObservers();

    const proof = await this.requestVerification();
    
    if (proof) {
      this.config.onProof(proof);
    }

    this.sessionId = null;
    return proof;
  }

  onProof(listener: (proof: ProofOfAttention) => void): void {
    // Implementation for proof listener
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  private setupPlatformObservers(): void {
    // Platform-specific implementation
    // React Native: use AppState, PanResponder, Dimensions
    // Native iOS: NotificationCenter, UIScreen notifications
    // Native Android: ActivityLifecycleCallbacks, View callbacks
    console.log(`[VerifiedAttention Mobile] Platform observers setup for ${this.config.platform || 'auto'}`);
  }

  private teardownPlatformObservers(): void {
    // Cleanup platform observers
    console.log('[VerifiedAttention Mobile] Platform observers torn down');
  }

  private async requestVerification(): Promise<ProofOfAttention | null> {
    if (!this.sessionId) return null;

    try {
      const response = await fetch(`${this.verifierUrl}/api/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          contentId: this.config.contentId,
          policyId: this.config.policyId,
        }),
      });

      if (!response.ok) throw new Error(`Verification failed: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[VerifiedAttention Mobile] Verification request failed:', error);
      return null;
    }
  }

  private generateSessionId(): string {
    return `urn:vap:session:${crypto.randomUUID()}`;
  }
}

// Type definitions for ProofOfAttention
export interface ProofOfAttention {
  proofId: string;
  claimId: string;
  verifierId: string;
  issuedAt: string;
  expiresAt: string;
  confidence: number;
  evidenceClasses: string[];
  policyId: string;
  modelVersion: string;
  signature: string;
  publicKey: string;
}

export default VerifiedAttention;