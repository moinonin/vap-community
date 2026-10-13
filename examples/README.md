# Examples (Sprint 20)

## `publish-and-verify.mjs`

Self-contained end-to-end demo of the VAE public API, runnable with a single
command — it starts the API server itself (imported from the compiled
`apps/api` dist) on an ephemeral local port:

```bash
pnpm install
pnpm --filter @verified-attention/api run build   # and: .../cli run build
node examples/publish-and-verify.mjs
```

What it does:

1. Creates a session via the `vap` CLI (`vap session create`).
2. Ingests an evidence record using the canonical shape from
   `apps/api/src/evidence` tests (`vap evidence ingest`).
3. Lists the built-in verification policies (`GET /v1/policies`).
4. Builds a demo proof with the VAP lifecycle helpers from
   `@verified-attention/core` (`createUnsignedProof` → `signProof` →
   `publishProof`) and verifies it with `vap verify` (structural validation
   against the VAP `ProofSchema`).
5. Closes the session.

Honest limitations:

- The demo proof uses a placeholder signature; `vap verify` checks structure,
  not cryptographic provenance.
- Proof retrieval via HTTP (`GET /v1/proofs/...`) is read-only against an
  in-memory store; the demo therefore validates a proof file rather than a
  server-stored proof.
- `vap session close`/`get` are broken for real ids (CLI percent-encoding vs.
  router mismatch); the script closes the session with `fetch` directly. See
  [docs/quickstart.md](../docs/quickstart.md).

Expected output ends with `[example] 6. session closed. ALL STEPS PASSED`
(exit code 0).
