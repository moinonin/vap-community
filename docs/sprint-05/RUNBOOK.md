# Sprint 5 — Verification Engine Core & Policy — RUNBOOK

**Mode**: `EXECUTE` — All deliverables pre-implemented; run verification gates only.
**Packages**: `@verified-attention/core`, `@verified-attention/verification`, `@verified-attention/conformance`
**Test totals**: 171 + 26 + 141 = **338 tests**

---

## Stage 1 — Inspect Claim Model (L1)

| Step | Command | Expected |
|------|---------|----------|
| 1.1 | `test -f packages/core/src/claim.ts` | exit 0 |
| 1.2 | `grep -q 'export enum ClaimState' packages/core/src/claim.ts` | exit 0 |
| 1.3 | `grep -q 'PROPOSED\|EVALUATED\|ISSUED\|REVOKED' packages/core/src/claim.ts` | exit 0 |

---

## Stage 2 — Inspect Confidence Model (L2)

| Step | Command | Expected |
|------|---------|----------|
| 2.1 | `test -f packages/verification/src/confidence.ts` | exit 0 |
| 2.2 | `grep -q 'IdentityCalibrator\|IsotonicCalibrator' packages/verification/src/confidence.ts` | exit 0 |
| 2.3 | `grep -q 'calculateConfidence' packages/verification/src/confidence.ts` | exit 0 |

---

## Stage 3 — Inspect Verification Engine (L3)

| Step | Command | Expected |
|------|---------|----------|
| 3.1 | `test -f packages/verification/src/engine.ts` | exit 0 |
| 3.2 | `grep -q 'class VerificationEngine' packages/verification/src/engine.ts` | exit 0 |
| 3.3 | `grep -q 'async verify' packages/verification/src/engine.ts` | exit 0 |
| 3.4 | `grep -q 'verifyStreaming' packages/verification/src/engine.ts` | exit 0 |

---

## Stage 4 — Inspect Policy Engine (L4)

| Step | Command | Expected |
|------|---------|----------|
| 4.1 | `test -f packages/verification/src/policy.ts` | exit 0 |
| 4.2 | `grep -q 'evaluatePolicy' packages/verification/src/policy.ts` | exit 0 |
| 4.3 | `grep -q 'InMemoryPolicyStore' packages/verification/src/policy.ts` | exit 0 |

---

## Stage 5 — Inspect Outcome Codes (L5)

| Step | Command | Expected |
|------|---------|----------|
| 5.1 | `test -f packages/verification/src/outcomes.ts` | exit 0 |
| 5.2 | `grep -q 'determineOutcome' packages/verification/src/outcomes.ts` | exit 0 |
| 5.3 | `grep -q 'PASS\|FAIL\|INSUFFICIENT\|PENDING' packages/verification/src/outcomes.ts` | exit 0 |

---

## Stage 6 — Inspect Conformance Tests (L6)

| Step | Command | Expected |
|------|---------|----------|
| 6.1 | `test -f packages/verification/tests/verification-conformance.test.ts` | exit 0 |
| 6.2 | `grep -c 'it(' packages/verification/tests/verification-conformance.test.ts` | ≥ 17 |

---

## Stage 7 — Inspect Integration Tests (L7)

| Step | Command | Expected |
|------|---------|----------|
| 7.1 | `test -f packages/verification/tests/integration-verification-flow.test.ts` | exit 0 |
| 7.2 | `grep -c 'it(' packages/verification/tests/integration-verification-flow.test.ts` | ≥ 9 |

---

## Stage 8 — Typecheck (L8)

| Step | Command | Expected |
|------|---------|----------|
| 8.1 | `pnpm --filter @verified-attention/core typecheck` | exit 0 |
| 8.2 | `pnpm --filter @verified-attention/verification typecheck` | exit 0 |

---

## Stage 9 — Build (L9)

| Step | Command | Expected |
|------|---------|----------|
| 9.1 | `pnpm --filter @verified-attention/core build` | exit 0, dist/ created |
| 9.2 | `pnpm --filter @verified-attention/verification build` | exit 0, dist/ created |

---

## Stage 10 — All Tests Pass (L10)

| Step | Command | Expected |
|------|---------|----------|
| 10.1 | `pnpm --filter @verified-attention/core test` | 171 passed |
| 10.2 | `pnpm --filter @verified-attention/verification test` | 26 passed |
| 10.3 | `pnpm --filter @verified-attention/conformance test` | 141 passed |

---

## Rollback / Retry

If any stage fails:
1. Re-run the failing command with `--reporter=verbose`
2. Inspect error output
3. Fix root cause (not symptom)
4. Re-run from that stage

**Do not skip stages** — binary verify gates are the contract.

---

## Sign-off

All 10 stages ✅ → Sprint 5 COMPLETE.

Next: `docs/sprint-06/RUNBOOK.md` (Proof Generation & Cryptographic Signing)