# Sprint 5 — Verification Engine Core & Policy (VAP §7–10)

**Status**: COMPLETE ✅
**Spec**: `docs/sprint-05/spec.yaml`
**Depends on**: Sprint 4 (VAP Spec Finalization & Conformance)

---

## Executive Summary

Sprint 5 delivers the **Verification Decision Engine** — the computational heart of VAP that transforms evidence into trustworthy attestations. All code was pre-implemented; this sprint formalizes it with spec, plan, runbook, and verification gates.

**Packages implemented**:
- `@verified-attention/core` — Claim model (VAP §7)
- `@verified-attention/verification` — Confidence Model (§8), Verification Engine (§9), Policy Engine (§10), Outcome codes, Keys/HSM/Audit/Signing/Verify utilities

**Test totals**: 171 (core) + 26 (verification) + 141 (conformance) = **338 tests, all passing**.

---

## Deliverables Checklist

| ID | Deliverable | Location | Status |
|----|-------------|----------|--------|
| L1 | Claim model (state machine, schemas, transitions) | `packages/core/src/claim.ts` | ✅ |
| L2 | Confidence model (calibration: Identity, Isotonic) | `packages/verification/src/confidence.ts` | ✅ |
| L3 | Verification Engine (lifecycle: evidence→claims→confidence→decision) | `packages/verification/src/engine.ts` | ✅ |
| L4 | Policy Engine (JSON config, thresholds, InMemoryPolicyStore) | `packages/verification/src/policy.ts` | ✅ |
| L5 | Outcome codes (PASS/FAIL/INSUFFICIENT/PENDING + semantics) | `packages/verification/src/outcomes.ts` | ✅ |
| L6 | Conformance tests (17 tests) | `packages/verification/tests/verification-conformance.test.ts` | ✅ |
| L7 | Integration tests (9 tests, end-to-end VAP §9 lifecycle) | `packages/verification/tests/integration-verification-flow.test.ts` | ✅ |
| L8 | Typecheck core + verification | `pnpm --filter @verified-attention/core typecheck && pnpm --filter @verified-attention/verification typecheck` | ✅ |
| L9 | Build core + verification | `pnpm --filter @verified-attention/core build && pnpm --filter @verified-attention/verification build` | ✅ |
| L10 | All tests pass (core, verification, conformance) | `pnpm test` across all three packages | ✅ |

---

## Architecture Notes

### Claim Model (VAP §7)
- **States**: `PROPOSED → EVALUATED → ISSUED` or `REVOKED` (terminal)
- **Evidence binding**: `evidenceIds[]` + `evidenceHash` (cryptographic commitment)
- **Confidence**: Calibrated probability [0, 1] per claim
- **Expiration**: Optional TTL for staleness

### Confidence Model (VAP §8)
- **Inputs**: evidenceQuality[], completeness, evidenceCount, sourceReliability[], contradictionPenalty, fraudScore
- **Weights** (configurable): quality=0.35, completeness=0.25, count=0.15, reliability=0.25
- **Calibration interface**: `IdentityCalibrator` (pass-through), `IsotonicCalibrator` (PAVA, configurable bins)
- **Output**: rawConfidence, calibratedConfidence, confidence (final), component breakdown

### Verification Engine (VAP §9)
- **Single entry point**: `VerificationEngine.verify(input)`
- **Streaming variant**: `verifyStreaming()` for real-time updates
- **Pipeline**: evidence quality → contradiction → completeness → confidence → policy → outcome
- **Deterministic**: identical inputs → identical outputs

### Policy Engine (VAE §10)
- **PolicyConfig**: requiredEvidenceTypes[], passThreshold, failThreshold, minEvidenceCount, fraudScoreThreshold, contradictionMultiplier, fraudMultiplier, allowManualReview
- **Evaluation**: `evaluatePolicy(policy, input)` → { passed, reasons[], failures[], warnings[] }
- **Store**: `InMemoryPolicyStore` (CRUD + getActivePolicy)

### Outcome Codes (VAP §9)
| Outcome | Meaning | Terminal? |
|---------|---------|-----------|
| `PASS` | Confidence ≥ passThreshold, all policy checks pass | ✅ |
| `FAIL` | Confidence < failThreshold OR fraud detected | ✅ |
| `INSUFFICIENT` | Session closed, evidence below thresholds, no fraud | ✅ |
| `PENDING` | Session open, more evidence can arrive | ❌ |

**Decision logic** (in `determineOutcome`):
```typescript
if (fraudDetected) return FAIL;
if (!allRequiredPresent) {
  if (canReceiveMoreEvidence) return PENDING;
  return INSUFFICIENT;
}
if (confidence < failThreshold) return FAIL;
if (confidence >= passThreshold && evidenceCount >= minEvidenceCount) return PASS;
return PENDING; // between thresholds
```

---

## ADR Reference

- **ADR-003** (Verifier Identity & Trust Model) — `docs/adr/0003-verifier-trust-model.md` — **Already exists, complete**
- Implemented in Sprint 6 (Proof Generation & Cryptographic Signing)

---

## Verification Commands (Copy-Paste)

```bash
# Typecheck
pnpm --filter @verified-attention/core typecheck
pnpm --filter @verified-attention/verification typecheck

# Build
pnpm --filter @verified-attention/core build
pnpm --filter @verified-attention/verification build

# Test all three packages
pnpm --filter @verified-attention/core test
pnpm --filter @verified-attention/verification test
pnpm --filter @verified-attention/conformance test
```

---

## Next Sprint

**Sprint 6** — Proof Generation & Cryptographic Signing (VAP §11–12)
- Implements ADR-003 (Verifier identity, X.509 certs, HSM signing)
- Proof object with 7 mandatory fields, state machine (UNSIGNED→SIGNED→PUBLISHED/REVOKED/EXPIRED)
- API: POST/GET /v1/proofs, /v1/proofs/:id/sign, /v1/proofs/:id/verify, /v1/proofs/:id/revoke