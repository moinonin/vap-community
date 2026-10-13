/**
 * Test-only fakes (not exported from the public bundle): a fake DomAdapter,
 * fake fetch, manual timers and in-memory storage. These let the whole SDK
 * be exercised in Node without a browser.
 */

import type { DomAdapter } from './dom';
import type { FetchLike, StorageAdapter, TimerAdapter } from './types';

export class FakeDomAdapter implements DomAdapter {
  listeners = new Map<string, Array<(e: unknown) => void>>();
  intersectionCb?: (ratio: number, rect?: { x: number; y: number; width: number; height: number }) => void;
  private scroll = { x: 0, y: 0 };

  listen(target: string, type: string, handler: (e: unknown) => void): () => void {
    const key = `${target}:${type}`;
    const list = this.listeners.get(key) ?? [];
    list.push(handler);
    this.listeners.set(key, list);
    return () => {
      const current = this.listeners.get(key) ?? [];
      this.listeners.set(key, current.filter((h) => h !== handler));
    };
  }

  observeIntersection(_el: unknown, cb: (ratio: number, rect?: never) => void): () => void {
    this.intersectionCb = cb as typeof this.intersectionCb;
    return () => {
      this.intersectionCb = undefined;
    };
  }

  trigger(target: 'window' | 'document', type: string, event: unknown = {}): void {
    for (const h of this.listeners.get(`${target}:${type}`) ?? []) h(event);
  }

  setScroll(x: number, y: number): void {
    this.scroll = { x, y };
  }

  scrollPosition() {
    return this.scroll;
  }
  viewportSize() {
    return { width: 1024, height: 768 };
  }
  visibilityState() {
    return 'visible';
  }
  userAgent() {
    return 'fake-agent/1.0';
  }
  language() {
    return 'en-US';
  }
  timezone() {
    return 'UTC';
  }
  devicePixelRatio() {
    return 2;
  }
  platform() {
    return 'fake';
  }
}

export type FetchResponse = { status: number; body?: unknown } | { throwMessage: string };

export class FakeFetch {
  calls: Array<{ url: string; method: string; body?: unknown }> = [];
  private responses: FetchResponse[] = [];
  private handlers: Array<{ match: (url: string) => boolean; response: FetchResponse }> = [];
  private defaultResponse: FetchResponse = { status: 201, body: {} };

  readonly impl: FetchLike = async (url, init) => {
    this.calls.push({
      url,
      method: init.method,
      body: init.body ? JSON.parse(init.body) : undefined,
    });
    const handler = this.handlers.find((h) => h.match(url));
    const next = handler
      ? handler.response
      : this.responses.length > 0
        ? this.responses.shift()!
        : this.defaultResponse;
    if ('throwMessage' in next) throw new Error(next.throwMessage);
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body,
    };
  };

  respondOnce(r: FetchResponse): this {
    this.responses.push(r);
    return this;
  }

  setDefault(r: FetchResponse): this {
    this.defaultResponse = r;
    return this;
  }

  /** Route-based response (checked before queued and default responses). */
  when(match: (url: string) => boolean, response: FetchResponse): this {
    this.handlers.push({ match, response });
    return this;
  }
}

export class ManualTimers implements TimerAdapter {
  handlers: Array<{ handler: () => void; ms: number; id: number }> = [];
  private nextId = 1;

  setInterval(handler: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.handlers.push({ handler, ms, id });
    return id;
  }

  clearInterval(id: unknown): void {
    this.handlers = this.handlers.filter((h) => h.id !== id);
  }

  tick(): void {
    for (const h of [...this.handlers]) h.handler();
  }
}

export class MemoryStorage implements StorageAdapter {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

/** A queue-validation-passing evidence record. */
export function makeEvidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    evidenceId: `urn:vap:evidence:${crypto.randomUUID()}`,
    sessionId: 'urn:vap:session:test-session',
    sourceId: 'test',
    timestamp: new Date().toISOString(),
    evidenceType: 'E-INTERACTION',
    confidence: 0.9,
    payload: { clickCount: 1 },
    provenance: {
      observationIds: [crypto.randomUUID()],
      observationHash: 'a'.repeat(64),
      sourceId: 'test',
      collectionMethod: 'sdk',
    },
    signature: 'test-sig',
    ...overrides,
  };
}

export const sessionResponse = (id = 'urn:vap:session:abc123'): FetchResponse => ({
  status: 201,
  body: { sessionId: id, state: 'CREATED' },
});
