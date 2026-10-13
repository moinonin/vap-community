# Quickstart — Verified Attention Engine (Sprint 20)

Get from zero to a verified Proof of Attention in ~5 minutes against a local
VAE stack.

> Scope note: every command below is grounded in the current repo. See
> [docs/AUDIT.md](AUDIT.md) for an honest list of partial/missing pieces
> (no API gateway yet, no hosted sandbox).

## 0. Prerequisites

- Node ≥ 20 and pnpm 9 (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- Optional: Docker (for the full compose cluster)

```bash
pnpm install
```

## 1. Start a local API

**Option A — full cluster (Docker):**

```bash
make start-cluster          # api, verifier, settlement-worker, postgres, redis, jaeger
# API available at http://127.0.0.1:${VAE_API_PORT:-3001}
```

Requires BuildKit (the Makefile sets `DOCKER_BUILDKIT=1`); Dockerfiles use
`RUN --mount=type=cache`.

**Option B — API only, no Docker.** The API package does not ship a `start`
script; it exports `createServer()` from `@verified-attention/api`. Either run
the self-contained example (which boots the server itself):

```bash
pnpm --filter @verified-attention/api run build
node examples/publish-and-verify.mjs
```

or start a long-running dev server on port 3001 from the repo root:

```bash
node --input-type=module -e "
import('./apps/api/dist/index.js').then(({ createServer }) => {
  createServer().listen(3001, '0.0.0.0');
  console.log('VAE API on http://127.0.0.1:3001');
});"
```

## 2. Create a session

With the `vap` CLI (build it first: `pnpm --filter @verified-attention/cli run build`):

```bash
export VAP_API_URL=http://127.0.0.1:3001   # CLI default if env not set
node packages/cli/dist/index.js session create article_12345 --participant demo-user
```

or with curl:

```bash
curl -s -X POST "$VAP_API_URL/v1/sessions" \
  -H 'Content-Type: application/json' \
  -d '{"contentId":"article_12345","participant":{"viewerIdHash":"sha256:'$(printf x | head -c 64)'"}}'
```

Note the `sessionId` (`urn:vap:session:<uuid>`) from the response.

## 3. Ingest evidence

Save `evidence.json` (canonical shape from `apps/api/src/evidence` tests):

```json
{
  "evidenceId": "urn:vap:evidence:550e8400-e29b-41d4-a716-446655440000",
  "sessionId": "urn:vap:session:<your-session-uuid>",
  "sourceId": "example-001",
  "timestamp": "2026-10-13T00:00:00.000Z",
  "evidenceType": "E-CUSTOM",
  "confidence": 0.8,
  "payload": { "evidenceType": "CUSTOM", "foo": "bar" },
  "provenance": {
    "observationIds": ["650e8400-e29b-41d4-a716-446655440001"],
    "observationHash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "sourceId": "example-001"
  },
  "signature": "MEUCIQD1234567890abcdef"
}
```

```bash
node packages/cli/dist/index.js evidence ingest evidence.json
```

## 4. Collect evidence in the browser (real integration)

```bash
pnpm --filter @verified-attention/browser-sdk run build
```

```ts
import { VerifiedAttention } from '@verified-attention/browser-sdk';

const va = new VerifiedAttention({
  apiUrl: 'http://127.0.0.1:3001',
  policyId: 'pol_reading_30s',
  contentId: 'article_12345',
  contentElement: document.querySelector('article'),
  consentProvider: { requestConsent: () => cm.getConsent() }, // must resolve GRANTED
  onProof: (proof) => console.log('Verified:', proof),
});

await va.startSession();   // POST /v1/sessions; observers start after consent
// observations → signed evidence records → offline-tolerant queue → POST /v1/evidence
await va.stopSession();    // graceful close on pagehide
```

See [packages/sdk/browser/README.md](../packages/sdk/browser/README.md) for the
full API (observers, consent gate, queue backoff).

## 5. Retrieve and verify a proof

Proofs are exposed read-only at `GET /v1/proofs/:proofId` and
`GET /v1/proofs?sessionId=...` (see [apps/api/openapi.yaml](../apps/api/openapi.yaml)).

```bash
node packages/cli/dist/index.js verify <proofId-or-proof.json>
```

`vap verify` validates the proof against the VAP `ProofSchema`
(`@verified-attention/core`): structural validity, state, non-empty signature.
Cryptographic signature validation is performed by the verification engine
(`apps/verifier`), not the public API today.

Note: session/evidence/proof ids contain `urn:` colons; the routers
percent-decode path segments, so both raw `curl` paths and the CLI's
encoded ids work.

## 6. Full script

`node examples/publish-and-verify.mjs` performs steps 2–5 automatically
against an ephemeral in-process API server — see
[examples/README.md](../examples/README.md).
