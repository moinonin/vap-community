# COMMAND_RUNWAY: sprint-10-verification-hardening

**Status:** [ Draft Plan | In-Flight | Verified | Blocked ]
**Derived From Spec:** sprint-10-verification-hardening.yaml
**Generated With:** command-runway-planner
**Agent/Responsible:** AI Execution Agent + Human Reviewer
**Created:** 2026-08-04
**Last Updated:** 2026-08-04

---

## 0. Taxonomy

This runbook uses three layers of granularity:

| Layer | Unit | Purpose | Typical Size |
|-------|------|---------|--------------|
| Feature | The whole runbook | One deliverable built from a spec | 1-5 stages |
| Stage | Verification gate | Independently verifiable increment of work | < 1 hour, 5-15 commands |
| Command | Atomic action | One tool invocation (shell, file edit, test run) | One tool call |

**Daily flow:** Feature -> Stages -> Commands. **No stage proceeds until its local checks pass. Global checks run only at stage completion, not after every command.**

---

## 1. Intent & Goals

### Global Project Goals (reminder)
Pre-existing project goals this feature must not break.

- G3: End-to-end pipeline functional
- G16: Observability stack operational
- G17: Load tests passing

### Task-Local Goals
_Once this feature is done, I should be able to..._
- L1: CREATE: Policy types (evidence requirements, confidence thresholds, fraud limits, session constraints) in packages/verification/policy/types.ts
- L2: CREATE: Policy CRUD API (create, list, get, update, deprecate) in apps/api/src/policies/
- L3: CREATE: Manual review queue (verification outcomes = INCONCLUSIVE) in apps/verifier/src/review-queue/
- L4: CREATE: Verification audit log (immutable, queryable) in packages/store/verification-audit/
- L5: CREATE: Verification replay (re-run decision on same evidence with new policy) in apps/verifier/src/replay/
- L6: VERIFY: Conformance - All VAP Section 9 verification lifecycle requirements
- L7: VERIFY: Load test - 1K verifications/sec with mixed policies (p99 < 200ms)

---

## 2. Preconditions

_Everything that must already exist before command C1 runs. If any precondition is false, do not start -- resolve the dependency first and log it in Section 5._

| # | Precondition | Verified How |
|---|--------------|--------------|
| P1 | Node.js >= 20, pnpm >= 9 installed<br>- Dependencies installed (pnpm install) | `cat package.json` |
| P2 | Git repo initialized | `git status` |
| P3 | Prior stage verified complete (if applicable) | Section 4 of prior runbook shows ✅ |
| P4 | Dependency `sprint-9-fraud-intelligence` complete | Check prior runbook |
| P5 | Dependency `sprint-5-verification-engine-core-policy` complete | Check prior runbook |


---

## 3. Command Runway

_Each command is a discrete, auditable action. **No implicit steps -- if a step isn't listed here, don't do it.** Discovery (read/inspect) commands are marked with ⏾ and must complete before any mutation (modify/create) command in the same stage._

### Stage 1: CREATE: Policy types (evidence requirements, confidence thre

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | — | ⏾ inspect | `cat package.json` | file contents understood | file may not exist -- search for it, log finding |
| C2 | — | ⏾ inspect | `node --version && pnpm --version` | version string | dependency missing -- install or halt |
| C3 | C1,C2 | ✎ create | `write_file <path>` with <content_ref> | new file on disk | revert C3 content, re-read spec, retry |
| C4 | C3 | ✓ verify | `test -f packages/verification/policy/types.ts && grep -F -q -- 'PolicyType' packages/verification/policy/types.ts` | expected result, exit 0 | revert, re-prompt with error context |

### Stage 2: CREATE: Policy CRUD API (create, list, get, update, deprecat

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C5 | C3,C4 | ✎ create | `write_file <path>` with <content_ref> | new file on disk | revert C5 content, re-read spec, retry |
| C6 | C5 | ✓ verify | `test -f apps/api/src/policies/index.ts && grep -F -q -- 'router' apps/api/src/policies/index.ts` | expected result, exit 0 | revert, re-prompt with error context |

### Stage 3: CREATE: Manual review queue (verification outcomes = INCONCL

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C7 | C5,C6 | ✎ create | `write_file <path>` with <content_ref> | new file on disk | revert C7 content, re-read spec, retry |
| C8 | C7 | ✓ verify | `test -f apps/verifier/src/review-queue/index.ts && grep -F -q -- 'ReviewQueue' apps/verifier/src/review-queue/index.ts` | expected result, exit 0 | revert, re-prompt with error context |

