# COMMAND_RUNWAY: Proof Store

**Feature:** proof-store
**Purpose:** Append-only proof store indexed by proofId, sessionId, and contentId with query API
**Dependencies:** proof-signing-service
**Global Goals:** G5, G13
**Target Environment:** TypeScript, Express, Prisma, Vitest

---

## Execution Stages

### Stage 1: Proof Store Module

**Objective:** Implement append-only proof store with storeProof, getProofById, listProofsBySession, listProofsByContent

**Preconditions:**
- [ ] `packages/store/src/evidence-store.ts` exists (store package configured)
- [ ] Core proof.ts has Proof type

**Commands:**

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | — | ⏾ | `read_file packages/store/src/evidence-store.ts` | Existing store pattern understood | Search |
| C2 | — | ⏾ | `read_file packages/store/src/index.ts` | Current exports known | Search |
| C3 | — | ⏾ | `read_file packages/core/src/proof.ts` | Proof type understood | Search |
| C4 | C1-C3 | ✎ | `write_file packages/store/src/proof-store.ts` — storeProof(proof), getProofById(id), listProofsBySession(sid), listProofsByContent(cid), immutability enforcement, in-memory Map store | proof-store.ts created | Re-read, fix |
| C5 | C4 | ✎ | `patch packages/store/src/index.ts` export storeProof, getProofById, listProofsBySession, listProofsByContent | Exports updated | Re-read, retry |
| C6 | C5 | ✓ | `pnpm typecheck --filter=@verified-attention/store` | Exit 0 | Fix types |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L7 | `grep 'export function storeProof' packages/store/src/proof-store.ts` | Match |
| L8 | `pnpm typecheck --filter=@verified-attention/store` | Exit 0 |

**Completion:** C6 exits 0 AND L7 + L8 pass.

---

### Stage 2: Store Tests

**Objective:** Tests for store, duplicate rejection, retrieval, immutability

**Preconditions:**
- [ ] Stage 1 complete

**Commands:**

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | Stage1.C6 | ⏾ | `read_file packages/store/src/proof-store.ts` | Store logic understood | Retry Stage 1 |
| C2 | C1 | ✎ | `write_file packages/store/tests/store-proof.test.ts` | store + retrieve test | Re-read |
| C3 | C1 | ✎ | `write_file packages/store/tests/store-duplicate.test.ts` | duplicate rejection test | Re-read |
| C4 | C1 | ✎ | `write_file packages/store/tests/get-proof.test.ts` | getProofById test | Re-read |
| C5 | C1 | ✎ | `write_file packages/store/tests/list-by-session.test.ts` | listProofsBySession test | Re-read |
| C6 | C1 | ✎ | `write_file packages/store/tests/list-by-content.test.ts` | listProofsByContent test | Re-read |
| C7 | C1 | ✎ | `write_file packages/store/tests/immutable.test.ts` | immutability test | Re-read |
| C8 | C2-C7 | ✓ | `pnpm test --filter=@verified-attention/store` | All pass, Exit 0 | See Failure Procedure |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L1-L6 | `pnpm test --filter=@verified-attention/store` | Exit 0, "passing" |

**Completion:** C8 exits 0 AND L1-L6 pass.

---

### Stage 3: Global Verification Gate

| Cmd# | Deps | Type | Command | Expected | Fallback |
|------|------|------|---------|----------|----------|
| C1 | Stage2.C8 | ✓ | `pnpm build` | Exit 0 | Fix build |
| C2 | C1 | ✓ | `pnpm typecheck` | Exit 0 | Fix types |
| C3 | C2 | ✓ | `pnpm test` | Exit 0 | Fix tests |

**Completion:** All exit 0. Feature complete.