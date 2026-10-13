/**
 * Unit tests for the vap CLI (Sprint 20).
 *
 * fetch and readFile are injected stubs — no network or real filesystem is
 * touched. Tests cover arg parsing, request construction, output and exit
 * codes.
 */

import { describe, it, expect } from 'vitest';
import { run, VERSION, type CliIO } from './cli';

interface Captured {
  io: CliIO;
  stdout: string[];
  stderr: string[];
  fetches: { url: string; init?: RequestInit }[];
  files: Record<string, string>;
  responses: Record<string, { status: number; body: unknown }>;
}

function harness(opts: {
  files?: Record<string, string>;
  responses?: Record<string, { status: number; body: unknown }>;
  apiUrl?: string;
  fetchThrows?: boolean;
} = {}): Captured {
  const c: Captured = {
    io: {},
    stdout: [],
    stderr: [],
    fetches: [],
    files: opts.files ?? {},
    responses: opts.responses ?? {},
  };
  c.io = {
    stdout: (t) => c.stdout.push(t),
    stderr: (t) => c.stderr.push(t),
    readFile: async (p) => {
      if (p in c.files) return c.files[p]!;
      throw new Error(`ENOENT: no such file ${p}`);
    },
    fetch: async (url, init) => {
      c.fetches.push({ url, init });
      if (opts.fetchThrows) throw new Error('ECONNREFUSED');
      const u = new URL(url);
      const key = `${init?.method ?? 'GET'} ${u.pathname}`;
      const r = c.responses[key] ?? { status: 404, body: { error: { code: 'NOT_FOUND', message: 'not found' } } };
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => r.body,
      } as Response;
    },
  };
  if (opts.apiUrl) c.io.apiUrl = opts.apiUrl;
  return c;
}

const VALID_PROOF = {
  proofId: 'urn:vap:proof:p1',
  sessionId: 'urn:vap:session:s1',
  contentId: 'content-1',
  confidence: 0.95,
  evidenceHash: 'a'.repeat(64),
  verifierId: 'verifier-1',
  signature: 'sig',
  state: 'PUBLISHED',
  issuedAt: '2026-01-01T00:00:00Z',
};

describe('vap --help / --version', () => {
  it('prints help and exits 0', async () => {
    const c = harness();
    expect(await run(['--help'], c.io)).toBe(0);
    expect(c.stdout.join('\n')).toContain('Usage:');
  });

  it('prints version and exits 0', async () => {
    const c = harness();
    expect(await run(['--version'], c.io)).toBe(0);
    expect(c.stdout[0]).toBe(VERSION);
  });

  it('exits 2 on unknown command', async () => {
    const c = harness();
    expect(await run(['nope'], c.io)).toBe(2);
    expect(c.stderr.join('\n')).toContain('unknown command');
  });

  it('exits 2 when no command given', async () => {
    const c = harness();
    expect(await run([], c.io)).toBe(2);
  });
});

describe('vap verify <file>', () => {
  it('PASSes a structurally valid local proof file', async () => {
    const c = harness({ files: { 'proof.json': JSON.stringify(VALID_PROOF) } });
    expect(await run(['verify', 'proof.json'], c.io)).toBe(0);
    expect(c.stdout.join('\n')).toContain('PASS');
    expect(c.stdout.join('\n')).toContain('urn:vap:proof:p1');
    expect(c.fetches).toHaveLength(0);
  });

  it('FAILs an invalid proof and lists issues', async () => {
    const bad = { ...VALID_PROOF, confidence: 9 };
    const c = harness({ files: { 'proof.json': JSON.stringify(bad) } });
    expect(await run(['verify', 'proof.json'], c.io)).toBe(1);
    expect(c.stdout.join('\n')).toContain('FAIL');
    expect(c.stdout.join('\n')).toContain('confidence');
  });

  it('FAILs a revoked proof', async () => {
    const c = harness({ files: { 'proof.json': JSON.stringify({ ...VALID_PROOF, state: 'REVOKED' }) } });
    expect(await run(['verify', 'proof.json'], c.io)).toBe(1);
    expect(c.stdout.join('\n')).toContain('REVOKED');
  });

  it('exits 1 on unreadable file', async () => {
    const c = harness();
    expect(await run(['verify', 'missing.json'], c.io)).toBe(1);
    expect(c.stderr.join('\n')).toContain('cannot read file');
  });

  it('exits 1 on invalid JSON', async () => {
    const c = harness({ files: { 'proof.json': '{nope' } });
    expect(await run(['verify', 'proof.json'], c.io)).toBe(1);
    expect(c.stderr.join('\n')).toContain('not valid JSON');
  });

  it('exits 2 without an argument', async () => {
    const c = harness();
    expect(await run(['verify'], c.io)).toBe(2);
  });
});

