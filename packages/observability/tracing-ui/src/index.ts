/**
 * Tracing UI (VAE Sprint 13)
 *
 * Query interface for distributed traces (Jaeger/Tempo compatible).
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const TraceSpanSchema = z.object({
  traceId: z.string().min(1),
  spanId: z.string().min(1),
  parentSpanId: z.string().optional(),
  operationName: z.string().min(1),
  startTime: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  status: z.enum(['UNSET', 'OK', 'ERROR']),
  tags: z.array(z.object({
    key: z.string().min(1),
    value: z.unknown(),
  })).default([]),
  logs: z.array(z.object({
    timestamp: z.string().datetime(),
    event: z.string().min(1),
    attributes: z.record(z.unknown()).default({}),
  })).default([]),
  kind: z.enum(['INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER']).default('INTERNAL'),
});

export type TraceSpan = z.infer<typeof TraceSpanSchema>;

export const TraceQuerySchema = z.object({
  traceId: z.string().optional(),
  operationName: z.string().optional(),
  serviceName: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  minDurationMs: z.number().int().nonnegative().optional(),
  maxDurationMs: z.number().int().nonnegative().optional(),
  status: z.enum(['UNSET', 'OK', 'ERROR']).optional(),
  limit: z.number().int().positive().default(100),
  offset: z.number().int().nonnegative().default(0),
});

export type TraceQuery = z.infer<typeof TraceQuerySchema>;

export const TraceResultSchema = z.object({
  traces: z.array(z.object({
    traceId: z.string().min(1),
    rootSpan: TraceSpanSchema,
    spans: z.array(TraceSpanSchema),
    durationMs: z.number().int().nonnegative(),
    statusCode: z.enum(['UNSET', 'OK', 'ERROR']),
  })),
  total: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
});

export type TraceResult = z.infer<typeof TraceResultSchema>;

export interface TracingUI {
  storeSpan(span: TraceSpan): void;
  getTrace(traceId: string): TraceSpan[] | undefined;
  queryTraces(query: TraceQuery): TraceResult;
  getServiceList(): string[];
  getOperationList(serviceName?: string): string[];
  getSpanStats(operationName: string, days?: number): SpanStats;
}

export interface SpanStats {
  operationName: string;
  count: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  errorRate: number;
}

// ─── In-Memory Tracing ────────────────────────────────────────────────────────

export class TracingUIEngine implements TracingUI {
  private spans = new Map<string, TraceSpan[]>(); // traceId -> spans
  private spanIndex = new Map<string, TraceSpan>(); // spanId -> span
  private serviceOperations = new Map<string, Set<string>>();

  storeSpan(span: TraceSpan): void {
    const existing = this.spans.get(span.traceId) || [];
    existing.push(span);
    this.spans.set(span.traceId, existing);
    this.spanIndex.set(span.spanId, span);

    // Index by service/operation
    const service = span.tags.find(t => t.key === 'service.name')?.value as string;
    if (service) {
      if (!this.serviceOperations.has(service)) {
        this.serviceOperations.set(service, new Set());
      }
      this.serviceOperations.get(service)!.add(span.operationName);
    }
  }

  getTrace(traceId: string): TraceSpan[] | undefined {
    return this.spans.get(traceId);
  }

  queryTraces(query: TraceQuery): TraceResult {
    const matchingTraces: Array<{ traceId: string; spans: TraceSpan[] }> = [];

    for (const [traceId, spans] of this.spans) {
      const rootSpan = spans.find(s => !s.parentSpanId);
      if (!rootSpan) continue;

      // Apply filters
      if (query.traceId && traceId !== query.traceId) continue;
      if (query.operationName && !rootSpan.operationName.includes(query.operationName)) continue;
      if (query.startTime && rootSpan.startTime < query.startTime) continue;
      if (query.endTime && rootSpan.startTime > query.endTime) continue;
      if (query.minDurationMs && rootSpan.durationMs < query.minDurationMs) continue;
      if (query.maxDurationMs && rootSpan.durationMs > query.maxDurationMs) continue;
      if (query.status && rootSpan.status !== query.status) continue;

      matchingTraces.push({ traceId, spans });
    }

    matchingTraces.sort((a, b) => {
      const aStart = a.spans[0]?.startTime ?? '';
      const bStart = b.spans[0]?.startTime ?? '';
      return new Date(bStart).getTime() - new Date(aStart).getTime();
    });

    const total = matchingTraces.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const page = matchingTraces.slice(offset, offset + limit);

    const traces = page.map(({ traceId, spans }) => {
      const rootSpan = spans.find(s => !s.parentSpanId) ?? spans[0]!;
      return {
        traceId,
        rootSpan,
        spans,
        durationMs: rootSpan.durationMs,
        statusCode: rootSpan.status,
      };
    });

    return { traces, total, limit, offset };
  }

  getServiceList(): string[] {
    return Array.from(this.serviceOperations.keys());
  }

  getOperationList(serviceName?: string): string[] {
    if (serviceName) {
      const ops = this.serviceOperations.get(serviceName);
      return ops ? Array.from(ops) : [];
    }

    const allOps = new Set<string>();
    for (const ops of this.serviceOperations.values()) {
      for (const op of ops) {
        allOps.add(op);
      }
    }
    return Array.from(allOps);
  }

  getSpanStats(operationName: string, _days?: number): SpanStats {
    const allSpans = Array.from(this.spanIndex.values())
      .filter(s => s.operationName === operationName);

    if (allSpans.length === 0) {
      return {
        operationName,
        count: 0,
        avgDurationMs: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        errorRate: 0,
      };
    }

    const durations = allSpans.map(s => s.durationMs).sort((a, b) => a - b);
    const errors = allSpans.filter(s => s.status === 'ERROR').length;

    return {
      operationName,
      count: allSpans.length,
      avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50DurationMs: this.percentile(durations, 0.50),
      p95DurationMs: this.percentile(durations, 0.95),
      p99DurationMs: this.percentile(durations, 0.99),
      errorRate: errors / allSpans.length,
    };
  }

  private percentile(data: number[], p: number): number {
    if (data.length === 0) return 0;
    const index = Math.ceil(p * data.length) - 1;
    return data[Math.max(0, index)] ?? 0;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _engine: TracingUI | null = null;

export function getTracingUI(): TracingUI {
  if (!_engine) {
    _engine = new TracingUIEngine();
  }
  return _engine;
}

export function setTracingUI(engine: TracingUI): void {
  _engine = engine;
}
