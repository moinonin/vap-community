# COMMAND_RUNWAY: Proof Verification

**Status:** Draft Plan
**Derived From Spec:** `docs/sprint-06/proof-verification/spec.yaml`
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
- L1: verifyProofSignature() returns true for a proof signed by the matching public key
- L2: verifyProofSignature() returns false for a tampered proof or mismatched key
- L3: verifyProofHash() recomputes the SHA-256 over 7 mandatory fields and matches the stored evidenceHash
- L4: verifyProof() returns a ProofValidationResult with valid=true for a correctly signed + published proof
- L5: verifyProof() returns valid=false for a revoked or expired proof
- L6: Proof verification module exists with exported verifyProof function
- L7: Verification package typecheck passes with verify module

---

## 2. Preconditions

| # | Precondition | Verified How |
|---|--------------|--------------|
| P1 | Node.js ≥ 20, pnpm ≥ 9 | `node --version && pnpm --version` |
| P2 | verification package exists | `test -d packages/verification` |
| P3 | signing.ts exists | `test -f packages/verification/src/signing.ts` |
| P4 | Core proof.ts has computeProofHash | `grep 'computeProofHash' packages/core/src/proof.ts` |

---

## 3. Command Runway

### Stage A: Verification Module

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | — | ⏾ | `read_file packages/verification/src/signing.ts` | Signing logic understood | signing not done |
| C2 | — | ⏾ | `read_file packages/core/src/proof.ts` | computeProofHash, ProofState understood | Search |
| C3 | — | ⏾ | `read_file packages/verification/src/index.ts` | Current exports known | Search |
| C4 | C1-C3 | ✎ | `write_file packages/verification/src/verify.ts` — verifyProofSignature(proof, pubKey), verifyProofHash(proof), verifyProof(proof): ProofValidationResult | verify.ts created | Re-read, fix |
| C5 | C4 | ✎ | `patch packages/verification/src/index.ts` export verify functions | Exports updated | Re-read, retry |
| C6 | C5 | ✓ | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 | Fix types |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L6 | `grep 'export function verifyProof' packages/verification/src/verify.ts` | Match |
| L7 | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 |

**Completion:** C6 exits 0 AND L6 + L7 pass.

---

### Stage B: Verification Tests

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | StageA.C6 | ⏾ | `read_file packages/verification/src/verify.ts` | Verification logic understood | Retry Stage A |
| C2 | C1 | ✎ | `write_file packages/verification/tests/verify-signature-valid.test.ts` | Valid sig test | Re-read |
| C3 | C1 | ✎ | `write_file packages/verification/tests/verify-signature-invalid.test.ts` | Invalid sig test | Re-read |
| C4 | C1 | ✎ | `write_file packages/verification/tests/verify-hash.test.ts` | Hash recompute test | Re-read |
| C5 | C1 | ✎ | `write_file packages/verification/tests/verify-proof-full.test.ts` | Full verification test | Re-read |
| C6 | C1 | ✎ | `write_file packages/verification/tests/verify-proof-invalid-state.test.ts` | Invalid state test | Re-read |
| C7 | C2-C6 | ✓ | `pnpm test --filter=@verified-attention/verification` | All pass, Exit 0 | See Failure Procedure |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L1-L5 | `pnpm test --filter=@verified-attention/verification` | Exit 0, "passing" |

**Completion:** C7 exits 0 AND L1-L5 pass.

---

### Stage C: Global Verification Gate

| Cmd# | Deps | Type | Command | Expected | Fallback |
|------|------|------|---------|----------|----------|
| C1 | StageB.C7 | ✓ | `pnpm build` | Exit 0 | Fix build |
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
- **L1:** `pnpm test --filter=@verified-attention/verification -- test/verify-signature-valid` → ✅
- **L2:** `pnpm test --filter=@verified-attention/verification -- test/verify-signature-invalid` → ✅
- **L3:** `pnpm test --filter=@verified-attention/verification -- test/verify-hash` → ✅
- **L4:** `pnpm test --filter=@verified-attention/verification -- test/verify-proof-full` → ✅
- **L5:** `pnpm test --filter=@verified-attention/verification -- test/verify-proof-invalid-state` → ✅
- **L6:** `grep 'export function verifyProof' packages/verification/src/verify.ts` → ✅
- **L7:** `pnpm typecheck --filter=@verified-attention/verification` → ✅

### Global Regression Quick-Checks
- **G5:** `pnpm test:conformance` → ✅
- **G13:** `pnpm build` → ✅

---

## 6. Iteration & Notes
- **Deviations:** <none>
- **Blockers:** <none>
- **Next runbooks:** proof-store, conformance tests

---

## 7. Machine-Readable Extension (JSON)

```json
{
  "task_id": "proof-verification",
  "status": "Draft",
  "generated_with": "spec-forge-runway",
  "goals": {
    "local": [
      {"id": "L1", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification -- test/verify-signature-valid", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L2", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification -- test/verify-signature-invalid", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L3", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification -- test/verify-hash", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L4", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification -- test/verify-proof-full", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L5", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification -- test/verify-proof-invalid-state", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L6", "assert": {"cmd": "grep 'export function verifyProof' packages/verification/src/verify.ts", "exit_code": 0}},
      {"id": "L7", "assert": {"cmd": "pnpm typecheck --filter=@verified-attention/verification", "exit_code": 0}}
    ],
    "global": ["G5", "G13"]
  },
  "stages": [
    {"id": "StageA", "name": "Verification Module", "completion_condition": "C6 exits 0 AND L6 + L7 pass"},
    {"id": "StageB", "name": "Verification Tests", "completion_condition": "C7 exits 0 AND L1-L5 pass"},
    {"id": "StageC", "name": "Global Verification Gate", "completion_condition": "All exit 0"}
  ]
}
```
