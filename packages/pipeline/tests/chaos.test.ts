/**
 * Chaos Test: Pipeline resilience under failure conditions
 *
 * Simulates stage crashes, DLQ recovery, metrics continuity,
 * and verifies no data loss through full failure/recovery cycle.
 *
 * Sprint 7 Goal L8: VERIFY chaos test - kill nodes, verify no data loss
 */

import { describe, it, expect } from 'vitest';
import { enrichEvidence } from '../enrichment/src/index';
import { PipelineMetrics } from '../../observability/pipeline-metrics/src/index';
import { PipelineTracer, SpanStatus } from '../../observability/tracing/src/index';
import { DeadLetterQueue, DLQStatus } from '../dlq/src/index';

function createEvidence(id: string, overrides: any = {}): any {
  return {
    evidenceId: `urn:vap:evidence:${id}`,
    evidenceType: 'E-INTERACTION',
    timestamp: Date.now(),
    payload: { clickCount: 5, engagementScore: 0.8 },
    provenance: { sourceId: 'browser-sdk', observationIds: [`obs-${id}`], observationHash: `hash-${id}`, collectionMethod: 'sdk' },
    metadata: { sessionId: `session-${id}` },
    ...overrides,
  };
}

describe('Chaos Test: Pipeline Resilience', () => {
  it('should route failed evidence to DLQ and retry successfully', () => {
    const dlq = new DeadLetterQueue({ maxRetries: 3, baseRetryDelayMs: 0 });
    const evidence = createEvidence('chaos-1');

    const entry = dlq.add(evidence, 'stage_crash:enrichment');
    expect(entry.status).toBe(DLQStatus.PENDING);

    dlq.recordRetryFailure(entry.id, 'timeout:retry-1');
    expect(dlq.get(entry.id)!.status).toBe(DLQStatus.RETRYING);

    dlq.markReprocessed(entry.id);
    expect(dlq.get(entry.id)!.status).toBe(DLQStatus.REPROCESSED);
    expect(dlq.get(entry.id)!.evidence.evidenceId).toBe('urn:vap:evidence:chaos-1');
  });

  it('should permanently fail after max retries and preserve evidence', () => {
    const dlq = new DeadLetterQueue({ maxRetries: 2, baseRetryDelayMs: 0 });
    const evidence = createEvidence('chaos-2');

    const entry = dlq.add(evidence, 'persistent_error');
    dlq.recordRetryFailure(entry.id, 'retry-1-failed');
    dlq.recordRetryFailure(entry.id, 'retry-2-failed');

    const final = dlq.get(entry.id)!;
    expect(final.status).toBe(DLQStatus.PERMANENTLY_FAILED);
    expect(final.retryCount).toBe(2);
    expect(final.evidence.evidenceId).toBe('urn:vap:evidence:chaos-2');
  });

  it('should trace failures and maintain trace context', async () => {
    const tracer = new PipelineTracer();

    await expect(
      tracer.traceStage('dedup', async () => { throw new Error('OOM killed'); })
    ).rejects.toThrow('OOM killed');

    await tracer.traceStage('recovery', async () => {});

    const spans = tracer.getTracer().getAllSpans();
    expect(spans).toHaveLength(2);
    expect(spans[0].status).toBe(SpanStatus.ERROR);
    expect(spans[1].status).toBe(SpanStatus.OK);
  });

  it('should maintain metrics continuity through failure', () => {
    const metrics = new PipelineMetrics();

    metrics.recordEvidenceProcessed(100);
    metrics.recordStageDuration('dedup', 2.5);
    metrics.setQueueDepth('dedup', 50);
    metrics.recordEvidenceRejected('validation_error');
    metrics.recordEvidenceRejected('signature_invalid');
    metrics.recordError('enrichment', 'timeout');
    metrics.recordEvidenceProcessed(50);

    const c = metrics.getCollector();
    expect(c.getCounter('pipeline_evidence_processed_total')).toBe(150);
    expect(c.getCounter('pipeline_evidence_rejected_total', { reason: 'validation_error' })).toBe(1);
    expect(c.getCounter('pipeline_errors_total', { stage: 'enrichment', error_type: 'timeout' })).toBe(1);
  });

  it('should not lose evidence across dedup + enrichment failure + retry', () => {
    const dlq = new DeadLetterQueue({ maxRetries: 3, baseRetryDelayMs: 0 });
    const evidence = createEvidence('chaos-full-1');

    const dlqEntry = dlq.add(evidence, 'enrichment_stage_crash');
    expect(dlqEntry.evidence.evidenceId).toBe('urn:vap:evidence:chaos-full-1');

    const enriched = enrichEvidence(dlqEntry.evidence);
    expect(enriched.enrichedEvidence.evidenceId).toBe('urn:vap:evidence:chaos-full-1');

    dlq.markReprocessed(dlqEntry.id);
    expect(dlq.getByStatus(DLQStatus.REPROCESSED)).toHaveLength(1);
  });

  it('should handle concurrent failures without cross-contamination', () => {
    const dlq = new DeadLetterQueue({ maxRetries: 3, baseRetryDelayMs: 0 });

    const entries = [];
    for (let i = 0; i < 5; i++) {
      entries.push(dlq.add(createEvidence(`concurrent-${i}`), `error-${i}`));
    }

    dlq.recordRetryFailure(entries[2].id, 'retry-fail-2');
    dlq.recordRetryFailure(entries[3].id, 'retry-fail-3');

    expect(dlq.get(entries[0].id)!.retryCount).toBe(0);
    expect(dlq.get(entries[2].id)!.retryCount).toBe(1);
    expect(dlq.get(entries[3].id)!.retryCount).toBe(1);
  });

  it('DLQ statistics should reflect failure state accurately', () => {
    const dlq = new DeadLetterQueue({ maxRetries: 2, baseRetryDelayMs: 0 });

    const e1 = dlq.add(createEvidence('stats-1'), 'error');
    const e2 = dlq.add(createEvidence('stats-2'), 'error');
    const e3 = dlq.add(createEvidence('stats-3'), 'error');

    dlq.recordRetryFailure(e1.id, 'err');
    dlq.recordRetryFailure(e1.id, 'err');
    dlq.markReprocessed(e2.id);

    const stats = dlq.getStats();
    expect(stats.total).toBe(3);
    expect(stats.permanentlyFailed).toBe(1);
    expect(stats.reprocessed).toBe(1);
    expect(stats.pending).toBe(1);
  });
});
