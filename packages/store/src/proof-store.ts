/**
 * Append-only proof store (VAP Section 10)
 *
 * Proofs are immutable once stored. The store rejects duplicate proofIds,
 * supports retrieval by proofId, and listing by sessionId or contentId.
 * Updating or deleting a stored proof throws — corrections require a new
 * revocation or supplementary proof, not edits.
 */

import type { Proof } from '@verified-attention/core';

/**
 * Stored proof with storage metadata.
 */
export interface StoredProof {
  readonly proof: Proof;
  readonly storedAt: string;
  readonly storageIndex: number; // monotonic sequence
}

/**
 * In-memory append-only proof store.
 * Replace with persistent storage (Prisma, SQLite, etc.) in production.
 */
const proofStore: Map<string, StoredProof> = new Map();
const sessionIndex: Map<string, string[]> = new Map();
const contentIndex: Map<string, string[]> = new Map();
let monotonicCounter = 0;

/**
 * Store a signed proof. Append-only — rejects duplicate proofId.
 *
 * @throws Error if a proof with the same proofId already exists
 */
export function storeProof(proof: Proof): StoredProof {
  if (proofStore.has(proof.proofId)) {
    throw new Error(`PROOF_EXISTS: proof with id ${proof.proofId} already stored (append-only)`);
  }

  const stored: StoredProof = Object.freeze({
    proof: Object.freeze({ ...proof }),
    storedAt: new Date().toISOString(),
    storageIndex: monotonicCounter++
  });

  proofStore.set(proof.proofId, stored);

  // Update session index
  const sessionProofs = sessionIndex.get(proof.sessionId) ?? [];
  sessionProofs.push(proof.proofId);
  sessionIndex.set(proof.sessionId, sessionProofs);

  // Update content index
  const contentProofs = contentIndex.get(proof.contentId) ?? [];
  contentProofs.push(proof.proofId);
  contentIndex.set(proof.contentId, contentProofs);

  return stored;
}

/**
 * Retrieve a proof by its proofId.
 *
 * @returns the stored proof with metadata, or undefined if not found
 */
export function getProofById(proofId: string): StoredProof | undefined {
  return proofStore.get(proofId);
}

/**
 * List all proofs for a given sessionId, ordered by issuedAt descending.
 *
 * @returns array of stored proofs for the session
 */
export function listProofsBySession(sessionId: string): StoredProof[] {
  const proofIds = sessionIndex.get(sessionId) ?? [];
  return proofIds
    .map(id => proofStore.get(id))
    .filter((p): p is StoredProof => p !== undefined)
    .sort((a, b) => {
      const timeA = new Date(a.proof.issuedAt).getTime();
      const timeB = new Date(b.proof.issuedAt).getTime();
      return timeB - timeA; // descending
    });
}

/**
 * List all proofs for a given contentId.
 *
 * @returns array of stored proofs for the content
 */
export function listProofsByContent(contentId: string): StoredProof[] {
  const proofIds = contentIndex.get(contentId) ?? [];
  return proofIds
    .map(id => proofStore.get(id))
    .filter((p): p is StoredProof => p !== undefined)
    .sort((a, b) => {
      const timeA = new Date(a.proof.issuedAt).getTime();
      const timeB = new Date(b.proof.issuedAt).getTime();
      return timeB - timeA; // descending
    });
}

/**
 * Get the total count of stored proofs.
 */
export function getProofCount(): number {
  return proofStore.size;
}

/**
 * Clear the store (for testing only — never expose in production).
 */
export function _clearStore(): void {
  proofStore.clear();
  sessionIndex.clear();
  contentIndex.clear();
  monotonicCounter = 0;
}
