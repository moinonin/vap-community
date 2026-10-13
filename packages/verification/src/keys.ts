/**
 * Verifier key management — Ed25519 key generation, rotation, and export.
 * VAP Section 10: Proof signing requires Ed25519 keys.
 */

import { generateKeyPairSync, type KeyObject } from 'crypto';
import { randomUUID } from 'crypto';

/**
 * A verifier key pair with metadata.
 */
export interface VerifierKeyPair {
  keyId: string;
  verifierId: string;
  publicKey: string;   // base64url
  privateKey: KeyObject; // Ed25519 — never serialized
  state: 'active' | 'superseded';
  createdAt: string;
  supersededAt?: string;
}

/**
 * Generate a new Ed25519 key pair for a verifier.
 */
export function generateKeyPair(verifierId: string): VerifierKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    keyId: randomUUID(),
    verifierId,
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64url'),
    privateKey,
    state: 'active',
    createdAt: new Date().toISOString()
  };
}

/**
 * Export the public key in base64url format for proof verification.
 */
export function exportPublicKey(keyPair: VerifierKeyPair): string {
  return keyPair.publicKey;
}

/**
 * Rotate keys: generate a new key pair and mark the previous one as superseded.
 * Returns the new active key pair.
 */
export function rotateKey(oldKey: VerifierKeyPair, verifierId: string): VerifierKeyPair {
  if (oldKey.state === 'superseded') {
    throw new Error('KEY_ALREADY_SUPERSEDED: cannot rotate a key that is already superseded');
  }
  // Mark old key as superseded (caller should persist this change)
  oldKey.state = 'superseded';
  oldKey.supersededAt = new Date().toISOString();
  // Generate new active key
  return generateKeyPair(verifierId);
}

/**
 * Check if a key is active (not superseded).
 */
export function isKeyActive(keyPair: VerifierKeyPair): boolean {
  return keyPair.state === 'active';
}
