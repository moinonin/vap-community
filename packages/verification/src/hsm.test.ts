import { describe, it, expect } from 'vitest';
import { hsm, SoftwareHSM } from './hsm.js';

describe('SoftwareHSM (verification)', () => {
  it('exposes a software-backed singleton', () => {
    expect(hsm).toBeInstanceOf(SoftwareHSM);
  });

  it('sign/verify round-trip succeeds', async () => {
    const data = Buffer.from('hello world');
    const signature = await hsm.sign(data, 'test-key');
    expect(signature).toMatch(/^[0-9a-f]+$/);
    await expect(hsm.verify(data, signature, 'test-key')).resolves.toBe(true);
  });

  it('rejects tampered data', async () => {
    const data = Buffer.from('hello world');
    const signature = await hsm.sign(data, 'test-key');
    const tampered = Buffer.from('hello world!');
    await expect(hsm.verify(tampered, signature, 'test-key')).resolves.toBe(false);
  });

  it('rejects a corrupted signature', async () => {
    const data = Buffer.from('hello world');
    const signature = await hsm.sign(data, 'test-key');
    const corrupted = signature.slice(0, -2) + (signature.endsWith('00') ? 'ff' : '00');
    await expect(hsm.verify(data, corrupted, 'test-key')).resolves.toBe(false);
  });

  it('uses an independent keypair per keyId', async () => {
    const data = Buffer.from('cross-key');
    const sigA = await hsm.sign(data, 'key-a');
    const sigB = await hsm.sign(data, 'key-b');
    await expect(hsm.verify(data, sigA, 'key-a')).resolves.toBe(true);
    await expect(hsm.verify(data, sigB, 'key-b')).resolves.toBe(true);
    // A signature from key-a must not verify under key-b
    await expect(hsm.verify(data, sigA, 'key-b')).resolves.toBe(false);
  });

  it('exports the public key as PEM/SPKI', async () => {
    const pem = await hsm.getPublicKey('test-key');
    expect(pem).toContain('-----BEGIN PUBLIC KEY-----');
    expect(pem).toContain('-----END PUBLIC KEY-----');
  });
});
