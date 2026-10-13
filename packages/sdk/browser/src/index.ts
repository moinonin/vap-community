/**
 * @verified-attention/browser-sdk
 * Browser SDK for Verified Attention Protocol
 * 
 * Target: VAE 1.0 GA (Phase 5) - This is a skeleton implementation
 */

import { z } from 'zod';

// Configuration schema matching README documentation
export const VerifiedAttentionConfigSchema = z.object({
  policyId: z.string().min(1),
  contentId: z.string().min(1),
  onProof: z.function().args(z.any()).returns(z.void()),
  verifierUrl: z.string().url().optional(),
  autoStart: z.boolean().default(false),
});

export type VerifiedAttentionConfig = z.infer<typeof VerifiedAttentionConfigSchema>;

// Proof of Attention type
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

// Evidence types
export type EvidenceType = 
  | 'E-INTERACTION' 
  | 'E-VISIBLE' 
  | 'E-DURATION' 
  | 'E-CONTEXT' 
  | 'E-QUALITY' 
  | 'E-FRAUD-SIGNAL';

// Observation types from browser
export interface Observation {
  type: 'mouse_move' | 'scroll' | 'key_press' | 'viewport_change' | 'focus_event' | 'click' | 'hover';
  timestamp: number;
  data: Record<string, unknown>;
  sessionId: string;
}

/**
 * VerifiedAttention - Main SDK class
 * 
 * Matches the README documentation for VAE 1.0 GA target experience.
 * 
 * @example
 * ```typescript
 * import { VerifiedAttention } from '@verified-attention/browser-sdk';
 * 
 * const va = new VerifiedAttention({
 *   policyId: 'pol_reading_30s',
 *   contentId: 'article_12345',
 *   onProof: (proof) => console.log('Verified:', proof)
 * });
 * 
 * va.startSession();
 * ```
 */
export class VerifiedAttention {
  private config: VerifiedAttentionConfig;
  private sessionId: string | null = null;
  private observations: Observation[] = [];
  private isActive = false;
  private verifierUrl: string;
  private proofListeners: ((proof: ProofOfAttention) => void)[] = [];

  constructor(config: VerifiedAttentionConfig) {
    this.config = VerifiedAttentionConfigSchema.parse(config);
    this.verifierUrl = config.verifierUrl || 'https://verifier.verified-attention.org';
    
    if (config.autoStart) {
      this.startSession();
    }
  }

  /**
   * Start a new verification session
   */
  startSession(): string {
    this.sessionId = this.generateSessionId();
    this.observations = [];
    this.isActive = true;
    
    // Start observing user interactions
    this.attachEventListeners();
    
    console.log(`[VerifiedAttention] Session started: ${this.sessionId}`);
    return this.sessionId;
  }

  /**
   * Stop the current session and trigger verification
   */
  async stopSession(): Promise<ProofOfAttention | null> {
    if (!this.isActive || !this.sessionId) {
      console.warn('[VerifiedAttention] No active session to stop');
      return null;
    }

    this.isActive = false;
    this.detachEventListeners();

    // Send evidence to verifier for verification
    const proof = await this.requestVerification();
    
    if (proof) {
      this.config.onProof(proof);
      this.proofListeners.forEach(listener => listener(proof));
    }

    this.sessionId = null;
    return proof;
  }

  /**
   * Register a proof listener
   */
  onProof(listener: (proof: ProofOfAttention) => void): void {
    this.proofListeners.push(listener);
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if session is active
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Attach browser event listeners for observation collection
   */
  private attachEventListeners(): void {
    if (typeof window === 'undefined') return; // SSR guard

    const handleMouseMove = (e: MouseEvent) => this.recordObservation('mouse_move', { x: e.clientX, y: e.clientY });
    const handleScroll = () => this.recordObservation('scroll', { scrollY: window.scrollY, scrollX: window.scrollX });
    const handleKeyDown = (e: KeyboardEvent) => this.recordObservation('key_press', { key: e.key });
    const handleClick = (e: MouseEvent) => this.recordObservation('click', { x: e.clientX, y: e.clientY, target: e.target });
    const handleFocus = () => this.recordObservation('focus_event', { type: 'focus' });
    const handleBlur = () => this.recordObservation('focus_event', { type: 'blur' });
    const handleVisibilityChange = () => this.recordObservation('viewport_change', { 
      hidden: document.hidden, 
      visibilityState: document.visibilityState 
    });

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('keydown', handleKeyDown, { passive: true });
    window.addEventListener('click', handleClick, { passive: true });
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Store handlers for cleanup
    (this as any)._eventHandlers = {
      mousemove: handleMouseMove,
      scroll: handleScroll,
      keydown: handleKeyDown,
      click: handleClick,
      focus: handleFocus,
      blur: handleBlur,
      visibilitychange: handleVisibilityChange,
    };
  }

  /**
   * Detach browser event listeners
   */
  private detachEventListeners(): void {
    if (typeof window === 'undefined') return;
    
    const handlers = (this as any)._eventHandlers;
    if (handlers) {
      Object.entries(handlers).forEach(([event, handler]) => {
        if (event === 'visibilitychange') {
          document.removeEventListener(event, handler as EventListener);
        } else {
          window.removeEventListener(event, handler as EventListener);
        }
      });
      (this as any)._eventHandlers = null;
    }
  }

  /**
   * Record an observation
   */
  private recordObservation(type: Observation['type'], data: Record<string, unknown>): void {
    if (!this.isActive || !this.sessionId) return;

    const observation: Observation = {
      type,
      timestamp: Date.now(),
      data,
      sessionId: this.sessionId,
    };

    this.observations.push(observation);

    // Batch send observations periodically (in production)
    if (this.observations.length % 50 === 0) {
      this.flushObservations();
    }
  }

  /**
   * Flush observations to verifier (batched)
   */
  private async flushObservations(): Promise<void> {
    if (this.observations.length === 0) return;

    try {
      await fetch(`${this.verifierUrl}/api/v1/evidence/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          observations: this.observations.splice(0),
        }),
      });
    } catch (error) {
      console.error('[VerifiedAttention] Failed to flush observations:', error);
    }
  }

  /**
   * Request verification from verifier service
   */
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

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.status}`);
      }

      const proof = await response.json();
      return proof as ProofOfAttention;
    } catch (error) {
      console.error('[VerifiedAttention] Verification request failed:', error);
      return null;
    }
  }

  /**
   * Generate a session ID
   */
  private generateSessionId(): string {
    return `urn:vap:session:${crypto.randomUUID()}`;
  }
}

// Export for bundle
export default VerifiedAttention;