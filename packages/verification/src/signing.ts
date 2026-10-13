/**
 * Proof signing service — signs an UnsignedProof with Ed25519 private key.
 * VAP Section 10: Proof lifecycle UNSIGNED → SIGNED.
 */

import { sign } from 'crypto';
import type { KeyObject } from 'crypto';
import type { Proof, UnsignedProof, ProofValidationResult } from '@verified-attention/core';

/**
 * Proof signing event emitted when a proof is signed.
 */
export interface ProofSignEvent {
  proofId: string;
  verifierId: string;
  keyId: string;
  timestamp: string;
  eventType: 'proof.signed';
}

/**
 * Event emitter callback for proof signing events.
 * Replace with real event bus in production.
 */
type EventListener = (event: ProofSignEvent) => void;
const listeners: EventListener[] = [];

export function onProofSigned(listener: EventListener): void {
  listeners.push(listener);
}

function emitProofSignEvent(proofId: string, verifierId: string, keyId: string): void {
  const event: ProofSignEvent = {
    proofId,
    verifierId,
    keyId,
    timestamp: new Date().toISOString(),
    eventType: 'proof.signed'
  };
  for (const l of listeners) {
    l(event);
  }
}

/**
 * Sign an unsigned proof with the verifier's Ed25519 private key.
 *
 * Signs the canonical serialization of the proof (serializeProof output).
 * Transitions state from UNSIGNED to SIGNED and sets issuedAt.
 *
 * @throws Error if the key is superseded (KEY_SUPERSEDED)
 */
export function signProof(
  unsigned: UnsignedProof,
  privateKey: KeyObject,
  verifierId: string,
  keyId: string,
  keyActive: boolean = true
): Proof {
  if (!keyActive) {
    throw new Error('KEY_SUPERSEDED: cannot sign with a superseded key');
  }

  // Sign the canonical serialization
  const data = Buffer.from(JSON.stringify({
    proofId: unsigned.proofId,
    sessionId: unsigned.sessionId,
    contentId: unsigned.contentId,
    confidence: unsigned.confidence,
    evidenceHash: unsigned.evidenceHash,
    verifierId: unsigned.verifierId
  }), 'utf8');

  const signature = sign(null, data, privateKey).toString('base64url');

  const signedProof: Proof = {
    ...unsigned,
    signature,
    state: 'SIGNED' as Proof['state'],
    issuedAt: new Date().toISOString()
  } as Proof;

  // Emit signing event
  emitProofSignEvent(signedProof.proofId, verifierId, keyId);

  return signedProof;
}
