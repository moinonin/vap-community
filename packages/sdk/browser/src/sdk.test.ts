import { describe, expect, it, vi } from 'vitest';
import { VerifiedAttention } from './sdk';
import { FakeDomAdapter, FakeFetch, ManualTimers, sessionResponse } from './test-support';

function makeSdk(overrides: Record<string, unknown> = {}) {
  const adapter = new FakeDomAdapter();
  const fetch = new FakeFetch().setDefault(sessionResponse());
  const timers = new ManualTimers();
  const sdk = new VerifiedAttention({
    apiUrl: 'https://api.test',
    policyId: 'pol_1',
    contentId: 'article_1',
    adapter,
    fetchImpl: fetch.impl,
    timers,
    storage: null,
    viewerIdHash: 'viewer-hash',
    ...overrides,
  });
  return { sdk, adapter, fetch, timers };
}

describe('VerifiedAttention (SDK facade)', () => {
  it('consent gate blocks collection until consent is granted', async () => {
    const onConsentDenied = vi.fn();
    const requestConsent = vi.fn(() => ({ status: 'DENIED' as const }));
    const { sdk, fetch, adapter } = makeSdk({
      consentProvider: { requestConsent },
      onConsentDenied,
    });
    await expect(sdk.startSession()).rejects.toThrow(/consent not granted/);
    expect(onConsentDenied).toHaveBeenCalledOnce();
    // No session was created, and no listeners attached would emit:
    expect(fetch.calls).toHaveLength(0);
    adapter.trigger('window', 'click', { clientX: 1, clientY: 1 });
    await sdk.flush();
    expect(fetch.calls).toHaveLength(0);
  });

  it('consent pending works when first denied then granted (collection only after grant)', async () => {
    const requestConsent = vi
      .fn()
      .mockReturnValueOnce({ status: 'DENIED' })
      .mockReturnValueOnce({ status: 'GRANTED', consentId: 'consent-1' });
    const { sdk, fetch } = makeSdk({ consentProvider: { requestConsent } });
    await expect(sdk.startSession()).rejects.toThrow();
    const id = await sdk.startSession();
    expect(id).toBe('urn:vap:session:abc123');
    const created = fetch.calls[0]!.body as { participant: { consentId?: string } };
    expect(created.participant.consentId).toBe('consent-1');
    sdk.destroy();
  });

  it('full lifecycle: observers emit, session closes, stopSession resolves', async () => {
    const { sdk, adapter, fetch } = makeSdk();
    fetch.when(
      (url) => url.includes('/v1/proofs/'),
      { status: 404, body: { error: { code: 'NOT_FOUND', message: 'no proof yet' } } },
    );
    await sdk.startSession();
    expect(sdk.getIsActive()).toBe(true);
    adapter.trigger('window', 'click', { clientX: 5, clientY: 6, target: { tagName: 'A' } });
    adapter.trigger('window', 'scroll', {});
    adapter.trigger('window', 'focus');
    adapter.trigger('document', 'visibilitychange', {});
    adapter.intersectionCb?.(0.75, { x: 0, y: 10, width: 100, height: 200 });
    const proof = await sdk.stopSession();
    expect(sdk.getIsActive()).toBe(false);
    expect(sdk.getSessionId()).toBeNull();
    expect(proof).toBeUndefined(); // proof endpoint not live yet — resolved, not thrown
    // evidence posted to the ingestion API
    const evidenceCalls = fetch.calls.filter((c) => c.url.endsWith('/v1/evidence'));
    expect(evidenceCalls.length).toBeGreaterThanOrEqual(3); // context + visible + interaction (+duration)
    expect(
      fetch.calls.some((c) => c.url.endsWith('/close')),
    ).toBe(true);
    sdk.destroy();
  });

  it('invokes onProof when a proof is retrievable', async () => {
    const proof = { proofId: 'urn:vap:proof:1' };
    const fetch = new FakeFetch();
    const adapter = new FakeDomAdapter();
    const onProof = vi.fn();
    const sdk = new VerifiedAttention({
      apiUrl: 'https://api.test',
      policyId: 'p',
      contentId: 'c',
      adapter,
      fetchImpl: fetch.impl,
      timers: new ManualTimers(),
      storage: null,
      viewerIdHash: 'h',
      onProof,
    });
    fetch.setDefault(sessionResponse());
    fetch.when((url) => url.includes('/v1/proofs/'), { status: 200, body: proof });
    await sdk.startSession();
    const result = await sdk.stopSession();
    expect(result).toEqual(proof);
    expect(onProof).toHaveBeenCalledWith(proof);
    sdk.destroy();
  });

  it('startSession is idempotent while active', async () => {
    const { sdk, fetch } = makeSdk();
    const id1 = await sdk.startSession();
    const id2 = await sdk.startSession();
    expect(id1).toBe(id2);
    expect(fetch.calls.filter((c) => c.url.endsWith('/v1/sessions'))).toHaveLength(1);
    sdk.destroy();
  });
});
