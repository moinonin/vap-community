# Repository Audit — Verified Attention Engine / Githeri

_Date: 2026 audit round. Sources: githeri 0.4.10 (init/scan/verify-exec), sprint-plan audit, live build/test audit._

## 1. githeri audit results

- `githeri init` → `.githeri/` workspace created; `githeri scan` → framework unknown (TS monorepo — githeri's AST scan is Python-oriented), test command detected as `npm test`.
- `githeri verify-exec --spec sprint7-spec.yaml --plan COMMAND_RUNWAY.md --deep`:
  - spec validation: **pass**; plan structure: **pass** (29 stages, 95 commands)
  - command safety: 56 pass / 39 unknown (heredocs, `cat`, `mkdir` — benign)
  - path integrity: **FAIL (9 errors)** — plan references files that do not exist and are never created:
    1. `packages/pipeline/src/deduplication.ts` (stage 10)
    2. `packages/pipeline/src/enrichment.ts` (stage 10)
    3. `packages/verification/confidence/src/confidence-model.ts` (stage 13)
    4. `packages/verification/engine/src/verification-engine.ts` (stage 13)
    5. `packages/verification/policy/src/policy-engine.ts` (stage 13)
    6. `packages/verification/policy/types.ts` (stage 18)
    7. `dist/sdk.js` (stage 24)
    8. `apps/api/src/versioning.ts` (stage 27)
    9. `docs/launch/checklist.md` (stage 29)
  - Overall score 0.33 (fail) — COMMAND_RUNWAY.md has drifted from the actual repo layout.

## 2. Sprint status verified against repo (✅ verified · ◐ partial · ✗ missing)

| Sprint | Status | Gap |
|---|---|---|
| S1 Foundations | ◐ | missing `docs/security/threat-model.md`, `docs/privacy/dpia-baseline.md`, `research/literature-review.md` |
| S2 Evidence model | ◐ | **no evidence ingestion route** in `apps/api` (only sessions/policies/proofs/privacy/security) |
| S3 Sessions + ML prototypes | ◐ | 3 research prototypes missing (no `research/` dir) |
| S4 VAP + conformance | ◐ | suites scattered, not at `tests/conformance/*` |
| S5 Verification core | ✅ | flat layout vs planned subdirs (cosmetic) |
| S6 Proofs & crypto | ✅ | — |
| S7 Pipeline hardening | ✅ code / ✗ gates | L7/L8 load+chaos gates exit-0 vacuous; root `sprint7-spec.yaml` duplicates `docs/sprint-07/spec.yaml` |
| S8 Attention ML | ◐ | features+model exist; **missing `apps/ml-serving/`, drift detection, retrain** |
| S9 Fraud ML | ✅ code | AUC claims unverifiable |
| S10–S15 | ✅ | policy CRUD, proofs production, rewards×5, analytics, security, privacy all present |
| S16–18 SDKs | ✗ | single-file stubs only; no observers/consent/queue/session, no MV3, no Kotlin/Swift |
| S19 Public API | ◐ | openapi.yaml ✅; gateway, versioning, portal, generated SDKs missing |
| S20–21 | ✗ | no CLI, examples, sandbox, quickstart, beta |
| S22–26+ | ✗ | post-1.0, acceptable |

## 3. Planning-quality issues

1. README "Phase" labels disagree with SPRINTS.md (SDKs: Phase 5 vs Phase 3).
2. Header says "21 sprints / 42 weeks"; content runs to S26+.
3. Sprint-spec dirs uneven (full docs only S03, S05–S10).
4. Spec gates satisfiable by stubs (`file_exists`/`content_contains`); load/chaos gates vacuously pass.
5. No traceability matrix: contract tests → VAP §requirement IDs.
6. Hygiene: `packages/reward/settlement/debug_test*.ts`, duplicate `SPRINT 4` heading in `githeri/docs/SPRINTS.md`.

## 4. Feature verification (builds/tests)

- `pnpm install` ✅ · `pnpm --filter @verified-attention/api run build` ✅ · `make lint` ✅ (0 errors, warnings only)
- `make test` ❌ — ~45 suites pass (core 195, conformance 141, pipeline 132+13+11+6+8, store 51, verification 26, all ML/fraud/attention, all reward, apps/api 32, apps/verifier 29, SDK stubs) **but two fail**:
  - `packages/privacy/consent`: 7/14 fail
  - `packages/privacy/minimisation`: 8/12 fail
  - **Root cause (confirmed):**
    1. Test-isolation bug in both suites: `vi.resetModules()` + static imports → module singletons (`getConsentManager()`/`getDataMinimiser()`) persist across tests.
    2. **Real implementation bug in `packages/privacy/minimisation`:** `getDataMinimiser()` preloads a default GDPR policy on first call, and `loadPolicy()` uses "first policy wins" — later policies never become active (email gets HASHed instead of STRIPped). Affects any real consumer of that factory.
- Contract tests: `contract-test.js` ✅ 3/3; `integration-cicd.js` passes but mostly a stub (skips migrations; `provider-verify.js` never makes HTTP requests — prints URLs only). No Pact; k6 load scripts need a running cluster.
- githeri pytest: ✅ 54/54.
- Docker cluster: ❌ NOT verifiable — Dockerfiles use `RUN --mount=type=cache` (requires BuildKit; legacy builder fails) and host port conflicts exist (6379 taken; 3000 serving an unrelated app). Deploy story unverified end-to-end.

### Deliberate stubs found (honest, but incomplete features)

- `packages/crypto/hsm` — stub keys ("stub-key-1", tests assert stub format)
- `packages/verification/src/hsm.ts` — sign/verify/export throw NOT_IMPLEMENTED
- `packages/security/tls` — placeholder self-signed certs; `packages/security/secrets` — encrypt/decrypt no-ops
- `packages/pipeline/enrichment` — geo enrichment + device fingerprint placeholders
- SDK packages — 1-file skeletons (README claims "not yet in repo" — doc rot)

### Doc rot found

- README claims `make test` runs contract tests — it runs only `pnpm -r test`; contract tests are manual node scripts.
- `docker-compose.yml` has obsolete `version: "3.9"` key.

## 5. What we need to implement (dependency order)

**Fix first (existing-but-broken):**
0a. ✅ DONE — `make test` green (47/47): fixed minimisation "first policy wins" + consent timestamp tie-break + test isolation (fresh instances per test)
0b. ✅ DONE — HSM ✅ DONE: `crypto/hsm` and `verification/hsm.ts` replaced with real software-backed `SoftwareHSM` (node:crypto ECDSA P-256, sign/verify, PEM/SPKI export; `StubHSM` kept as deprecated alias; cloud-KMS adapters fall back with a warning). Secrets encryption ✅ DONE: `security/secrets` encrypt/decrypt now real AES-256-GCM via node:crypto (key from `VAE_SECRETS_KEY` 64-hex env var, else per-process dev key; `aes256gcm.<iv>.<tag>.<ct>` encoding, tamper/wrong-key detection, tested). TLS ✅ DONE: `security/tls` placeholder cert replaced with `loadOrCreateDevCertificate()` — loads cert/key from configured PEM paths, otherwise generates a real dev-only self-signed EC P-256 cert via a minimal pure-JS X.509/DER encoder (new `cert.ts`; verified usable with `node:https`; openssl one-liner documented for manual dev certs). Also fixed `security/encryption-at-rest` (was broken: iterated plain object as Map, and double-encoded the GCM auth tag) — now correct real AES-256-GCM with tamper test. Also: `packages/security/secrets/src/index.ts`, `packages/security/tls/src/{index,cert}.ts`

0c. ✅ DONE — contract CI gates made real: `provider-verify.js` issues actual HTTP requests (env `CONTRACT_PROVIDER_URL`, default `http://127.0.0.1:3000`), validates status+body shape per contract interaction, prints `PROVIDER_UNREACHABLE` and exits 2 when down (`--skip-if-down` opt-out); `integration-cicd.js` runs it via spawnSync and fails on non-zero, migration step honestly prints NOT INTEGRATED (real runner still owed by S4.4). L7/L8 gates in `docs/sprint-07/spec.yaml` (now canonical; root `sprint7-spec.yaml` is a generated mirror via `scripts/sync-sprint7-spec.sh` — a pure pointer broke `githeri verify-exec` spec validation) call `scripts/run-gated.sh` — exit 1 on failure, exit 2 NOT CONFIGURED when k6 absent; no more vacuous `|| echo` passes. docker-compose: obsolete `version: "3.9"` removed, host ports `${VAE_API_PORT:-3001}:3000` / `${VAE_REDIS_PORT:-6380}:6379`; Makefile start-cluster exports `COMPOSE_DOCKER_CLI_BUILD=1 DOCKER_BUILDKIT=1`. Verified: contract-test 3/3, provider-verify exit 2 (down) / 1 (unrelated app on :3000), run-gated exit 2 (no k6), `githeri verify-exec` spec_validation PASS, `pnpm -r lint` clean (warnings only).
0d. ✅ DONE — pipeline enrichment implemented in `packages/pipeline/enrichment`: offline geo lookup (RFC1918/loopback/TEST-NET static ranges + pluggable `geoLookup` fn; honest UNKNOWN for unresolvable IPs) and coarse deterministic device fingerprint (HMAC-SHA-256 over normalized userAgent/ip/headers, salted via option or `VAP_FINGERPRINT_SALT`); no fake GeoIP DB, no new deps

**Then the roadmap gaps:**

1. ✅ DONE — **Evidence ingestion API**: `apps/api/src/evidence/` (POST `/v1/evidence` ingest via pipeline, GET by id, GET by `?sessionId=`; session-bound; 14 tests)
2. ✅ DONE — Doc debts (S1/S3): `docs/security/threat-model.md`, `docs/privacy/dpia-baseline.md`, `research/literature-review.md`
3. Attention model serving + drift/retrain pipeline (S8)
4. ✅ DONE — Real browser SDK (S16): `packages/sdk/browser` implements observers (visibility/interaction/focus via injectable DomAdapter), consent gate, offline-tolerant queue (localStorage + backoff), session lifecycle vs `apps/api` (`/v1/sessions`, heartbeat, close), pre-send zod validation, ephemeral WebCrypto evidence signing; ~27KB ESM bundle (~8KB gz); 27 tests green
5. ✅ DONE — SDKs: browser (observers/consent/queue/session/validation, 27 KB), MV3 extension (background/content/popup/msg protocol), mobile + desktop wrappers — all tested; full repo build/test/lint green
6. ◐ S19 PARTIAL — apps/api mounts proofs/policies/privacy routers (`src/proofs/router.ts`, `src/privacy/router.ts`; 46 tests green, typecheck clean); openapi.yaml ✅; developer portal & customer console fully implemented in `apps/portal` (serves landing, live explorer, API key provisioning, and visual Policy Studio). Remaining S19 tasks: API gateway, generated SDKs
7. ◐ S20 — CLI DONE (`packages/cli/` `vap`; 22 tests). Quickstart ✍️ DONE (`docs/quickstart.md`); examples ✍️ DONE (`examples/publish-and-verify.mjs` + `examples/README.md`, runs green via `node examples/publish-and-verify.mjs`). NEW BUG FOUND: `vap session close/get` percent-encode the urn id but `apps/api/src/sessions/router.ts` never percent-decodes → 404 on real session ids (curl raw URL works; quickstart documents caveat). TODO: integration framework, sandbox
8. ◐ S21 — Launch checklist ✍️ DONE (`docs/launch/checklist.md`, honest done/todo states; fixes the githeri verify-exec missing-path flag); beta program doc ✍️ DONE (`docs/beta/README.md`). TODO: recruit beta participants, feedback loop, load test at 2× launch volume, cut vae-1.0-rc1
9. Plan hygiene: ✅ README phases reconciled with SPRINTS.md; ✅ `reward/settlement/debug_test*.ts` removed; ⏳ vacuous gates + sprint7-spec.yaml dedupe (in progress, item 0c); TODO update COMMAND_RUNWAY.md paths (githeri verify-exec flagged 9 missing)
