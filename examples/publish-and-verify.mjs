/**
 * publish-and-verify.mjs — end-to-end VAE integration example (Sprint 20).
 *
 * Self-contained: starts the VAE API server (from the compiled apps/api dist)
 * on an ephemeral local port, then walks the full happy path:
 *
 *   1. create a session            (POST /v1/sessions, via `vap session create`)
 *   2. ingest an evidence record   (POST /v1/evidence, via `vap evidence ingest`)
 *   3. list verification policies  (GET /v1/policies)
 *   4. build + sign a demo proof   (@verified-attention/core proof helpers)
 *   5. verify the proof            (`vap verify <file>` — VAP Proof schema)
 *   6. close the session           (POST /v1/sessions/:id/close)
 *
 * Prerequisite: `pnpm install && pnpm --filter @verified-attention/api run build`
 * (the script imports the compiled dist; it errors with guidance if missing).
 *
 * Run:  node examples/publish-and-verify.mjs
 *
 * The demo proof in step 4/5 is structural only: `vap verify` validates the
 * VAP Proof schema (shape, state, non-empty signature). Cryptographic
 * signature validation against a verifier identity is performed by the
 * verification engine, not exposed as a public HTTP route today.
 */

import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');

let createServer;
try {
  ({ createServer } = await import(join(repoRoot, 'apps/api/dist/index.js')));
} catch {
  console.error('error: apps/api/dist/index.js not found. Run first:');
  console.error('  pnpm install && pnpm --filter @verified-attention/api run build');
  process.exit(1);
}

let cliRun;
try {
  // dist/index.js is the `vap` executable entrypoint (runs process.argv);
  // dist/cli.js exports the injectable runner.
  ({ run: cliRun } = await import(join(repoRoot, 'packages/cli/dist/cli.js')));
} catch {
  console.error('error: packages/cli/dist/cli.js not found. Run first:');
  console.error('  pnpm --filter @verified-attention/cli run build');
  process.exit(1);
}

const { createUnsignedProof, signProof, publishProof } = await import(
  join(repoRoot, 'packages/core/dist/index.mjs')
);

/** Find an unused TCP port on 127.0.0.1. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = createServer();
server.listen(port, '127.0.0.1');
console.log(`[example] VAE API listening on ${baseUrl}`);

const tmp = await mkdtemp(join(tmpdir(), 'vap-example-'));
let lastOutput = '';
const io = { apiUrl: baseUrl, stdout: (t) => { lastOutput = t; } };

try {
  // Wait for the server to accept connections.
  let up = false;
  for (let i = 0; i < 50 && !up; i++) {
    try { up = (await fetch(`${baseUrl}/v1/policies`)).ok; } catch { /* retry */ }
    if (!up) await new Promise((r) => setTimeout(r, 100));
  }
  if (!up) throw new Error('API did not become ready');

  // 1. Create a session via the vap CLI.
  const contentId = 'article_example_001';
  if ((await cliRun(['session', 'create', contentId, '--participant', 'demo-user'], io)) !== 0) {
    throw new Error('vap session create failed');
  }
  const session = JSON.parse(lastOutput);
  const sessionId = session.sessionId;
  console.log(`[example] 1. session created: ${sessionId}`);

  // 2. Ingest an evidence record (canonical shape from apps/api/src/evidence tests).
  const evidence = {
    evidenceId: `urn:vap:evidence:${randomUUID()}`,
    sessionId,
    sourceId: 'example-001',
    timestamp: new Date().toISOString(),
    evidenceType: 'E-CUSTOM',
    confidence: 0.8,
    payload: { evidenceType: 'CUSTOM', foo: 'bar' },
    provenance: {
      observationIds: [randomUUID()],
      observationHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      sourceId: 'example-001',
    },
    signature: 'MEUCIQD1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
  };
  const evidenceFile = join(tmp, 'evidence.json');
  await writeFile(evidenceFile, JSON.stringify(evidence, null, 2));
  if ((await cliRun(['evidence', 'ingest', evidenceFile], io)) !== 0) {
    throw new Error('vap evidence ingest failed');
  }
  console.log(`[example] 2. evidence ingested: ${JSON.parse(lastOutput).evidenceId}`);

  // 3. List verification policies.
  const policies = await (await fetch(`${baseUrl}/v1/policies`)).json();
  console.log(
    `[example] 3. policies: ${policies.policies.map((p) => p.policyId).join(', ')}`,
  );

  // 4. Build and sign a demo proof from the session (VAP proof lifecycle).
  const proof = publishProof(
    signProof(
      createUnsignedProof({
        sessionId,
        contentId,
        confidence: 0.8,
        evidenceHash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        verifierId: 'urn:vap:verifier:example',
        signature: '',
        expiresAt: undefined,
        metadata: undefined,
        baseMetadata: undefined,
      }),
      'demo-signature-0134abcd',
    ),
  );
  const proofFile = join(tmp, 'proof.json');
  await writeFile(proofFile, JSON.stringify(proof, null, 2));

  // 5. Verify the proof file with the vap CLI.
  const verifyRc = await cliRun(['verify', proofFile], io);
  console.log(`[example] 4/5. vap verify:\n${lastOutput}`);
  if (verifyRc !== 0) throw new Error('vap verify failed');

  // 6. Close the session. NOTE: `vap session close` currently percent-encodes
  // the id (urn%3Avap%3A...) but the sessions router does not decode it, so
  // the CLI close/get commands 404 on real session ids (known bug). Use the
  // raw (colon-unescaped) URL directly:
  const closeRes = await fetch(`${baseUrl}/v1/sessions/${sessionId}/close`, { method: 'POST' });
  if (!closeRes.ok) throw new Error(`session close failed: HTTP ${closeRes.status}`);
  console.log('[example] 6. session closed. ALL STEPS PASSED');
} finally {
  await server.close();
  await rm(tmp, { recursive: true, force: true });
}
