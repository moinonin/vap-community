/**
 * Proof Retrieval API (VAE Sprint 11)
 *
 * REST endpoints for retrieving proofs by various criteria.
 */

import type { Router } from 'express';
import type { Proof } from '@verified-attention/core';
import { InMemoryProofStorage } from '@verified-attention/verifier';

export interface ProofFilter {
  proofId?: string;
  sessionId?: string;
  contentId?: string;
  verifierId?: string;
  state?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface ProofAPI {
  getByProofId(proofId: string): Promise<Proof | undefined>;
  getBySession(sessionId: string, opts?: ProofFilter): Promise<Proof[]>;
  getByContent(contentId: string, opts?: ProofFilter): Promise<Proof[]>;
  getByVerifier(verifierId: string, opts?: ProofFilter): Promise<Proof[]>;
  getByTimeRange(from: string, to: string, opts?: ProofFilter): Promise<Proof[]>;
  search(filter: ProofFilter): Promise<ProofSearchResult>;
}

export interface ProofSearchResult {
  proofs: Proof[];
  total: number;
  limit: number;
  offset: number;
}

// ─── In-Memory Proof API Implementation ──────────────────────────────────────

let _proofStorage: InMemoryProofStorage | null = null;

function getProofStorage(): InMemoryProofStorage {
  if (!_proofStorage) {
    _proofStorage = new InMemoryProofStorage();
  }
  return _proofStorage;
}

function setProofStorage(storage: InMemoryProofStorage): void {
  _proofStorage = storage;
}

export class ProofAPIHandler implements ProofAPI {
  async getByProofId(proofId: string): Promise<Proof | undefined> {
    return getProofStorage().get(proofId);
  }

  async getBySession(sessionId: string, opts?: ProofFilter): Promise<Proof[]> {
    let proofs = await getProofStorage().getBySession(sessionId);

    if (opts?.state) {
      proofs = proofs.filter(p => p.state === opts.state);
    }
    if (opts?.from) {
      proofs = proofs.filter(p => p.issuedAt >= opts.from!);
    }
    if (opts?.to) {
      proofs = proofs.filter(p => p.issuedAt <= opts.to!);
    }
    if (opts?.limit) {
      proofs = proofs.slice(opts.offset || 0, (opts.offset || 0) + opts.limit);
    }

    return proofs;
  }

  async getByContent(contentId: string, opts?: ProofFilter): Promise<Proof[]> {
    let proofs = await getProofStorage().getByContent(contentId);

    if (opts?.state) {
      proofs = proofs.filter(p => p.state === opts.state);
    }
    if (opts?.from) {
      proofs = proofs.filter(p => p.issuedAt >= opts.from!);
    }
    if (opts?.to) {
      proofs = proofs.filter(p => p.issuedAt <= opts.to!);
    }
    if (opts?.limit) {
      proofs = proofs.slice(opts.offset || 0, (opts.offset || 0) + opts.limit);
    }

    return proofs;
  }

  async getByVerifier(verifierId: string, opts?: ProofFilter): Promise<Proof[]> {
    let proofs = await getProofStorage().getByVerifier(verifierId);

    if (opts?.state) {
      proofs = proofs.filter(p => p.state === opts.state);
    }
    if (opts?.from) {
      proofs = proofs.filter(p => p.issuedAt >= opts.from!);
    }
    if (opts?.to) {
      proofs = proofs.filter(p => p.issuedAt <= opts.to!);
    }
    if (opts?.limit) {
      proofs = proofs.slice(opts.offset || 0, (opts.offset || 0) + opts.limit);
    }

    return proofs;
  }

  async getByTimeRange(from: string, to: string, _opts?: ProofFilter): Promise<Proof[]> {
    // In-memory storage doesn't support efficient time-range queries.
    // A real implementation would use indexed storage.
    return [];
  }

  async search(filter: ProofFilter): Promise<ProofSearchResult> {
    let proofs: Proof[] = [];
    const storage = getProofStorage();

    // Collect all proofs from all sessions
    const sessions = [...storage.getKeys()];
    for (const sessionId of sessions) {
      const sessionProofs = await storage.getBySession(sessionId);
      proofs.push(...sessionProofs);
    }

    // Apply filters
    if (filter.proofId) {
      proofs = proofs.filter(p => p.proofId === filter.proofId);
    }
    if (filter.sessionId) {
      proofs = proofs.filter(p => p.sessionId === filter.sessionId);
    }
    if (filter.contentId) {
      proofs = proofs.filter(p => p.contentId === filter.contentId);
    }
    if (filter.verifierId) {
      proofs = proofs.filter(p => p.verifierId === filter.verifierId);
    }
    if (filter.state) {
      proofs = proofs.filter(p => p.state === filter.state);
    }
    if (filter.from) {
      proofs = proofs.filter(p => p.issuedAt >= filter.from!);
    }
    if (filter.to) {
      proofs = proofs.filter(p => p.issuedAt <= filter.to!);
    }

    const total = proofs.length;
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    proofs = proofs.slice(offset, offset + limit);

    return { proofs, total, limit, offset };
  }
}

// ─── Router Factory (for Express integration) ────────────────────────────────

/**
 * Create an Express router with proof retrieval endpoints.
 * Assumes proofAPI is injected.
 */
export function createProofRouter(proofAPI: ProofAPI): Router {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const router: Router = {} as any;

  // GET /proofs/:proofId
  // router.get('/proofs/:proofId', async (req, res) => { ... });

  // GET /proofs/session/:sessionId
  // router.get('/proofs/session/:sessionId', async (req, res) => { ... });

  // GET /proofs/content/:contentId
  // router.get('/proofs/content/:contentId', async (req, res) => { ... });

  // GET /proofs/verifier/:verifierId
  // router.get('/proofs/verifier/:verifierId', async (req, res) => { ... });

  // GET /proofs/search
  // router.get('/proofs/search', async (req, res) => { ... });

  return router;
}
