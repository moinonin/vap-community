import { describe, expect, it } from 'vitest';
import { createContentScript } from './content';
import { MSG, type ObservationMessage } from './messages';
import type { RuntimeAdapter } from './runtime';
import type { DomAdapter } from '@verified-attention/browser-sdk';

class FakeRuntime {
  messages: unknown[] = [];
  async sendMessage(message: unknown): Promise<unknown> { this.messages.push(message); return undefined; }
  addListener(): () => void { return () => {}; }
}

class FakeDomAdapter implements DomAdapter {
  listeners = new Map<string, Array<(e: unknown) => void>>();
  intersectionCb?: (ratio: number, rect?: never) => void;

  listen(target: string, type: string, handler: (e: unknown) => void): () => void {
    const key = `${target}:${type}`;
    const list = this.listeners.get(key) ?? [];
    list.push(handler);
    this.listeners.set(key, list);
    return () => { this.listeners.set(key, (this.listeners.get(key) ?? []).filter((h) => h !== handler)); };
  }
  observeIntersection(_el: unknown, cb: (ratio: number, rect?: never) => void): () => void { this.intersectionCb = cb as typeof this.intersectionCb; return () => { this.intersectionCb = undefined; }; }

  trigger(target: string, type: string, event: unknown = {}): void {
    for (const h of this.listeners.get(`${target}:${type}`) ?? []) h(event);
  }
  scrollPosition() { return { x: 0, y: 0 }; }
  viewportSize() { return { width: 1280, height: 800 }; }
  visibilityState() { return 'visible'; }
  userAgent() { return undefined; } language() { return undefined; }
  timezone() { return 'UTC'; } devicePixelRatio() { return undefined; }
  platform() { return undefined; }
}

describe('createContentScript', () => {
  it('emits vap:observation messages to the background on observation events', () => {
    const runtime = new FakeRuntime();
    const adapter = new FakeDomAdapter();
    const content = createContentScript({ runtime: runtime as unknown as RuntimeAdapter, adapter });
    content.start();
    adapter.trigger('window', 'click', { clientX: 1, clientY: 1 });
    adapter.trigger('window', 'scroll', {});
    adapter.trigger('document', 'visibilitychange', {});
    adapter.intersectionCb?.(0.5, undefined);
    content.stop();
    const types = runtime.messages.filter((m): m is ObservationMessage => (m as ObservationMessage).type === MSG.OBSERVATION).map((m) => m.signalType);
    expect(types).toContain('CLICK');
    expect(types).toContain('SCROLL');
    expect(types).toContain('VIEWPORT_VISIBILITY');
  });

  it('stop() unsubscribes observers', () => {
    const runtime = new FakeRuntime();
    const adapter = new FakeDomAdapter();
    const content = createContentScript({ runtime: runtime as unknown as RuntimeAdapter, adapter });
    content.start();
    content.stop();
    adapter.trigger('window', 'click', { clientX: 5, clientY: 10 });
    expect(runtime.messages.length).toBe(0);
  });
});
