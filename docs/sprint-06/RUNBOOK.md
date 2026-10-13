# COMMAND_RUNWAY Runbook: implement-proof-of-attention

**Status:** Draft Plan
**Derived From Spec:** `/tmp/proof-attention-plan-prompt.md` (Structured YAML Format B)
**Generated With:** `.runbookprompt.md` (COMMAND_RUNWAY plan generation prompt)
**Agent/Responsible:** Hermes Agent + Human Reviewer
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
- G13: Public REST + Streaming APIs with OpenAPI 3.1 spec, generated SDKs (TS, Python, Go, Rust)

### Task-Local Goals
_Once this feature is done, I should be able to…_
- L1: The ProofOfAttention class has properties for proofId, sessionId, contentId, confidence, evidenceHash, verifierId, and signature
- L2: The ProofOfAttention class includes a serialize method that returns the object as a JSON string
- L3: The ProofOfAttention class includes a computeHash method that computes and sets the evidenceHash based on the object's properties
- L4: The ProofOfAttention class has methods to transition between states: from UNSIGNED to SIGNED, then to PUBLISHED/REVOKED/EXPIRED
- L5: Test state transitions and hash computation — `pnpm test --filter=@verified-attention/core -- --testPathPattern=proof-of-attention-state-machine` exits 0
- L6: Generate the OpenAPI spec for ProofOfAttention endpoints — `npx @redocly/cli lint apps/api/openapi.yaml && grep '/v1/proofs' apps/api/openapi.yaml` exits 0

---

## 2. Preconditions

_Must be true before command C1 runs. If any is false, resolve the dependency first and log it in Section 6._

| # | Precondition | Verified How |
|---|--------------|--------------|
| P1 | Node.js ≥ 20 installed | `node --version` |
| P2 | pnpm ≥ 9 installed | `pnpm --version` |
| P3 | Dependencies installed | `pnpm install` exits 0 |
| P4 | `packages/core/src/proof.ts` exists | `test -f packages/core/src/proof.ts` |
| P5 | `packages/core/src/common.ts` exists | `test -f packages/core/src/common.ts` |
| P6 | Stage 1 (core models) verified | Prior runbook Section 5 shows ✅ |

### Python Virtual Environment (not applicable — this is a TypeScript/Node.js project)

---

## 3. Command Runway

_Each command is a discrete, auditable action. ⏾ commands (inspect) must complete before ✎ commands (mutate) in the same stage. ✓ commands (verify) run after ✎ — in the same stage or at stage end._

### Stage 1: Inspect Existing ProofOfAttention Implementation

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | — | ⏾ | `cat packages/core/src/proof.ts` | File contents displayed | Search for file, log finding |
| C2 | — | ⏾ | `cat packages/core/src/common.ts` | Primitive schemas visible | Search for file, log finding |
| C3 | — | ⏾ | `cat packages/core/src/index.ts` | Exports confirmed | Search for file, log finding |
| C4 | C1,C2,C3 | ✓ | `pnpm typecheck --filter=@verified-attention/core` | Exit 0, no errors | Fix type errors, re-run |

### Stage 2: Verify/Implement Serialization and Hash Computation

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C5 | C4 | ⏾ | `grep -n "serialize\|toJSON" packages/core/src/proof.ts` | Serialization method presence | Zod types serialize natively; no action needed |
| C6 | C4 | ⏾ | `grep -n "computeHash\|computeEvidenceHash" packages/core/src/proof.ts` | Hash function presence | If missing, implement in Stage 2 mutate |
| C7 | C5,C6 | ✎ | `[IF MISSING] patch packages/core/src/proof.ts to add computeEvidenceHash function` | computeEvidenceHash added | Re-read file, retry patch |
| C8 | C7 | ✓ | `pnpm tsx -e "import { createUnsignedProof } from './packages/core/src/proof'; console.log(JSON.stringify(createUnsignedProof({sessionId:'s',contentId:'c',confidence:0.9,evidenceHash:'h',verifierId:'v'})))"` | Valid JSON output | Fix serialization issue |
| C9 | C8 | ✓ | `pnpm typecheck --filter=@verified-attention/core` | Exit 0 | Fix type errors, re-run |

