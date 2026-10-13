# RUNBOOK.md — Sprint 3: Session CRUD API

**PLAN**: `docs/sprint-03/PLAN.md`
**Spec**: `docs/sprint-03/spec.yaml`
**Executor**: python (built-in)

Legend: ⏾ inspect · ✎ create/modify · ✓ verify

---

## Stage 1 — Inspect & Scaffold (L1, L2, L6)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | — | ⏾ inspect | `test -f packages/core/src/session.ts && test -f packages/core/src/session.test.ts` | exit 0 — core Session module exists | halt: out of scope, escalate |
| C2 | — | ⏾ inspect | `grep -nE '^export (function|const|type|enum) ' packages/core/src/session.ts` | list of public exports | halt |
| C3 | — | ⏾ inspect | `grep -q 'apps/\*' pnpm-workspace.yaml && echo present \|\| echo absent` | output indicates presence | if absent → patch pnpm-workspace.yaml |
| C4 | — | ✎ create | `write_file apps/api/package.json` | new package manifest with name `@verified-attention/api`, tsdown/vitest scripts, peer dep on `@verified-attention/core` workspace link | re-read spec L2, regenerate |
| C5 | — | ✎ create | `write_file apps/api/tsconfig.json` | new TS config extending repo conventions (module bundler resolution) | re-read packages/core/tsconfig.json for reference |
| C6 | — | ✎ create | `write_file apps/api/tsdown.config.ts` | new tsdown config emitting CJS + ESM + dts | re-read packages/core/tsdown.config.ts |
| C7 | — | ✎ create | `write_file apps/api/vitest.config.ts` | new vitest config (defaults) | re-read packages/core vitest setup |
| C8 | C1, C2 | ✓ verify | `test -f apps/api/package.json && grep -q '@verified-attention/api' apps/api/package.json` | exit 0 | scaffold missing — re-run C4 |
| C9 | — | ✓ verify | `pnpm install --offline 2>&1 \| tail -3` | workspace links new package | escalate if pnpm fails |

## Stage 2 — Session CRUD Module (L3)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C10 | C8 | ✎ create | `write_file apps/api/src/sessions/store.ts` | new in-memory store wrapper around core `createSession`/`transitionSessionState`/`sessionHeartbeat` | re-read `packages/core/src/session.ts` |
| C11 | C10 | ✎ create | `write_file apps/api/src/sessions/controller.ts` | new controller returning `{ status, body }` for each route | re-read core zod schemas, fix validator |
| C12 | C11 | ✎ create | `write_file apps/api/src/sessions/router.ts` | new URL matcher with 5 routes | read C10/C11 contracts |
| C13 | — | ✎ create | `write_file apps/api/src/app.ts` | new minimal http server wiring router to controller (exported for tests) | reuse controller instead |
| C14 | — | ✎ create | `write_file apps/api/src/index.ts` | new package entrypoint re-exporting app + router | look at packages/core/src/index.ts |

## Stage 3 — Tests (L4)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C15 | C12 | ✎ create | `write_file apps/api/src/sessions/sessions.test.ts` | new vitest suite covering create/get/update/close/expire/404/bad-transition/invalid-body | re-read core `session.test.ts` to mirror style |

## Stage 4 — OpenAPI Extension (L5)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C16 | — | ✎ modify | `patch apps/api/openapi.yaml` — insert `/sessions` paths + schemas after `/proofs/{proofId}/verify` block | augmented openapi with Sessions tag | re-read full yaml, re-author patch |

## Stage 5 — Wire-up & Verify (L7)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C17 | C9-C16 | ✓ verify | `pnpm --filter @verified-attention/api typecheck` | exit 0, no TS errors | inspect tsconfig, fix imports |
| C18 | C17 | ✓ verify | `pnpm --filter @verified-attention/api build` | new dist files generated | fix tsdown config |
| C19 | C18 | ✓ verify | `pnpm --filter @verified-attention/api test` | vitest run exits 0, all suite tests pass | re-read failing test, patch |
| C20 | C19 | ✓ verify | `cd /Users/nickrotich/Desktop/portfolio/projects/python/verified-attention && grep -q '/sessions' apps/api/openapi.yaml && pnpm --filter @verified-attention/api typecheck && pnpm --filter @verified-attention/api test` | exit 0 across all three | re-stage |

## Stage 6 — Self-Healing Loop (max 3 retries per command, max 2 stage replans)

If any ✓ command fails:
1. Read the failing test / typecheck / build output (tail 50 lines).
2. Diagnose root cause: import path / zod schema / API contract / openapi syntax / dlq.
3. Apply targeted patch (no full rewrites).
4. Re-run the failed command. If 3 consecutive attempts on the same command fail, escalate with the full failure log.

---

## Execution Log (filled during execution)

_(autonomous executor appends status lines here as C1…C20 execute)_
