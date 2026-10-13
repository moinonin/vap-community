/**
 * vap CLI (Sprint 20) — command-line client for the VAE public API.
 *
 * Talks to the API routes implemented in apps/api/src (sessions/evidence
 * are live; proofs/policies follow the documented /v1 surface). Local proof
 * files are validated structurally against the VAP Proof schema from
 * @verified-attention/core.
 *
 * The logic is exportable and dependency-injected (fetch/readFile/writers)
 * so tests run without a network or real filesystem.
 */

import { parseArgs } from 'node:util';
import { readFile as fsReadFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ProofSchema } from '@verified-attention/core';

export const VERSION = '0.1.0-dev';
export const DEFAULT_API_URL = 'http://127.0.0.1:3001';

export interface CliIO {
  fetch?: typeof globalThis.fetch;
  readFile?: (path: string) => Promise<string>;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  apiUrl?: string;
}

const HELP = `vap - Verified Attention Protocol CLI

Usage:
  vap --version
  vap --help
  vap verify <proofId|file>         Verify a proof: by id via the API, or a local proof JSON file
  vap proof get <proofId>           Fetch and print a proof
  vap policy create <file>          Create a policy from a JSON file
  vap evidence ingest <file>        Ingest an evidence record from a JSON file
  vap session create <contentId>    Create a session (--participant <id>)
  vap session close <sessionId>     Close a session
  vap session get <sessionId>       Fetch and print a session

Options:
  --api-url <url>     API base URL (default: $VAP_API_URL or ${DEFAULT_API_URL})
  --help              Show help for the CLI or a subcommand
  --version           Print version

Exit codes: 0 success, 1 verification/command failure, 2 usage error.
`;

interface RunContext {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  readFile: (path: string) => Promise<string>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  apiUrl: string;
}

/** Run the CLI from the given argv (no node/script prefix). Returns the exit code. */
export async function run(argv: string[], io: CliIO = {}): Promise<number> {
  const ctx: RunContext = {
    fetch: io.fetch ?? globalThis.fetch,
    readFile: io.readFile ?? ((p) => fsReadFile(p, 'utf8')),
    stdout: io.stdout ?? ((t) => console.log(t)),
    stderr: io.stderr ?? ((t) => console.error(t)),
    apiUrl: io.apiUrl ?? process.env.VAP_API_URL ?? DEFAULT_API_URL,
  };

  const top = splitGlobal(argv);
  if (top.help) { printHelp(ctx); return 0; }
  if (top.version) { printVersion(ctx); return 0; }
  const args = top.rest;
  const [command, sub, ...rest] = args;

  if (command === undefined) { usage(ctx, 'missing command'); return 2; }

  switch (command) {
    case 'verify': return verify(ctx, sub, rest);
    case 'proof': return proof(ctx, sub, rest);
    case 'policy': return policy(ctx, sub, rest);
    case 'evidence': return evidence(ctx, sub, rest);
    case 'session': return session(ctx, sub, rest);
    default: usage(ctx, `unknown command: ${command}`); return 2;
  }
}

function splitGlobal(argv: string[]): { help: boolean; version: boolean; rest: string[] } {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    allowPositionals: true,
    strict: false,
  });
  return { help: Boolean(values.help), version: Boolean(values.version), rest: positionals };
}

function printHelp(ctx: RunContext): void { ctx.stdout(HELP); }
function printVersion(ctx: RunContext): void { ctx.stdout(VERSION); }
function usage(ctx: RunContext, msg: string): void {
  ctx.stderr(`error: ${msg}\n\n${HELP}`);
}

function fail(ctx: RunContext, msg: string): number {
  ctx.stderr(`error: ${msg}`);
  return 1;
}