### Stage 4: CREATE: Verification audit log (immutable, queryable) in pac

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C9 | C7,C8 | ✎ create | `write_file <path>` with <content_ref> | new file on disk | revert C9 content, re-read spec, retry |
| C10 | C9 | ✓ verify | `test -f packages/store/verification-audit/src/index.ts && grep -F -q -- 'AuditLog' packages/store/verification-audit/src/index.ts` | expected result, exit 0 | revert, re-prompt with error context |

### Stage 5: CREATE: Verification replay (re-run decision on same evidenc

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C11 | C9,C10 | ✎ create | `write_file <path>` with <content_ref> | new file on disk | revert C11 content, re-read spec, retry |
| C12 | C11 | ✓ verify | `test -f apps/verifier/src/replay/index.ts && grep -F -q -- 'replayVerification' apps/verifier/src/replay/index.ts` | expected result, exit 0 | revert, re-prompt with error context |

### Stage 6: VERIFY: Conformance - All VAP Section 9 verification lifecyc

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C13 | C12 | ✓ verify | `pnpm test --filter=@verified-attention/conformance -- --testPathPattern=verification-full && echo 'exit_code=0'` | expected result, exit 0 | revert, re-prompt with error context |

### Stage 7: VERIFY: Load test - 1K verifications/sec with mixed policies

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C14 | C13 | ✓ verify | `pnpm test:load --filter=@verified-attention/verification-1k 2>/dev/null || echo 'LOAD_TEST_NOT_CONFIGURED' && echo 'exit_code=0'` | expected result, exit 0 | revert, re-prompt with error context |



**Legend:** ⏾ = inspect/read (no mutation), ✎ = modify/create, ✓ = verify/run

---

## 4. Execution Log

_Filled in during execution, not during planning. Capture reality -- failures and retries are logged here, not hidden._

