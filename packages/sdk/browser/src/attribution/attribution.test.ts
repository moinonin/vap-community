import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PriorAttentionHandshake, type PriorAttentionVoucher } from './index';

describe('PriorAttentionHandshake (Sprint 16, Unit 9)', () => {
  let handshake: PriorAttentionHandshake;

  beforeEach(() => {
    handshake = new PriorAttentionHandshake('karakana');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds attribution payload without voucher as direct_none', () => {
    const payload = handshake.buildAttributionPayload('conv_123', null);
    expect(payload.conversionId).toBe('conv_123');
    expect(payload.attributionSource).toBe('direct_none');
    expect(payload.voucher).toBeUndefined();
  });

  it('builds attribution payload with verified social voucher', () => {
    const voucher: PriorAttentionVoucher = {
      organizationId: 'karakana',
      platform: 'linkedin',
      proofUrn: 'urn:vap:proof:social:linkedin:post_999',
      exposureTimestamp: new Date().toISOString(),
      confidenceScore: 0.92,
      lookbackWindowDays: 30,
      attestationSignature: 'sig_mock_123'
    };

    const payload = handshake.buildAttributionPayload('conv_456', voucher);
    expect(payload.conversionId).toBe('conv_456');
    expect(payload.attributionSource).toBe('social:linkedin');
    expect(payload.voucher).toBeDefined();
    expect(payload.voucher?.confidenceScore).toBe(0.92);
  });

  it('handles requestPriorAttention message query response', async () => {
    const voucher: PriorAttentionVoucher = {
      organizationId: 'karakana',
      platform: 'youtube',
      proofUrn: 'urn:vap:proof:social:youtube:video_888',
      exposureTimestamp: new Date().toISOString(),
      confidenceScore: 0.88,
      lookbackWindowDays: 14,
      attestationSignature: 'sig_yt_888'
    };

    // Mock postMessage and event dispatch
    const originalPostMessage = (globalThis as any).window?.postMessage;
    const listeners: ((e: MessageEvent) => void)[] = [];

    (globalThis as any).window = {
      location: { href: 'https://karakana.io/signup' },
      addEventListener: (_: string, handler: (e: MessageEvent) => void) => {
        listeners.push(handler);
      },
      removeEventListener: (_: string, handler: (e: MessageEvent) => void) => {
        const idx = listeners.indexOf(handler);
        if (idx !== -1) listeners.splice(idx, 1);
      },
      postMessage: (msg: any) => {
        if (msg.type === 'VAP_PRIOR_ATTENTION_QUERY') {
          // Simulate extension replying with voucher
          setTimeout(() => {
            for (const l of listeners) {
              l({ data: { type: 'VAP_PRIOR_ATTENTION_RESPONSE', voucher } } as MessageEvent);
            }
          }, 10);
        }
      }
    };

    const result = await handshake.requestPriorAttention({ organizationId: 'karakana', timeoutMs: 200 });
    expect(result).not.toBeNull();
    expect(result?.platform).toBe('youtube');
    expect(result?.confidenceScore).toBe(0.88);

    if (originalPostMessage) {
      (globalThis as any).window.postMessage = originalPostMessage;
    }
  });
});
