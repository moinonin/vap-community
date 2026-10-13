/**
 * Consent gate.
 *
 * Evidence collection MUST NOT start until consent is granted. The gate
 * wraps session startup: without a provider the host application is assumed
 * responsible (consent implicitly granted); with a provider, start() only
 * resolves true when the provider reports GRANTED.
 */

import type { ConsentContext, ConsentDecision, ConsentProvider } from '../types';

export class ConsentGate {
  constructor(private readonly provider?: ConsentProvider) {}

  /** True when no provider is configured (host-managed consent). */
  get isImplicit(): boolean {
    return this.provider === undefined;
  }

  async ensureConsent(context: ConsentContext): Promise<ConsentDecision> {
    if (!this.provider) return { status: 'GRANTED' };
    const decision = await this.provider.requestConsent(context);
    return decision;
  }

  static isGranted(decision: ConsentDecision): boolean {
    return decision.status === 'GRANTED';
  }
}
