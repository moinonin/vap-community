# COMMAND_RUNWAY Plan — Proof of Attention Feature

**Feature Name:** implement-proof-of-attention
**Purpose:** Implement the Proof of Attention object with all 7 mandatory fields and a state machine
**Reference Specification:** Structured YAML spec (Format B) at `/tmp/proof-attention-plan-prompt.md`
**Expected Deliverables:**
- Verified ProofOfAttention class with 7 mandatory fields (proofId, sessionId, contentId, confidence, evidenceHash, verifierId, signature)
- Serialization method (toJSON/serialize)
- Hash computation method (computeHash)
- State machine logic (UNSIGNED → SIGNED → PUBLISHED/REVOKED/EXPIRED)
- Test coverage for state transitions and hash computation (L5)
- OpenAPI spec with /v1/proofs endpoints (L6)

**Dependencies:** stage-1-core-models, stage-2-pipeline
**Assumptions:** Monorepo uses pnpm workspaces, TypeScript, Vitest; core package already exists with proof.ts

---

# Global Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| G5 | Session lifecycle state machine enforced | Conformance test `session-state-machine` passes |
| G13 | Public REST + Streaming APIs with OpenAPI 3.1 spec, generated SDKs | `pnpm openapi:generate` + `pnpm sdk:generate` |

---

# Execution Stages

## Stage 1: Inspect Existing ProofOfAttention Implementation

### Objective
Understand the current ProofOfAttention class structure in `packages/core/src/proof.ts` to verify it meets all 7 mandatory fields and state machine requirements.

### Inputs
- `packages/core/src/proof.ts` (existing implementation)
- VAP Spec Section 10 (Proof of Attention)

### Preconditions
- [ ] `packages/core/src/proof.ts` exists
- [ ] Node.js ≥ 20, pnpm ≥ 9 installed
- [ ] Dependencies installed (`pnpm install`)

### Discovery Tasks
- [ ] Read `packages/core/src/proof.ts` — inspect ProofSchema, ProofState enum, createUnsignedProof, signProof, publishProof, revokeProof, transitionProofState
- [ ] Read `packages/core/src/common.ts` — verify schema primitives (ProofIdSchema, SessionIdSchema, ContentIdSchema, ConfidenceSchema, HashSchema, VerifierIdSchema, SignatureSchema)
- [ ] Check `packages/core/src/index.ts` — verify exports include Proof, ProofState, ProofSchema, createUnsignedProof, signProof, publishProof, revokeProof, transitionProofState, validateProof, isProofExpired, isProofValid

### Execution Tasks
1. **Inspect proof.ts** — Read and understand the complete ProofOfAttention implementation
2. **Verify 7 mandatory fields** — Confirm ProofSchema includes: proofId, sessionId, contentId, confidence, evidenceHash, verifierId, signature
3. **Verify state machine** — Confirm ProofState enum has UNSIGNED, SIGNED, PUBLISHED, REVOKED, EXPIRED and transitionProofState enforces valid transitions
4. **Verify serialization** — Check if Proof type/serialization method exists (JSON.stringify works on Zod-inferred types)
5. **Verify hash computation** — Check if computeEvidenceHash or similar exists for computing evidenceHash

### Suggested Commands
```bash
# 1. Inspect proof.ts
cat packages/core/src/proof.ts

# 2. Inspect common.ts for primitive schemas
cat packages/core/src/common.ts

# 3. Check exports
cat packages/core/src/index.ts

# 4. Run typecheck to ensure no TypeScript errors
pnpm typecheck --filter=@verified-attention/core
```

### Expected Outputs
- Understanding of current implementation (no files modified)
- List of any gaps vs. spec requirements

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| ProofSchema has 7 fields | `grep -A 10 "export const ProofSchema" packages/core/src/proof.ts` | proofId, sessionId, contentId, confidence, evidenceHash, verifierId, signature present |
| ProofState enum | `grep -A 7 "export enum ProofState" packages/core/src/proof.ts` | UNSIGNED, SIGNED, PUBLISHED, REVOKED, EXPIRED present |
| Typecheck passes | `pnpm typecheck --filter=@verified-attention/core` | Exit 0, no errors |

