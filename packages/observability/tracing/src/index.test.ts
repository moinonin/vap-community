import { describe, it, expect, beforeEach } from 'vitest';
import { Tracer, PipelineTracer, SpanStatus, SpanKind } from './index';

describe('Tracer', () => {
  let tracer: Tracer;

  beforeEach(() => {
    tracer = new Tracer();
  });

  it('should start and end spans', () => {
    const span = tracer.startSpan('test');
    expect(span.name).toBe('test');
    expect(span.spanId).toHaveLength(16);
    expect(span.traceId).toHaveLength(32);
    expect(span.parentSpanId).toBeNull();
    tracer.endSpan(span.spanId);
    expect(span.endTime).toBeNull();
    const completed = tracer.getAllSpans();
    expect(completed).toHaveLength(1);
    expect(completed[0].endTime).not.toBeNull();
  });

  it('should chain spans via parentSpanId', () => {
    const parent = tracer.startSpan('parent');
    const child = tracer.startSpan('child', parent.spanId, SpanKind.INTERNAL, parent.traceId);
    expect(child.parentSpanId).toBe(parent.spanId);
    expect(child.traceId).toBe(parent.traceId);
  });

  it('should add events to spans', () => {
    const span = tracer.startSpan('test');
    tracer.addEvent(span.spanId, 'checkpoint', { step: 1 });
    tracer.addEvent(span.spanId, 'checkpoint', { step: 2 });
    tracer.endSpan(span.spanId);
    const completed = tracer.getTraceSpans(span.traceId);
    expect(completed[0].events).toHaveLength(2);
    expect(completed[0].events[0].attributes.step).toBe(1);
  });

  it('should set span attributes', () => {
    const span = tracer.startSpan('test');
    tracer.setAttribute(span.spanId, 'evidence.id', 'test-eid-1');
    tracer.setAttribute(span.spanId, 'count', 42);
    tracer.endSpan(span.spanId);
    const completed = tracer.getAllSpans();
    expect(completed[0].attributes['evidence.id']).toBe('test-eid-1');
    expect(completed[0].attributes.count).toBe(42);
  });

  it('should export JSON', () => {
    const span = tracer.startSpan('test');
    tracer.endSpan(span.spanId);
    const json = tracer.exportJSON();
    const parsed = JSON.parse(json);
    expect(parsed.resourceSpans[0].scopeSpans[0].spans).toHaveLength(1);
    expect(parsed.resourceSpans[0].scopeSpans[0].spans[0].name).toBe('test');
  });

  it('should generate traceparent for propagation', () => {
    const span = tracer.startSpan('test');
    const tp = tracer.getTraceParent(span.spanId);
    expect(tp).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    const parsed = Tracer.parseTraceParent(tp);
    expect(parsed).not.toBeNull();
    expect(parsed!.traceId).toBe(span.traceId);
    expect(parsed!.spanId).toBe(span.spanId);
  });
});

describe('PipelineTracer', () => {
  it('should trace successful stages', async () => {
    const tracer = new PipelineTracer();
    await tracer.traceStage('dedup', async () => {
      // simulate work
    });
    const spans = tracer.getTracer().getAllSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('pipeline.dedup');
    expect(spans[0].status).toBe(SpanStatus.OK);
  });

  it('should trace failed stages', async () => {
    const tracer = new PipelineTracer();
    await expect(tracer.traceStage('enrichment', async () => {
      throw new Error('timeout');
    })).rejects.toThrow('timeout');
    const spans = tracer.getTracer().getAllSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].status).toBe(SpanStatus.ERROR);
    expect(spans[0].attributes.error).toBe(true);
  });
});
