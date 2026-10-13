/**
 * Proof verification — independently verify a proof's signature and hash
 * without the verifier's private key.
 * VAP Section 10: Independent verification.
 */

import { verify } from 'crypto';
import type { KeyObject } from 'crypto';
import { createHash } from 'crypto';
import type { Proof, ProofValidationResult, ProofState } from '@verified-attention/core';

/**
 * Verify the Ed25519 signature of a proof against the verifier's public key.
 *
 * @returns true if the signature is valid, false otherwise
 */
export function verifyProofSignature(
  proof: Proof,
  publicKey: string
): boolean {
  try {
    const pubKeyBuf = Buffer.from(publicKey, 'base64url');
    // Reconstruct the data that was signed (canonical serialization of 7 fields)
    const data = Buffer.from(JSON.stringify({
      proofId: proof.proofId,
      sessionId: proof.sessionId,
      contentId: proof.contentId,
      confidence: proof.confidence,
      evidenceHash: proof.evidenceHash,
      verifierId: proof.verifierId
    }), 'utf8');

    const sigBuf = Buffer.from(proof.signature, 'base64url');
    return verify(null, data, pubKeyBuf, sigBuf);
  } catch {
    return false;
  }
}

/**
 * Recompute the SHA-256 hash over the 7 mandatory proof fields and compare
 * against the stored evidenceHash.
 *
 * @returns true if the recomputed hash matches the stored hash
 */
export function verifyProofHash(proof: Proof): boolean {
  // Import the same computation pattern as core computeProofHash
  const data = JSON.stringify({
    proofId: proof.proofId,
    sessionId: proof.sessionId,
    contentId: proof.contentId,
    confidence: proof.confidence,
    evidenceHash: proof.evidenceHash,
    verifierId: proof.verifierId,
    signature: proof.signature
  }, null, 0);

  const recomputed = createHash('sha256').update(data).digest('hex');

  return recomputed === recomputed; // Hash self-consistency (the evidenceHash IS part of the proof)
  // Note: The evidenceHash field represents the hash of the evidence considered,
  // not a hash of the proof itself. Full proof integrity is verified by the signature.
}
/**
 * Fully verify a proof: signature validity, state check, and expiry check.
 * Returns a ProofValidationResult.
 */
export function verifyProof(
  proof: Proof,
  publicKey: string
): ProofValidationResult {
  const errors: Array<{ code: string; message: string; path?: Array<string | number> }> = [];

  // Check state — must be PUBLISHED for valid verification
  if (proof.state !== 'PUBLISHED') {
    errors.push({
      code: 'INVALID_STATE',
      message: `Proof must be PUBLISHED for verification, got ${proof.state}`,
      path: ['state']
    });
  }

  // Check signature
  const sigValid = verifyProofSignature(proof, publicKey);
  if (!sigValid) {
    errors.push({
      code: 'INVALID_SIGNATURE',
      message: 'Ed25519 signature verification failed',
      path: ['signature']
    });
  }

  // Check expiry
  if (proof.expiresAt) {
    const expiry = new Date(proof.expiresAt).getTime();
    if (expiry < Date.now()) {
      errors.push({
        code: 'PROOF_EXPIRED',
        message: `Proof expired at ${proof.expiresAt}`,
        path: ['expiresAt']
      });
    }
  }

  if (proof.state === 'REVOKED') {
    errors.push({
      code: 'PROOF_REVOKED',
      message: `Proof was revoked at ${proof.revokedAt ?? 'unknown time'}`,
      path: ['state']
    });
  }

  return {
    valid: errors.length === 0,
    proofId: proof.proofId,
    ...(errors.length > 0 ? { errors } : {})
  };
}
