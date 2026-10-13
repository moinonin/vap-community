# PLAN.md — Sprint 3: Session Model & Research Prototypes

**Task ID**: sprint-3-session-crud-api
**Spec**: `docs/sprint-03/spec.yaml`
**Status**: IN PROGRESS (autonomous execution via command-runway-autonomous)

---

## 1. Sprint 3 Deliverable Audit (Pre-Execution)

| Task | Deliverable | Disk State | Status |
|------|-------------|------------|--------|
| Session model (VAP §6) state machine | `packages/core/src/session.ts` + `session.test.ts` (47 tests) | Committed in `a1d6564` | ✅ Already done |
| Attention prototype | `research/models/attention-prototype/` (auc 0.9999) | On disk, untracked | ✅ Already done |
| Fraud prototype | `research/models/fraud-prototype/` (auc 1.0) | On disk, untracked | ✅ Already done |
| Confidence calibration prototype | `research/models/confidence-prototype/` (platt/isotonic/conformal results) | On disk, untracked | ✅ Already done |
| Feature extraction schema | `packages/pipeline/features/schema.json` (164 lines) | On disk, untracked | ✅ Already done |
| ADR-002 model serving | `docs/adr/0002-model-serving.md` | Committed in `5134bfa` | ✅ Already done |
| **Session CRUD API** (sessions create/get/update/close/expire) | `apps/api/src/sessions/` | **MISSING** | ❌ Pending |

**Scope of this PLAN**: Deliver the one missing piece — Session CRUD API under `apps/api/`.

---

## 2. Implementation Stages

### Stage 1: Inspect & Scaffold (L1, L2, L6)
- L1: Read `packages/core/src/session.ts` to learn the public API of the Session model (exported functions: `createSession`, `addEvidenceToSession`, `transitionSessionState`, `isSessionExpired`, `sessionHeartbeat`; Session schema).
- L6: Confirm `apps/*` is in `pnpm-workspace.yaml` (already is — see "## 1" above). If not present, add it.
- L2: Create `apps/api/` package: `package.json`, `tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts`, `src/index.ts`, `src/app.ts`. Mirror conventions from existing packages (zod + tsdown + vitest; node ≥ 20). Add a fast in-memory HTTP layer (Node `http`/`node:test` avoid heavy deps; we will use a minimal hand-rolled router to keep `pnpm` install surface tiny and avoid Express version churn).

### Stage 2: Session CRUD Module (L3)
- L3: `apps/api/src/sessions/store.ts` — in-memory session store keyed by `sessionId` (Map). Backed by core `createSession` / `transitionSessionState` / `sessionHeartbeat`. Returns shallow copies to prevent external mutation.
- L3: `apps/api/src/sessions/controller.ts` — pure decode/route handlers that turn HTTP request JSON into store operations. Returns `{ status, body }` rather than touching sockets — testable without binding.
- L3: `apps/api/src/sessions/router.ts` — URL matcher: `POST /v1/sessions`, `GET /v1/sessions/:id`, `PATCH /v1/sessions/:id`, `POST /v1/sessions/:id/close`, `POST /v1/sessions/:id/expire`. 404 otherwise.

### Stage 3: Tests (L4)
- L4: `apps/api/src/sessions/sessions.test.ts` — vitest suite, exercising the controller against an empty store: happy-path create → get → update → close/expire; 404 for unknown id; 409 / 400 for invalid state transitions; input validation rejects bad body, returns 400 with `{ error: { code, message } }`.

### Stage 4: OpenAPI Extension (L5)
- L5: Add `components.schemas.Session`, `SessionParticipant`, `SessionConfig`, `SessionState`, `CreateSessionRequest`, `UpdateSessionRequest`, `SessionListResponse`, `SessionStateTransitionRequest`. Add paths `POST /sessions`, `GET /sessions/{sessionId}`, `PATCH /sessions/{sessionId}`, `POST /sessions/{sessionId}/close`, `POST /sessions/{sessionId}/expire`. Tag `Sessions`. Reuse existing `SessionId`, `ContentId`, `Timestamp` schemas.

### Stage 5: Wire-up & Build (L7)
- L5/L6: Wire `apps/api` into the workspace / turbo build / test graph. Run `pnpm install` (no new external deps). Then:
  - `pnpm --filter @verified-attention/api typecheck`
  - `pnpm --filter @verified-attention/api build`
  - `pnpm --filter @verified-attention/api test`

### Stage 6: Self-Healing Loop (on L7 failure)
- On any Stage 5 verification failing: read the test output, patch the offending file (controller/store/router/test/scaffolding), re-run. Max 3 attempts per command, max 2 stage re-plans. Escalate to user if still failing.

---

## 3. Constraints

- **No new runtime deps**: use only Node 20 stdlib + the existing `zod` + `@verified-attention/core` import. Keep bundle footprint tiny.
- **No HTTP server binding in tests**: keep the controller return-object pattern so tests are socket-free and synchronous.
- **No secrets / no env writes**: this is a pure code slice.
- **No destructive git ops**: commit/push allowed only when user requests (per AGENTS.md).
- **Touch only**: `apps/api/**` (new), `apps/api/openapi.yaml` (extend), `pnpm-workspace.yaml` if needed, `docs/sprint-03/**` (this plan/runbook). No edits to `packages/core`, `research/models/`, or any committed Sprint 1-6 code.
