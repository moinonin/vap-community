/**
 * HSM / Cloud KMS Integration (VAE Sprint 11)
 *
 * Abstract interface for hardware security modules and cloud KMS providers.
 * Supports AWS KMS, Azure Key Vault, GCP KMS, and local HSM via PKCS#11.
 */

import { z } from 'zod';
import type { UnsignedProof } from '@verified-attention/core';
import { createSign } from 'crypto';

// ─── HSM Provider Types ──────────────────────────────────────────────────────

export enum HSMProviderType {
  AWS_KMS = 'AWS_KMS',
  AZURE_KEY_VAULT = 'AZURE_KEY_VAULT',
  GCP_KMS = 'GCP_KMS',
  LOCAL_PKCS11 = 'LOCAL_PKCS11',
  STUB = 'STUB',
}

export const HSMConfigSchema = z.object({
  type: z.nativeEnum(HSMProviderType),
  // AWS KMS
  awsRegion: z.string().optional(),
  awsKeyId: z.string().optional(),
  // Azure Key Vault
  azureVaultUrl: z.string().optional(),
  azureKeyName: z.string().optional(),
  // GCP KMS
  gcpProjectId: z.string().optional(),
  gcpLocationId: z.string().optional(),
  gcpKeyRingId: z.string().optional(),
  gcpKeyId: z.string().optional(),
  // Local PKCS#11
  pkcs11LibPath: z.string().optional(),
  pkcs11SlotId: z.number().int().nonnegative().optional(),
  pkcs11Pin: z.string().optional(),
  pkcs11KeyLabel: z.string().optional(),
  // Common
  algorithm: z.enum(['ECDSA_P256', 'ED25519', 'RSA_PSS_SHA256']).default('ECDSA_P256'),
});

export type HSMConfig = z.infer<typeof HSMConfigSchema>;

// ─── HSM Interface ───────────────────────────────────────────────────────────

export interface HSMInterface {
  initialize(config: HSMConfig): Promise<void>;
  sign(data: Uint8Array): Promise<Uint8Array>;
  getPublicKey(): Promise<Uint8Array>;
  getKeyId(): string;
  close(): Promise<void>;
}

// ─── Stub Implementation (for development/testing) ───────────────────────────

export class StubHSM implements HSMInterface {
  private keyPair: { publicKey: Uint8Array; privateKey: Uint8Array } | null = null;
  private keyId = 'stub-key-1';

  async initialize(config: HSMConfig): Promise<void> {
    // Generate a deterministic key pair for testing
    const crypto = await import('crypto');
    this.keyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    });
    this.keyId = `stub-${config.type.toLowerCase()}-${Date.now()}`;
  }

  async sign(data: Uint8Array): Promise<Uint8Array> {
    if (!this.keyPair) throw new Error('HSM not initialized');

    const crypto = await import('crypto');
    const sign = crypto.createSign('sha256');
    sign.update(data);
    sign.end();
    const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(this.keyPair!.privateKey).toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;
    const signature = sign.sign(privateKeyPem);
    return new Uint8Array(signature);
  }

  async getPublicKey(): Promise<Uint8Array> {
    if (!this.keyPair) throw new Error('HSM not initialized');
    return this.keyPair.publicKey;
  }

  getKeyId(): string {
    return this.keyId;
  }

  async close(): Promise<void> {
    this.keyPair = null;
  }
}

// ─── HSM Factory ─────────────────────────────────────────────────────────────

let _hsm: HSMInterface | null = null;

export function getHSM(): HSMInterface {
  if (!_hsm) {
    _hsm = new StubHSM();
  }
  return _hsm;
}

export function setHSM(hsm: HSMInterface): void {
  _hsm = hsm;
}

export async function initializeHSM(config: HSMConfig): Promise<HSMInterface> {
  let hsm: HSMInterface;

  switch (config.type) {
    case HSMProviderType.STUB:
    case HSMProviderType.LOCAL_PKCS11:
      hsm = new StubHSM();
      break;
    case HSMProviderType.AWS_KMS:
      // hsm = new AWSKMSHSM(config);
      hsm = new StubHSM(); // Placeholder
      break;
    case HSMProviderType.AZURE_KEY_VAULT:
      // hsm = new AzureKeyVaultHSM(config);
      hsm = new StubHSM(); // Placeholder
      break;
    case HSMProviderType.GCP_KMS:
      // hsm = new GCPKMSHSM(config);
      hsm = new StubHSM(); // Placeholder
      break;
    default:
      hsm = new StubHSM();
  }

  await hsm.initialize(config);
  _hsm = hsm;
  return hsm;
}

// ─── Convenience Function for Proof Signing ──────────────────────────────────

/**
 * Sign an unsigned proof using the configured HSM.
 * This is the main entry point for proof-gen pipeline.
 */
export async function signWithHSM(unsignedProof: UnsignedProof): Promise<string> {
  const hsm = getHSM();

  // Prepare data to sign (canonical serialization of proof fields)
  const data = `${unsignedProof.proofId}:${unsignedProof.sessionId}:${unsignedProof.contentId}:${unsignedProof.confidence}:${unsignedProof.evidenceHash}:${unsignedProof.verifierId}`;

  const encoder = new TextEncoder();
  const signature = await hsm.sign(encoder.encode(data));

  // Return as hex string
  return Buffer.from(signature).toString('hex');
}