/**
 * @verified-attention/extension-sdk
 * Browser Extension SDK for Verified Attention Protocol
 * 
 * Target: VAE 1.0 GA (Phase 5) - This is a skeleton implementation
 */

import { z } from 'zod';

export const VerifiedAttentionConfigSchema = z.object({
  policyId: z.string().min(1),
  contentId: z.string().min(1),
  onProof: z.function().args(z.any()).returns(z.void()),
  verifierUrl: z.string().url().optional(),
  manifestVersion: z.enum(['v2', 'v3']).default('v3'),
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
  type: 'content_script' | 'popup' | 'background' | 'tab' | 'page_load' | 'visibility';
  timestamp: number;
  data: Record<string, unknown>;
  sessionId: string;
  tabId?: number;
  frameId?: number;
}

/**
 * VerifiedAttention - Extension SDK class
 * 
 * Supports Manifest V2 and V3 browser extensions (Chrome, Firefox, Edge).
 * 
 * @example
 * ```typescript
 * import { VerifiedAttention } from '@verified-attention/extension-sdk';
 * 
 * const va = new VerifiedAttention({
 *   policyId: 'pol_reading_30s',
 *   contentId: 'page_url_12345',
 *   onProof: (proof) => console.log('Verified:', proof),
 *   manifestVersion: 'v3'
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
    tabId?: number;
    frameId?: number;
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
    
    this.setupExtensionObservers();
    
    console.log(`[VerifiedAttention Extension] Session started: ${this.sessionId}`);
    return this.sessionId;
  }

  async stopSession(): Promise<ProofOfAttention | null> {
    if (!this.isActive || !this.sessionId) {
      console.warn('[VerifiedAttention Extension] No active session to stop');
      return null;
    }

    this.isActive = false;
    this.teardownExtensionObservers();

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

  private setupExtensionObservers(): void {
    // Manifest V3: content scripts, service worker, offscreen documents
    // Manifest V2: background page, content scripts
    // Use chrome.runtime, chrome.tabs, chrome.webNavigation APIs
    console.log(`[VerifiedAttention Extension] Extension observers setup for Manifest ${this.config.manifestVersion}`);
  }

  private teardownExtensionObservers(): void {
    console.log('[VerifiedAttention Extension] Extension observers torn down');
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
      console.error('[VerifiedAttention Extension] Verification request failed:', error);
      return null;
    }
  }

  private generateSessionId(): string {
    return `urn:vap:session:${crypto.randomUUID()}`;
  }
}

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