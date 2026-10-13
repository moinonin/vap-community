# COMMAND_RUNWAY: Verifier Key Management

**Status:** Draft Plan
**Derived From Spec:** `docs/sprint-06/verifier-key-management/spec.yaml` (verifier-key-management)
**Generated With:** spec-forge-runway skill (unified)
**Agent/Responsible:** Hermes + Human Reviewer
**Created:** 2026-07-24
**Last Updated:** 2026-07-24

---

## 0. Taxonomy

Three layers of granularity:

| Layer | Unit | Purpose | Typical Size |
|-------|------|---------|---------------|
| Feature | The whole runbook | One deliverable from a spec | 1–5 stages |
| Stage | Verification gate | Independently verifiable increment | < 1 hour; 5–15 commands |
| Command | Atomic action | One tool invocation | One tool call |

**No stage proceeds until its local checks pass. Global checks run only at stage completion.**

---

## 1. Intent & Goals

### Global Project Goals (must not break)
- G5: Session lifecycle state machine (CREATED→ACTIVE→EXPIRED/VERIFIED/CANCELLED) enforced
- G13: Public REST + Streaming APIs with OpenAPI 3.1 spec, generated SDKs

### Task-Local Goals
*Once this feature is done, I should be able to…*
- L1: Generate an Ed25519 key pair and persist it to the key store
- L2: Export the public key in base64url format for proof verification
- L3: Rotate keys — create a new active key and mark the previous as superseded
- L4: Call the HSM interface stub and receive NOT_IMPLEMENTED
- L5: See audit log entries for every key operation (generate, rotate, supersede)
- L6: Typecheck the verification package with all new key management types

---

## 2. Preconditions

*Must be true before command C1 runs. If any is false, resolve the dependency first and log it in Section 6.*

| # | Precondition | Verified How |
|---|--------------|--------------|
| P1 | Node.js ≥ 20, pnpm ≥ 9 installed | `node --version && pnpm --version` |
| P2 | `@verified-attention/verification` package exists | `test -d packages/verification` |
| P3 | `implement-proof-of-attention` feature complete | `docs/sprint-06/RUNBOOK.md` shows verified |
| P4 | Node.js crypto module available (built-in) | `node -e "require('crypto')"` |

### Python Virtual Environment (CRITICAL — when Python is used)

**All Python backend commands MUST use `.venv` — NEVER bare `python`, `python3`, or `pip`.**

| # | Precondition | Verified How |
|---|--------------|--------------|
| P5 | `.venv` exists and is functional | `test -d .venv && .venv/bin/python --version` |

---

## 3. Command Runway

*Each command is a discrete, auditable action. ⏾ commands (inspect) must complete before ✎ commands (mutate) in the same stage. ✓ commands (verify) run after ✎.*

### Stage A: Key Generation and Export

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | — | ⏾ | `read_file packages/verification/src/index.ts` | Current exports understood | Search for file |
| C2 | — | ⏾ | `read_file packages/verification/package.json` | Dependencies known | Search for file |
| C3 | C1,C2 | ⏾ | `search_files pattern="ed25519\|keypair" path=packages/verification` | Existing key code found | Note if none |
| C4 | C3 | ✎ | `write_file packages/verification/src/keys.ts` with Ed25519 key generation + export | Key module created | Re-read, fix syntax |
| C5 | C4 | ✎ | `patch packages/verification/src/index.ts` to export key functions | Exports updated | Re-read, retry |
| C6 | C5 | ✓ | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 | Fix type errors |
| C7 | C5 | ✎ | `write_file packages/verification/tests/key-generation.test.ts` | Key generation tests | Re-read keys.ts |
| C8 | C4 | ✎ | `write_file packages/verification/tests/key-export.test.ts` | Key export tests | Re-read keys.ts |
| C9 | C7,C8 | ✓ | `pnpm test --filter=@verified-attention/verification` | All pass, Exit 0 | See Failure Procedure |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L1 | `pnpm test --filter=@verified-attention/verification --testPathPattern=key-generation` | Exit 0, stdout contains "passing" |
| L2 | `pnpm test --filter=@verified-attention/verification --testPathPattern=key-export` | Exit 0, stdout contains "passing" |

**Completion Condition:** C9 exits 0 AND L1 + L2 pass.

---

