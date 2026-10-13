/**
 * Pipeline Observability Metrics
 *
 * Collects, aggregates, and exports metrics from the evidence processing pipeline:
 * - Throughput (evidence/sec)
 * - Latency (p50, p95, p99)
 * - Error rates
 * - Stage durations
 * - Queue depths
 *
 * @module @verified-attention/observability-pipeline-metrics
 */

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

/**
 * Metric sample
 */
export interface MetricSample {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

/**
 * Histogram bucket configuration
 */
export interface HistogramConfig {
  buckets: number[];
}

const DEFAULT_HISTOGRAM_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * Histogram result
 */
export interface HistogramResult {
  count: number;
  sum: number;
  buckets: Record<string, number>;
}

/**
 * In-memory metrics store
 */
export class MetricsCollector {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private labels = new Map<string, Record<string, string>>();
  private bucketConfig: Map<string, number[]>;

  constructor() {
    this.bucketConfig = new Map();
  }

  /**
   * Increment a counter
   */
  increment(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    const key = this.labelKey(name, labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + value);
    this.labels.set(key, labels);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.labelKey(name, labels);
    this.gauges.set(key, value);
    this.labels.set(key, labels);
  }

  /**
   * Observe a histogram value (latency, size, etc.)
   */
  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.labelKey(name, labels);
    let histogram = this.histograms.get(key);
    if (!histogram) {
      histogram = [];
      this.histograms.set(key, histogram);
    }
    histogram.push(value);
    this.labels.set(key, labels);
  }

  /**
   * Set custom histogram buckets for a metric name
   */
  setHistogramBuckets(name: string, buckets: number[]): void {
    this.bucketConfig.set(name, buckets);
  }

  /**
   * Get counter value
   */
  getCounter(name: string, labels: Record<string, string> = {}): number {
    return this.counters.get(this.labelKey(name, labels)) ?? 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, labels: Record<string, string> = {}): number {
    return this.gauges.get(this.labelKey(name, labels)) ?? 0;
  }

  /**
   * Get histogram result with buckets
   */
  getHistogram(name: string, labels: Record<string, string> = {}): HistogramResult {
    const key = this.labelKey(name, labels);
    const values = this.histograms.get(key) ?? [];
    const buckets = this.bucketConfig.get(name) ?? DEFAULT_HISTOGRAM_BUCKETS;

    const bucketCounts: Record<string, number> = {};
    for (const bucket of buckets) {
      bucketCounts[bucket.toString()] = values.filter(v => v <= bucket).length;
    }
    bucketCounts['+Inf'] = values.length;

    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      buckets: bucketCounts,
    };
  }

  /**
   * Get histogram quantiles (for latency p50/p95/p99)
   */
  getQuantile(name: string, quantile: number, labels: Record<string, string> = {}): number {
    const key = this.labelKey(name, labels);
    const values = [...(this.histograms.get(key) ?? [])].sort((a, b) => a - b);
    if (values.length === 0) return 0;

    const idx = Math.ceil(quantile * values.length) - 1;
    return values[Math.max(0, Math.min(values.length - 1, idx))] ?? 0;
  }

  /**
   * Export all metrics in Prometheus text format
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of this.counters) {
      const labels = this.labels.get(key) ?? {};
      const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
      lines.push(`# TYPE ${this.metricName(key)} counter`);
      lines.push(`${this.metricName(key)}${labelStr ? `{${labelStr}}` : ''} ${value}`);
    }

    // Gauges
    for (const [key, value] of this.gauges) {
      const labels = this.labels.get(key) ?? {};
      const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
      lines.push(`# TYPE ${this.metricName(key)} gauge`);
      lines.push(`${this.metricName(key)}${labelStr ? `{${labelStr}}` : ''} ${value}`);
    }

    // Histograms
    for (const [key, values] of this.histograms) {
      const name = this.metricName(key);
      const labels = this.labels.get(key) ?? {};
      const result = this.getHistogram(name, labels);
      const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
      lines.push(`# TYPE ${name} histogram`);
      for (const [bucket, count] of Object.entries(result.buckets)) {
        const bucketLabel = bucket === '+Inf' ? '+Inf' : bucket;
        lines.push(`${name}_bucket{le="${bucketLabel}"${labelStr ? `,${labelStr}` : ''}} ${count}`);
      }
      lines.push(`${name}_count${labelStr ? `{${labelStr}}` : ''} ${result.count}`);
      lines.push(`${name}_sum${labelStr ? `{${labelStr}}` : ''} ${result.sum}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.labels.clear();
  }

  /**
   * Get all metric samples
   */
  getSamples(): MetricSample[] {
    const samples: MetricSample[] = [];
    const now = Date.now();

    for (const [key, value] of this.counters) {
      samples.push({
        name: this.metricName(key),
        type: MetricType.COUNTER,
        value,
        labels: this.labels.get(key) ?? {},
        timestamp: now,
      });
    }

    for (const [key, value] of this.gauges) {
      samples.push({
        name: this.metricName(key),
        type: MetricType.GAUGE,
        value,
        labels: this.labels.get(key) ?? {},
        timestamp: now,
      });
    }

    return samples;
  }

  private labelKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels).sort().map(([k, v]) => `${k}=${v}`).join(',');
    return `${name}|${labelStr}`;
  }

  private metricName(key: string): string {
    return key.split('|')[0] ?? key;
  }
}

/**
 * Pipeline-specific metrics helper
 */
export class PipelineMetrics {
  private collector: MetricsCollector;

  constructor(collector?: MetricsCollector) {
    this.collector = collector ?? new MetricsCollector();
    this.collector.setHistogramBuckets('pipeline_stage_duration_seconds', DEFAULT_HISTOGRAM_BUCKETS);
  }

  /**
   * Record stage duration
   */
  recordStageDuration(stage: string, durationMs: number): void {
    this.collector.observe('pipeline_stage_duration_seconds', durationMs / 1000, { stage });
  }

  /**
   * Record evidence processed
   */
  recordEvidenceProcessed(count: number = 1): void {
    this.collector.increment('pipeline_evidence_processed_total', count);
  }

  /**
   * Record evidence rejected
   */
  recordEvidenceRejected(reason: string): void {
    this.collector.increment('pipeline_evidence_rejected_total', 1, { reason });
  }

  /**
   * Set queue depth gauge
   */
  setQueueDepth(stage: string, depth: number): void {
    this.collector.setGauge('pipeline_queue_depth', depth, { stage });
  }

  /**
   * Record error
   */
  recordError(stage: string, errorType: string): void {
    this.collector.increment('pipeline_errors_total', 1, { stage, error_type: errorType });
  }

  getCollector(): MetricsCollector {
    return this.collector;
  }
}

export default {
  MetricsCollector,
  PipelineMetrics,
  MetricType,
};
