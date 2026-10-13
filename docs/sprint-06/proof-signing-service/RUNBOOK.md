# COMMAND_RUNWAY: Proof Signing Service

**Status:** Draft Plan
**Derived From Spec:** `docs/sprint-06/proof-signing-service/spec.yaml`
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

**No stage proceeds until its local checks pass. Global checks run only at stage completion.**

---

## 1. Intent & Goals

### Global Project Goals (must not break)
- G5: Session lifecycle state machine enforced
- G13: Public REST + Streaming APIs with OpenAPI 3.1

### Task-Local Goals
- L1: signProof() takes an UnsignedProof and verifier key, returns a SIGNED Proof with valid Ed25519 signature
- L2: Signed proof's signature field is non-empty base64url
- L3: Proof signing event is emitted with proofId, verifierId, and timestamp
- L4: Signing with a superseded key throws KEY_SUPERSEDED error
- L5: The signProof function exists and is exported from the verification package
- L6: Verification package typecheck passes with signing module

---

## 2. Preconditions

| # | Precondition | Verified How |
|---|--------------|--------------|
| P1 | Node.js ≥ 20, pnpm ≥ 9 | `node --version && pnpm --version` |
| P2 | verification package exists | `test -d packages/verification` |
| P3 | keys.ts exists (key management done) | `test -f packages/verification/src/keys.ts` |
| P4 | Core proof.ts has signProof | `grep 'signProof' packages/core/src/proof.ts` |

---

## 3. Command Runway

### Stage A: Signing Module

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | — | ⏾ | `read_file packages/verification/src/index.ts` | Current exports known | Search |
| C2 | — | ⏾ | `read_file packages/core/src/proof.ts` | Core signProof + UnsignedProof understood | Search |
| C3 | C1,C2 | ✎ | `write_file packages/verification/src/signing.ts` — signProof(unsigned, privateKey): Proof, Ed25519 sign, state UNSIGNED→SIGNED, issuedAt, emit event | signing.ts created | Re-read, fix |
| C4 | C3 | ✎ | `patch packages/verification/src/index.ts` export signProof + types | Exports updated | Re-read, retry |
| C5 | C4 | ✓ | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 | Fix types |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L5 | `grep 'export function signProof' packages/verification/src/signing.ts` | Match |
| L6 | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 |

**Completion:** C5 exits 0 AND L5 + L6 pass.

---

### Stage B: Signing Tests

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | StageA.C5 | ⏾ | `read_file packages/verification/src/signing.ts` | Signing logic understood | Retry Stage A |
| C2 | C1 | ✎ | `write_file packages/verification/tests/sign-proof.test.ts` | signProof test | Re-read |
| C3 | C1 | ✎ | `write_file packages/verification/tests/signature-format.test.ts` | format test | Re-read |
| C4 | C1 | ✎ | `write_file packages/verification/tests/sign-event.test.ts` | event test | Re-read |
| C5 | C1 | ✎ | `write_file packages/verification/tests/sign-superseded.test.ts` | superseded key test | Re-read |
| C6 | C2-C5 | ✓ | `pnpm test --filter=@verified-attention/verification` | All pass, Exit 0 | See Failure Procedure |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L1 | `pnpm test --filter=@verified-attention/verification` | Exit 0, "passing" |
| L2 | (covered by L1) | Exit 0, "passing" |
| L3 | (covered by L1) | Exit 0, "passing" |
| L4 | (covered by L1) | Exit 0, "passing" |

**Completion:** C6 exits 0 AND L1-L4 pass.

---

### Stage C: Global Verification Gate

| Cmd# | Deps | Type | Command | Expected | Fallback |
|------|------|------|---------|----------|----------|
| C1 | StageB.C6 | ✓ | `pnpm build` | Exit 0 | Fix build |
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
- **L1:** `pnpm test --filter=@verified-attention/verification -- test/sign-proof` → ✅
- **L2:** `pnpm test --filter=@verified-attention/verification -- test/signature-format` → ✅
- **L3:** `pnpm test --filter=@verified-attention/verification -- test/sign-event` → ✅
- **L4:** `pnpm test --filter=@verified-attention/verification -- test/sign-superseded` → ✅
- **L5:** `grep 'export function signProof' packages/verification/src/signing.ts` → ✅
- **L6:** `pnpm typecheck --filter=@verified-attention/verification` → ✅

### Global Regression Quick-Checks
- **G5:** `pnpm test:conformance` → ✅
- **G13:** `pnpm build` → ✅

---

## 6. Iteration & Notes
- **Deviations:** <none>
- **Blockers:** <none>
- **Next runways:** proof-verification, proof-store

---

## 7. Machine-Readable Extension (JSON)

```json
{
  "task_id": "proof-signing-service",
  "status": "Draft",
  "generated_with": "spec-forge-runway",
  "goals": {
    "local": [
      {"id": "L1", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification -- test/sign-proof", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L2", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification -- test/signature-format", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L3", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification -- test/sign-event", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L4", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification -- test/sign-superseded", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L5", "assert": {"cmd": "grep 'export function signProof' packages/verification/src/signing.ts", "exit_code": 0}},
      {"id": "L6", "assert": {"cmd": "pnpm typecheck --filter=@verified-attention/verification", "exit_code": 0}}
    ],
    "global": ["G5", "G13"]
  },
  "stages": [
    {"id": "StageA", "name": "Signing Module", "completion_condition": "C5 exits 0 AND L5 + L6 pass"},
    {"id": "StageB", "name": "Signing Tests", "completion_condition": "C6 exits 0 AND L1-L4 pass"},
    {"id": "StageC", "name": "Global Verification Gate", "completion_condition": "All exit 0"}
  ]
}
```
