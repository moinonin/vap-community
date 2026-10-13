/**
 * Small WebCrypto/utilities helpers. Standard APIs only; every helper
 * degrades predictably when crypto.subtle is unavailable (older Node, some
 * embedded webviews) rather than crashing.
 */

function cryptoApi(): Crypto | undefined {
  return typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
}

export function uuid(): string {
  const c = cryptoApi();
  if (c?.randomUUID) return c.randomUUID();
  // RFC4122 v4 fallback over Math.random (non-cryptographic; only used when
  // no CSPRNG exists at all).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function base64url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(arr).toString('base64');
  return b64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export async function sha256Hex(text: string): Promise<string | undefined> {
  const subtle = cryptoApi()?.subtle;
  if (!subtle) return undefined;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Deterministic JSON: object keys sorted recursively. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * Ephemeral per-session ECDSA P-256 signer. The SDK signs each evidence
 * record so the ingestion API's signature field is real; the public key is
 * attached to evidence metadata. Returns undefined off-WebCrypto runtimes —
 * callers then mark records as unsigned instead of faking a signature.
 */
export interface SessionSigner {
  publicKeyBase64Url: string;
  sign(text: string): Promise<string>;
}

export async function createSessionSigner(): Promise<SessionSigner | undefined> {
  const subtle = cryptoApi()?.subtle;
  if (!subtle) return undefined;
  try {
    const keyPair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ]);
    const spki = await subtle.exportKey('spki', keyPair.publicKey);
    return {
      publicKeyBase64Url: base64url(spki),
      async sign(text) {
        const sig = await subtle.sign(
          { name: 'ECDSA', hash: 'SHA-256' },
          keyPair.privateKey,
          new TextEncoder().encode(text),
        );
        return base64url(sig);
      },
    };
  } catch {
    return undefined;
  }
}