### Stage B: Key Rotation

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | StageA.C9 | ⏾ | `read_file packages/verification/src/keys.ts` | Key module understood | Retry Stage A |
| C2 | C1 | ✎ | `patch packages/verification/src/keys.ts` add rotateKey() | Rotation logic added | Re-read, retry |
| C3 | C2 | ✎ | `write_file packages/verification/tests/key-rotation.test.ts` | Rotation tests | Re-read keys.ts |
| C4 | C3 | ✓ | `pnpm test --filter=@verified-attention/verification --testPathPattern=key-rotation` | Exit 0 | See Failure Procedure |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L3 | `pnpm test --filter=@verified-attention/verification --testPathPattern=key-rotation` | Exit 0, stdout contains "passing" |

**Completion Condition:** C4 exits 0 AND L3 passes.

---

### Stage C: HSM Interface Stub and Audit Logging

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | StageA.C6 | ⏾ | `read_file packages/verification/src/keys.ts` | Key types understood | Retry Stage A |
| C2 | C1 | ✎ | `write_file packages/verification/src/hsm.ts` with HSM stub | HSM stub created | Re-read, fix syntax |
| C3 | C1 | ✎ | `write_file packages/verification/src/audit.ts` with logKeyOperation() | Audit logging created | Re-read, fix syntax |
| C4 | C2,C3 | ✎ | `patch packages/verification/src/index.ts` export HSM + audit | Exports updated | Re-read, retry |
| C5 | C2 | ✎ | `write_file packages/verification/tests/hsm-stub.test.ts` | HSM stub tests | Re-read hsm.ts |
| C6 | C3 | ✎ | `write_file packages/verification/tests/audit.test.ts` | Audit tests | Re-read audit.ts |
| C7 | C4,C5,C6 | ✓ | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 | Fix type errors |
| C8 | C5,C6 | ✓ | `pnpm test --filter=@verified-attention/verification` | All pass, Exit 0 | See Failure Procedure |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L4 | `pnpm test --filter=@verified-attention/verification --testPathPattern=hsm-stub` | Exit 0, stdout contains "passing" |
| L5 | `grep 'logKeyOperation' packages/verification/src/audit.ts` | At least one match |
| L6 | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 |

**Completion Condition:** C8 exits 0 AND L4 + L5 + L6 pass.

---

### Stage D: Global Verification Gate

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | StageA.C9, StageB.C4, StageC.C8 | ✓ | `pnpm build` | All packages build, Exit 0 | Fix build errors |
| C2 | C1 | ✓ | `pnpm typecheck` | No TypeScript errors, Exit 0 | Fix type errors |
| C3 | C2 | ✓ | `pnpm lint` | No lint errors, Exit 0 | Fix lint errors |
| C4 | C3 | ✓ | `pnpm test` | All tests pass, Exit 0 | Fix failing tests |
| C5 | C4 | ✓ | `pnpm test:conformance` | All conformance pass, Exit 0 | Fix conformance failures |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| Build | `pnpm build` | Exit 0 |
| Typecheck | `pnpm typecheck` | Exit 0 |
| Lint | `pnpm lint` | Exit 0 |
| Test | `pnpm test` | Exit 0 |
| Conformance | `pnpm test:conformance` | Exit 0 |

**Completion Condition:** All C1-C5 exit 0. Feature complete.

---

## 4. Execution Log

*Filled in during execution. Capture reality — failures and retries are logged, not hidden.*

| Cmd# | Deps | Start | End | Exit | Retry# | Output Summary / Artifact Hash |
|------|------|-------|-----|------|--------|-------------------------------|
|  |  |  |  |  |  |  |

---

## 5. Goal Verification

*Local checks run after stage commands complete. Global checks run at stage completion only.*

### Local Goal Checks
- **L1:** `pnpm test --filter=@verified-attention/verification --testPathPattern=key-generation` → exit 0, "passing" → ✅
- **L2:** `pnpm test --filter=@verified-attention/verification --testPathPattern=key-export` → exit 0, "passing" → ✅
- **L3:** `pnpm test --filter=@verified-attention/verification --testPathPattern=key-rotation` → exit 0, "passing" → ✅
- **L4:** `pnpm test --filter=@verified-attention/verification --testPathPattern=hsm-stub` → exit 0, "passing" → ✅
- **L5:** `grep 'logKeyOperation' packages/verification/src/audit.ts` → at least one match → ✅
- **L6:** `pnpm typecheck --filter=@verified-attention/verification` → exit 0 → ✅

