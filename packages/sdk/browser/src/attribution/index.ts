/**
 * Prior Attention Handshake (Sprint 16, Unit 9)
 * First-party Browser SDK protocol for dark social attribution ("Where did you hear about us?").
 * Connects anonymous social exposure proofs (LinkedIn, YouTube, etc.) to website conversion events.
 */

export interface PriorAttentionVoucher {
  organizationId: string;
  platform: string;
  proofUrn: string;
  exposureTimestamp: string;
  confidenceScore: number;
  lookbackWindowDays: number;
  attestationSignature: string;
}

export interface ConversionAttributionPayload {
  conversionId: string;
  targetUrl: string;
  timestamp: string;
  voucher?: PriorAttentionVoucher;
  attributionSource: string;
}

export interface HandshakeOptions {
  organizationId: string;
  lookbackDays?: number;
  timeoutMs?: number;
}

export class PriorAttentionHandshake {
  private readonly orgId: string;

  constructor(organizationId: string) {
    this.orgId = organizationId;
  }

  /**
   * Request prior attention proofs held locally by the user's extension.
   * Returns a signed voucher if prior verified attention exists within the lookback window.
   */
  public async requestPriorAttention(options?: Partial<HandshakeOptions>): Promise<PriorAttentionVoucher | null> {
    const orgId = options?.organizationId ?? this.orgId;
    const lookbackDays = options?.lookbackDays ?? 30;
    const timeoutMs = options?.timeoutMs ?? 500;

    if (typeof window === 'undefined') {
      return null;
    }

    return new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('message', handleResponse);
          resolve(null);
        }
      }, timeoutMs);

      function handleResponse(event: MessageEvent) {
        if (event.data && event.data.type === 'VAP_PRIOR_ATTENTION_RESPONSE') {
          resolved = true;
          clearTimeout(timer);
          window.removeEventListener('message', handleResponse);
          const voucher = event.data.voucher as PriorAttentionVoucher | null;
          resolve(voucher);
        }
      }

      window.addEventListener('message', handleResponse);

      // Post inquiry to window (intercepted by VAP extension content script)
      window.postMessage(
        {
          type: 'VAP_PRIOR_ATTENTION_QUERY',
          organizationId: orgId,
          lookbackDays
        },
        '*'
      );
    });
  }

  /**
   * Build conversion event payload linked with the prior attention voucher.
   */
  public buildAttributionPayload(
    conversionId: string,
    voucher?: PriorAttentionVoucher | null
  ): ConversionAttributionPayload {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://localhost';
    return {
      conversionId,
      targetUrl: currentUrl,
      timestamp: new Date().toISOString(),
      voucher: voucher || undefined,
      attributionSource: voucher ? `social:${voucher.platform}` : 'direct_none'
    };
  }
}
