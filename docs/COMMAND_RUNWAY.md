# COMMAND_RUNWAY — Verified Attention Engine (VAE) Reference Implementation

**Target**: Build the Verified Attention Engine (VAE) — the reference implementation of the Verified Attention Protocol (VAP)  
**Specification**: `docs/specs/0001-verified-attention-protocol.md` (VAP), `docs/specs/0000-project-charter.md` (Charter), `docs/specs/0010-verified-attention-engine.md` (VAE)  
**Sprint Plan**: `SPRINTS.md` (24 sprints across 6 phases)  
**Monorepo**: TypeScript/Node.js (pnpm + Turborepo), packages: `core`, `pipeline`, `store`, `verification`, `crypto`, `ml/attention`, `ml/fraud`, `sdk/browser`, `sdk/mobile`, `sdk/desktop`, `extension`, `api`, `verifier`, `reward`, `analytics`, `cli`

---

# Global Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| G1 | VAP 1.0 specification published (`docs/specs/0001-verified-attention-protocol.md` v1.0) | Public GitHub Release `vap-1.0-draft` |
| G2 | Core VAP data models implemented with Zod schemas & 100% conformance test coverage | `pnpm test:conformance` passes |
| G3 | Evidence pipeline: ingestion → validation → normalization → dedup → feature extraction → store | `pnpm test:integration --filter=@verified-attention/pipeline` passes |
| G4 | Evidence store (append-only, indexed by session_id + EVID) with in-memory + persistent backends | `pnpm test --filter=@verified-attention/store` passes |
| G5 | Session lifecycle state machine (CREATED→ACTIVE→EXPIRED/VERIFIED/CANCELLED) enforced | Conformance test `session-state-machine` passes |
| G6 | Attention Intelligence: behaviour model AUC ≥ 0.95 on held-out human vs bot data | `tests/benchmarks/attention-model/` passes |
| G7 | Fraud Intelligence: ensemble model AUC ≥ 0.98, precision ≥ 0.95 at 0.1% FPR | `tests/benchmarks/fraud-model/` passes |
| G8 | Verification Engine: policy evaluation, confidence calculation, deterministic decisions | Conformance tests `verification-full` pass |
| G9 | Proof of Attention generation: Ed25519 signing, 7 mandatory fields, append-only store | Conformance tests `proof-full` pass |
| G10 | Reward Intelligence: eligibility → pricing → budget → settlement prep pipeline | Integration test `reward-flow` passes |
| G11 | Browser SDK < 50 KB gzipped, produces VAP-conformant evidence | `pnpm build --filter=@verified-attention/sdk-browser` + conformance |
| G12 | Browser Extension (MV3) published to Chrome/Firefox/Edge stores | Store listings approved |
| G13 | Public REST + Streaming APIs with OpenAPI 3.1 spec, generated SDKs (TS, Python, Go, Rust) | `pnpm openapi:generate` + `pnpm sdk:generate` |
| G14 | Security: OAuth2/OIDC, mTLS, RBAC, secrets management, encryption at rest, pen-test clean | `docs/security/pentest-report.md` clean |
| G15 | Privacy: consent management, data minimisation, pseudonymisation, retention, DSR API | Conformance `privacy` passes, DPIA sign-off |
| G16 | Observability: Prometheus metrics, Grafana dashboards, OpenTelemetry tracing, alerting | Dashboards render, alerts fire |
| G17 | Load test: 10K evidence/sec sustained 1hr (p99 < 500ms), 10K proofs/min (p99 < 1s) | `tests/load/` pass |
| G18 | Chaos test: pipeline node kill → recovery < 30s, zero evidence loss | `tests/chaos/` pass |
| G19 | All CI gates pass: lint, typecheck, test, build, conformance | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` |

---

# Execution Stages

## Stage 0: Foundation & Monorepo Setup (Sprint 1)

### Objective
Establish monorepo, CI/CD, shared config, ADR-001 (Language/Framework), and minimal prototype ingestion flow.

### Inputs
- `SPRINTS.md` Sprint 1 tasks
- `docs/adr/0001-language-framework.md` (to create)
- `package.json` (root), `tsconfig.json`, `turbo.json`

### Preconditions
- Node.js ≥ 20, pnpm ≥ 9 installed
- Git repo initialized

### Discovery Tasks
- [ ] Inspect existing `package.json`, `tsconfig.json`, `packages/*/package.json`
- [ ] Verify Turborepo pipeline config

### Execution Tasks
1. **Initialize monorepo structure** — ensure `packages/` and `apps/` workspaces exist
2. **Configure Turborepo pipeline** — `build`, `test`, `lint`, `typecheck`, `dev` tasks with proper dependsOn
3. **Set up shared TypeScript config** — `tsconfig.json` with path aliases `@verified-attention/*`
4. **Configure CI/CD** — `.github/workflows/ci.yml` with lint, typecheck, test, build on PR
5. **Create ADR-001** — Document language/framework decision (TypeScript, Node.js, Zod, Vitest)
6. **Implement prototype ingestion script** — `scripts/prototype-ingest.ts` end-to-end mock flow
7. **Configure Prettier, ESLint, Vitest** across workspaces
8. **Run initial build** — verify `pnpm install && pnpm build` succeeds

### Suggested Commands
```bash
# 1. Verify tooling
node --version && pnpm --version

# 2. Install deps
pnpm install

# 3. Create ADR-001
mkdir -p docs/adr
cat > docs/adr/0001-language-framework.md << 'EOF'
# ADR-001: Language and Framework Selection
## Status: Accepted
## Context: Need implementation language for VAE reference implementation
## Decision: TypeScript (Node.js 20+) with pnpm workspaces + Turborepo
## Rationale: Type safety for protocol objects, rich ecosystem, shared code with SDKs
EOF

# 4. Build & verify
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

### Expected Outputs
- `docs/adr/0001-language-framework.md`
- `.github/workflows/ci.yml`
- `turbo.json` (if not present)
- Working `pnpm build` and `pnpm test`

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Install | `pnpm install` | Exit 0 |
| Build | `pnpm build` | All packages build |
| Typecheck | `pnpm typecheck` | No errors |
| Lint | `pnpm lint` | No errors |
| Test | `pnpm test` | All pass (may be empty initially) |
| Prototype | `pnpm tsx scripts/prototype-ingest.ts` | Runs without error |

### Failure Procedure
- If `pnpm install` fails: check Node/pnpm versions, `package.json` syntax
- If build fails: inspect `turbo` output, fix TypeScript errors in package order
- If typecheck fails: fix type errors before proceeding

### Completion Condition
`pnpm build && pnpm typecheck && pnpm lint` all exit 0. CI workflow runs on PR.

---

## Stage 1: Core Protocol Data Models (Sprint 2)

### Objective
Implement VAP Evidence, Observation, Session, Claim, Proof models as TypeScript classes with Zod schemas, validation, serialization.

### Inputs
- VAP Spec Sections 4, 5, 6, 7, 10
- `packages/core/src/` (existing stubs from inspection)

### Preconditions
- Stage 0 complete
- `packages/core/package.json` with `zod`, `typescript`, `vitest`

### Discovery Tasks
- [ ] Read `packages/core/src/common.ts`, `evidence.ts`, `observation.ts`, `session.ts`, `claim.ts`, `proof.ts`
- [ ] Verify Zod schemas match VAP spec exactly (field names, types, constraints)
- [ ] Check existing `createEvidence`, `createObservation`, `createSession`, `createClaim`, `createUnsignedProof` functions

### Execution Tasks
1. **Complete Evidence model** (`packages/core/src/evidence.ts`)
   - All 5 evidence types: E-INTERACTION, E-VISIBLE, E-DURATION, E-CONTEXT, E-CUSTOM
   - Payload schemas with exact VAP fields
   - Provenance with observationIds, observationHash, sourceId, collectionMethod
   - Signature field, metadata, baseMetadata
   - `createEvidence()`, `validateEvidence()`, `computeEvidenceHash()`
2. **Complete Observation model** (`packages/core/src/observation.ts`)
   - All 8 signal types: SCROLL, CLICK, KEY_PRESS, VIEWPORT_VISIBILITY, FOCUS, DEVICE_MOTION, PAGE_RESIZE, CUSTOM
   - Payload schemas per signal type
   - ObservationMeta with all required fields
   - `createObservation()`, `normalizeObservation()` stub
   - ObservationBatch schema
3. **Complete Session model** (`packages/core/src/session.ts`)
   - SessionConfig, SessionParticipant
   - State machine: CREATED → ACTIVE → EXPIRED/VERIFIED/CANCELLED → CERTIFIED
   - `createSession()`, `addEvidenceToSession()`, `transitionSessionState()`, `isSessionExpired()`, `sessionHeartbeat()`
   - Validate all transitions per VAP Appendix B
4. **Complete Claim model** (`packages/core/src/claim.ts`)
   - All 6 claim types: HUMAN_PRESENCE, CONTENT_VISIBLE, ENGAGEMENT_SUFFICIENT, DURATION_MET, NO_FRAUD_DETECTED, CUSTOM
   - Evidence references with hash
   - Confidence, state machine: PROPOSED → EVALUATED → ISSUED/REVOKED
   - `createClaim()`, `transitionClaimState()`, `validateClaim()`, `isClaimExpired()`, `isClaimActive()`
5. **Complete Proof model** (`packages/core/src/proof.ts`)
   - 7 mandatory fields: proofId, sessionId, contentId, confidence, evidenceHash, verifierId, signature
   - State machine: UNSIGNED → SIGNED → PUBLISHED/REVOKED/EXPIRED
   - `createUnsignedProof()`, `signProof()`, `publishProof()`, `revokeProof()`, `transitionProofState()`
6. **Export all from `packages/core/src/index.ts`**
7. **Unit tests** — `packages/core/tests/` with Vitest, ≥80% coverage, mutation testing

### Suggested Commands
```bash
# 1. Inspect current state
cat packages/core/src/common.ts
cat packages/core/src/evidence.ts
cat packages/core/src/observation.ts
cat packages/core/src/session.ts
cat packages/core/src/claim.ts
cat packages/core/src/proof.ts

# 2. Run tests to see baseline
pnpm test --filter=@verified-attention/core

# 3. After edits, verify
pnpm build --filter=@verified-attention/core
pnpm test --filter=@verified-attention/core --coverage
pnpm typecheck --filter=@verified-attention/core
```

### Expected Outputs
- Complete `packages/core/src/*.ts` files
- `packages/core/tests/*.test.ts` (≥80% coverage)
- All types exported from `packages/core/src/index.ts`

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Build | `pnpm build --filter=@verified-attention/core` | Exit 0, dist/ generated |
| Typecheck | `pnpm typecheck --filter=@verified-attention/core` | No errors |
| Tests | `pnpm test --filter=@verified-attention/core` | All pass |
| Coverage | `pnpm test --filter=@verified-attention/core --coverage` | ≥80% |

### Failure Procedure
- Schema validation errors: compare Zod schema to VAP spec Section 5/4/6/7/10 field-by-field
- State machine test failures: verify transition tables match VAP Appendix B exactly
- Type errors: fix `z.infer` types, ensure discriminated unions work

### Completion Condition
Core package builds, typechecks, tests pass with ≥80% coverage. All VAP data models implemented.

---

## Stage 2: Evidence Processing Pipeline (Sprint 2–3, 7)

### Objective
Build the evidence processing pipeline: ingestion → validation → normalization → deduplication → feature extraction → enrichment → store.

### Inputs
- VAP Spec Sections 3, 4, 5
- VAE Spec Section 7 (Evidence Processing Pipeline)
- `packages/pipeline/src/` (validation.ts, normalization.ts exist)
- `packages/store/src/evidence-store.ts` (InMemoryEvidenceStore exists)

### Preconditions
- Stage 1 complete (core models available)

### Discovery Tasks
- [ ] Read `packages/pipeline/src/validation.ts`, `normalization.ts`
- [ ] Read `packages/store/src/evidence-store.ts`
- [ ] Check `packages/pipeline/package.json` for dependencies

### Execution Tasks

#### 2.1 Validation Stage (`packages/pipeline/src/validation.ts`)
1. Implement `validateEvidence(evidence)` — schema + business rules (timestamp window, required fields)
2. Implement `validateObservation(observation)` — schema + session attribution
3. Return `EvidenceValidationResult` / `ObservationValidationResult` with errors/warnings
4. Replay protection: reject evidence with timestamp outside acceptable window

#### 2.2 Normalization Stage (`packages/pipeline/src/normalization.ts`)
1. Implement `normalizeObservation(platformObservation, platform)` for browser/mobile/desktop/server
2. Map platform-specific fields to canonical VAP Observation schema
3. Handle viewport differences, touch vs mouse, background/foreground states

#### 2.3 Deduplication Stage (new: `packages/pipeline/src/deduplication.ts`)
1. Content-hash based dedup (evidence payload hash + session_id)
2. Session-scoped dedup with configurable window
3. Emit dedup metrics

#### 2.4 Feature Extraction Stage (new: `packages/pipeline/src/features/`)
1. Implement schema `packages/pipeline/features/schema.json` (VAP Section 5 evidence types)
2. Extract: reading speed, pause distribution, engagement depth, scroll velocity, visibility ratios, interaction patterns
3. Output enriched evidence with `features` field

#### 2.5 Enrichment Stage (new: `packages/pipeline/src/enrichment.ts`)
1. Add context: device trust, source reliability, policy ID
2. Compute qualityScore, completenessScore
3. Attach to evidence metadata

#### 2.6 Evidence Store (`packages/store/src/evidence-store.ts`)
1. Complete `InMemoryEvidenceStore` — append-only, indexed by session_id + EVID
2. Add persistent backend interface (to be implemented in Sprint 7: PostgreSQL/S3)
3. Implement `iterate()` with proper pagination
4. Error types: DUPLICATE, OVERFLOW, MISSING_SESSION

#### 2.7 Pipeline Orchestrator (new: `packages/pipeline/src/pipeline.ts`)
1. Compose stages: validate → normalize → dedup → extract → enrich → store
2. Async iterator input, streaming output
3. Dead letter queue for failed evidence with retry logic
4. Metrics emission at each stage (latency, throughput, error rates)

### Suggested Commands
```bash
# Build & test pipeline
pnpm build --filter=@verified-attention/pipeline
pnpm test --filter=@verified-attention/pipeline --coverage

# Build & test store
pnpm build --filter=@verified-attention/store
pnpm test --filter=@verified-attention/store --coverage

# Integration test
pnpm test --filter=@verified-attention/pipeline --filter=@verified-attention/store
```

### Expected Outputs
- `packages/pipeline/src/validation.ts`, `normalization.ts`, `deduplication.ts`, `features/`, `enrichment.ts`, `pipeline.ts`
- `packages/store/src/evidence-store.ts` (complete)
- Unit tests for each stage
- Integration test: observation batch → pipeline → store

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Pipeline build | `pnpm build --filter=@verified-attention/pipeline` | Exit 0 |
| Store build | `pnpm build --filter=@verified-attention/store` | Exit 0 |
| Unit tests | `pnpm test --filter=@verified-attention/pipeline --filter=@verified-attention/store` | All pass |
| Integration | `pnpm test:integration --filter=@verified-attention/pipeline` | Pass |
| Conformance | `pnpm test:conformance --filter=@verified-attention/pipeline` | Evidence validation tests pass |

### Failure Procedure
- Validation rejects valid evidence: check timestamp window, schema strictness
- Normalization loses data: verify all platform fields mapped
- Store duplicate error on legitimate evidence: check hash computation
- Pipeline backpressure: add buffering, metrics

### Completion Condition
Pipeline processes observation batches end-to-end, produces validated/enriched evidence in store. All conformance tests for evidence validation pass.

---

## Stage 3: Session Management & API (Sprint 3)

### Objective
Implement Session lifecycle API (create, get, update, close, expire) with state machine enforcement.

### Inputs
- VAP Spec Section 6
- `packages/core/src/session.ts` (from Stage 1)
- `apps/api/` (to create)

### Preconditions
- Stage 1 complete (Session model ready)
- Stage 2 complete (evidence store available)

### Execution Tasks
1. **Create `apps/api/src/sessions/`** — REST endpoints:
   - `POST /v1/sessions` — create session (returns sessionId)
   - `GET /v1/sessions/:id` — get session with evidence/claims
   - `PATCH /v1/sessions/:id` — update config, heartbeat
   - `POST /v1/sessions/:id/evidence` — add evidence to session
   - `POST /v1/sessions/:id/verify` — trigger verification
   - `POST /v1/sessions/:id/close` — close session
2. **Session state machine enforcement** — use `transitionSessionState()` from core
3. **Evidence integration** — call pipeline for each evidence submission
4. **Auth middleware** — API key / JWT validation (stub for now)
5. **OpenAPI spec generation** — `apps/api/openapi.yaml` from code

### Suggested Commands
```bash
# Create API package
mkdir -p apps/api/src/sessions
# ... implement endpoints ...

pnpm build --filter=@verified-attention/api
pnpm test --filter=@verified-attention/api
```

### Expected Outputs
- `apps/api/src/sessions/*.ts` endpoints
- `apps/api/openapi.yaml` (generated)
- Integration tests: session CRUD + evidence flow

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| API build | `pnpm build --filter=@verified-attention/api` | Exit 0 |
| API tests | `pnpm test --filter=@verified-attention/api` | All pass |
| OpenAPI valid | `npx @redocly/cli lint apps/api/openapi.yaml` | No errors |

### Completion Condition
Session API accepts evidence, enforces state machine, integrates with pipeline.

---

## Stage 4: VAP Specification Finalization & Conformance Framework (Sprint 4)

### Objective
Finalize VAP 1.0-draft spec, build conformance test framework, implement core conformance tests.

### Inputs
- `docs/specs/0001-verified-attention-protocol.md` (current draft)
- `packages/core/` (data models)
- `SPRINTS.md` Sprint 4 tasks

### Execution Tasks
1. **Finalize VAP spec** — Complete all 14 sections + appendices, no TODOs
2. **Create `packages/conformance/`** — test runner, fixtures, assertions
3. **Implement conformance tests**:
   - Evidence model validation (all 5 types, required fields, constraints)
   - Session state machine (all valid/invalid transitions)
   - Proof object structure (7 mandatory fields, signature format)
   - Protocol messages (SubmitEvidence, ClaimRequest, VerificationCreate)
4. **Publish VAP 1.0-draft** — GitHub Release `vap-1.0-draft`

### Suggested Commands
```bash
# Create conformance package
mkdir -p packages/conformance/src
# ... implement test runner ...

pnpm test --filter=@verified-attention/conformance
# Should run all conformance suites
```

### Expected Outputs
- `docs/specs/0001-verified-attention-protocol.md` v1.0 (finalized)
- `packages/conformance/` test framework
- `tests/conformance/evidence/`, `session/`, `proof/`, `messages/`
- GitHub Release `vap-1.0-draft`

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Conformance tests | `pnpm test:conformance` | All pass against core package |
| Spec completeness | Manual review | No TODOs, all sections complete |

### Completion Condition
VAP spec published, conformance framework runs, core package passes all conformance tests.

---

## Stage 5: Verification Engine Core & Policy Engine (Sprint 5)

### Objective
Implement Claim model, Confidence Model, Verification Engine, Policy Engine, deterministic outcomes.

### Inputs
- VAP Spec Sections 7, 8, 9, 10
- VAE Spec Sections 8, 10
- `packages/core/src/claim.ts`, `common.ts` (Confidence, VerificationOutcome)
- `packages/verification/` (to create)

### Preconditions
- Stage 1 complete (Claim, Confidence types)
- Stage 4 complete (conformance framework)

### Execution Tasks
1. **Create `packages/verification/confidence/`** — Confidence Model
   - Deterministic confidence calculation: `C = f(E_quality, E_completeness, E_count, reliability, contradiction_penalty)`
   - Same input + same rules = same output (test with fixed seed)
   - Calibration interface for ML models
2. **Create `packages/verification/engine/`** — Verification Engine
   - Lifecycle: evidence → claims → confidence → decision
   - `verify(sessionId, policyId)` → VerificationResult
   - Outcome codes: PASS, FAIL, INSUFFICIENT, PENDING, INCONCLUSIVE
3. **Create `packages/verification/policy/`** — Policy Engine
   - JSON policy config: required evidence types, confidence thresholds, fraud limits, session constraints
   - Policy CRUD API (create, list, get, update, deprecate)
   - Versioned policies with audit log
4. **Create `packages/verification/outcomes/`** — Outcome enum + semantics
5. **Conformance tests** — All VAP Section 9 requirements
6. **Integration test** — Full session → evidence → verification → decision

### Suggested Commands
```bash
mkdir -p packages/verification/{confidence,engine,policy,outcomes}/src
# ... implement ...

pnpm build --filter=@verified-attention/verification
pnpm test --filter=@verified-attention/verification
pnpm test:conformance --filter=@verified-attention/verification
```

### Expected Outputs
- `packages/verification/confidence/src/confidence-model.ts`
- `packages/verification/engine/src/verification-engine.ts`
- `packages/verification/policy/src/policy-engine.ts`
- Conformance tests in `tests/conformance/verification/`

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Build | `pnpm build --filter=@verified-attention/verification` | Exit 0 |
| Tests | `pnpm test --filter=@verified-attention/verification` | All pass |
| Conformance | `pnpm test:conformance --filter=@verified-attention/verification` | 100% VAP Sec 9 |
| Determinism | `pnpm test:determinism` | Same input → same confidence |

### Failure Procedure
- Non-deterministic confidence: check for random seeds, date.now(), unordered iterations
- Policy evaluation mismatch: verify JSON schema matches VAP spec
- Integration test fails: trace evidence → claim → confidence → decision

### Completion Condition
Verification engine produces deterministic decisions. All conformance tests pass.

---

## Stage 6: Proof Generation & Cryptographic Signing (Sprint 6)

### Objective
Complete Proof of Attention generation with Ed25519 signing, key management, proof store, webhooks.

### Inputs
- VAP Spec Section 10, Appendix A
- `packages/core/src/proof.ts` (from Stage 1)
- `packages/crypto/` (to create)

### Preconditions
- Stage 5 complete (verification produces PASS decisions)

### Execution Tasks
1. **Create `packages/crypto/keys/`** — Verifier key management
   - Ed25519 key generation, rotation, HSM interface (stub)
   - Key storage, audit log
2. **Create `packages/crypto/signing/`** — Proof signing service
   - Sign proof with verifier private key
   - Emit proof event, store proof
3. **Create `packages/core/proof/verify.ts`** — Independent proof verification
   - Verify signature + hash without verifier
4. **Create `packages/store/proof/`** — Proof store (append-only, indexed by PID, session_id)
5. **Create `apps/verifier/src/proof-signing/`** — Proof generation pipeline
   - Async, batched, idempotent
   - Exactly-once semantics
6. **Create `apps/verifier/src/webhooks/`** — Proof webhook delivery
   - Retry, backoff, dead letter, HMAC signature
7. **Conformance tests** — Proof structure, signature, immutability, revocation
8. **ADR-003** — Verifier identity & trust model

### Suggested Commands
```bash
mkdir -p packages/crypto/{keys,signing}/src
mkdir -p packages/store/proof/src
mkdir -p apps/verifier/src/{proof-signing,webhooks}
# ... implement ...

pnpm build --filter=@verified-attention/crypto --filter=@verified-attention/store-proof --filter=@verified-attention/verifier
pnpm test --filter=@verified-attention/crypto --filter=@verified-attention/store-proof --filter=@verified-attention/verifier
pnpm test:conformance --filter=@verified-attention/verifier
```

### Expected Outputs
- Crypto packages with Ed25519 signing/verification
- Proof store with query API
- Verifier service: proof generation + webhook delivery
- Conformance tests passing

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Crypto tests | `pnpm test --filter=@verified-attention/crypto` | Sign/verify roundtrip |
| Proof store | `pnpm test --filter=@verified-attention/store-proof` | Append-only, query |
| Verifier | `pnpm test --filter=@verified-attention/verifier` | Proof gen + webhook |
| Conformance | `pnpm test:conformance --filter=@verified-attention/verifier` | 100% VAP Sec 10 |
| Load test | `pnpm test:load --filter=@verified-attention/verifier` | 10K proofs/min, p99 < 1s |

### Completion Condition
Proofs generated, signed, stored, delivered via webhook. All conformance tests pass. Load test passes.

---

## Stage 7: Pipeline Production Hardening (Sprint 7)

### Objective
Harden pipeline for production: observability, distributed tracing, DLQ, load/chaos testing.

### Inputs
- Stage 2 pipeline
- VAE Spec Section 7, 13, 17

### Execution Tasks
1. **Metrics** (`packages/observability/pipeline-metrics/`) — Prometheus: latency, throughput, error rates, backlog
2. **Distributed Tracing** (`packages/observability/tracing/`) — OpenTelemetry: ingestion → validation → normalization → store
3. **Dead Letter Queue** (`packages/pipeline/dlq/`) — Failed evidence quarantine, retry logic, alerting
4. **Load Test** (`tests/load/pipeline-10k/`) — 10K evidence/sec sustained 1hr, p99 < 500ms, 0% data loss
5. **Chaos Test** (`tests/chaos/pipeline-resilience/`) — Kill nodes, verify recovery < 30s, zero evidence loss

### Suggested Commands
```bash
mkdir -p packages/observability/{pipeline-metrics,tracing}/src
mkdir -p packages/pipeline/dlq/src
mkdir -p tests/load/pipeline-10k tests/chaos/pipeline-resilience
# ... implement ...

pnpm test:load --filter=pipeline-10k
pnpm test:chaos --filter=pipeline-resilience
```

### Expected Outputs
- Prometheus metrics + Grafana dashboards
- OpenTelemetry instrumentation
- DLQ with retry/alerting
- Load test results
- Chaos test results

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Metrics exposed | `curl localhost:9090/metrics` | Pipeline metrics present |
| Traces | Jaeger/Tempo UI | Full pipeline trace |
| Load test | `pnpm test:load:pipeline-10k` | p99 < 500ms, 0% loss |
| Chaos test | `pnpm test:chaos:pipeline-resilience` | Recovery < 30s, 0 loss |

### Completion Condition
Pipeline hardened, observable, passes load + chaos tests.

---

## Stage 8: Attention Intelligence — Behaviour Models (Sprint 8)

### Objective
Production attention models with feature engineering, serving, versioning, continuous learning.

### Inputs
- VAE Spec Section 8
- `packages/ml/attention/` (to create)
- `apps/ml-serving/attention/` (to create)

### Preconditions
- Stage 7 complete (pipeline produces enriched evidence with features)

### Execution Tasks
1. **Feature Engineering** (`packages/ml/attention/features/`) — Match research prototype schema
2. **Model Training** (`packages/ml/attention/model/`) — Transformer/GRU, AUC ≥ 0.95 on human vs bot
3. **Model Serving** (`apps/ml-serving/attention/`) — gRPC/REST, batch + streaming, p99 < 50ms
4. **Versioning & A/B** (`apps/ml-serving/infra/`) — Blue/green, canary, rollback < 1 min
5. **Drift Detection** (`packages/ml/attention/drift/`) — KS test, PSI, alert + auto-retrain
6. **Retraining Pipeline** (`packages/ml/attention/retrain/`) — Weekly, promotes if AUC improves
7. **Conformance** — Deterministic output (fixed seed)
8. **Integration Test** — Pipeline → features → model → confidence score

### Suggested Commands
```bash
mkdir -p packages/ml/attention/{features,model,drift,retrain}/src
mkdir -p apps/ml-serving/{attention,infra}
# ... implement ...

pnpm build --filter=@verified-attention/ml-attention --filter=@verified-attention/ml-serving-attention
pnpm test --filter=@verified-attention/ml-attention
pnpm test:benchmarks --filter=attention-model
```

### Expected Outputs
- Trained model artifacts
- Model serving API
- Drift detection + auto-retrain
- Benchmark results (AUC ≥ 0.95)

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Model AUC | `pnpm test:benchmarks:attention-model` | ≥ 0.95 |
| Serving latency | `pnpm test:load:ml-serving` | p99 < 50ms |
| Determinism | `pnpm test:conformance:ml-determinism` | Bitwise identical |
| Integration | `pnpm test:integration:attention-ml` | End-to-end passes |

### Completion Condition
Attention model serves in production pipeline with monitoring, drift detection, CI/CD.

---

## Stage 9: Fraud Intelligence — Detection Models (Sprint 9)

### Objective
Production fraud detection covering all threat vectors: biometrics, fingerprinting, automation, Sybil, reputation.

### Inputs
- VAE Spec Section 9
- `packages/ml/fraud/` (to create)
- `apps/ml-serving/fraud/` (shared infra with attention)

### Preconditions
- Stage 8 complete (ML serving infra ready)

### Execution Tasks
1. **Behavioural Biometrics** (`packages/ml/fraud/biometrics/`) — Mouse curvature, keystroke dynamics, pressure
2. **Device Fingerprinting** (`packages/ml/fraud/fingerprint/`) — Browser attrs, canvas, WebGL, audio, battery; entropy ≥ 18 bits
3. **Automation Detection** (`packages/ml/fraud/automation/`) — Headless, Puppeteer, Selenium, Playwright signatures; detection ≥ 99%
4. **Sybil Detection** (`packages/ml/fraud/sybil/`) — IP clustering, device correlation, velocity checks; graph-based
5. **Reputation Scoring** (`packages/ml/fraud/reputation/`) — Device, IP, subnet, ASN; time-decayed scores
6. **Ensemble Model** (`packages/ml/fraud/ensemble/`) — Gradient boosting + neural; AUC ≥ 0.98, precision ≥ 0.95 at 0.1% FPR
6. **Fraud Serving** (`apps/ml-serving/fraud/`) — p99 < 50ms, shared infra
7. **Conformance** — Deterministic, auditable scores
8. **Integration Test** — Fraud signals → verification engine policy → FAIL outcome

### Suggested Commands
```bash
mkdir -p packages/ml/fraud/{biometrics,fingerprint,automation,sybil,reputation,ensemble}/src
mkdir -p apps/ml-serving/fraud
# ... implement ...

pnpm test:benchmarks --filter=fraud-model
pnpm test:conformance --filter=fraud-determinism
pnpm test:integration --filter=fraud-verification
```

### Expected Outputs
- 5 fraud detection model packages
- Ensemble model with benchmarks
- Fraud serving API
- Conformance + integration tests

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Ensemble AUC | `pnpm test:benchmarks:fraud-model` | ≥ 0.98 |
| Precision @ 0.1% FPR | benchmark | ≥ 0.95 |
| Determinism | `pnpm test:conformance:fraud-determinism` | Pass |
| Integration | `pnpm test:integration:fraud-verification` | High fraud → FAIL |

### Completion Condition
Fraud ensemble deployed, monitored, integrated with verification engine.

---

## Stage 10: Verification Engine — Policy & Decision Hardening (Sprint 10)

### Objective
Complete verification engine: all policy types, manual review queue, audit log, replay, load test.

### Inputs
- VAP Spec Section 9, 10
- Stage 5 (verification core), Stage 9 (fraud signals)

### Execution Tasks
1. **Policy Types** (`packages/verification/policy/types.ts`) — Evidence requirements, confidence thresholds, fraud limits, session constraints
2. **Policy CRUD API** (`apps/api/src/policies/`) — Versioned, audit log
3. **Manual Review Queue** (`apps/verifier/src/review-queue/`) — UI + API, reviewer assignment, SLA tracking
4. **Verification Audit Log** (`packages/store/verification-audit/`) — Immutable, queryable, full context
5. **Verification Replay** (`apps/verifier/src/replay/`) — Deterministic re-run with new policy, diff output
6. **Conformance** — 100% VAP Section 9 coverage
7. **Load Test** — 1K verifications/sec mixed policies, p99 < 200ms, 0% errors

### Suggested Commands
```bash
# Extend verification packages
# ... implement ...

pnpm test:conformance --filter=verification-full
pnpm test:load --filter=verification-1k
```

### Expected Outputs
- Complete policy engine
- Review queue UI/API
- Audit log store
- Replay capability
- Load test results

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Conformance | `pnpm test:conformance:verification-full` | 100% VAP Sec 9 |
| Load test | `pnpm test:load:verification-1k` | p99 < 200ms, 0% errors |
| Replay | `pnpm test:integration:verification-replay` | Deterministic diff |

### Completion Condition
Verification engine production-ready with all policy types, review queue, audit, replay.

---

## Stage 11: Proof Generation — Production Ready (Sprint 11)

### Objective
Proof generation at scale with HSM/KMS signing, revocation, retrieval API, webhooks, load test.

### Inputs
- Stage 6 (proof generation core)
- Stage 10 (verification produces PASS)

### Execution Tasks
1. **Proof Generation Pipeline** (`apps/verifier/src/proof-gen/`) — Async, batched, idempotent, exactly-once
2. **HSM/Cloud KMS Integration** (`packages/crypto/hsm/`) — Keys never in memory, audit trail
3. **Proof Revocation** (`packages/core/proof/revocation.ts`) — Revoked flag, version chain, audit
4. **Proof Retrieval API** (`apps/api/src/proofs/`) — By PID, session, content, verifier, time range; paginated, filtered
5. **Webhook Delivery** (`apps/verifier/src/webhooks/`) — At-least-once, consumer verifies HMAC
6. **Conformance** — Proof structure, signature, immutability, revocation (100% VAP Sec 10 + Appendix A)
7. **Load Test** — 10K proofs/min generation + signing, p99 < 1s

### Suggested Commands
```bash
# Extend verifier, crypto, api
# ... implement ...

pnpm test:conformance --filter=proof-full
pnpm test:load --filter=proof-gen-10k
```

### Expected Outputs
- Production proof pipeline
- HSM/KMS signing
- Revocation support
- Proof query API
- Webhook delivery
- Load test results

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Conformance | `pnpm test:conformance:proof-full` | 100% VAP Sec 10 + A |
| Load test | `pnpm test:load:proof-gen-10k` | p99 < 1s |
| HSM signing | `pnpm test:crypto:hsm` | Keys never in memory |

### Completion Condition
Proof generation at scale with hardware signing, full API, conformance passing.

---

## Stage 12: Reward Intelligence (Sprint 12)

### Objective
Reward recommendation engine: eligibility, pricing, budget, settlement prep.

### Inputs
- VAE Spec Section 12
- Stage 11 (proofs generated and retrievable)

### Execution Tasks
1. **Eligibility Engine** (`packages/reward/eligibility/`) — Policy match, proof validation, deduplication
2. **Campaign Policy Engine** (`packages/reward/campaigns/`) — JSON config, budget, pricing rules, caps, targeting
3. **Dynamic Pricing** (`packages/reward/pricing/`) — Model or rule-based, configurable
4. **Budget Allocation** (`packages/reward/budget/`) — Pacing, caps, rollover, exhaustion handling
5. **Settlement Preparation** (`packages/reward/settlement/`) — CSV/JSON/Parquet, idempotent, auditable
6. **Conformance** — Traceable proof → recommendation
7. **Integration Test** — Proof → eligibility → pricing → budget → settlement prep

### Suggested Commands
```bash
mkdir -p packages/reward/{eligibility,campaigns,pricing,budget,settlement}/src
# ... implement ...

pnpm test:conformance --filter=reward
pnpm test:integration --filter=reward-flow
```

### Expected Outputs
- Complete reward intelligence pipeline
- Settlement export formats
- Conformance + integration tests

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Conformance | `pnpm test:conformance:reward` | Full audit trail |
| Integration | `pnpm test:integration:reward-flow` | End-to-end passes |

### Completion Condition
Reward engine translates proofs to settlement-ready recommendations.

---

## Stage 13: Analytics & Observability Platform (Sprint 13)

### Objective
Operational and business analytics: data warehouse, metrics, dashboards, alerting, tracing UI.

### Inputs
- All previous stages producing events/metrics

### Execution Tasks
1. **Analytics Warehouse** (`packages/analytics/warehouse/`) — Columnar, time-partitioned: evidence, sessions, proofs, verifications, rewards
2. **Operational Metrics** (`packages/observability/ops-metrics/`) — Prometheus + Grafana: throughput, latency, error rates, queue depths
3. **Attention Metrics** (`packages/analytics/attention-metrics/`) — Verified sessions, confidence dist, fraud rates; daily/hourly rollups
4. **Fraud Metrics** (`packages/analytics/fraud-metrics/`) — Detection rates, false positives, new vectors; model perf monitoring
5. **Business Metrics** (`packages/analytics/business-metrics/`) — Reward payout, campaign ROI, publisher yield; real-time + historical
6. **Alerting** (`packages/observability/alerting/`) — PagerDuty/Slack/email, runbook-linked, no unactionable pages
7. **Tracing UI** (`packages/observability/tracing-ui/`) — Jaeger/Tempo integration, search by session_id, PID, error
8. **Conformance** — All metrics queryable via REST API with OpenAPI spec

### Suggested Commands
```bash
mkdir -p packages/analytics/{warehouse,attention-metrics,fraud-metrics,business-metrics}/src
mkdir -p packages/observability/{ops-metrics,alerting,tracing-ui}/src
# ... implement ...

pnpm test:conformance --filter=analytics-api
```

### Expected Outputs
- Analytics warehouse
- Grafana dashboards (pre-built)
- Alert rules with runbooks
- Tracing query UI
- Metrics API

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Dashboards | Grafana UI | All panels render |
| Alerts | Trigger test alert | Fires, runbook linked |
| Tracing | Search by session_id | Returns trace |
| Metrics API | `curl /metrics` | OpenAPI valid |

### Completion Condition
Full observability stack operational, all metrics queryable via API.

---

## Stage 14: Security Hardening & Penetration Testing (Sprint 14)

### Objective
Production-grade security: auth, authz, secrets, encryption, TLS, pen-test, SBOM.

### Inputs
- All APIs and stores from Stages 3–13

### Execution Tasks
1. **Authentication** (`packages/auth/`) — OAuth2/OIDC, API keys, mTLS for service-to-service
2. **Authorization** (`packages/auth/rbac.ts`) — RBAC: admin, operator, reviewer, consumer, publisher
3. **Secrets Management** (`packages/security/secrets/`) — HashiCorp Vault / cloud secrets, rotation
4. **Encryption at Rest** (`packages/security/encryption-at-rest/`) — AES-256, key per tenant/env
5. **TLS Everywhere** (`packages/security/tls/`) — Internal mTLS, external TLS 1.3, cert-manager, auto-rotation, HSTS
6. **Penetration Test** — Internal + external, `docs/security/pentest-report.md`, critical/high remediated
7. **Dependency Scan** — SBOM, CVE monitoring, license compliance, `docs/security/sbom.json`, zero critical/unpatched
8. **Security Headers** (`apps/api/src/security/`) — CSP, rate limiting, WAF, OWASP ASVS Level 2

### Suggested Commands
```bash
mkdir -p packages/{auth,security}/{secrets,encryption-at-rest,tls}/src
# ... implement ...

# Pen test (external)
# Dependency scan
pnpm audit --prod
# SBOM generation
npx @cyclonedx/bom .
```

### Expected Outputs
- Auth/AuthZ packages
- Secrets management
- Encryption at rest
- TLS config
- Pen test report (clean)
- SBOM with zero critical CVEs
- Security headers/WAF

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Auth | `pnpm test --filter=@verified-attention/auth` | All roles enforced |
| TLS | `curl -v https://api` | TLS 1.3, cert valid |
| Headers | `curl -I https://api` | CSP, HSTS, rate limit |
| SBOM | `cat docs/security/sbom.json` | Valid CycloneDX |
| Pen test | Review `docs/security/pentest-report.md` | Critical/high = 0 |

### Completion Condition
Security posture production-ready, pen-test clean, SBOM current.

---

## Stage 15: Privacy Compliance & Data Governance (Sprint 15)

### Objective
Full GDPR/CCPA compliance: consent, minimisation, pseudonymisation, retention, DSR API, selective disclosure.

### Inputs
- VAP Spec Section 11, 17
- All data stores from previous stages

### Execution Tasks
1. **Consent Management** (`packages/privacy/consent/`) — Capture, store, query, revoke per session
2. **Data Minimisation** (`packages/privacy/minimisation/`) — Schema validation, field stripping
3. **Pseudonymisation** (`packages/privacy/pseudonymisation/`) — Session IDs unlinkable, no PII in evidence
4. **Retention Policies** (`packages/privacy/retention/`) — Evidence 90d, proofs 7y, analytics aggregated only; auto-deletion jobs
5. **Data Subject Rights API** (`apps/api/src/privacy/`) — Access, rectification, erasure, portability (GDPR Art 15–20)
6. **Selective Disclosure** (`packages/core/proof/disclosure.ts`) — ZK-ready interface, v1 = field filtering
7. **Privacy Audit** — DPIA update, legal review, `docs/privacy/dpia-final.md`, auditor sign-off
8. **Conformance** — All VAP Section 17 privacy rules tested

### Suggested Commands
```bash
mkdir -p packages/privacy/{consent,minimisation,pseudonymisation,retention}/src
mkdir -p apps/api/src/privacy
# ... implement ...

pnpm test:conformance --filter=privacy
```

### Expected Outputs
- Consent management
- Minimisation enforcement
- Pseudonymisation
- Automated retention/deletion
- DSR API
- Selective disclosure for proofs
- DPIA final with sign-off

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Consent | `pnpm test --filter=@verified-attention/privacy-consent` | Linked to session |
| Minimisation | `pnpm test --filter=@verified-attention/privacy-minimisation` | Only VAP fields stored |
| Pseudonymisation | `pnpm test --filter=@verified-attention/privacy-pseudonymisation` | Auto-tests pass |
| Retention | `pnpm test --filter=@verified-attention/privacy-retention` | Auto-deletion works |
| DSR API | `pnpm test --filter=@verified-attention/api-privacy` | Art 15–20 compliant |
| DPIA | Review `docs/privacy/dpia-final.md` | Auditor sign-off |

### Completion Condition
Privacy compliance verified, DPIA signed, all conformance tests pass.

---

## Stage 16: Browser SDK — Core (Sprint 16)

### Objective
Minimal, performant browser SDK for evidence collection: observers, consent, queue, session, validation.

### Inputs
- VAP Spec Section 4, 5
- Stage 2 (ingestion API stable)

### Execution Tasks
1. **Observation Capture** (`packages/sdk/browser/observers/`) — All VAP Section 4 types: visibility, scroll, click, key, focus, motion
2. **Consent UI** (`packages/sdk/browser/consent/`) — Banner, preferences, granular toggles; GDPR-compliant, accessible
3. **Evidence Queue** (`packages/sdk/browser/queue/`) — Batching, compression, offline queue (IndexedDB), survives unload, retries
4. **Session Lifecycle** (`packages/sdk/browser/session/`) — Start, heartbeat, close, timeout; matches VAP Section 6 state machine
5. **Schema Validation** (`packages/sdk/browser/validation/`) — Protobuf/JSON Schema, invalid dropped locally
6. **Bundle Size** — Target < 50 KB gzipped (Webpack/Rollup, tree-shaking)
7. **Cross-browser Testing** — Chrome, Firefox, Safari, Edge; no console errors
8. **Conformance** — SDK produces VAP-conformant evidence

### Suggested Commands
```bash
mkdir -p packages/sdk/browser/{observers,consent,queue,session,validation,build}/src
# ... implement ...

pnpm build --filter=@verified-attention/sdk-browser
pnpm test --filter=@verified-attention/sdk-browser
pnpm test:conformance --filter=browser-sdk
# Check bundle size
ls -lh packages/sdk/browser/dist/*.gz
```

### Expected Outputs
- Browser SDK package
- All observers implemented
- Consent UI
- Offline queue
- Bundle < 50 KB gzipped
- Conformance tests passing

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Build | `pnpm build --filter=@verified-attention/sdk-browser` | Exit 0 |
| Bundle size | `gzip -c dist/sdk.js \| wc -c` | < 51200 bytes |
| Tests | `pnpm test --filter=@verified-attention/sdk-browser` | All pass |
| Conformance | `pnpm test:conformance:browser-sdk` | Evidence passes VAP validation |
| Cross-browser | Manual/Playwright | No errors on Chrome/FF/Safari/Edge |

### Completion Condition
Browser SDK published to npm, conformance passing, bundle size target met.

---

## Stage 17: Browser SDK — Advanced & Extension (Sprint 17)

### Objective
Advanced SDK features + Manifest V3 browser extension with user dashboard.

### Inputs
- Stage 16 (core SDK)

### Execution Tasks
1. **Advanced Features** (`packages/sdk/browser/advanced/`) — Reading detection, engagement scoring, attention heatmap; match ML feature schema
2. **Publisher Integration API** (`packages/sdk/browser/publisher-api/`) — Simple JS API, TypeScript types: `init()`, `configure()`, callbacks
3. **Browser Extension** (`packages/extension/`) — Manifest V3, user dashboard: active verifications, proofs earned
4. **Extension UI** (`packages/extension/ui/`) — Consent management, proof history, reward display; React/Vanilla, accessible, i18n-ready
5. **Content Script** (`packages/extension/content-script/`) — Publisher-less verification (user-initiated), works on any page with consent
6. **Store Submission** (`packages/extension/store/`) — Chrome Web Store, Firefox Add-ons, Edge Add-ons; approved listings, privacy policies
7. **Conformance** — Extension produces same evidence as SDK
8. **Documentation** — SDK integration guide, extension user guide

### Suggested Commands
```bash
mkdir -p packages/sdk/browser/{advanced,publisher-api}/src
mkdir -p packages/extension/{ui,content-script,store}
# ... implement ...

pnpm build --filter=@verified-attention/sdk-browser --filter=@verified-attention/extension
pnpm test:conformance --filter=extension
# Submit to stores (manual)
```

### Expected Outputs
- Advanced SDK features
- Browser extension (MV3) with dashboard
- Store listings approved
- Documentation

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Extension build | `pnpm build --filter=@verified-attention/extension` | MV3 manifest valid |
| Conformance | `pnpm test:conformance:extension` | Evidence parity with SDK |
| Store | Manual submission | All 3 stores approved |
| Docs | Review `docs/sdk/browser/` | Complete with examples |

### Completion Condition
Extension published on all major stores, conformance passing, docs complete.

---

## Stage 18: Mobile & Desktop SDKs (Sprint 18)

### Objective
Native Android/iOS and Desktop (Electron/Tauri) SDKs with evidence parity.

### Inputs
- Stage 17 (SDK patterns established)
- Stage 7 (ingestion API stable)

### Execution Tasks
1. **Android SDK** (`packages/sdk/android/`) — Kotlin: observers, consent, queue, session, network; all VAP observers, same evidence schema
2. **iOS SDK** (`packages/sdk/ios/`) — Swift: observers, consent, queue, session, network; all VAP observers, same evidence schema
3. **Desktop SDK** (`packages/sdk/desktop/`) — Electron/Tauri + native modules: Windows, macOS, Linux; window focus, idle, input observers
4. **Cross-platform Parity Tests** (`tests/conformance/cross-platform/`) — Same session → equivalent evidence
5. **Mobile App Store Compliance** (`packages/sdk/mobile/compliance/`) — Privacy manifests, data use declarations; App Store / Play Store ready
6. **Documentation** — Mobile/desktop integration guides

### Suggested Commands
```bash
mkdir -p packages/sdk/{android,ios,desktop,mobile/compliance}
# ... implement (Gradle, Xcode, Cargo/npm for desktop) ...

pnpm test:conformance --filter=cross-platform
```

### Expected Outputs
- Android SDK (AAR/Maven)
- iOS SDK (XCFramework/SwiftPM)
- Desktop SDK (npm package)
- Cross-platform conformance tests
- App store compliance docs

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Android build | `./gradlew build` | AAR published locally |
| iOS build | `xcodebuild` | XCFramework created |
| Desktop build | `pnpm build --filter=@verified-attention/sdk-desktop` | npm package |
| Parity tests | `pnpm test:conformance:cross-platform` | Equivalent evidence |

### Completion Condition
All three SDKs build, produce VAP-conformant evidence, parity tests pass, app store ready.

---

## Stage 19: Public API — Stabilization & Documentation (Sprint 19)

### Objective
Production-ready public REST/Streaming APIs with full documentation, versioning, generated SDKs.

### Inputs
- All API endpoints from Stages 3, 6, 11, 12, 14, 15
- Stage 15 (privacy/security done)

### Execution Tasks
1. **Stabilize All Endpoints** (`apps/api/src/`) — Evidence, sessions, proofs, verifications, policies, rewards; no breaking changes after
2. **API Versioning** (`apps/api/src/versioning.ts`) — URL path, headers, deprecation policy
3. **OpenAPI 3.1 Spec** (`apps/api/openapi.yaml`) — Auto-generated from code, CI validates spec matches impl
4. **API Gateway** (`apps/api-gateway/`) — Kong/Envoy/AWS API GW config: rate limiting, auth, logging, request ID, tracing
5. **Developer Portal** (`apps/developer-portal/`) — Redoc/Stoplight, reference docs, quickstarts, API explorer (Try It)
6. **SDK Generation** (`packages/sdk/generated/`) — TypeScript, Python, Go, Rust from OpenAPI; CI publishes to npm/PyPI/crates.io
7. **Conformance** — API matches VAP protocol messages exactly

### Suggested Commands
```bash
# Stabilize API
# Generate OpenAPI
npx @nestjs/swagger-cli ...  # or equivalent

# API Gateway config
# Developer portal (Next.js/VitePress)
# SDK generation
npx openapi-typescript-codegen -i apps/api/openapi.yaml -o packages/sdk/generated

pnpm test:conformance --filter=api
```

### Expected Outputs
- Stable v1 API
- OpenAPI 3.1 spec (always current)
- API Gateway config
- Developer portal live
- Generated SDKs published
- Conformance passing

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| OpenAPI valid | `npx @redocly/cli lint apps/api/openapi.yaml` | No errors |
| Spec matches impl | `pnpm test:conformance:api` | All VAP Sec 14 messages |
| SDKs generate | `pnpm sdk:generate` | 4 languages, no errors |
| Gateway | Deploy config, test | Rate limit, auth, tracing work |

### Completion Condition
API v1 frozen, docs live, SDKs published, conformance 100%.

---

## Stage 20: Integration Tools & Onboarding (Sprint 20)

### Objective
Developer onboarding: CLI, integration test framework, sample apps, quickstarts, sandbox.

### Inputs
- Stage 19 (stable APIs, generated SDKs)

### Execution Tasks
1. **CLI Tool** (`packages/cli/`) — `vap verify`, `vap proof get`, `vap policy create`
2. **Integration Test Framework** (`tests/integration/framework/`) — testcontainers, mock verifier, fixtures; full stack local in < 2 min
3. **Sample Applications** (`examples/`) — Publisher demo, Advertiser dashboard, Research notebook; runnable, documented
4. **Quickstart Guides** (`docs/quickstart/`) — 5-min, 30-min, production; tested by external developers
5. **Sandbox Environment** (`infra/sandbox/`) — Free tier, rate limited, auto-provisioned, self-serve signup, auto-cleanup
6. **Conformance** — Sample apps pass VAP conformance

### Suggested Commands
```bash
mkdir -p packages/cli/src
mkdir -p tests/integration/framework
mkdir -p examples/{publisher-demo,advertiser-dashboard,research-notebook}
mkdir -p docs/quickstart
mkdir -p infra/sandbox
# ... implement ...

pnpm test:conformance --filter=examples
```

### Expected Outputs
- CLI tool published
- Local integration test framework
- 3 sample apps
- 3 quickstart guides
- Sandbox environment
- Conformance for examples

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| CLI | `vap --help` | Commands work |
| Local stack | `pnpm test:integration:local` | Up in < 2 min |
| Samples | `cd examples/publisher-demo && pnpm dev` | Runs, produces proofs |
| Quickstart | External dev test | 5-min works |
| Sandbox | Signup flow | Auto-provision, cleanup |

### Completion Condition
Onboarding friction minimal, external developers can integrate in < 1 hour.

---

## Stage 21: Beta Program & VAE 1.0 Release Candidate (Sprint 21)

### Objective
External beta with real publishers, feedback integration, load test, launch checklist, VAE 1.0 RC.

### Inputs
- All previous stages complete
- Stage 20 (onboarding ready)

### Execution Tasks
1. **Recruit Beta Publishers** (5–10, diverse verticals) — Signed agreements, integration started
2. **Beta Support Rotation** — Daily standups, dedicated Slack, issue triage; SLA: 4h response, 24h fix for blocking
3. **Collect Feedback** — Usability, API gaps, performance, docs; categorized, prioritized, tracked
4. **Implement Top 10 Feedback Items** — API fixes, SDK improvements, doc updates
5. **Beta Load Test** — Real patterns, real volumes; system stable at 2x expected launch load
6. **Launch Checklist** — Monitoring, runbooks, rollback, communications; `docs/launch/checklist.md`
7. **VAE 1.0 Release Candidate** — GitHub Release `vae-1.0-rc1`; all Phase 0–4 DoD met

### Suggested Commands
```bash
# Beta coordination, issue tracking
# Load test with beta traffic patterns
pnpm test:load --filter=beta-traffic

# Final release prep
git tag vae-1.0-rc1
git push origin vae-1.0-rc1
```

### Expected Outputs
- Beta participants onboarded
- Feedback tracked and top 10 fixed
- Load test at 2x passes
- Launch checklist verified
- VAE 1.0 RC released

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Beta integrations | Monitor dashboards | Active sessions, proofs generating |
| Feedback fixes | `git log --oneline --since="beta start"` | Top 10 items committed |
| Load test | `pnpm test:load:beta-traffic` | Stable at 2x |
| Launch checklist | Review `docs/launch/checklist.md` | All items ✓ |
| RC release | GitHub Release `vae-1.0-rc1` | Published, all DoD met |

### Completion Condition
VAE 1.0 RC released, all Phase 0–4 Definition of Done criteria satisfied.

---

## Global Verification (Post-Stage 21)

After all stages complete, perform complete project validation:

| Verification | Command / Action | Pass Criteria |
|--------------|------------------|---------------|
| Full Build | `pnpm build` | All packages build |
| Full Test Suite | `pnpm test` | All unit + integration + conformance pass |
| Typecheck | `pnpm typecheck` | Zero errors |
| Lint | `pnpm lint` | Zero errors |
| Format | `pnpm format --check` | No changes needed |
| Conformance | `pnpm test:conformance` | 100% VAP coverage |
| Load Tests | `pnpm test:load` | All thresholds met |
| Chaos Tests | `pnpm test:chaos` | Recovery < 30s, zero data loss |
| Security | Pen test report, SBOM | Critical/High = 0, SBOM current |
| Privacy | DPIA sign-off, conformance | Auditor approved, tests pass |
| Observability | Dashboards, alerts, tracing | All operational |
| Documentation | `docs/` complete | API, SDK, quickstart, architecture |
| VAP Spec | `docs/specs/0001-verified-attention-protocol.md` | v1.0 published |
| Release | GitHub Release `vae-1.0` | Tagged, artifacts published |

**Only after every global verification succeeds may the COMMAND_RUNWAY declare the feature complete.**

---

# Execution Rules (Mandatory)

1. **Never skip stages** — Each stage builds on verified outputs of previous stages
2. **Never skip verification** — Local verification must pass before proceeding
3. **Never continue after failed verification** — Diagnose, produce corrective plan, repeat stage
4. **Never modify uninspected files** — Read before write, always
5. **Prefer incremental implementation** — Small commits, isolated changes
6. **Minimize edits** — Touch only what the stage requires
7. **Preserve backwards compatibility** — API changes only in Stage 19 with versioning
8. **Do not duplicate functionality** — Reuse existing packages, check before creating
9. **Keep commits small and isolated** — One logical change per commit
10. **Treat every stage as a complete iteration** — Understand → Inspect → Plan → Execute → Verify

---

# Failure Procedure Template (Per Stage)

When any local verification fails:

```markdown
## Failure: [Stage N] - [Check Name]
**Command**: `pnpm test --filter=...`
**Exit Code**: N
**Output**: (last 50 lines)

### Root Cause Analysis
- [ ] Incorrect assumption about [spec/interface/dependency]
- [ ] Missing dependency: [package/service]
- [ ] Incorrect implementation: [file:function]
- [ ] Environment problem: [Node version, missing service, etc.]
- [ ] Test failure: [flaky, incorrect assertion, spec mismatch]
- [ ] Unexpected architecture: [discovered during inspection]

### Corrective Plan
1. [Specific fix action]
2. [Verification step]
3. [Re-run failed check]

### Repeat Stage
Re-execute failed stage tasks after fix. Do not proceed to next stage.
```

---

# Notes for Execution Agents

- **Read the specs first** — VAP (`docs/specs/0001-verified-attention-protocol.md`), Charter (`docs/specs/0000-project-charter.md`), VAE (`docs/specs/0010-verified-attention-engine.md`) are normative
- **SPRINTS.md is the sprint plan** — This COMMAND_RUNWAY maps sprints to executable stages
- **AGENTS.md conventions apply** — TypeScript, Zod, Vitest, pnpm, Turborepo, modern typing
- **Backend before UI** — Stages 0–15 are backend/infrastructure; UI (extension, dashboards) starts Stage 16
- **Conformance is the quality gate** — Every protocol object must pass conformance tests
- **Determinism is mandatory** — Verification, confidence, fraud scores must be reproducible
- **Privacy by architecture** — Not policy; enforce at code level (minimisation, pseudonymisation, retention)
- **Observability built-in** — Not bolted on; every stage emits metrics, traces, logs
- **Security at every layer** — Auth, encryption, secrets, TLS, headers — not a single stage
- **Ask before committing** — Git operations require explicit user approval

---

# Quick Reference: Package Map

| Package | Purpose | Key Stages |
|---------|---------|------------|
| `@verified-attention/core` | VAP data models (Evidence, Observation, Session, Claim, Proof) | 1, 4, 5, 6 |
| `@verified-attention/common` | Shared types, schemas, enums, utilities | 1 |
| `@verified-attention/pipeline` | Evidence processing pipeline stages | 2, 7 |
| `@verified-attention/store` | Evidence store (in-memory + persistent) | 2, 7 |
| `@verified-attention/store-proof` | Proof store | 6, 11 |
| `@verified-attention/verification` | Confidence model, verification engine, policy engine | 5, 10 |
| `@verified-attention/crypto` | Ed25519 keys, signing, HSM interface | 6, 11 |
| `@verified-attention/ml-attention` | Attention behaviour models, features, drift, retrain | 8 |
| `@verified-attention/ml-fraud` | Fraud models: biometrics, fingerprint, automation, sybil, reputation | 9 |
| `@verified-attention/ml-serving-attention` | Attention model serving (gRPC/REST) | 8 |
| `@verified-attention/ml-serving-fraud` | Fraud model serving | 9 |
| `@verified-attention/api` | Public REST API (sessions, evidence, proofs, policies, rewards, privacy) | 3, 6, 11, 12, 14, 15, 19 |
| `@verified-attention/verifier` | Proof generation, signing, webhooks, review queue, replay | 6, 10, 11 |
| `@verified-attention/reward` | Eligibility, campaigns, pricing, budget, settlement | 12 |
| `@verified-attention/analytics` | Warehouse, attention/fraud/business metrics | 13 |
|| `@verified-attention/observability` | Metrics, tracing, alerting, tracing UI | 7, 13 |
|| `@verified-attention/auth` | OAuth2/OIDC, API keys, mTLS, RBAC | 14 |
|| `@verified-attention/security` | Secrets, encryption-at-rest, TLS, headers, WAF | 14 |
|| `@verified-attention/privacy` | Consent, minimisation, pseudonymisation, retention, DSR | 15 |
|| `@verified-attention/sdk-browser` | Browser SDK (core + advanced) | 16, 17 |
|| `@verified-attention/extension` | Browser extension (MV3) | 17 |
|| `@verified-attention/sdk-android` | Android SDK (Kotlin) | 18 |
|| `@verified-attention/sdk-ios` | iOS SDK (Swift) | 18 |
|| `@verified-attention/sdk-desktop` | Desktop SDK (Electron/Tauri) | 18 |
|| `@verified-attention/cli` | CLI tool (`vap` command) | 20 |
|| `@verified-attention/developer-portal` | Developer docs, API explorer | 19 |
|| `@verified-attention/api-gateway` | Kong/Envoy config | 19 |
|| `@verified-attention/conformance` | Conformance test runner, fixtures, assertions | 4, all |
|| `@verified-attention/pipeline-dlq` | Dead letter queue for failed evidence | 7 |
|| `@verified-attention/observability-tracing` | OpenTelemetry instrumentation | 7, 13 |
|| `@verified-attention/privacy-consent` | Consent management UI + API | 15 |
|| `@verified-attention/privacy-minimisation` | Data minimisation enforcement | 15 |
|| `@verified-attention/privacy-pseudonymisation` | Pseudonymisation implementation | 15 |
|| `@verified-attention/privacy-retention` | Retention policies + deletion jobs | 15 |
|| `@verified-attention/privacy-dsr` | Data subject rights API | 15 |
|| `@verified-attention/privacy-disclosure` | Selective disclosure for proofs | 15 |
|| `@verified-attention/sdk-browser-advanced` | Reading detection, engagement scoring, heatmap | 17 |
|| `@verified-attention/sdk-browser-publisher` | Publisher integration API | 17 |
|| `@verified-attention/extension-ui` | Extension React/Vanilla UI | 17 |
|| `@verified-attention/extension-content-script` | Publisher-less verification | 17 |
|| `@verified-attention/sdk-mobile-compliance` | App store compliance | 18 |
|| `@verified-attention/conformance-framework` | Test runner, fixtures, assertions | 4 |