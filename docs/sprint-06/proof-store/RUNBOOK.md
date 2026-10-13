# COMMAND_RUNWAY: Proof Store

**Status:** Draft Plan
**Derived From Spec:** `docs/sprint-06/proof-store/spec.yaml`
**Generated With:** spec-forge-runway
**Created:** 2026-07-24
**Last Updated:** 2026-07-24

---

## 0. Taxonomy

| Layer | Unit | Purpose | Typical Size |
|-------|------|---------|---------------|
| Feature | The whole runbook | One deliverable | 1–5 stages |
| Stage | Verification gate | Independently verifiable increment | < 1 hour; 5–15 commands |
| Command | Atomic action | One tool invocation | One tool call |

---

## 1. Intent & Goals

### Global Project Goals (must not break)
- G5: Session lifecycle state machine enforced
- G13: Public REST + Streaming APIs with OpenAPI 3.1

### Task-Local Goals
- L1: storeProof() writes a signed proof to the append-only store and returns the stored proof
- L2: storeProof() rejects the same proofId twice (append-only, no overwrite)
- L3: getProofById() retrieves a proof by proofId
- L4: listProofsBySession() returns all proofs for a given sessionId, ordered by issuedAt descending
- L5: listProofsByContent() returns all proofs for a given contentId
- L6: Stored proofs are immutable — updating or deleting a proof throws
- L7: Proof store module exists with storeProof exported
- L8: Store package typecheck passes with proof store module

---

## 2. Preconditions

| # | Precondition | Verified How |
|---|--------------|--------------|
| P1 | Node.js ≥ 20, pnpm ≥ 9 | `node --version && pnpm --version` |
| P2 | store package exists | `test -d packages/store` |
| P3 | evidence-store.ts exists (store pattern established) | `test -f packages/store/src/evidence-store.ts` |
| P4 | Core proof.ts has Proof type | `grep 'Proof' packages/core/src/proof.ts` |

---

## 3. Command Runway

### Stage A: Proof Store Module

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | — | ⏾ | `read_file packages/store/src/evidence-store.ts` | Existing store pattern understood | Search |
| C2 | — | ⏾ | `read_file packages/store/src/index.ts` | Current exports known | Search |
| C3 | — | ⏾ | `read_file packages/core/src/proof.ts` | Proof type understood | Search |
| C4 | C1-C3 | ✎ | `write_file packages/store/src/proof-store.ts` — storeProof, getProofById, listProofsBySession, listProofsByContent, immutability, in-memory Map | proof-store.ts created | Re-read, fix |
| C5 | C4 | ✎ | `patch packages/store/src/index.ts` export proof store functions | Exports updated | Re-read, retry |
| C6 | C5 | ✓ | `pnpm typecheck --filter=@verified-attention/store` | Exit 0 | Fix types |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L7 | `grep 'export function storeProof' packages/store/src/proof-store.ts` | Match |
| L8 | `pnpm typecheck --filter=@verified-attention/store` | Exit 0 |

**Completion:** C6 exits 0 AND L7 + L8 pass.

---

### Stage B: Store Tests

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | StageA.C6 | ⏾ | `read_file packages/store/src/proof-store.ts` | Store logic understood | Retry Stage A |
| C2 | C1 | ✎ | `write_file packages/store/tests/store-proof.test.ts` | store + retrieve test | Re-read |
| C3 | C1 | ✎ | `write_file packages/store/tests/store-duplicate.test.ts` | duplicate rejection test | Re-read |
| C4 | C1 | ✎ | `write_file packages/store/tests/get-proof.test.ts` | getProofById test | Re-read |
| C5 | C1 | ✎ | `write_file packages/store/tests/list-by-session.test.ts` | listBySession test | Re-read |
| C6 | C1 | ✎ | `write_file packages/store/tests/list-by-content.test.ts` | listByContent test | Re-read |
| C7 | C1 | ✎ | `write_file packages/store/tests/immutable.test.ts` | immutability test | Re-read |
| C8 | C2-C7 | ✓ | `pnpm test --filter=@verified-attention/store` | All pass, Exit 0 | See Failure Procedure |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L1-L6 | `pnpm test --filter=@verified-attention/store` | Exit 0, "passing" |

**Completion:** C8 exits 0 AND L1-L6 pass.

---

### Stage C: Global Verification Gate

| Cmd# | Deps | Type | Command | Expected | Fallback |
|------|------|------|---------|----------|----------|
| C1 | StageB.C8 | ✓ | `pnpm build` | Exit 0 | Fix build |
| C2 | C1 | ✓ | `pnpm typecheck` | Exit 0 | Fix types |
| C3 | C2 | ✓ | `pnpm test` | Exit 0 | Fix tests |

**Completion:** All exit 0. Feature complete.

---

## 4. Execution Log

| Cmd# | Deps | Start | End | Exit | Retry# | Output Summary |
|------|------|-------|-----|------|--------|----------------|
| | | | | | | |

---

## 5. Goal Verification

### Local Goal Checks
- **L1:** `pnpm test --filter=@verified-attention/store -- test/store-proof` → ✅
- **L2:** `pnpm test --filter=@verified-attention/store -- test/store-duplicate` → ✅
- **L3:** `pnpm test --filter=@verified-attention/store -- test/get-proof` → ✅
- **L4:** `pnpm test --filter=@verified-attention/store -- test/list-by-session` → ✅
- **L5:** `pnpm test --filter=@verified-attention/store -- test/list-by-content` → ✅
- **L6:** `pnpm test --filter=@verified-attention/store -- test/immutable` → ✅
- **L7:** `grep 'export function storeProof' packages/store/src/proof-store.ts` → ✅
- **L8:** `pnpm typecheck --filter=@verified-attention/store` → ✅

### Global Regression Quick-Checks
- **G5:** `pnpm test:conformance` → ✅
- **G13:** `pnpm build` → ✅

---

## 6. Iteration & Notes
- **Deviations:** <none>
- **Blockers:** <none>
- **Next runbooks:** conformance tests for proof structure, signature, immutability

---

## 7. Machine-Readable Extension (JSON)

```json
{
  "task_id": "proof-store",
  "status": "Draft",
  "generated_with": "spec-forge-runway",
  "goals": {
    "local": [
      {"id": "L1", "assert": {"cmd": "pnpm test --filter=@verified-attention/store -- test/store-proof", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L2", "assert": {"cmd": "pnpm test --filter=@verified-attention/store -- test/store-duplicate", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L3", "assert": {"cmd": "pnpm test --filter=@verified-attention/store -- test/get-proof", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L4", "assert": {"cmd": "pnpm test --filter=@verified-attention/store -- test/list-by-session", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L5", "assert": {"cmd": "pnpm test --filter=@verified-attention/store -- test/list-by-content", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L6", "assert": {"cmd": "pnpm test --filter=@verified-attention/store -- test/immutable", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L7", "assert": {"cmd": "grep 'export function storeProof' packages/store/src/proof-store.ts", "exit_code": 0}},
      {"id": "L8", "assert": {"cmd": "pnpm typecheck --filter=@verified-attention/store", "exit_code": 0}}
    ],
    "global": ["G5", "G13"]
  },
  "stages": [
    {"id": "StageA", "name": "Proof Store Module", "completion_condition": "C6 exits 0 AND L7 + L8 pass"},
    {"id": "StageB", "name": "Store Tests", "completion_condition": "C8 exits 0 AND L1-L6 pass"},
    {"id": "StageC", "name": "Global Verification Gate", "completion_condition": "All exit 0"}
  ]
}
```
