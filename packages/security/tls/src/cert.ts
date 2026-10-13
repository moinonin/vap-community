/**
 * Minimal pure-JS X.509 self-signed certificate encoder (DEV ONLY).
 *
 * node:crypto can generate keys and sign, but cannot build X.509 certificates,
 * so this module assembles the DER by hand for a minimal EC P-256 self-signed
 * cert (subject = issuer = CN=<hostname>, no SANs/extensions). This is enough
 * for local development TLS — NOT for production. For production, provide real
 * certificates (e.g. from your CA / Let's Encrypt) via loadOrCreateDevCertificate,
 * or generate a dev cert once with:
 *
 *   openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
 *     -nodes -keyout dev-key.pem -out dev-cert.pem -days 365 -subj "/CN=localhost"
 */

import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';

type DerPart = number[] | Uint8Array;

function len(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [];
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return [0x80 | bytes.length, ...bytes];
}

function tlv(tag: number, ...parts: DerPart[]): Buffer {
  const body = Buffer.concat(parts.map(p => Buffer.from(p)));
  return Buffer.concat([Buffer.from([tag, ...len(body.length)]), body]);
}

const seq = (...p: DerPart[]) => tlv(0x30, ...p);
const set = (...p: DerPart[]) => tlv(0x31, ...p);
const null_ = () => Buffer.from([0x05, 0x00]);
const bitString = (b: Uint8Array) => tlv(0x03, new Uint8Array([0x00, ...b]));
const utf8 = (s: string) => tlv(0x0c, Buffer.from(s, 'utf8'));
const explicit = (n: number, ...p: DerPart[]) => tlv(0xa0 + n, ...p);

function integer(bytes: Uint8Array): Buffer {
  const b = Array.from(bytes);
  while (b.length > 1 && b[0] === 0) b.shift();
  if (b[0]! & 0x80) b.unshift(0);
  return tlv(0x02, b);
}

function rawOid(id: number[]): Buffer {
  const rest = id.slice(2).flatMap(n => {
    const enc: number[] = [];
    do { enc.unshift(n & 0x7f); n = Math.floor(n / 128); } while (n > 0);
    for (let i = 0; i < enc.length - 1; i++) enc[i]! |= 0x80;
    return enc;
  });
  return tlv(0x06, [id[0]! * 40 + id[1]!, ...rest]);
}

function utcTime(d: Date): Buffer {
  const p = (n: number) => String(n).padStart(2, '0');
  return tlv(0x17, Buffer.from(
    `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`));
}

// ecdsa-with-SHA256 (1.2.840.10045.4.3.2)
const ALG_ECDSA_SHA256 = () => seq(rawOid([1, 2, 840, 10045, 4, 3, 2]), null_());
// id-ecPublicKey (1.2.840.10045.2.1), prime256v1 (1.2.840.10045.3.1.7)
const OID_EC_PUBLIC_KEY = [1, 2, 840, 10045, 2, 1];
const OID_PRIME256V1 = [1, 2, 840, 10045, 3, 1, 7];

function rdn(hostname: string): Buffer {
  return seq(set(seq(rawOid([2, 5, 4, 3]), utf8(hostname)))); // CN=<hostname>
}

function pem(label: string, der: Buffer): string {
  const b64 = der.toString('base64').replace(/.{1,64}/g, '$&\n').trimEnd();
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}

export function generateSelfSignedCertificate(hostname: string, days: number): { certificate: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  const point = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(jwk.x, 'base64url'),
    Buffer.from(jwk.y, 'base64url'),
  ]);

  const now = new Date();
  const tbs = seq(
    explicit(0, integer(Uint8Array.of(0x02))), // version: v3
    integer(randomBytes(16)),
    ALG_ECDSA_SHA256(),
    rdn(hostname),
    seq(utcTime(now), utcTime(new Date(now.getTime() + days * 24 * 60 * 60 * 1000))),
    rdn(hostname),
    seq(
      seq(rawOid(OID_EC_PUBLIC_KEY), rawOid(OID_PRIME256V1)),
      bitString(point),
    ),
  );

  const signature = sign('sha256', tbs, { key: privateKey, dsaEncoding: 'ieee-p1363' });
  const cert = seq(tbs, ALG_ECDSA_SHA256(), bitString(signature));

  return {
    certificate: pem('CERTIFICATE', cert),
    privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }) as string,
  };
}