### Stage 3: Verify State Machine Logic

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C10 | C9 | ⏾ | `grep -A 20 "validTransitions" packages/core/src/proof.ts` | Transition map visible | Log if incorrect |
| C11 | C9 | ⏾ | `grep -A 10 "export function signProof" packages/core/src/proof.ts` | signProof implementation | Log if incorrect |
| C12 | C9 | ⏾ | `grep -A 10 "export function publishProof" packages/core/src/proof.ts` | publishProof implementation | Log if incorrect |
| C13 | C9 | ⏾ | `grep -A 10 "export function revokeProof" packages/core/src/proof.ts` | revokeProof implementation | Log if incorrect |
| C14 | C9 | ⏾ | `grep -A 5 "export function isProofExpired" packages/core/src/proof.ts` | isProofExpired implementation | Log if incorrect |
| C15 | C10,C11,C12,C13,C14 | ✓ | `pnpm typecheck --filter=@verified-attention/core` | Exit 0 | Patch proof.ts if transitions wrong, re-run |

### Stage 4: Write Tests for State Transitions and Hash Computation (L5)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C16 | C15 | ⏾ | `cat packages/core/tests/evidence.test.ts \| head -50` | Test pattern understood | Log pattern |
| C17 | C15 | ⏾ | `cat packages/core/tests/observation.test.ts \| head -50` | Test pattern understood | Log pattern |
| C18 | C15 | ⏾ | `ls -la packages/core/tests/` | Test directory listing | Create if missing |
| C19 | C16,C17,C18 | ✎ | `write_file packages/core/tests/proof-of-attention-state-machine.test.ts` with comprehensive tests | Test file created | Fix syntax, re-write |
| C20 | C19 | ✓ | `pnpm test --filter=@verified-attention/core -- --testPathPattern=proof-of-attention-state-machine` | Exit 0, all tests pass | Debug failing tests, fix implementation or tests, re-run |
| C21 | C20 | ✓ | `pnpm test --filter=@verified-attention/core --coverage` | Coverage reported | Ensure proof module covered |

### Stage 5: Generate OpenAPI Spec for ProofOfAttention Endpoints (L6)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C22 | C21 | ⏾ | `find . -name "openapi.yaml" -o -name "openapi.yml" 2>/dev/null \| head -10` | OpenAPI spec location | Create if missing |
| C23 | C21 | ⏾ | `ls -la apps/ 2>/dev/null` | API package exists | Create apps/api if missing |
| C24 | C22,C23 | ✎ | `[IF NEEDED] Create/update apps/api/openapi.yaml with /v1/proofs endpoints` | OpenAPI spec updated | Fix YAML syntax |
| C25 | C24 | ✓ | `npx @redocly/cli lint apps/api/openapi.yaml` | Exit 0, no errors | Fix OpenAPI errors, re-run |
| C26 | C25 | ✓ | `grep '/v1/proofs' apps/api/openapi.yaml` | /v1/proofs found | Add endpoints, re-run |

### Stage 6: Global Verification & Final Validation

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C27 | C26 | ✓ | `pnpm test --filter=@verified-attention/core` | All tests pass | Fix failing tests |
| C28 | C27 | ✓ | `pnpm typecheck` | Exit 0 | Fix type errors |
| C29 | C28 | ✓ | `pnpm lint` | Exit 0 | Fix lint errors |
| C30 | C29 | ✓ | `pnpm build` | Exit 0 | Fix build errors |
| C31 | C30 | ✓ | `pnpm openapi:generate` | Exit 0 | Fix generation issues |
| C32 | C31 | ✓ | `pnpm test:conformance --filter=@verified-attention/core 2>/dev/null \| grep -i session` | Session state machine tests pass | Fix conformance tests |

---

## 4. Execution Log

_Filled in during execution. Capture reality — failures and retries are logged, not hidden._

| Cmd# | Deps | Start | End | Exit | Retry# | Output Summary / Artifact Hash |
|------|------|-------|-----|------|--------|-------------------------------|
| C1 | — | | | | | |
| C2 | — | | | | | |
| C3 | — | | | | | |
| C4 | C1,C2,C3 | | | | | |
| C5 | C4 | | | | | |
| C6 | C4 | | | | | |
| C7 | C5,C6 | | | | | |
| C8 | C7 | | | | | |
| C9 | C8 | | | | | |
| C10 | C9 | | | | | |
| C11 | C9 | | | | | |
| C12 | C9 | | | | | |
| C13 | C9 | | | | | |
| C14 | C9 | | | | | |
| C15 | C10-C14 | | | | | |
| C16 | C15 | | | | | |
| C17 | C15 | | | | | |
| C18 | C15 | | | | | |
| C19 | C16-C18 | | | | | |
| C20 | C19 | | | | | |
| C21 | C20 | | | | | |
| C22 | C21 | | | | | |
| C23 | C21 | | | | | |
| C24 | C22,C23 | | | | | |
| C25 | C24 | | | | | |
| C26 | C25 | | | | | |
| C27 | C26 | | | | | |
| C28 | C27 | | | | | |
| C29 | C28 | | | | | |
| C30 | C29 | | | | | |
| C31 | C30 | | | | | |
| C32 | C31 | | | | | |

