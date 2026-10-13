/**
 * Distributed Tracing
 *
 * Provides span-based tracing for the evidence processing pipeline:
 * - Start/finish spans for each pipeline stage
 * - Context propagation across stages
 * - Span attributes for debugging
 * - Export to OpenTelemetry-compatible format
 *
 * @module @verified-attention/observability-tracing
 */

/**
 * Span status enum
 */
export enum SpanStatus {
  OK = 'OK',
  ERROR = 'ERROR',
  UNSET = 'UNSET',
}

/**
 * Span kind enum (OpenTelemetry compatible)
 */
export enum SpanKind {
  INTERNAL = 'INTERNAL',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  PRODUCER = 'PRODUCER',
  CONSUMER = 'CONSUMER',
}

/**
 * A single trace span
 */
export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime: number | null;
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
  status: SpanStatus;
  statusMessage: string | null;
}

/**
 * A span event (timestamped log within a span)
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, string | number | boolean>;
}

/**
 * Context for the current span
 */
export interface SpanContext {
  traceId: string;
  spanId: string;
}

/**
 * Generate a random hex ID (16 chars for spanId, 32 chars for traceId)
 */
function generateId(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * In-memory span storage (production would use OTLP exporter)
 */
export class Tracer {
  private completedSpans: Span[] = [];
  private activeSpans = new Map<string, Span>();

  /**
   * Start a new span and return its context
   */
  startSpan(
    name: string,
    parentSpanId: string | null = null,
    kind: SpanKind = SpanKind.INTERNAL,
    traceId?: string,
    attributes: Record<string, any> = {}
  ): Span & { context: SpanContext } {
    const span: Span = {
      traceId: traceId ?? generateId(32),
      spanId: generateId(16),
      parentSpanId,
      name,
      kind,
      startTime: Date.now(),
      endTime: null,
      attributes,
      events: [],
      status: SpanStatus.UNSET,
      statusMessage: null,
    };

    this.activeSpans.set(span.spanId, span);

    return {
      ...span,
      context: { traceId: span.traceId, spanId: span.spanId },
    };
  }

  /**
   * End a span by spanId
   */
  endSpan(spanId: string, status: SpanStatus = SpanStatus.OK, statusMessage: string | null = null): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.status = status;
    span.statusMessage = statusMessage;
    this.activeSpans.delete(spanId);
    this.completedSpans.push(span);
  }

  /**
   * Add an event to a span
   */
  addEvent(spanId: string, name: string, attributes: Record<string, any> = {}): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;
    span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  /**
   * Set an attribute on a span
   */
  setAttribute(spanId: string, key: string, value: any): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;
    span.attributes[key] = value;
  }

  /**
   * Get the trace parent for propagation
   */
  getTraceParent(spanId: string): string | null {
    const span = this.activeSpans.get(spanId);
    if (!span) return null;
    return `00-${span.traceId}-${span.spanId}-01`;
  }

  /**
   * Parse incoming traceparent header
   */
  static parseTraceParent(header: string): SpanContext | null {
    const parts = header.split('-');
    if (parts.length !== 4) return null;
    return {
      traceId: parts[1] ?? '',
      spanId: parts[2] ?? '',
    };
  }

  /**
   * Get all completed spans for a trace
   */
  getTraceSpans(traceId: string): Span[] {
    return this.completedSpans.filter(s => s.traceId === traceId);
  }

  /**
   * Get all completed spans
   */
  getAllSpans(): Span[] {
    return [...this.completedSpans];
  }

  /**
   * Get total span duration in milliseconds
   */
  getSpanDuration(span: Span): number {
    if (span.endTime === null) return 0;
    return span.endTime - span.startTime;
  }

  /**
   * Export spans in OTLP-like JSON format
   */
  exportJSON(): string {
    return JSON.stringify({
      resourceSpans: [{
        scopeSpans: [{
          spans: this.completedSpans.map(s => ({
            traceId: s.traceId,
            spanId: s.spanId,
            parentSpanId: s.parentSpanId,
            name: s.name,
            kind: s.kind,
            startTimeUnixNano: String(s.startTime * 1_000_000),
            endTimeUnixNano: String((s.endTime ?? s.startTime) * 1_000_000),
            attributes: Object.entries(s.attributes).map(([k, v]) => ({ key: k, value: { value: v } })),
            status: { code: s.status, message: s.statusMessage ?? '' },
          })),
        }],
      }],
    }, null, 2);
  }

  /**
   * Reset all spans (for testing)
   */
  reset(): void {
    this.completedSpans = [];
    this.activeSpans.clear();
  }
}

/**
 * Pipeline-tracing helper: wraps each pipeline stage in a span
 */
export class PipelineTracer {
  private tracer: Tracer;

  constructor(tracer?: Tracer) {
    this.tracer = tracer ?? new Tracer();
  }

  /**
   * Trace a pipeline stage execution
   */
  async traceStage(stage: string, fn: () => Promise<void>, parentSpanId?: string): Promise<void> {
    const span = this.tracer.startSpan(`pipeline.${stage}`, parentSpanId ?? null, SpanKind.INTERNAL);
    this.tracer.setAttribute(span.spanId, 'stage.name', stage);
    try {
      await fn();
      this.tracer.endSpan(span.spanId, SpanStatus.OK);
    } catch (error) {
      this.tracer.setAttribute(span.spanId, 'error', true);
      this.tracer.addEvent(span.spanId, 'exception', { error: String(error) });
      this.tracer.endSpan(span.spanId, SpanStatus.ERROR, String(error));
      throw error;
    }
  }

  getTracer(): Tracer {
    return this.tracer;
  }
}

export default {
  Tracer,
  PipelineTracer,
  SpanStatus,
  SpanKind,
};
