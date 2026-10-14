/**
 * HSM interface — software-backed implementation (node:crypto ECDSA P-256).
 * Keys are generated per keyId and held in process memory. Cloud KMS / PKCS#11
 * adapters can implement the same HSMInterface for production deployments.
 */

import { generateKeyPairSync, createSign, createVerify, type KeyObject } from 'node:crypto';

export interface HSMInterface {
  sign(data: Buffer, keyId: string): Promise<string>;
  verify(data: Buffer, signature: string, keyId: string): Promise<boolean>;
  getPublicKey(keyId: string): Promise<string>;
}

/**
 * Real software HSM: per-keyId lazily generated ECDSA P-256 keypairs.
 * Keys never leave the instance (public key exported as PEM for verification).
 */
export class SoftwareHSM implements HSMInterface {
  private readonly keys = new Map<string, { privateKey: KeyObject; publicKeyPem: string }>();

  private getKey(keyId: string): { privateKey: KeyObject; publicKeyPem: string } {
    let entry = this.keys.get(keyId);
    if (!entry) {
      const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
      entry = { privateKey, publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) as string };
      this.keys.set(keyId, entry);
    }
    return entry;

  }

  async sign(data: Buffer, keyId: string): Promise<string> {
    const signer = createSign('sha256');
    signer.update(data);
    signer.end();
    return signer.sign(this.getKey(keyId).privateKey).toString('hex');
  }

  async verify(data: Buffer, signature: string, keyId: string): Promise<boolean> {
    const verifier = createVerify('sha256');
    verifier.update(data);
    verifier.end();
    try {
      return verifier.verify(this.getKey(keyId).publicKeyPem, Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  }

  async getPublicKey(keyId: string): Promise<string> {
    return this.getKey(keyId).publicKeyPem;
  }
}

/** @deprecated Use SoftwareHSM. Kept for backwards compatibility. */
export const StubHSM = SoftwareHSM;

/**
 * Singleton HSM instance (software-backed by default).
 */
export const hsm: HSMInterface = new SoftwareHSM();