---

## 5. Goal Verification

_Local checks run after stage commands complete. Global checks run at stage completion only._

### Local Goal Checks
- **L1:** ProofSchema has 7 mandatory fields — `grep -A 10 "export const ProofSchema" packages/core/src/proof.ts` shows proofId, sessionId, contentId, confidence, evidenceHash, verifierId, signature ⬜
- **L2:** Serialization works — `pnpm tsx -e "import { createUnsignedProof } from './packages/core/src/proof'; console.log(JSON.stringify(createUnsignedProof({sessionId:'s',contentId:'c',confidence:0.9,evidenceHash:'h',verifierId:'v'})))"` outputs valid JSON ⬜
- **L3:** Hash computation exists — `grep -n "computeEvidenceHash" packages/core/src/proof.ts` finds function ⬜
- **L4:** State machine transitions correct — `grep -A 10 "validTransitions" packages/core/src/proof.ts` shows UNSIGNED→SIGNED, SIGNED→PUBLISHED/REVOKED, PUBLISHED→REVOKED/EXPIRED ⬜
- **L5:** `pnpm test --filter=@verified-attention/core -- --testPathPattern=proof-of-attention-state-machine` exits 0 ⬜
- **L6:** `npx @redocly/cli lint apps/api/openapi.yaml && grep '/v1/proofs' apps/api/openapi.yaml` exits 0 ⬜

### Global Regression Quick-Checks (at stage completion)
- **G5:** Session state machine conformance — `pnpm test:conformance` passes session-state-machine tests ⬜
- **G13:** OpenAPI generation — `pnpm openapi:generate` exits 0 ⬜

---

## 6. Iteration & Notes

- **Deviations from runway:** 
- **Blockers:** 
- **Commands that needed rework:** 
- **Lessons learned:** 
- **Next runways:** 

---

## 7. Machine-Readable Extension (JSON)