### Global Regression Quick-Checks (at stage completion)
- **G5:** `pnpm test:conformance` → all pass → ✅
- **G13:** `pnpm build` → all packages build → ✅

---

## 6. Iteration & Notes

- **Deviations from runway:** <none / description>
- **Blockers:** <none / description>
- **Commands that needed rework:** <e.g., C4 — keys.ts Ed25519 library choice; re-read before retry>
- **Lessons learned:** <method-level insight for the next runbook>
- **Next runways:** COMMAND_RUNWAY: proof-signing-service, COMMAND_RUNWAY: proof-verification

---

## 7. Machine-Readable Extension (JSON)

```json
{
  "task_id": "verifier-key-management",
  "status": "Draft",
  "generated_with": "spec-forge-runway",
  "goals": {
    "local": [
      {"id": "L1", "description": "Ed25519 key pair generated and persisted", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification --testPathPattern=key-generation", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L2", "description": "Public key exported in base64url", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification --testPathPattern=key-export", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L3", "description": "Key rotation creates new active key, marks old as superseded", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification --testPathPattern=key-rotation", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L4", "description": "HSM stub throws NOT_IMPLEMENTED", "assert": {"cmd": "pnpm test --filter=@verified-attention/verification --testPathPattern=hsm-stub", "exit_code": 0, "stdout_contains": "passing"}},
      {"id": "L5", "description": "Audit log function exists", "assert": {"cmd": "grep 'logKeyOperation' packages/verification/src/audit.ts", "exit_code": 0}},
      {"id": "L6", "description": "Verification package typecheck passes", "assert": {"cmd": "pnpm typecheck --filter=@verified-attention/verification", "exit_code": 0}}
    ],
    "global": ["G5", "G13"]
  },
  "preconditions": [
    {"id": "P1", "check": "node --version && pnpm --version", "expect_regex": "v2\\d+.\\d+"},
    {"id": "P2", "check": "test -d packages/verification", "expect_exit": 0},
    {"id": "P3", "check": "test -f docs/sprint-06/RUNBOOK.md", "expect_exit": 0},
    {"id": "P4", "check": "node -e \"require('crypto')\"", "expect_exit": 0}
  ],
  "stages": [
    {
      "id": "StageA",
      "name": "Key Generation and Export",
      "commands": [
        {"id": "C1", "type": "inspect", "tool": "read_file", "args": {"path": "packages/verification/src/index.ts"}, "depends_on": []},
        {"id": "C2", "type": "inspect", "tool": "read_file", "args": {"path": "packages/verification/package.json"}, "depends_on": []},
        {"id": "C3", "type": "inspect", "tool": "search_files", "args": {"pattern": "ed25519|keypair", "path": "packages/verification"}, "depends_on": ["C1", "C2"]},
        {"id": "C4", "type": "create", "tool": "write_file", "args": {"path": "packages/verification/src/keys.ts"}, "depends_on": ["C3"]},
        {"id": "C5", "type": "modify", "tool": "patch", "args": {"path": "packages/verification/src/index.ts"}, "depends_on": ["C4"]},
        {"id": "C6", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm typecheck --filter=@verified-attention/verification"}, "expected": {"exit_code": 0}, "fallback": "Fix type errors", "depends_on": ["C5"]},
        {"id": "C7", "type": "create", "tool": "write_file", "args": {"path": "packages/verification/tests/key-generation.test.ts"}, "depends_on": ["C5"]},
        {"id": "C8", "type": "create", "tool": "write_file", "args": {"path": "packages/verification/tests/key-export.test.ts"}, "depends_on": ["C4"]},
        {"id": "C9", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm test --filter=@verified-attention/verification"}, "expected": {"exit_code": 0}, "fallback": "Fix failing tests", "depends_on": ["C7", "C8"]}
      ],
      "completion_condition": "C9 exits 0 AND L1 + L2 pass"
    },
    {
      "id": "StageB",
      "name": "Key Rotation",
      "completion_condition": "C4 exits 0 AND L3 passes"
    },
    {
      "id": "StageC",
      "name": "HSM Interface Stub and Audit Logging",
      "completion_condition": "C8 exits 0 AND L4 + L5 + L6 pass"
    },
    {
      "id": "StageD",
      "name": "Global Verification Gate",
      "completion_condition": "All C1-C5 exit 0. Feature complete."
    }
  ]
}
```
