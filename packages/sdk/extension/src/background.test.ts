import { describe, it, expect } from 'vitest';
import { ExtensionBackground } from './background';
import { MSG } from './messages';
import { createMemoryStore } from './runtime';
import type { FetchLike } from '@verified-attention/browser-sdk';

function makeBackground(overrides: Record<string, unknown> = {}) {
  const runtime = { addListener: () => () => {}, sendMessage: async () => undefined };
  const store = createMemoryStore();
  const fetchCalls: Array<{ url: string; method?: string; body?: unknown }> = [];
  const fetchImpl: FetchLike = (async (url: string, init?: { method?: string; body?: string }) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    fetchCalls.push({ url, method: init?.method, body });
    if (url.endsWith('/v1/sessions')) {
      return { ok: true, status: 201, json: async () => ({ sessionId: 'urn:vap:session:test-1' }) } as never;
    }
    return { ok: true, status: 201, json: async () => ({}) } as never;
  }) as unknown as FetchLike;
  const background = new ExtensionBackground({
    runtime: runtime as never,
    store,
    config: { apiUrl: 'https://api.test', policyId: 'pol_1', contentId: 'article_1', fetchImpl, ...overrides },
  });
  return { background, store, fetchCalls };
}

describe('ExtensionBackground', () => {
  it('blocks start when consent is not granted', async () => {
    const { background, fetchCalls } = makeBackground();
    const result = (await background.handle({ type: MSG.START })) as { ok: boolean; error?: string };
    expect(result.ok).toBe(false);
    expect(result.error).toContain('consent');
    expect(fetchCalls).toHaveLength(0);
  });

  it('starts a session after consent is granted', async () => {
    const { background, store, fetchCalls } = makeBackground();
    await store.set('vap:consent', 'granted');
    const result = (await background.handle({ type: MSG.START })) as { ok: boolean; sessionId?: string };
    expect(result.ok).toBe(true);
    expect(result.sessionId).toBeTruthy();
    expect(fetchCalls.some((c) => c.url.endsWith('/v1/sessions'))).toBe(true);
  });

  it('accepts observations only while a session is active', async () => {
    const { background, store } = makeBackground();
    let result = await background.handle({ type: MSG.OBSERVATION, signalType: 'CLICK', payload: { x: 1 } });
    expect(result).toEqual({ ok: true });

    await store.set('vap:consent', 'granted');
    await background.handle({ type: MSG.START });
    result = await background.handle({ type: MSG.OBSERVATION, signalType: 'CLICK', payload: { x: 1 } });
    expect(result).toEqual({ ok: true });

    const status = (await background.handle({ type: MSG.STATUS })) as { active: boolean };
    expect(status.active).toBe(true);
  });

  it('stop ends the session and flushes the queue', async () => {
    const { background, store, fetchCalls } = makeBackground();
    await store.set('vap:consent', 'granted');
    await background.handle({ type: MSG.START });
    await background.handle({ type: MSG.OBSERVATION, signalType: 'SCROLL', payload: { deltaY: 10 } });
    await background.handle({ type: MSG.STOP });
    const status = (await background.handle({ type: MSG.STATUS })) as { active: boolean };
    expect(status.active).toBe(false);
    expect(fetchCalls.some((c) => c.url.includes('/close'))).toBe(true);
    expect(fetchCalls.some((c) => c.url.endsWith('/v1/evidence'))).toBe(true);
  });

  it('rejects unknown messages', async () => {
    const { background } = makeBackground();
    const result = await background.handle({ type: 'vap:unknown' });
    expect(result).toEqual({ ok: false, error: 'unknown message' });
  });

  it('records consent toggle from popup', async () => {
    const { background, store } = makeBackground();
    await background.handle({ type: MSG.CONSENT, granted: true });
    expect(await store.get('vap:consent')).toBe('granted');
  });
});
