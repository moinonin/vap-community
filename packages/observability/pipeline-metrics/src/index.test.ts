import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector, PipelineMetrics, MetricType } from './index';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it('should increment counters', () => {
    collector.increment('test_counter', 1);
    collector.increment('test_counter', 2);
    expect(collector.getCounter('test_counter')).toBe(3);
  });

  it('should set gauges', () => {
    collector.setGauge('test_gauge', 42);
    expect(collector.getGauge('test_gauge')).toBe(42);
    collector.setGauge('test_gauge', 100);
    expect(collector.getGauge('test_gauge')).toBe(100);
  });

  it('should observe histogram values', () => {
    collector.observe('latency', 0.01);
    collector.observe('latency', 0.05);
    collector.observe('latency', 0.2);
    const result = collector.getHistogram('latency');
    expect(result.count).toBe(3);
    expect(result.sum).toBeCloseTo(0.26, 2);
  });

  it('should compute quantiles', () => {
    for (let i = 1; i <= 100; i++) collector.observe('latency', i / 1000);
    const p50 = collector.getQuantile('latency', 0.5);
    const p95 = collector.getQuantile('latency', 0.95);
    expect(p50).toBeGreaterThanOrEqual(0.04);
    expect(p50).toBeLessThanOrEqual(0.06);
    expect(p95).toBeGreaterThanOrEqual(0.09);
    expect(p95).toBeLessThanOrEqual(0.1);
  });

  it('should handle labeled metrics', () => {
    collector.increment('requests_total', 1, { method: 'GET', status: '200' });
    collector.increment('requests_total', 1, { method: 'GET', status: '200' });
    collector.increment('requests_total', 1, { method: 'POST', status: '201' });
    expect(collector.getCounter('requests_total', { method: 'GET', status: '200' })).toBe(2);
    expect(collector.getCounter('requests_total', { method: 'POST', status: '201' })).toBe(1);
  });

  it('should export Prometheus format', () => {
    collector.increment('http_requests_total', 5);
    collector.setGauge('queue_depth', 10);
    collector.observe('request_duration', 0.05);
    const exported = collector.exportPrometheus();
    expect(exported).toContain('http_requests_total');
    expect(exported).toContain('queue_depth');
    expect(exported).toContain('request_duration');
  });
});

describe('PipelineMetrics', () => {
  it('should record stage durations', () => {
    const pipeline = new PipelineMetrics();
    pipeline.recordStageDuration('dedup', 5.2);
    pipeline.recordStageDuration('dedup', 10.3);
    const result = pipeline.getCollector().getHistogram('pipeline_stage_duration_seconds', { stage: 'dedup' });
    expect(result.count).toBe(2);
  });

  it('should record evidence processed', () => {
    const pipeline = new PipelineMetrics();
    pipeline.recordEvidenceProcessed(10);
    pipeline.recordEvidenceProcessed(5);
    expect(pipeline.getCollector().getCounter('pipeline_evidence_processed_total')).toBe(15);
  });

  it('should record rejections with reason labels', () => {
    const pipeline = new PipelineMetrics();
    pipeline.recordEvidenceRejected('invalid_signature');
    pipeline.recordEvidenceRejected('invalid_signature');
    pipeline.recordEvidenceRejected('schema_mismatch');
    expect(pipeline.getCollector().getCounter('pipeline_evidence_rejected_total', { reason: 'invalid_signature' })).toBe(2);
    expect(pipeline.getCollector().getCounter('pipeline_evidence_rejected_total', { reason: 'schema_mismatch' })).toBe(1);
  });

  it('should set queue depth', () => {
    const pipeline = new PipelineMetrics();
    pipeline.setQueueDepth('enrichment', 500);
    expect(pipeline.getCollector().getGauge('pipeline_queue_depth', { stage: 'enrichment' })).toBe(500);
  });
});