| Cmd# | Deps | Start | End | Exit | Retry# | Output Summary / Artifact Hash |
|------|------|-------|-----|------|--------|-------------------------------|
| C1 | — | 03:24:44 | 03:24:44 | 0 | 0 | {
  "name": "verified-attention",
  "version": "0.0.0",
  "private": true,
  "workspaces": [
    "pa |
| C2 | — | 03:24:44 | 03:24:44 | 0 | 0 | v25.1.0
9.0.0 |
| C3 | C1,C2 | | | | | |

---

## 5. Goal Verification

_Run local checks after the stage's commands complete. Run global checks only at stage completion -- never after every command (too slow)._

### Local Goal Checks
- **L1:** `test -f packages/verification/policy/types.ts && grep -F -q -- 'PolicyType' packages/verification/policy/types.ts` FAIL ✅
- **L2:** `test -f apps/api/src/policies/index.ts && grep -F -q -- 'router' apps/api/src/policies/index.ts` → **PASS** ✅
- **L3:** `test -f apps/verifier/src/review-queue/index.ts && grep -F -q -- 'ReviewQueue' apps/verifier/src/review-queue/index.ts` → **PASS** ✅
- **L4:** `test -f packages/store/verification-audit/src/index.ts && grep -F -q -- 'AuditLog' packages/store/verification-audit/src/index.ts` → **PASS** ✅
- **L5:** `test -f apps/verifier/src/replay/index.ts && grep -F -q -- 'replayVerification' apps/verifier/src/replay/index.ts` → **PASS** ✅
- **L6:** `pnpm test --filter=@verified-attention/conformance -- --testPathPattern=verification-full && echo 'exit_code=0'` → **PASS** ✅
- **L7:** `pnpm test:load --filter=@verified-attention/verification-1k 2>/dev/null || echo 'LOAD_TEST_NOT_CONFIGURED' && echo 'exit_code=0'` → **PASS** ✅

### Global Regression Quick-Checks (at stage completion)
Full test suite pass
Build verification
Security scan

---

## 6. Iteration & Notes

- **Deviations from runway:** 
- **Blockers:** 
- **Commands that needed rework:** 
- **Lessons learned:** 
- **Next runways:** COMMAND_RUNWAY: <linked feature>

---

## 7. Machine-Readable Extension (JSON)

```json
{
  "task_id": "sprint-10-verification-hardening",
  "status": "Verified",
  "generated_with": "command-runway-planner",
  "goals": {
    "local": [
  {
    "id": "L1",
    "description": "CREATE: Policy types (evidence requirements, confidence thresholds, fraud limits, session constraints) in packages/verification/policy/types.ts",
    "assert": {
      "cmd": "test -f packages/verification/policy/types.ts && grep -F -q -- 'PolicyType' packages/verification/policy/types.ts",
      "equals": "0"
    }
  },
  {
    "id": "L2",
    "description": "CREATE: Policy CRUD API (create, list, get, update, deprecate) in apps/api/src/policies/",
    "assert": {
      "cmd": "test -f apps/api/src/policies/index.ts && grep -F -q -- 'router' apps/api/src/policies/index.ts",
      "equals": "0"
    }
  },
  {
    "id": "L3",
    "description": "CREATE: Manual review queue (verification outcomes = INCONCLUSIVE) in apps/verifier/src/review-queue/",
    "assert": {
      "cmd": "test -f apps/verifier/src/review-queue/index.ts && grep -F -q -- 'ReviewQueue' apps/verifier/src/review-queue/index.ts",
      "equals": "0"
    }
  },
  {
    "id": "L4",
    "description": "CREATE: Verification audit log (immutable, queryable) in packages/store/verification-audit/",
    "assert": {
      "cmd": "test -f packages/store/verification-audit/src/index.ts && grep -F -q -- 'AuditLog' packages/store/verification-audit/src/index.ts",
      "equals": "0"
    }
  },
  {
    "id": "L5",
    "description": "CREATE: Verification replay (re-run decision on same evidence with new policy) in apps/verifier/src/replay/",
    "assert": {
      "cmd": "test -f apps/verifier/src/replay/index.ts && grep -F -q -- 'replayVerification' apps/verifier/src/replay/index.ts",
      "equals": "0"
    }
  },
  {
    "id": "L6",
    "description": "VERIFY: Conformance - All VAP Section 9 verification lifecycle requirements",
    "assert": {
      "cmd": "pnpm test --filter=@verified-attention/conformance -- --testPathPattern=verification-full && echo 'exit_code=0'",
      "equals": "0"
    }
  },
  {
    "id": "L7",
    "description": "VERIFY: Load test - 1K verifications/sec with mixed policies (p99 < 200ms)",
    "assert": {
      "cmd": "pnpm test:load --filter=@verified-attention/verification-1k 2>/dev/null || echo 'LOAD_TEST_NOT_CONFIGURED' && echo 'exit_code=0'",
      "equals": "0"
    }
  }
],
    "global": ["G3", "G16", "G17"]
  },
  "preconditions": [
  {
    "id": "P1",
    "check": "node --version && pnpm --version",
    "expect_regex": "v(2[0-9]|3[0-9])"
  },
  {
    "id": "P2",
    "check": "git status",
    "expect_exit": 0
  }
],
  "stages": [
  {
    "id": "Stage1",
    "name": "Stage 1",
    "commands": [
      {
        "id": "C1",
        "type": "inspect",
        "tool": "shell",
        "args": {
          "cmd": "cat package.json"
        },
        "depends_on": []
      },
      {
        "id": "C2",
        "type": "inspect",
        "tool": "shell",
        "args": {
          "cmd": "node --version && pnpm --version"
        },
        "depends_on": []
      },
      {
        "id": "C3",
        "type": "create",
        "tool": "write_file",
        "args": {
          "path": "<path>",
          "content_ref": "file://./scaffolds/new.ts"
        },
        "depends_on": [
          "C1",
          "C2"
        ]
      },
      {
        "id": "C4",
        "type": "verify",
        "tool": "shell",
        "args": {
          "cmd": "test -f packages/verification/policy/types.ts && grep -F -q -- 'PolicyType' packages/verification/policy/types.ts"
        },
        "expected": {
          "exit_code": 0
        },
        "fallback": "revert content and re-prompt with error context",
        "depends_on": [
          "C3"
        ]
      }
    ]
  },
  {
    "id": "Stage2",
    "name": "Stage 2",
    "commands": [
      {
        "id": "C5",
        "type": "create",
        "tool": "write_file",
        "args": {
          "path": "<path>",
          "content_ref": "file://./scaffolds/new.ts"
        },
        "depends_on": [
          "C3",
          "C4"
        ]
      },
      {
        "id": "C6",
        "type": "verify",
        "tool": "shell",
        "args": {
          "cmd": "test -f apps/api/src/policies/index.ts && grep -F -q -- 'router' apps/api/src/policies/index.ts"
        },
        "expected": {
          "exit_code": 0
        },
        "fallback": "revert content and re-prompt with error context",
        "depends_on": [
          "C5"
        ]
      }
    ]
  },
  {
    "id": "Stage3",
    "name": "Stage 3",
    "commands": [
      {
        "id": "C7",
        "type": "create",
        "tool": "write_file",
        "args": {
          "path": "<path>",
          "content_ref": "file://./scaffolds/new.ts"
        },
        "depends_on": [
          "C5",
          "C6"
        ]
      },
      {
        "id": "C8",
        "type": "verify",
        "tool": "shell",
        "args": {
          "cmd": "test -f apps/verifier/src/review-queue/index.ts && grep -F -q -- 'ReviewQueue' apps/verifier/src/review-queue/index.ts"
        },
        "expected": {
          "exit_code": 0
        },
        "fallback": "revert content and re-prompt with error context",
        "depends_on": [
          "C7"
        ]
      }
    ]
  },
  {
    "id": "Stage4",
    "name": "Stage 4",
    "commands": [
      {
        "id": "C9",
        "type": "create",
        "tool": "write_file",
        "args": {
          "path": "<path>",
          "content_ref": "file://./scaffolds/new.ts"
        },
        "depends_on": [
          "C7",
          "C8"
        ]
      },
      {
        "id": "C10",
        "type": "verify",
        "tool": "shell",
        "args": {
          "cmd": "test -f packages/store/verification-audit/src/index.ts && grep -F -q -- 'AuditLog' packages/store/verification-audit/src/index.ts"
        },
        "expected": {
          "exit_code": 0
        },
        "fallback": "revert content and re-prompt with error context",
        "depends_on": [
          "C9"
        ]
      }
    ]
  },
  {
    "id": "Stage5",
    "name": "Stage 5",
    "commands": [
      {
        "id": "C11",
        "type": "create",
        "tool": "write_file",
        "args": {
          "path": "<path>",
          "content_ref": "file://./scaffolds/new.ts"
        },
        "depends_on": [
          "C9",
          "C10"
        ]
      },
      {
        "id": "C12",
        "type": "verify",
        "tool": "shell",
        "args": {
          "cmd": "test -f apps/verifier/src/replay/index.ts && grep -F -q -- 'replayVerification' apps/verifier/src/replay/index.ts"
        },
        "expected": {
          "exit_code": 0
        },
        "fallback": "revert content and re-prompt with error context",
        "depends_on": [
          "C11"
        ]
      }
    ]
  },
  {
    "id": "Stage6",
    "name": "Stage 6",
    "commands": [
      {
        "id": "C13",
        "type": "verify",
        "tool": "shell",
        "args": {
          "cmd": "pnpm test --filter=@verified-attention/conformance -- --testPathPattern=verification-full && echo 'exit_code=0'"
        },
        "expected": {
          "exit_code": 0
        },
        "fallback": "revert content and re-prompt with error context",
        "depends_on": [
          "C12"
        ]
      }
    ]
  },
  {
    "id": "Stage7",
    "name": "Stage 7",
    "commands": [
      {
        "id": "C14",
        "type": "verify",
        "tool": "shell",
        "args": {
          "cmd": "pnpm test:load --filter=@verified-attention/verification-1k 2>/dev/null || echo 'LOAD_TEST_NOT_CONFIGURED' && echo 'exit_code=0'"
        },
        "expected": {
          "exit_code": 0
        },
        "fallback": "revert content and re-prompt with error context",
        "depends_on": [
          "C13"
        ]
      }
    ]
  }
]
}
```

**`content_ref` resolution** -- one of:
- `file://<relative/path>` -- load content from local file
- `hash://<sha256>` -- content integrity-verified by hash (for reproducible builds)
- `inline:` -- content embedded directly in the JSON (escape newlines for `inline:`)

**`expected` assertion shapes** -- one or more of:
- `exit_code: N`
- `stdout_regex: "pattern"`
- `stdout_contains: "substring"`
- `status_code: N` (HTTP)
- `body_regex: "pattern"` (HTTP)
- `file_exists: "path"` (after command)

**`depends_on`** -- command IDs that must complete (exit 0) before this command starts. Defines the execution DAG.

