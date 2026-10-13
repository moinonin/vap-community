/**
 * Operational Metrics (VAE Sprint 13)
 *
 * Throughput, latency, error rates, queue depths for operational monitoring.
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const OpsMetricsSnapshotSchema = z.object({
  timestamp: z.string().datetime(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  // Throughput
  evidenceIngested: z.number().int().nonnegative(),
  proofsGenerated: z.number().int().nonnegative(),
  verificationsCompleted: z.number().int().nonnegative(),
  // Latency (p50, p95, p99 in ms)
  latencyEvidenceIngestion: z.object({
    p50: z.number().nonnegative(),
    p95: z.number().nonnegative(),
    p99: z.number().nonnegative(),
  }),
  latencyProofGeneration: z.object({
    p50: z.number().nonnegative(),
    p95: z.number().nonnegative(),
    p99: z.number().nonnegative(),
  }),
  latencyVerification: z.object({
    p50: z.number().nonnegative(),
    p95: z.number().nonnegative(),
    p99: z.number().nonnegative(),
  }),
  // Error rates
  errorRateEvidence: z.number().min(0).max(1),
  errorRateProofGeneration: z.number().min(0).max(1),
  errorRateVerification: z.number().min(0).max(1),
  // Queue depths
  queueDepthEvidence: z.number().int().nonnegative(),
  queueDepthProofGen: z.number().int().nonnegative(),
  queueDepthVerification: z.number().int().nonnegative(),
  // System health
  cpuUsage: z.number().min(0).max(100),
  memoryUsage: z.number().min(0).max(100),
  diskUsage: z.number().min(0).max(100),
});

export type OpsMetricsSnapshot = z.infer<typeof OpsMetricsSnapshotSchema>;

export interface OpsMetrics {
  recordEvidenceIngestion(durationMs: number, success: boolean): void;
  recordProofGeneration(durationMs: number, success: boolean): void;
  recordVerification(durationMs: number, success: boolean): void;
  updateQueueDepth(evidence: number, proofGen: number, verification: number): void;
  updateSystemHealth(cpu: number, memory: number, disk: number): void;
  getSnapshot(windowStart?: string, windowEnd?: string): OpsMetricsSnapshot;
  getLatencyPercentiles(): {
    evidence: { p50: number; p95: number; p99: number };
    proofGen: { p50: number; p95: number; p99: number };
    verification: { p50: number; p95: number; p99: number };
  };
  getDailyTrend(days: number): OpsMetricsSnapshot[];
}

// ─── In-Memory Ops Metrics ────────────────────────────────────────────────────

export class OpsMetricsEngine implements OpsMetrics {
  private evidenceLatencies: number[] = [];
  private proofGenLatencies: number[] = [];
  private verificationLatencies: number[] = [];
  private evidenceErrors = 0;
  private proofGenErrors = 0;
  private verificationErrors = 0;
  private evidenceTotal = 0;
  private proofGenTotal = 0;
  private verificationTotal = 0;
  private queueDepths = { evidence: 0, proofGen: 0, verification: 0 };
  private systemHealth = { cpu: 0, memory: 0, disk: 0 };

  recordEvidenceIngestion(durationMs: number, success: boolean): void {
    this.evidenceLatencies.push(durationMs);
    this.evidenceTotal++;
    if (!success) this.evidenceErrors++;
  }

  recordProofGeneration(durationMs: number, success: boolean): void {
    this.proofGenLatencies.push(durationMs);
    this.proofGenTotal++;
    if (!success) this.proofGenErrors++;
  }

  recordVerification(durationMs: number, success: boolean): void {
    this.verificationLatencies.push(durationMs);
    this.verificationTotal++;
    if (!success) this.verificationErrors++;
  }

  updateQueueDepth(evidence: number, proofGen: number, verification: number): void {
    this.queueDepths = { evidence, proofGen, verification };
  }

  updateSystemHealth(cpu: number, memory: number, disk: number): void {
    this.systemHealth = { cpu, memory, disk };
  }

  getSnapshot(_windowStart?: string, _windowEnd?: string): OpsMetricsSnapshot {
    const now = new Date().toISOString();

    const evidenceP50 = this.percentile(this.evidenceLatencies, 0.50);
    const evidenceP95 = this.percentile(this.evidenceLatencies, 0.95);
    const evidenceP99 = this.percentile(this.evidenceLatencies, 0.99);

    const proofGenP50 = this.percentile(this.proofGenLatencies, 0.50);
    const proofGenP95 = this.percentile(this.proofGenLatencies, 0.95);
    const proofGenP99 = this.percentile(this.proofGenLatencies, 0.99);

    const verificationP50 = this.percentile(this.verificationLatencies, 0.50);
    const verificationP95 = this.percentile(this.verificationLatencies, 0.95);
    const verificationP99 = this.percentile(this.verificationLatencies, 0.99);

    return {
      timestamp: now,
      windowStart: now,
      windowEnd: now,
      evidenceIngested: this.evidenceTotal,
      proofsGenerated: this.proofGenTotal,
      verificationsCompleted: this.verificationTotal,
      latencyEvidenceIngestion: {
        p50: evidenceP50,
        p95: evidenceP95,
        p99: evidenceP99,
      },
      latencyProofGeneration: {
        p50: proofGenP50,
        p95: proofGenP95,
        p99: proofGenP99,
      },
      latencyVerification: {
        p50: verificationP50,
        p95: verificationP95,
        p99: verificationP99,
      },
      errorRateEvidence: this.evidenceTotal > 0
        ? this.evidenceErrors / this.evidenceTotal
        : 0,
      errorRateProofGeneration: this.proofGenTotal > 0
        ? this.proofGenErrors / this.proofGenTotal
        : 0,
      errorRateVerification: this.verificationTotal > 0
        ? this.verificationErrors / this.verificationTotal
        : 0,
      queueDepthEvidence: this.queueDepths.evidence,
      queueDepthProofGen: this.queueDepths.proofGen,
      queueDepthVerification: this.queueDepths.verification,
      cpuUsage: this.systemHealth.cpu,
      memoryUsage: this.systemHealth.memory,
      diskUsage: this.systemHealth.disk,
    };
  }

  getLatencyPercentiles(): {
    evidence: { p50: number; p95: number; p99: number };
    proofGen: { p50: number; p95: number; p99: number };
    verification: { p50: number; p95: number; p99: number };
  } {
    return {
      evidence: {
        p50: this.percentile(this.evidenceLatencies, 0.50),
        p95: this.percentile(this.evidenceLatencies, 0.95),
        p99: this.percentile(this.evidenceLatencies, 0.99),
      },
      proofGen: {
        p50: this.percentile(this.proofGenLatencies, 0.50),
        p95: this.percentile(this.proofGenLatencies, 0.95),
        p99: this.percentile(this.proofGenLatencies, 0.99),
      },
      verification: {
        p50: this.percentile(this.verificationLatencies, 0.50),
        p95: this.percentile(this.verificationLatencies, 0.95),
        p99: this.percentile(this.verificationLatencies, 0.99),
      },
    };
  }

  getDailyTrend(days: number): OpsMetricsSnapshot[] {
    const result: OpsMetricsSnapshot[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();

      result.push(this.getSnapshot(dayStart, dayEnd));
    }

    return result;
  }

  private percentile(data: number[], p: number): number {
    if (data.length === 0) return 0;
    const sorted = [...data].sort((a, b) => a - b);
    const index = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _engine: OpsMetrics | null = null;

export function getOpsMetrics(): OpsMetrics {
  if (!_engine) {
    _engine = new OpsMetricsEngine();
  }
  return _engine;
}

export function setOpsMetrics(engine: OpsMetrics): void {
  _engine = engine;
}
