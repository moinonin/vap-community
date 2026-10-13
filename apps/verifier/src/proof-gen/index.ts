/**
 * Proof Generation Pipeline (VAE Sprint 11)
 *
 * Async, batched, idempotent proof generation at scale.
 * Integrates with verification engine, audit log, and signing service.
 */

import { z } from 'zod';
import { ProofState } from '@verified-attention/core';
import type { Proof, UnsignedProof } from '@verified-attention/core';
import type { AuditEntry } from '@verified-attention/store-verification-audit';
import { getAuditLog } from '@verified-attention/store-verification-audit';
import { signWithHSM } from '@verified-attention/crypto-hsm';

// ─── Proof Generation Types ──────────────────────────────────────────────────

export const ProofGenerationJobSchema = z.object({
  jobId: z.string().min(1),
  sessionId: z.string().min(1),
  policyId: z.string().min(1),
  outcome: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE', 'REVIEW']),
  confidence: z.number().min(0).max(1),
  evidenceHash: z.string().min(1),
  evidenceCount: z.number().int().nonnegative(),
  evidenceTypes: z.array(z.string()),
  policyVersion: z.number().int().nonnegative(),
  passedChecks: z.array(z.string()),
  failedChecks: z.array(z.string()),
  warnings: z.array(z.string()),
  contentId: z.string().min(1),
  verifierId: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().min(1),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
  createdAt: z.string().datetime(),
  attempts: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(3),
});

export type ProofGenerationJob = z.infer<typeof ProofGenerationJobSchema>;

export const ProofGenerationResultSchema = z.object({
  jobId: z.string().min(1),
  success: z.boolean(),
  proof: z.unknown().optional(),
  error: z.string().optional(),
  attempts: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});

export type ProofGenerationResult = z.infer<typeof ProofGenerationResultSchema>;

export interface ProofSigner {
  sign(unsignedProof: UnsignedProof): Promise<string>;
}

export interface ProofStorage {
  save(proof: Proof): Promise<void>;
  get(proofId: string): Promise<Proof | undefined>;
  getBySession(sessionId: string): Promise<Proof[]>;
  getByContent(contentId: string): Promise<Proof[]>;
  getByVerifier(verifierId: string): Promise<Proof[]>;
}

export interface ProofGenerationPipeline {
  enqueue(job: ProofGenerationJob): Promise<void>;
  processBatch(batchSize: number): Promise<ProofGenerationResult[]>;
  processOne(job: ProofGenerationJob): Promise<ProofGenerationResult>;
  getQueueStats(): ProofQueueStats;
}

export interface ProofQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  oldestPendingMs: number;
}

// ─── In-Memory Proof Storage ─────────────────────────────────────────────────

class InMemoryProofStorageImpl implements ProofStorage {
  private proofs: Map<string, Proof> = new Map();
  private bySession: Map<string, Set<string>> = new Map();
  private byContent: Map<string, Set<string>> = new Map();
  private byVerifier: Map<string, Set<string>> = new Map();

  async save(proof: Proof): Promise<void> {
    this.proofs.set(proof.proofId, proof);

    // Index by session
    const sessionSet = this.bySession.get(proof.sessionId) || new Set();
    sessionSet.add(proof.proofId);
    this.bySession.set(proof.sessionId, sessionSet);

    // Index by content
    const contentSet = this.byContent.get(proof.contentId) || new Set();
    contentSet.add(proof.proofId);
    this.byContent.set(proof.contentId, contentSet);

    // Index by verifier
    const verifierSet = this.byVerifier.get(proof.verifierId) || new Set();
    verifierSet.add(proof.proofId);
    this.byVerifier.set(proof.verifierId, verifierSet);
  }

  async get(proofId: string): Promise<Proof | undefined> {
    return this.proofs.get(proofId);
  }

  async getBySession(sessionId: string): Promise<Proof[]> {
    const ids = this.bySession.get(sessionId) || new Set();
    return Array.from(ids).map(id => this.proofs.get(id)!).filter(Boolean);
  }

