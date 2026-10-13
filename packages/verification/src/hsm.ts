/**
 * HSM interface stub — hardware security module abstraction.
 * This is a placeholder. Real HSM integration deferred to production hardening.
 */

export interface HSMInterface {
  sign(data: Buffer, keyId: string): Promise<string>;
  verify(data: Buffer, signature: string, keyId: string): Promise<boolean>;
  getPublicKey(keyId: string): Promise<string>;
}

/**
 * Stub HSM that throws NOT_IMPLEMENTED for all operations.
 * Replace with real HSM adapter (PKCS#11, AWS KMS, etc.) in production.
 */
export class StubHSM implements HSMInterface {
  async sign(_data: Buffer, _keyId: string): Promise<string> {
    throw new Error('NOT_IMPLEMENTED: HSM signing not available in stub mode');
  }

  async verify(_data: Buffer, _signature: string, _keyId: string): Promise<boolean> {
    throw new Error('NOT_IMPLEMENTED: HSM verification not available in stub mode');
  }

  async getPublicKey(_keyId: string): Promise<string> {
    throw new Error('NOT_IMPLEMENTED: HSM public key export not available in stub mode');
  }
}

/**
 * Singleton HSM instance (stub by default).
 */
export const hsm: HSMInterface = new StubHSM();