/** Perform an HTTP request; on API error bodies, print the message and return null. */
async function request(
  ctx: RunContext,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<unknown | null> {
  let res: Response;
  try {
    res = await ctx.fetch(`${ctx.apiUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    ctx.stderr(`error: could not reach API at ${ctx.apiUrl} (${(err as Error).message})`);
    return null;
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } } | null)?.error?.message ??
      (res.status === 404 ? `${method} ${path} not found` : `HTTP ${res.status}`);
    ctx.stderr(`error: ${msg}`);
    return null;
  }
  return data;
}

async function readJsonFile(ctx: RunContext, path: string): Promise<unknown | null> {
  let raw: string;
  try {
    raw = await ctx.readFile(path);
  } catch {
    ctx.stderr(`error: cannot read file: ${path}`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    ctx.stderr(`error: ${path} is not valid JSON (${(err as Error).message})`);
    return null;
  }
}

/** Structurally validate a proof against the VAP Proof schema. Returns issues, [] when valid. */
function proofIssues(proof: unknown): string[] {
  const parsed = ProofSchema.safeParse(proof);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`);
  }
  const issues: string[] = [];
  if (!parsed.data.signature || parsed.data.signature.length === 0) {
    issues.push('signature: missing or empty');
  }
  if (parsed.data.state === 'REVOKED' || parsed.data.state === 'EXPIRED') {
    issues.push(`state: ${parsed.data.state}`);
  }
  return issues;
}

function reportProof(ctx: RunContext, proof: unknown, source: string): number {
  const issues = proofIssues(proof);
  const p = proof as Record<string, unknown> | null;
  if (issues.length === 0) {
    ctx.stdout(
      [
        `PASS (${source})`,
        `  proofId:    ${String(p?.proofId)}`,
        `  sessionId:  ${String(p?.sessionId)}`,
        `  contentId:  ${String(p?.contentId)}`,
        `  state:      ${String(p?.state)}`,
        `  confidence: ${String(p?.confidence)}`,
        `  issuedAt:   ${String(p?.issuedAt)}`,
      ].join('\n'),
    );
    return 0;
  }
  ctx.stdout(`FAIL (${source})`);
  for (const issue of issues) ctx.stdout(`  - ${issue}`);
  return 1;
}

function isPathLike(target: string): boolean {
  return target.endsWith('.json') || target.includes('/');
}

async function verify(ctx: RunContext, target: string | undefined, _rest: string[]): Promise<number> {
  if (!target) { usage(ctx, 'verify requires <proofId|file>'); return 2; }
  if (isPathLike(target)) {
    const data = await readJsonFile(ctx, target);
    if (data === null) return 1;
    return reportProof(ctx, data, target);
  }
  const data = await request(ctx, 'GET', `/v1/proofs/${encodeURIComponent(target)}`);
  if (data === null) return 1;
  return reportProof(ctx, data, `${ctx.apiUrl}/v1/proofs/${target}`);
}

async function proof(ctx: RunContext, sub: string | undefined, rest: string[]): Promise<number> {
  const [id] = rest;
  if (sub !== 'get' || !id) { usage(ctx, 'usage: vap proof get <proofId>'); return 2; }
  const data = await request(ctx, 'GET', `/v1/proofs/${encodeURIComponent(id)}`);
  if (data === null) return 1;
  printData(ctx, data);
  return 0;
}

async function policy(ctx: RunContext, sub: string | undefined, rest: string[]): Promise<number> {
  const [file] = rest;
  if (sub !== 'create' || !file) { usage(ctx, 'usage: vap policy create <file>'); return 2; }
  const body = await readJsonFile(ctx, file);
  if (body === null) return 1;
  const data = await request(ctx, 'POST', '/v1/policies', body);
  if (data === null) return 1;
  printData(ctx, data);
  return 0;
}

async function evidence(ctx: RunContext, sub: string | undefined, rest: string[]): Promise<number> {
  const [file] = rest;
  if (sub !== 'ingest' || !file) { usage(ctx, 'usage: vap evidence ingest <file>'); return 2; }
  const body = await readJsonFile(ctx, file);
  if (body === null) return 1;
  const data = await request(ctx, 'POST', '/v1/evidence', body);
  if (data === null) return 1;
  printData(ctx, data);
  return 0;
}

async function session(ctx: RunContext, sub: string | undefined, rest: string[]): Promise<number> {
  if (sub === 'create') {
    const [contentId] = rest;
    if (!contentId) { usage(ctx, 'usage: vap session create <contentId> [--participant <id>]'); return 2; }
    const pIdx = rest.indexOf('--participant');
    const participantId = pIdx >= 0 ? rest[pIdx + 1] : undefined;
    if (pIdx >= 0 && !participantId) { usage(ctx, '--participant requires a value'); return 2; }
    const body = {
      contentId,
      participant: {
        viewerIdHash: createHash('sha256')
          .update(participantId ?? 'vap-cli-anonymous')
          .digest('hex'),
      },
    };
    const data = await request(ctx, 'POST', '/v1/sessions', body);
    if (data === null) return 1;
    printData(ctx, data);
    return 0;
  }
  if (sub === 'close') {
    const [id] = rest;
    if (!id) { usage(ctx, 'usage: vap session close <sessionId>'); return 2; }
    const data = await request(ctx, 'POST', `/v1/sessions/${encodeURIComponent(id)}/close`);
    if (data === null) return 1;
    printData(ctx, data);
    return 0;
  }
  if (sub === 'get') {
    const [id] = rest;
    if (!id) { usage(ctx, 'usage: vap session get <sessionId>'); return 2; }
    const data = await request(ctx, 'GET', `/v1/sessions/${encodeURIComponent(id)}`);
    if (data === null) return 1;
    printData(ctx, data);
    return 0;
  }
  usage(ctx, 'usage: vap session create|close|get');
  return 2;
}

function printData(ctx: RunContext, data: unknown): void {
  ctx.stdout(JSON.stringify(data, null, 2));
}