describe('vap verify <proofId> (via API)', () => {
  it('fetches GET /v1/proofs/:id and reports PASS', async () => {
    const c = harness({
      apiUrl: 'http://api.test',
      responses: { 'GET /v1/proofs/urn%3Avap%3Aproof%3Ap1': { status: 200, body: VALID_PROOF } },
    });
    expect(await run(['verify', 'urn:vap:proof:p1'], c.io)).toBe(0);
    expect(c.fetches[0]!.url).toBe('http://api.test/v1/proofs/urn%3Avap%3Aproof%3Ap1');
    expect(c.stdout.join('\n')).toContain('PASS');
  });

  it('exits 1 when the proof is not found', async () => {
    const c = harness({ apiUrl: 'http://api.test' });
    expect(await run(['verify', 'urn:vap:proof:nope'], c.io)).toBe(1);
    expect(c.stderr.join('\n')).toContain('not found');
  });

  it('exits 1 when the API is unreachable', async () => {
    const c = harness({ apiUrl: 'http://api.test', fetchThrows: true });
    expect(await run(['verify', 'urn:vap:proof:p1'], c.io)).toBe(1);
    expect(c.stderr.join('\n')).toContain('could not reach API');
  });
});

describe('vap proof get', () => {
  it('pretty prints the proof as JSON', async () => {
    const c = harness({ responses: { 'GET /v1/proofs/urn%3Avap%3Aproof%3Ap1': { status: 200, body: VALID_PROOF } } });
    expect(await run(['proof', 'get', 'urn:vap:proof:p1'], c.io)).toBe(0);
    expect(JSON.parse(c.stdout.join('\n'))).toEqual(VALID_PROOF);
  });

  it('exits 2 with bad usage', async () => {
    const c = harness();
    expect(await run(['proof', 'get'], c.io)).toBe(2);
  });
});

describe('vap session', () => {
  const session = { sessionId: 'urn:vap:session:s1', state: 'ACTIVE' };

  it('create POSTs to /v1/sessions with a hashed participant id', async () => {
    const c = harness({ apiUrl: 'http://api.test', responses: { 'POST /v1/sessions': { status: 201, body: session } } });
    expect(await run(['session', 'create', 'article-42', '--participant', 'viewer-1'], c.io)).toBe(0);
    const req = c.fetches[0]!;
    expect(req.url).toBe('http://api.test/v1/sessions');
    const body = JSON.parse(String(req.init?.body));
    expect(body.contentId).toBe('article-42');
    expect(body.participant.viewerIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(body.participant.viewerIdHash).not.toContain('viewer-1'); // no raw PII
  });

  it('close POSTs to /v1/sessions/:id/close', async () => {
    const c = harness({ responses: { 'POST /v1/sessions/urn%3Avap%3Asession%3As1/close': { status: 200, body: session } } });
    expect(await run(['session', 'close', 'urn:vap:session:s1'], c.io)).toBe(0);
    expect(c.fetches[0]!.url).toContain('/v1/sessions/urn%3Avap%3Asession%3As1/close');
  });

  it('get fetches the session', async () => {
    const c = harness({ responses: { 'GET /v1/sessions/abc': { status: 200, body: session } } });
    expect(await run(['session', 'get', 'abc'], c.io)).toBe(0);
    expect(JSON.parse(c.stdout.join('\n'))).toEqual(session);
  });

  it('exits 1 on API error', async () => {
    const c = harness();
    expect(await run(['session', 'get', 'abc'], c.io)).toBe(1);
  });
});

describe('vap policy create / evidence ingest', () => {
  it('policy create POSTs the file contents to /v1/policies', async () => {
    const policy = { policyId: 'p1', name: 'test' };
    const c = harness({
      files: { 'policy.json': JSON.stringify(policy) },
      responses: { 'POST /v1/policies': { status: 201, body: { ...policy, created: true } } },
    });
    expect(await run(['policy', 'create', 'policy.json'], c.io)).toBe(0);
    expect(c.fetches[0]!.url).toBe('http://127.0.0.1:3001/v1/policies');
    expect(JSON.parse(String(c.fetches[0]!.init?.body))).toEqual(policy);
  });

  it('evidence ingest POSTs the file contents to /v1/evidence', async () => {
    const evidence = { evidenceId: 'e1', sessionId: 's1' };
    const c = harness({
      files: { 'ev.json': JSON.stringify(evidence) },
      responses: { 'POST /v1/evidence': { status: 201, body: { appended: true } } },
    });
    expect(await run(['evidence', 'ingest', 'ev.json'], c.io)).toBe(0);
    expect(JSON.parse(String(c.fetches[0]!.init?.body))).toEqual(evidence);
  });

  it('surfaces API validation errors', async () => {
    const c = harness({
      files: { 'ev.json': JSON.stringify({}) },
      responses: {
        'POST /v1/evidence': { status: 400, body: { error: { code: 'VALIDATION_ERROR', message: 'evidenceId required' } } },
      },
    });
    expect(await run(['evidence', 'ingest', 'ev.json'], c.io)).toBe(1);
    expect(c.stderr.join('\n')).toContain('evidenceId required');
  });
});