### Failure Procedure
- If proof.ts missing fields: document gaps, plan additions in Stage 2
- If typecheck fails: fix type errors before proceeding

### Completion Condition
All 7 mandatory fields confirmed present, state machine confirmed implemented, typecheck passes.

---

## Stage 2: Verify/Implement Serialization and Hash Computation

### Objective
Ensure ProofOfAttention has a serialization method and hash computation method as specified.

### Inputs
- `packages/core/src/proof.ts` (from Stage 1 inspection)
- `packages/core/src/common.ts` (for HashSchema)

### Preconditions
- [ ] Stage 1 complete
- [ ] Understanding of current implementation

### Discovery Tasks
- [ ] Check if Proof type has serialize/toJSON method
- [ ] Check if computeHash/computeEvidenceHash function exists
- [ ] Verify evidenceHash field is populated via hash computation

### Execution Tasks
1. **Check serialization** — Zod-inferred types serialize via JSON.stringify; verify this works for Proof
2. **Check hash computation** — Look for computeEvidenceHash or similar; if missing, add it
3. **Verify evidenceHash usage** — Ensure createUnsignedProof accepts evidenceHash and it's computed correctly

### Suggested Commands
```bash
# 1. Check if Proof type has custom serialize method
grep -n "serialize\|toJSON" packages/core/src/proof.ts

# 2. Check for hash computation
grep -n "computeHash\|computeEvidenceHash" packages/core/src/proof.ts

# 3. Test JSON serialization manually (if needed)
pnpm tsx -e "
import { createUnsignedProof } from './packages/core/src/proof';
const p = createUnsignedProof({ sessionId: 'test', contentId: 'test', confidence: 0.9, evidenceHash: 'hash', verifierId: 'test' });
console.log(JSON.stringify(p, null, 2));
"
```

### Expected Outputs
- Confirmation that serialization works via JSON.stringify
- computeEvidenceHash function exists or is added to proof.ts
- evidenceHash field properly populated

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Serialization works | `pnpm tsx -e "import { createUnsignedProof } from './packages/core/src/proof'; console.log(JSON.stringify(createUnsignedProof({sessionId:'s',contentId:'c',confidence:0.9,evidenceHash:'h',verifierId:'v'})))"` | Valid JSON output with all fields |
| Hash function exists | `grep -n "computeEvidenceHash" packages/core/src/proof.ts` | Function found |
| Typecheck passes | `pnpm typecheck --filter=@verified-attention/core` | Exit 0 |

### Failure Procedure
- If serialize missing: Zod types serialize natively; no action needed unless custom format required
- If hash function missing: implement computeEvidenceHash in proof.ts, re-run typecheck

### Completion Condition
Serialization confirmed working, hash computation function exists, typecheck passes.

---

## Stage 3: Verify State Machine Logic

### Objective
Verify the state machine implementation matches the spec: UNSIGNED → SIGNED → PUBLISHED/REVOKED/EXPIRED transitions.

### Inputs
- `packages/core/src/proof.ts` (from Stage 1)
- VAP Spec Section 10 state machine

### Preconditions
- [ ] Stage 1 complete
- [ ] Stage 2 complete

### Discovery Tasks
- [ ] Verify transitionProofState enforces valid transitions per VAP
- [ ] Verify signProof transitions UNSIGNED → SIGNED
- [ ] Verify publishProof transitions SIGNED → PUBLISHED
- [ ] Verify revokeProof transitions any → REVOKED
- [ ] Verify EXPIRED state handling (isProofExpired)

### Execution Tasks
1. **Verify transitionProofState** — Check validTransitions map matches spec
2. **Verify signProof** — Adds signature, sets state=SIGNED, issuedAt
3. **Verify publishProof** — Requires SIGNED, sets state=PUBLISHED, publishedAt
4. **Verify revokeProof** — Works from any state, sets state=REVOKED, revokedAt
5. **Verify isProofExpired** — Checks expiresAt and EXPIRED state

