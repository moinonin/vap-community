/**
 * Tracing UI Tests (VAE Sprint 13)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTracingUI, type TracingUI, type TraceSpan } from './index';

describe('Tracing UI', () => {
  let tracingUI;

  beforeEach(() => {
    vi.resetModules();
    tracingUI = getTracingUI();
  });

  it('stores a span', () => {
    const span: TraceSpan = {
      traceId: 'trace-1',
      spanId: 'span-1',
      operationName: 'GET /proofs',
      startTime: new Date().toISOString(),
      durationMs: 50,
      status: 'OK',
      tags: [{ key: 'service.name', value: 'api' }],
      logs: [],
      kind: 'SERVER',
    };
    tracingUI.storeSpan(span);
    const trace = tracingUI.getTrace('trace-1');
    expect(trace).toBeDefined();
    expect(trace!.length).toBe(1);
    expect(trace![0].operationName).toBe('GET /proofs');
  });

  it('queries traces', () => {
    tracingUI.storeSpan({
      traceId: 'trace-1',
      spanId: 'span-1',
      operationName: 'GET /proofs',
      startTime: new Date().toISOString(),
      durationMs: 50,
      status: 'OK',
      tags: [{ key: 'service.name', value: 'api' }],
      logs: [],
      kind: 'SERVER',
    });
    tracingUI.storeSpan({
      traceId: 'trace-2',
      spanId: 'span-2',
      operationName: 'POST /proofs',
      startTime: new Date().toISOString(),
      durationMs: 100,
      status: 'OK',
      tags: [{ key: 'service.name', value: 'api' }],
      logs: [],
      kind: 'SERVER',
    });

    const result = tracingUI.queryTraces({ limit: 10 });
    expect(result.traces.length).toBe(2);
    expect(result.total).toBe(2);
  });

  it('queries by operation name', () => {
    tracingUI.storeSpan({
      traceId: 'trace-1',
      spanId: 'span-1',
      operationName: 'GET /proofs',
      startTime: new Date().toISOString(),
      durationMs: 50,
      status: 'OK',
      tags: [],
      logs: [],
      kind: 'SERVER',
    });
    tracingUI.storeSpan({
      traceId: 'trace-2',
      spanId: 'span-2',
      operationName: 'POST /evidence',
      startTime: new Date().toISOString(),
      durationMs: 100,
      status: 'OK',
      tags: [],
      logs: [],
      kind: 'SERVER',
    });

    const result = tracingUI.queryTraces({ operationName: 'GET /proofs', limit: 10 });
    expect(result.traces.length).toBe(1);
    expect(result.traces[0].rootSpan.operationName).toBe('GET /proofs');
  });

  it('gets service list', () => {
    tracingUI.storeSpan({
      traceId: 'trace-1',
      spanId: 'span-1',
      operationName: 'GET /proofs',
      startTime: new Date().toISOString(),
      durationMs: 50,
      status: 'OK',
      tags: [{ key: 'service.name', value: 'api' }],
      logs: [],
      kind: 'SERVER',
    });
    tracingUI.storeSpan({
      traceId: 'trace-2',
      spanId: 'span-2',
      operationName: 'GET /evidence',
      startTime: new Date().toISOString(),
      durationMs: 50,
      status: 'OK',
      tags: [{ key: 'service.name', value: 'verifier' }],
      logs: [],
      kind: 'SERVER',
    });

    const services = tracingUI.getServiceList();
    expect(services).toContain('api');
    expect(services).toContain('verifier');
  });

  it('gets operation list', () => {
    tracingUI.storeSpan({
      traceId: 'trace-1',
      spanId: 'span-1',
      operationName: 'GET /proofs',
      startTime: new Date().toISOString(),
      durationMs: 50,
      status: 'OK',
      tags: [],
      logs: [],
      kind: 'SERVER',
    });

    const ops = tracingUI.getOperationList();
    expect(ops).toContain('GET /proofs');
  });

  it('gets span stats', () => {
    for (let i = 0; i < 10; i++) {
      tracingUI.storeSpan({
        traceId: `trace-${i}`,
        spanId: `span-${i}`,
        operationName: 'GET /proofs',
        startTime: new Date().toISOString(),
        durationMs: 50 + i * 10,
        status: i === 5 ? 'ERROR' : 'OK',
        tags: [],
        logs: [],
        kind: 'SERVER',
      });
    }

    const stats = tracingUI.getSpanStats('GET /proofs');
    expect(stats.count).toBe(10);
    expect(stats.errorRate).toBe(0.1);
    expect(stats.avgDurationMs).toBeGreaterThan(0);
  });

  it('returns empty for non-existent trace', () => {
    const trace = tracingUI.getTrace('nonexistent');
    expect(trace).toBeUndefined();
  });

  it('returns empty stats for non-existent operation', () => {
    const stats = tracingUI.getSpanStats('NONEXISTENT');
    expect(stats.count).toBe(0);
    expect(stats.avgDurationMs).toBe(0);
  });
});
