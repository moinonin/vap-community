# VAE 1.0 Launch Checklist (Sprint 21)

Status legend: ✅ done and verified · ◐ partial · ⬜ todo.
Statuses reflect the repo **as of the current audit round** — see
[docs/AUDIT.md](../AUDIT.md) for evidence.

## Security

- ✅ Software-backed HSM (`packages/crypto/hsm`, `SoftwareHSM`: node:crypto
  ECDSA P-256 sign/verify, PEM/SPKI export; `packages/verification/src/hsm.ts`
  real implementation)
- ⬜ Production HSM adapter — cloud KMS adapters currently fall back to the
  software HSM with a warning; a hardened prod KMS/HSM integration (AWS KMS,
  GCP Cloud HSM) is not wired
- ◐ TLS — `packages/security/tls` `loadOrCreateDevCertificate()` generates a
  real self-signed EC P-256 dev cert or loads configured PEM paths; production
  certificate provisioning/rotation is not automated
- ✅ Secrets — `packages/security/secrets` real AES-256-GCM, key from
  `VAE_SECRETS_KEY` (64-hex); tamper/wrong-key detection tested
- ✅ Threat model — [docs/security/threat-model.md](../security/threat-model.md)
- ✅ SBOM — [docs/security/sbom.json](../security/sbom.json)
- ◐ Pentest — [docs/security/pentest-report.md](../security/pentest-report.md) exists;
  no external pentest scheduled
- ⬜ Key management runbook (prod key custody, rotation schedule)

## Testing & Conformance

- ✅ Unit/integration suites — `make test` green (47/47 suites)
- ◐ Conformance suites — extensive `pnpm test:conformance` coverage in-repo,
  but VAP §14 API-message conformance suite not yet consolidated under
  `tests/conformance/api/`
- ✅ Contract tests — `pnpm contract:test` (3/3); `provider-verify.js` makes
  real HTTP requests (exits 2 `PROVIDER_UNREACHABLE` when down,
  `--skip-if-down` opt-out)
- ◐ k6 load gate — gate defined: `scripts/run-gated.sh LOAD_TEST k6 run
  contracts/contracts/load-verify.js` (exit 1 on failure, exit 2 NOT
  CONFIGURED when k6 absent); a passing k6 run at launch volume is **not yet
  recorded**
- ◐ k6 chaos gate — same wrapper: `scripts/run-gated.sh CHAOS_TEST k6 run
  contracts/contracts/load-reconcile.js`; pass at 2× launch load not yet
  recorded

## Privacy

- ✅ DPIA — [docs/privacy/dpia-baseline.md](../privacy/dpia-baseline.md) and
  [docs/privacy/dpia-final.md](../privacy/dpia-final.md)
- ✅ Consent / minimisation / retention packages tested green (S14–S15 fixes:
  "first policy wins", consent timestamp tie-break, test isolation)
- ⬜ Legal sign-off on production data flows with real publisher traffic

## Observability

- ✅ OpenTelemetry tracing wired in `apps/api` (`src/tracing.ts`); Jaeger in
  `docker-compose.yml`
- ⬜ Dashboards + alert rules for production (SLOs, error budgets) — not defined
- ✅ Runbooks — [docs/runbooks.md](../runbooks.md)

## Release & Rollback

- ◐ Versioning — OpenAPI/spec stable at `/v1`; API versioning middleware
  (`apps/api/src/versioning.ts`) not yet implemented (S19 gap)
- ⬜ Rollback plan — compose cluster is stateless-in-memory for sessions/
  proofs (rollback = redeploy previous image; risk: in-flight proofs lost);
  persistent store cutover (postgres is in compose but not wired to session/
  proof stores) must precede GA
- ✅ Container builds — per-app Dockerfiles; BuildKit required
  (`make start-cluster` sets `DOCKER_BUILDKIT=1`)
- ⬜ Release candidate tag `vae-1.0-rc1` — not cut
- ⬜ Communications plan (status page, changelog via changesets is configured
  but unused)

## Gate summary

| Gate | State |
|---|---|
| Security (crypto/secrets/TLS code) | ✅ code done; ⬜ prod HSM + cert ops |
| Tests (unit/contract) | ✅ |
| Load/chaos (k6) | ◐ gates honest, passing runs unrecorded |
| Privacy (DPIA) | ✅ docs; ⬜ legal sign-off |
| Observability | ◐ tracing present; dashboards/alerts missing |
| Rollback | ⬜ depends on persistent stores |