### Suggested Commands
```bash
# 1. Inspect transitionProofState validTransitions
grep -A 20 "validTransitions" packages/core/src/proof.ts

# 2. Inspect signProof, publishProof, revokeProof
grep -A 10 "export function signProof" packages/core/src/proof.ts
grep -A 10 "export function publishProof" packages/core/src/proof.ts
grep -A 10 "export function revokeProof" packages/core/src/proof.ts

# 3. Inspect isProofExpired
grep -A 5 "export function isProofExpired" packages/core/src/proof.ts
```

### Expected Outputs
- Confirmation that all state transitions match VAP spec
- No modifications needed if implementation is correct

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Valid transitions map | `grep -A 10 "validTransitions" packages/core/src/proof.ts` | UNSIGNED→SIGNED, SIGNED→PUBLISHED/REVOKED, PUBLISHED→REVOKED/EXPIRED |
| signProof sets SIGNED | `grep -A 8 "state: ProofState.SIGNED" packages/core/src/proof.ts` | Found |
| publishProof requires SIGNED | `grep -B 2 -A 5 "Cannot publish proof" packages/core/src/proof.ts` | Check present |
| Typecheck passes | `pnpm typecheck --filter=@verified-attention/core` | Exit 0 |

### Failure Procedure
- If transitions incorrect transitions: patch proof.ts to fix validTransitions map
- If state guards missing: add proper validation
- Re-run typecheck after fixes

### Completion Condition
All state machine transitions verified correct per VAP spec, typecheck passes.

---

## Stage 4: Write Tests for State Transitions and Hash Computation (L5)

### Objective
Create/complete test file for ProofOfAttention state machine and hash computation to satisfy L5 verification.

### Inputs
- `packages/core/src/proof.ts` (verified implementation)
- `packages/core/tests/` (test directory, may need creation)
- Vitest test framework

### Preconditions
- [ ] Stages 1-3 complete
- [ ] Implementation verified correct

### Discovery Tasks
- [ ] Check if `packages/core/tests/proof.test.ts` exists
- [ ] Check existing test patterns in `packages/core/tests/evidence.test.ts` and `observation.test.ts`

### Execution Tasks
1. **Create/extend test file** — `packages/core/tests/proof-of-attention-state-machine.test.ts`
2. **Test state transitions** — UNSIGNED→SIGNED→PUBLISHED, UNSIGNED→SIGNED→REVOKED, PUBLISHED→REVOKED, PUBLISHED→EXPIRED, invalid transitions throw
3. **Test hash computation** — computeEvidenceHash produces consistent output, different inputs produce different hashes
4. **Test signProof** — adds signature, sets state=SIGNED, issuedAt
5. **Test publishProof** — requires SIGNED, sets PUBLISHED, publishedAt
6. **Test revokeProof** — works from any state, sets REVOKED, revokedAt
6. **Test isProofExpired/isProofValid** — expired check, valid check

### Suggested Commands
```bash
# 1. Check existing test structure
cat packages/core/tests/evidence.test.ts | head -50
cat packages/core/tests/observation.test.ts | head -50

# 2. Check if proof test exists
ls -la packages/core/tests/

# 3. Create test file (if needed)
mkdir -p packages/core/tests
# Write test file...

# 4. Run tests
pnpm test --filter=@verified-attention/core -- --testPathPattern=proof-of-attention-state-machine
```

### Expected Outputs
- `packages/core/tests/proof-of-attention-state-machine.test.ts` with comprehensive tests
- All tests passing

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Test file exists | `test -f packages/core/tests/proof-of-attention-state-machine.test.ts` | Exit 0 |
| L5 CLI test passes | `pnpm test --filter=@verified-attention/core -- --testPathPattern=proof-of-attention-state-machine` | Exit 0, all tests pass |
| Coverage | `pnpm test --filter=@verified-attention/core --coverage` | Proof module covered |

### Failure Procedure
- If tests fail: debug implementation vs. test expectations
- Fix either test or implementation, re-run
- Ensure test file matches the exact pattern in L5: `pnpm test --filter=@verified-attention/api -- --testPathPattern=proof-of-attention-state-machine`
  - Note: Spec says `@verified-attention/api` but core tests are in `@verified-attention/core`; adjust to match actual package

