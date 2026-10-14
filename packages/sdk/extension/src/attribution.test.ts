import { describe, it, expect, beforeEach } from 'vitest';
import { ExtensionAttributionStore, type PriorAttentionProofEntry } from './attribution';

describe('ExtensionAttributionStore (Sprint 16, Unit 9)', () => {
  let store: ExtensionAttributionStore;

  beforeEach(() => {
    store = new ExtensionAttributionStore();
  });

  it('stores proof and queries prior exposure within lookback window', () => {
    const entry: PriorAttentionProofEntry = {
      proofUrn: 'urn:vap:proof:social:linkedin:12345',
      organizationId: 'karakana',
      platform: 'linkedin',
      contentUri: 'urn:li:activity:12345',
      dwellTimeMs: 45000,
      confidenceScore: 0.94,
      timestamp: new Date().toISOString()
    };

    store.storeProof(entry);
    expect(store.getProofs().length).toBe(1);

    const voucher = store.queryPriorExposure({ organizationId: 'karakana', lookbackDays: 7 });
    expect(voucher).not.toBeNull();
    expect(voucher?.organizationId).toBe('karakana');
    expect(voucher?.platform).toBe('linkedin');
    expect(voucher?.confidenceScore).toBe(0.94);
    expect(voucher?.attestationSignature).toBeDefined();
  });

  it('returns null if proof is outside lookback window', () => {
    const oldTimestamp = new Date(Date.now() - 40 * 86400 * 1000).toISOString(); // 40 days ago
    const entry: PriorAttentionProofEntry = {
      proofUrn: 'urn:vap:proof:social:youtube:old_video',
      organizationId: 'karakana',
      platform: 'youtube',
      contentUri: 'urn:vap:content:youtube:video:old',
      dwellTimeMs: 60000,
      confidenceScore: 0.9,
      timestamp: oldTimestamp
    };

    store.storeProof(entry);
    const voucher = store.queryPriorExposure({ organizationId: 'karakana', lookbackDays: 30 });
    expect(voucher).toBeNull();
  });

  it('caps ring buffer to maxEntries', () => {
    for (let i = 0; i < 120; i++) {
      store.storeProof({
        proofUrn: `urn:vap:proof:social:x:${i}`,
        organizationId: 'karakana',
        platform: 'x',
        contentUri: `urn:vap:content:x:${i}`,
        dwellTimeMs: 10000,
        confidenceScore: 0.8,
        timestamp: new Date().toISOString()
      });
    }

    expect(store.getProofs().length).toBe(100);
  });
});
