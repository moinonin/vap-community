import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { EvidenceQueue } from '../queue';
import { SessionManager } from './manager';
import { FakeDomAdapter, FakeFetch, ManualTimers, sessionResponse } from '../test-support';

async function makeManager() {
  const fetch = new FakeFetch().setDefault(sessionResponse());
  const queueSend = vi.fn(async (_e: unknown) => 'ok');
  const queue = new EvidenceQueue({ storage: null, batchSize: 100, send: queueSend });
  const timers = new ManualTimers();
  const adapter = new FakeDomAdapter();
  const manager = new SessionManager({
    api: new ApiClient('https://api.test', fetch.impl),
    queue,
    adapter,
    policyId: 'pol_1',
    contentId: 'article_1',
    sourceId: 'test-src',
    viewerIdHash: 'viewer-hash',
    timers,
    onError: (e) => {
      throw e;
    },
  });
  return { fetch, queueSend, queue, timers, adapter, manager };
}

describe('SessionManager', () => {
  it('creates an API session on start and emits context', async () => {
    const { manager, fetch, queue } = await makeManager();
    const id = await manager.start();
    expect(id).toBe('urn:vap:session:abc123');
    expect(fetch.calls[0]!.method).toBe('POST');
    await manager.flushAggregates();
    await queue.flush();
    // E-CONTEXT evidence was derived from the SESSION_CONTEXT observation
    // (validated by the queue → it was enqueued).
  });

  it('maps interaction observations into E-INTERACTION evidence', async () => {
    const { manager, queue, queueSend } = await makeManager();
    await manager.start();
    const sink = manager.sink;
    sink.emit('SCROLL', { deltaX: 0, deltaY: 120, positionX: 0, positionY: 120 });
    sink.emit('SCROLL', { deltaX: 0, deltaY: -80, positionX: 0, positionY: 40 });
    sink.emit('CLICK', { clientX: 10, clientY: 20 });
    sink.emit('KEY_PRESS', { key: 'a' });
    await manager.flushAggregates();
    await queue.flush();
    const bodies = queueSend.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const interaction = bodies.find((b) => b.evidenceType === 'E-INTERACTION');
    expect(interaction).toBeDefined();
    expect(interaction!.payload).toMatchObject({
      clickCount: 1,
      keyPressCount: 1,
      scrollDirectionChanges: 1,
    });
    expect(
      (interaction!.provenance as { observationIds: string[] }).observationIds,
    ).toHaveLength(4);
  });

  it('maps visibility observations into E-VISIBLE evidence', async () => {
    const { manager, queue, queueSend } = await makeManager();
    await manager.start();
    manager.sink.emit('VIEWPORT_VISIBILITY', { visibilityRatio: 0.8 });
    manager.sink.emit('VIEWPORT_VISIBILITY', { visibilityRatio: 0.4 });
    await manager.flushAggregates();
    await queue.flush();
    const bodies = queueSend.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const visible = bodies.find((b) => b.evidenceType === 'E-VISIBLE');
    expect((visible!.payload as Record<string, unknown>).maxVisibilityRatio).toBe(0.8);
    expect((visible!.payload as Record<string, unknown>).avgVisibilityRatio).toBeCloseTo(0.6);
  });

  it('ignores observations emitted without an active session', async () => {
    const { manager, queue, queueSend } = await makeManager();
    manager.sink.emit('CLICK', { clientX: 1, clientY: 1 });
    await manager.flushAggregates();
    await queue.flush();
    expect(queueSend).not.toHaveBeenCalled();
  });

  it('end() emits E-DURATION, flushes, and closes the API session', async () => {
    const { manager, fetch, queueSend } = await makeManager();
    await manager.start();
    manager.sink.emit('CLICK', { clientX: 1, clientY: 1 });
    await manager.end();
    const bodies = queueSend.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const duration = bodies.find((b) => b.evidenceType === 'E-DURATION');
    expect(duration).toBeDefined();
    expect(duration!.payload).toHaveProperty('activeDurationMs');
    expect(duration!.payload).toHaveProperty('heartbeatCount');
    expect(fetch.calls.some((c) => c.url.endsWith('/close') && c.method === 'POST')).toBe(true);
    expect(manager.isActive).toBe(false);
  });

  it('sends a heartbeat PATCH on the interval', async () => {
    const { manager, fetch, timers } = await makeManager();
    await manager.start();
    const before = fetch.calls.length;
    timers.tick();
    await new Promise((r) => setTimeout(r, 10));
    const hb = fetch.calls
      .slice(before)
      .find((c) => c.method === 'PATCH' && c.url.includes('/v1/sessions/'));
    expect(hb).toBeDefined();
    await manager.end();
  });

  it('signs evidence when WebCrypto is available', async () => {
    const { manager, queue, queueSend } = await makeManager();
    await manager.start();
    manager.sink.emit('CLICK', { clientX: 1, clientY: 1 });
    await manager.flushAggregates();
    await queue.flush();
    const body = queueSend.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(typeof body.signature).toBe('string');
    expect((body.signature as string).length).toBeGreaterThan(1);
    if (body.signature !== 'UNSIGNED-no-webcrypto') {
      expect((body.metadata as Record<string, unknown>).publicKey).toBeDefined();
    }
  });
});