### Completion Condition
L5 test command exits 0 with all tests passing.

---

## Stage 5: Generate OpenAPI Spec for ProofOfAttention Endpoints (L6)

### Objective
Ensure OpenAPI spec includes /v1/proofs endpoints and passes Redocly lint.

### Inputs
- OpenAPI spec location (likely `apps/api/openapi.yaml` or similar)
- API package structure (may need creation)

### Preconditions
- [ ] Stage 4 complete (tests passing)
- [ ] API package exists or will be created

### Discovery Tasks
- [ ] Find OpenAPI spec file in repo
- [ ] Check if /v1/proofs endpoints already defined
- [ ] Check Redocly CLI availability

### Execution Tasks
1. **Locate/create OpenAPI spec** — Find or create `apps/api/openapi.yaml`
2. **Add /v1/proofs endpoints** — GET /v1/proofs/:proofId, POST /v1/proofs (create), GET /v1/proofs (list)
3. **Define Proof schema** — Reference ProofSchema from core package
4. **Run Redocly lint** — Validate OpenAPI spec
5. **Verify grep** — Confirm `/v1/proofs` present in spec

### Suggested Commands
```bash
# 1. Find OpenAPI spec
find . -name "openapi.yaml" -o -name "openapi.yml" 2>/dev/null | head -10

# 2. Check if API package exists
ls -la apps/ 2>/dev/null || echo "No apps directory"

# 3. If API package exists, check its openapi.yaml
cat apps/api/openapi.yaml 2>/dev/null | head -100

# 4. Run Redocly lint (L6 command)
npx @redocly/cli lint apps/api/openapi.yaml && grep '/v1/proofs' apps/api/openapi.yaml
```

### Expected Outputs
- `apps/api/openapi.yaml` with /v1/proofs endpoints
- Redocly lint passes
- grep finds /v1/proofs

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| L6 CLI test passes | `npx @redocly/cli lint apps/api/openapi.yaml && grep '/v1/proofs' apps/api/openapi.yaml` | Exit 0, /v1/proofs found |
| OpenAPI valid | `npx @redocly/cli lint apps/api/openapi.yaml` | No errors |

### Failure Procedure
- If OpenAPI spec missing: create minimal spec with /v1/proofs endpoints
- If lint fails: fix OpenAPI syntax errors
- If /v1/proofs missing: add endpoints to spec

### Completion Condition
L6 CLI command exits 0 — Redocly lint passes AND /v1/proofs found in spec.

---

## Stage 6: Global Verification & Final Validation

### Objective
Run complete validation: full test suite, typecheck, lint, build for core package and related packages.

### Inputs
- All previous stages complete

### Preconditions
- [ ] Stages 1-5 complete

### Execution Tasks
1. **Run core package tests** — Full test suite for @verified-attention/core
2. **Run typecheck** — All packages
3. **Run lint** — All packages
4. **Run build** — All packages
5. **Verify global goals** — G5 (session state machine), G13 (OpenAPI generation)

### Suggested Commands
```bash
# 1. Core package full test
pnpm test --filter=@verified-attention/core

# 2. Typecheck all
pnpm typecheck

# 3. Lint all
pnpm lint

# 4. Build all
pnpm build

# 5. OpenAPI generation (G13)
pnpm openapi:generate

# 6. Check G5 - session state machine conformance
pnpm test:conformance --filter=@verified-attention/core 2>/dev/null | grep -i session
```

### Expected Outputs
- All tests pass
- Typecheck clean
- Lint clean
- Build succeeds
- OpenAPI generation works

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| Core tests | `pnpm test --filter=@verified-attention/core` | All pass |
| Typecheck | `pnpm typecheck` | Exit 0 |
| Lint | `pnpm lint` | Exit 0 |
| Build | `pnpm build` | Exit 0 |
| OpenAPI gen | `pnpm openapi:generate` | Exit 0 |
| G5 conformance | `pnpm test:conformance` | Session state machine tests pass |

### Failure Procedure
- Fix any failures in order: tests → typecheck → lint → build
- Re-run failed commands until all pass

### Completion Condition
All global verification commands exit 0. Feature complete.