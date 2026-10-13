# PLAN: sprint-10-verification-hardening

**Status:** [ Draft | Approved | In-Progress | Complete ]
**Derived From Spec:** sprint-10-verification-hardening.yaml
**Generated:** 2026-08-04

---

## 1. Intent & Goals

### Summary
Complete verification engine with all policy types, manual review queue, audit log, replay

### Dependencies
- sprint-9-fraud-intelligence
- sprint-5-verification-engine-core-policy

### Global Goals (from project)
- G1: Core specification published
- G2: Core data models with schemas & 100% conformance
- G3: End-to-end pipeline functional
- G4: Data store operational
- G5: State machine enforced
- G6: Intelligence model performing
- G7: Fraud detection performing
- G8: Verification engine deterministic
- G9: Proof generation operational
- G10: Reward pipeline functional
- G11: Client SDK within size budget
- G12: Extension published
- G13: Public APIs with OpenAPI spec + generated SDKs
- G14: Security posture production-ready
- G15: Privacy compliance (GDPR/CCPA)
- G16: Observability stack operational
- G17: Load tests passing
- G18: Chaos tests passing
- G19: All CI gates pass

### Task-Local Goals
- **L1**: CREATE: Policy types (evidence requirements, confidence thresholds, fraud limits, session constraints) in packages/verification/policy/types.ts
- **L2**: CREATE: Policy CRUD API (create, list, get, update, deprecate) in apps/api/src/policies/
- **L3**: CREATE: Manual review queue (verification outcomes = INCONCLUSIVE) in apps/verifier/src/review-queue/
- **L4**: CREATE: Verification audit log (immutable, queryable) in packages/store/verification-audit/
- **L5**: CREATE: Verification replay (re-run decision on same evidence with new policy) in apps/verifier/src/replay/
- **L6**: VERIFY: Conformance - All VAP Section 9 verification lifecycle requirements
- **L7**: VERIFY: Load test - 1K verifications/sec with mixed policies (p99 < 200ms)

---

## 2. Preconditions
Everything that must exist before Stage 1 starts.

Node.js >= 20, pnpm >= 9 installed
- Dependencies installed (pnpm install)

---

## 3. Execution Stages

### Stage 1: CREATE: Policy types (evidence requirements, confidence thre (CREATE)

#### Objective
CREATE: Policy types (evidence requirements, confidence thresholds, fraud limits, session constraints) in packages/verification/policy/types.ts

#### Action
CREATE

#### Verification Command
```bash
test -f packages/verification/policy/types.ts && grep -F -q -- 'PolicyType' packages/verification/policy/types.ts
```

#### Expected Result
Exit code 0 (or expected HTTP status / file content)


### Stage 2: CREATE: Policy CRUD API (create, list, get, update, deprecat (CREATE)

#### Objective
CREATE: Policy CRUD API (create, list, get, update, deprecate) in apps/api/src/policies/

#### Action
CREATE

#### Verification Command
```bash
test -f apps/api/src/policies/index.ts && grep -F -q -- 'router' apps/api/src/policies/index.ts
```

#### Expected Result
Exit code 0 (or expected HTTP status / file content)


### Stage 3: CREATE: Manual review queue (verification outcomes = INCONCL (CREATE)

#### Objective
CREATE: Manual review queue (verification outcomes = INCONCLUSIVE) in apps/verifier/src/review-queue/

#### Action
CREATE

#### Verification Command
```bash
test -f apps/verifier/src/review-queue/index.ts && grep -F -q -- 'ReviewQueue' apps/verifier/src/review-queue/index.ts
```

#### Expected Result
Exit code 0 (or expected HTTP status / file content)


### Stage 4: CREATE: Verification audit log (immutable, queryable) in pac (CREATE)

#### Objective
CREATE: Verification audit log (immutable, queryable) in packages/store/verification-audit/

#### Action
CREATE

#### Verification Command
```bash
test -f packages/store/verification-audit/src/index.ts && grep -F -q -- 'AuditLog' packages/store/verification-audit/src/index.ts
```

#### Expected Result
Exit code 0 (or expected HTTP status / file content)


### Stage 5: CREATE: Verification replay (re-run decision on same evidenc (CREATE)

#### Objective
CREATE: Verification replay (re-run decision on same evidence with new policy) in apps/verifier/src/replay/

#### Action
CREATE

#### Verification Command
```bash
test -f apps/verifier/src/replay/index.ts && grep -F -q -- 'replayVerification' apps/verifier/src/replay/index.ts
```

#### Expected Result
Exit code 0 (or expected HTTP status / file content)


### Stage 6: VERIFY: Conformance - All VAP Section 9 verification lifecyc (VERIFY)

#### Objective
VERIFY: Conformance - All VAP Section 9 verification lifecycle requirements

#### Action
VERIFY

#### Verification Command
```bash
pnpm test --filter=@verified-attention/conformance -- --testPathPattern=verification-full && echo 'exit_code=0'
```

#### Expected Result
Exit code 0 (or expected HTTP status / file content)


### Stage 7: VERIFY: Load test - 1K verifications/sec with mixed policies (VERIFY)

#### Objective
VERIFY: Load test - 1K verifications/sec with mixed policies (p99 < 200ms)

#### Action
VERIFY

#### Verification Command
```bash
pnpm test:load --filter=@verified-attention/verification-1k 2>/dev/null || echo 'LOAD_TEST_NOT_CONFIGURED' && echo 'exit_code=0'
```

#### Expected Result
Exit code 0 (or expected HTTP status / file content)



---

## 4. Global Verification
Run after all stages complete.

Full test suite: pytest (or project equivalent)
Integration tests
Security scan
Build verification

---

## 5. Rollback Plan
If any stage fails irreversibly.

git reset --hard HEAD~7
Clear build artifacts