  async getByContent(contentId: string): Promise<Proof[]> {
    const ids = this.byContent.get(contentId) || new Set();
    return Array.from(ids).map(id => this.proofs.get(id)!).filter(Boolean);
  }

  async getByVerifier(verifierId: string): Promise<Proof[]> {
    const ids = this.byVerifier.get(verifierId) || new Set();
    return Array.from(ids).map(id => this.proofs.get(id)!).filter(Boolean);
  }

  // Test helper
  getKeys(): string[] {
    return Array.from(this.bySession.keys());
  }
}

// ─── Proof Signer Stub (HSM integration in separate package) ────────────────

class StubProofSignerImpl implements ProofSigner {
  async sign(unsignedProof: UnsignedProof): Promise<string> {
    // In production, this calls HSM/KMS
    // For now, return a deterministic mock signature
    const data = `${unsignedProof.proofId}:${unsignedProof.sessionId}:${unsignedProof.contentId}:${unsignedProof.confidence}:${unsignedProof.evidenceHash}:${unsignedProof.verifierId}`;
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

// ─── Proof Generation Pipeline Implementation ────────────────────────────────

class InMemoryProofGenerationPipelineImpl implements ProofGenerationPipeline {
  private queue: ProofGenerationJob[] = [];
  private processing: Set<string> = new Set();
  private completed: Set<string> = new Set();
  private failed: Map<string, string> = new Map();
  private proofStorage: ProofStorage;
  private signer: ProofSigner;
  private auditLog = getAuditLog();
  private jobCounter = 0;

  constructor(proofStorage?: ProofStorage, signer?: ProofSigner) {
    this.proofStorage = proofStorage || new InMemoryProofStorageImpl();
    this.signer = signer || new StubProofSignerImpl();
  }

  async enqueue(job: ProofGenerationJob): Promise<void> {
    // Check idempotency
    const existing = this.queue.find(j => j.idempotencyKey === job.idempotencyKey);
    if (existing) {
      return; // Already enqueued
    }

    // Check if already completed
    if (this.completed.has(job.idempotencyKey)) {
      return;
    }

    this.queue.push(job);
    this.queue.sort((a, b) => {
      const priorityOrder = { HIGH: 0, NORMAL: 1, LOW: 2 };
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  async processOne(job: ProofGenerationJob): Promise<ProofGenerationResult> {
    const startTime = Date.now();
    const jobId = job.jobId;

    this.processing.add(jobId);

    try {
      // Create unsigned proof
      const unsignedProof: UnsignedProof = {
        proofId: `urn:vap:proof:${jobId}`,
        sessionId: job.sessionId,
        contentId: job.contentId,
        confidence: job.confidence,
        evidenceHash: job.evidenceHash,
        verifierId: job.verifierId,
        state: ProofState.UNSIGNED,
        metadata: {
          policyId: job.policyId,
          verificationModelVersion: '1.0',
          fraudScore: 0,
          evidenceCount: job.evidenceCount,
          sessionDurationMs: 0,
        },
        baseMetadata: { createdAt: new Date().toISOString(), version: 1 },
      };

      // Sign the proof
      const signature = await this.signer.sign(unsignedProof);

      // Create signed proof
      const proof: Proof = {
        ...unsignedProof,
        signature,
        state: ProofState.SIGNED,
        issuedAt: new Date().toISOString(),
      };

      // Save to storage
      await this.proofStorage.save(proof);

      // Log to audit
      this.auditLog.append({
        sessionId: job.sessionId,
        policyId: job.policyId,
        outcome: job.outcome,
        confidence: job.confidence,
        evidenceHash: job.evidenceHash,
        evidenceCount: job.evidenceCount,
        evidenceTypes: job.evidenceTypes,
        policyVersion: job.policyVersion,
        passedChecks: job.passedChecks,
        failedChecks: job.failedChecks,
        warnings: job.warnings,
        inputSnapshot: job,
        verifierVersion: '1.0',
        correlationId: job.jobId,
      });

      this.processing.delete(jobId);
      this.completed.add(job.idempotencyKey);

      return {
        jobId,
        success: true,
        proof,
        attempts: job.attempts + 1,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      this.processing.delete(jobId);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.failed.set(jobId, errorMessage);

      return {
        jobId,
        success: false,
        error: errorMessage,
        attempts: job.attempts + 1,
        durationMs: Date.now() - startTime,
      };
    }
  }

  async processBatch(batchSize: number): Promise<ProofGenerationResult[]> {
    const results: ProofGenerationResult[] = [];

    // Get up to batchSize jobs that aren't processing
    const available = this.queue.filter(
      j => !this.processing.has(j.jobId) && j.attempts < j.maxAttempts
    );

    const batch = available.slice(0, batchSize);

    for (const job of batch) {
      const result = await this.processOne(job);
      results.push(result);

      // If failed and has retries, re-enqueue with incremented attempts
      if (!result.success && job.attempts + 1 < job.maxAttempts) {
        const retryJob: ProofGenerationJob = {
          ...job,
          attempts: job.attempts + 1,
          jobId: `${job.jobId}_retry${job.attempts + 1}`,
        };
        await this.enqueue(retryJob);
      }
    }

    // Remove completed jobs from queue
    const completedIds = new Set(results.filter(r => r.success).map(r => r.jobId));
    this.queue = this.queue.filter(j => !completedIds.has(j.jobId));

    return results;
  }

  getQueueStats(): ProofQueueStats {
    const now = Date.now();
    const pendingJobs = this.queue.filter(j => !this.processing.has(j.jobId));
    const oldestPendingMs = pendingJobs.length > 0
      ? now - Math.min(...pendingJobs.map(j => new Date(j.createdAt).getTime()))
      : 0;

    return {
      pending: pendingJobs.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      oldestPendingMs,
    };
  }
}

// ─── Pipeline Factory ────────────────────────────────────────────────────────

let _pipeline: ProofGenerationPipeline | null = null;

function getProofGenerationPipelineImpl(): ProofGenerationPipeline {
  if (!_pipeline) {
    _pipeline = new InMemoryProofGenerationPipelineImpl();
  }
  return _pipeline;
}

function setProofGenerationPipelineImpl(pipeline: ProofGenerationPipeline): void {
  _pipeline = pipeline;
}

// ─── Convenience Function ────────────────────────────────────────────────────

async function generateProofImpl(
  sessionId: string,
  contentId: string,
  verifierId: string,
  outcome: 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'REVIEW',
  confidence: number,
  evidenceHash: string,
  evidenceCount: number,
  evidenceTypes: string[],
  policyId: string,
  policyVersion: number,
  passedChecks: string[],
  failedChecks: string[],
  warnings: string[],
  metadata: Record<string, unknown> = {}
): Promise<ProofGenerationResult> {
  const pipeline = getProofGenerationPipelineImpl();
  const jobId = `proof_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const idempotencyKey = `${sessionId}:${contentId}:${verifierId}`;

  const job: ProofGenerationJob = {
    jobId,
    sessionId,
    policyId,
    outcome,
    confidence,
    evidenceHash,
    evidenceCount,
    evidenceTypes,
    policyVersion,
    passedChecks,
    failedChecks,
    warnings,
    contentId,
    verifierId,
    metadata,
    idempotencyKey,
    priority: 'NORMAL',
    createdAt: new Date().toISOString(),
    attempts: 0,
    maxAttempts: 3,
  };

  await pipeline.enqueue(job);
  const results = await pipeline.processBatch(1);
  return results[0]!;
}

// ─── Public Exports ──────────────────────────────────────────────────────────

export {
  InMemoryProofStorageImpl as InMemoryProofStorage,
  InMemoryProofGenerationPipelineImpl as InMemoryProofGenerationPipeline,
  getProofGenerationPipelineImpl as getProofGenerationPipeline,
  setProofGenerationPipelineImpl as setProofGenerationPipeline,
  generateProofImpl as generateProof,
};