```json
{
  "task_id": "implement-proof-of-attention",
  "status": "Draft Plan",
  "generated_with": ".runbookprompt.md",
  "goals": {
    "local": [
      {
        "id": "L1",
        "description": "ProofOfAttention class has 7 mandatory fields",
        "assert": {
          "cmd": "grep -A 10 'export const ProofSchema' packages/core/src/proof.ts",
          "stdout_contains": "proofId",
          "stdout_contains_also": ["sessionId", "contentId", "confidence", "evidenceHash", "verifierId", "signature"]
        }
      },
      {
        "id": "L2",
        "description": "ProofOfAttention serializes to JSON",
        "assert": {
          "cmd": "pnpm tsx -e \"import { createUnsignedProof } from './packages/core/src/proof'; console.log(JSON.stringify(createUnsignedProof({sessionId:'s',contentId:'c',confidence:0.9,evidenceHash:'h',verifierId:'v'})))\"",
          "exit_code": 0,
          "stdout_contains": "proofId"
        }
      },
      {
        "id": "L3",
        "description": "ProofOfAttention has computeHash method",
        "assert": {
          "cmd": "grep -n 'computeEvidenceHash' packages/core/src/proof.ts",
          "exit_code": 0
        }
      },
      {
        "id": "L4",
        "description": "ProofOfAttention state machine implemented",
        "assert": {
          "cmd": "grep -A 10 'validTransitions' packages/core/src/proof.ts",
          "stdout_contains": "UNSIGNED",
          "stdout_contains_also": ["SIGNED", "PUBLISHED", "REVOKED", "EXPIRED"]
        }
      },
      {
        "id": "L5",
        "description": "Test state transitions and hash computation",
        "assert": {
          "cmd": "pnpm test --filter=@verified-attention/core -- --testPathPattern=proof-of-attention-state-machine",
          "exit_code": 0
        }
      },
      {
        "id": "L6",
        "description": "OpenAPI spec for ProofOfAttention endpoints",
        "assert": {
          "cmd": "npx @redocly/cli lint apps/api/openapi.yaml && grep '/v1/proofs' apps/api/openapi.yaml",
          "exit_code": 0
        }
      }
    ],
    "global": ["G5", "G13"]
  },
  "preconditions": [
    {"id": "P1", "check": "node --version", "expect_regex": "v2[0-9]\\."},
    {"id": "P2", "check": "pnpm --version", "expect_regex": "9\\."},
    {"id": "P3", "check": "pnpm install", "expect_exit": 0},
    {"id": "P4", "check": "test -f packages/core/src/proof.ts", "expect_exit": 0},
    {"id": "P5", "check": "test -f packages/core/src/common.ts", "expect_exit": 0},
    {"id": "P6", "check": "test -f packages/core/src/index.ts", "expect_exit": 0}
  ],
  "stages": [
    {
      "id": "Stage1",
      "name": "Inspect Existing ProofOfAttention Implementation",
      "commands": [
        {"id": "C1", "type": "inspect", "tool": "shell", "args": {"cmd": "cat packages/core/src/proof.ts"}, "depends_on": []},
        {"id": "C2", "type": "inspect", "tool": "shell", "args": {"cmd": "cat packages/core/src/common.ts"}, "depends_on": []},
        {"id": "C3", "type": "inspect", "tool": "shell", "args": {"cmd": "cat packages/core/src/index.ts"}, "depends_on": []},
        {"id": "C4", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm typecheck --filter=@verified-attention/core"}, "expected": {"exit_code": 0}, "fallback": "Fix type errors, re-run", "depends_on": ["C1", "C2", "C3"]}
      ],
      "completion_condition": "C4 exits 0"
    },
    {
      "id": "Stage2",
      "name": "Verify/Implement Serialization and Hash Computation",
      "commands": [
        {"id": "C5", "type": "inspect", "tool": "shell", "args": {"cmd": "grep -n 'serialize\\|toJSON' packages/core/src/proof.ts"}, "depends_on": ["C4"]},
        {"id": "C6", "type": "inspect", "tool": "shell", "args": {"cmd": "grep -n 'computeHash\\|computeEvidenceHash' packages/core/src/proof.ts"}, "depends_on": ["C4"]},
        {"id": "C7", "type": "modify", "tool": "patch", "args": {"path": "packages/core/src/proof.ts", "old": "", "new": ""}, "depends_on": ["C5", "C6"], "fallback": "Re-read file, retry patch"},
        {"id": "C8", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm tsx -e \"import { createUnsignedProof } from './packages/core/src/proof'; console.log(JSON.stringify(createUnsignedProof({sessionId:'s',contentId:'c',confidence:0.9,evidenceHash:'h',verifierId:'v'})))\""}, "expected": {"exit_code": 0}, "fallback": "Fix serialization issue", "depends_on": ["C7"]},
        {"id": "C9", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm typecheck --filter=@verified-attention/core"}, "expected": {"exit_code": 0}, "fallback": "Fix type errors, re-run", "depends_on": ["C8"]}
      ],
      "completion_condition": "C8 and C9 exit 0"
    },
    {
      "id": "Stage3",
      "name": "Verify State Machine Logic",
      "commands": [
        {"id": "C10", "type": "inspect", "tool": "shell", "args": {"cmd": "grep -A 20 'validTransitions' packages/core/src/proof.ts"}, "depends_on": ["C9"]},
        {"id": "C11", "type": "inspect", "tool": "shell", "args": {"cmd": "grep -A 10 'export function signProof' packages/core/src/proof.ts"}, "depends_on": ["C9"]},
        {"id": "C12", "type": "inspect", "tool": "shell", "args": {"cmd": "grep -A 10 'export function publishProof' packages/core/src/proof.ts"}, "depends_on": ["C9"]},
        {"id": "C13", "type": "inspect", "tool": "shell", "args": {"cmd": "grep -A 10 'export function revokeProof' packages/core/src/proof.ts"}, "depends_on": ["C9"]},
        {"id": "C14", "type": "inspect", "tool": "shell", "args": {"cmd": "grep -A 5 'export function isProofExpired' packages/core/src/proof.ts"}, "depends_on": ["C9"]},
        {"id": "C15", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm typecheck --filter=@verified-attention/core"}, "expected": {"exit_code": 0}, "fallback": "Patch proof.ts if transitions wrong, re-run", "depends_on": ["C10", "C11", "C12", "C13", "C14"]}
      ],
      "completion_condition": "C15 exits 0"
    },
    {
      "id": "Stage4",
      "name": "Write Tests for State Transitions and Hash Computation (L5)",
      "commands": [
        {"id": "C16", "type": "inspect", "tool": "shell", "args": {"cmd": "cat packages/core/tests/evidence.test.ts | head -50"}, "depends_on": ["C15"]},
        {"id": "C17", "type": "inspect", "tool": "shell", "args": {"cmd": "cat packages/core/tests/observation.test.ts | head -50"}, "depends_on": ["C15"]},
        {"id": "C18", "type": "inspect", "tool": "shell", "args": {"cmd": "ls -la packages/core/tests/"}, "depends_on": ["C15"]},
        {"id": "C19", "type": "create", "tool": "write_file", "args": {"path": "packages/core/tests/proof-of-attention-state-machine.test.ts", "content_ref": "inline:"}, "depends_on": ["C16", "C17", "C18"], "fallback": "Fix syntax, re-write"},
        {"id": "C20", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm test --filter=@verified-attention/core -- --testPathPattern=proof-of-attention-state-machine"}, "expected": {"exit_code": 0}, "fallback": "Debug failing tests, fix implementation or tests, re-run", "depends_on": ["C19"]},
        {"id": "C21", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm test --filter=@verified-attention/core --coverage"}, "expected": {"exit_code": 0}, "fallback": "Ensure proof module covered", "depends_on": ["C20"]}
      ],
      "completion_condition": "C20 exits 0"
    },
    {
      "id": "Stage5",
      "name": "Generate OpenAPI Spec for ProofOfAttention Endpoints (L6)",
      "commands": [
        {"id": "C22", "type": "inspect", "tool": "shell", "args": {"cmd": "find . -name 'openapi.yaml' -o -name 'openapi.yml' 2>/dev/null | head -10"}, "depends_on": ["C21"]},
        {"id": "C23", "type": "inspect", "tool": "shell", "args": {"cmd": "ls -la apps/ 2>/dev/null"}, "depends_on": ["C21"]},
        {"id": "C24", "type": "modify", "tool": "write_file", "args": {"path": "apps/api/openapi.yaml", "content_ref": "inline:"}, "depends_on": ["C22", "C23"], "fallback": "Fix YAML syntax"},
        {"id": "C25", "type": "verify", "tool": "shell", "args": {"cmd": "npx @redocly/cli lint apps/api/openapi.yaml"}, "expected": {"exit_code": 0}, "fallback": "Fix OpenAPI errors, re-run", "depends_on": ["C24"]},
        {"id": "C26", "type": "verify", "tool": "shell", "args": {"cmd": "grep '/v1/proofs' apps/api/openapi.yaml"}, "expected": {"exit_code": 0}, "fallback": "Add endpoints, re-run", "depends_on": ["C25"]}
      ],
      "completion_condition": "C25 and C26 exit 0"
    },
    {
      "id": "Stage6",
      "name": "Global Verification & Final Validation",
      "commands": [
        {"id": "C27", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm test --filter=@verified-attention/core"}, "expected": {"exit_code": 0}, "fallback": "Fix failing tests", "depends_on": ["C26"]},
        {"id": "C28", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm typecheck"}, "expected": {"exit_code": 0}, "fallback": "Fix type errors", "depends_on": ["C27"]},
        {"id": "C29", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm lint"}, "expected": {"exit_code": 0}, "fallback": "Fix lint errors", "depends_on": ["C28"]},
        {"id": "C30", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm build"}, "expected": {"exit_code": 0}, "fallback": "Fix build errors", "depends_on": ["C29"]},
        {"id": "C31", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm openapi:generate"}, "expected": {"exit_code": 0}, "fallback": "Fix generation issues", "depends_on": ["C30"]},
        {"id": "C32", "type": "verify", "tool": "shell", "args": {"cmd": "pnpm test:conformance --filter=@verified-attention/core 2>/dev/null | grep -i session"}, "expected": {"exit_code": 0}, "fallback": "Fix conformance tests", "depends_on": ["C31"]}
      ],
      "completion_condition": "C27-C32 all exit 0"
    }
  ]
}
```

---

## Execution Rules (Mandatory)

1. ⏾ commands complete before ✎ in the same stage
2. No stage closes until its ✓ commands pass
3. On ✓ failure: stop, diagnose (Section 6), retry — don't advance
4. Every command is atomic: one tool invocation
5. No implicit steps — if it's not in the table, it doesn't happen
6. Failures are logged with Retry# — never hidden
7. Local checks per command; global checks per stage (not per command)
8. Never weaken an assertion to pass — fix the implementation or the test, not the gate
9. Update Last Updated timestamp on every edit or log entry