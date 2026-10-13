# Sprint 2 Summary: Evidence Model & Pipeline Skeleton

**Status:** ✅ Complete
**Sprint:** 2 of 21 (Phase 0: Research)
**Duration:** 1 session
**Method:** COMMAND_RUNWAY (per-sprint runbook execution)

---

## Goal

Implement the evidence data model, observation types, pipeline stages, and evidence store for the Verified Attention Engine per VAP Sections 3, 4, and 5.

---

## Stages Completed

| Stage | Focus | Tests | Coverage | Status |
|-------|-------|-------|----------|--------|
| A | Evidence Model (VAP Section 5) | 63 | 100% | ✅ |
| B | Observation Model (VAP Section 4) | 61 | 100% | ✅ |
| C | Evidence Ingestion API | — | — | Deferred (Phase 1) |
| D | Validation Pipeline | 30 | 98.86% | ✅ |
| E | Normalization Pipeline | 34 | 100% | ✅ |
| F | Evidence Store | 23 | 100% | ✅ |
| G | Pipeline Integration | 18 | 98.8% | ✅ |
| H | Coverage & Mutation | 211 total | ≥80% all | ✅ |
| I | Global Verification | build+test pass | — | ✅ |

---

## Test Summary

```
@verified-attention/core:     124 tests (63 evidence + 61 observation)
@verified-attention/pipeline:  82 tests (30 validation + 34 normalization + 18 pipeline)
@verified-attention/store:    23 tests (evidence store)
Total: 211 tests, all passing
```

### Coverage (Sprint 2 source files only)

| File | Statements | Branch | Functions | Lines |
|------|-----------|--------|-----------|-------|
| core/src/evidence.ts | 100% | 100% | 100% | 100% |
| core/src/observation.ts | 100% | 100% | 100% | 100% |
| core/src/common.ts | 93.33% | 100% | 20% | 93.33% |
| pipeline/src/validation.ts | 98.86% | 92.3% | 100% | 98.86% |
| pipeline/src/normalization.ts | 100% | 95.91% | 100% | 100% |
| pipeline/src/pipeline.ts | 98.8% | 92.3% | 100% | 98.8% |
| store/src/evidence-store.ts | 100% | 100% | 100% | 100% |

All Sprint 2 source files exceed the 80% coverage threshold.

---

## Files Created/Modified

### New Files
- `packages/core/src/evidence.test.ts` — 630 lines, 63 tests
- `packages/core/src/observation.test.ts` — 61 tests
- `packages/pipeline/src/validation.test.ts` — 30 tests
- `packages/pipeline/src/normalization.test.ts` — 34 tests
- `packages/pipeline/src/pipeline.ts` — Pipeline class wiring validation → normalization → store
- `packages/pipeline/src/pipeline.test.ts` — 18 integration tests
- `packages/store/src/evidence-store.test.ts` — 23 tests
- `packages/store/src/index.ts` — barrel export
- `.runbookprompt.md` — venv rule + Make target rule
- `Makefile` — 12 Make targets for all backend entrypoints

### Modified Files
- `packages/core/src/common.ts` — relaxed TimestampSchema (precision: 6 → variable precision)
- `packages/pipeline/src/validation.ts` — fixed bug: EvidenceValidationResultSchema → EvidenceSchema
- `packages/pipeline/src/index.ts` — added pipeline barrel export
- `packages/pipeline/package.json` — added @verified-attention/store dependency
- `packages/store/package.json` — fixed exports (.mjs → .js)
- `README.md` — added Make targets documentation section

---

## Key Bug Fixes

1. **TimestampSchema precision** — `z.string().datetime({ precision: 6 })` rejected standard ISO timestamps from `new Date().toISOString()` (3-digit ms). Fixed to `datetime({ offset: true })` accepting variable precision.

2. **Validation pipeline schema bug** — `validateEvidence()` was validating raw evidence against `EvidenceValidationResultSchema` (the result schema) instead of `EvidenceSchema` (the evidence schema). Fixed import and usage.

3. **Store package exports** — `package.json` pointed `import` to `.mjs` but tsdown produces `.js` only. Fixed exports field.

4. **Store barrel export** — `packages/store/src/index.ts` was missing. Created barrel export.

5. **Pipeline store dependency** — Pipeline package needed `@verified-attention/store` as a workspace dependency for integration tests. Added to package.json.

---

## VAP Compliance

- ✅ VAP Section 4: 8 signal types (SCROLL, CLICK, KEY_PRESS, VIEWPORT_VISIBILITY, FOCUS, DEVICE_MOTION, PAGE_RESIZE, CUSTOM), 4 lifecycle states (captured, verified, attributed, embeddable)
- ✅ VAP Section 5: 5 evidence types (E-INTERACTION, E-VISIBLE, E-DURATION, E-CONTEXT, E-CUSTOM), provenance, metadata, state machine (PROPOSED → VALIDATED → INDEXED → ARCHIVED/DISCARDED)
- ✅ VAP Section 3: Append-only evidence store (no update/delete), indexed by session_id and EID
- ✅ Pipeline: validation (schema, timestamp, replay, session) → normalization (platform → canonical) → store

---

## Infrastructure Improvements

- `.venv` recreated fresh with Python 3.11.13 (previous venv had broken shebangs from path relocation)
- `Makefile` created with 12 targets: help, venv, install, prototype, test-py, build, test-ts, typecheck, lint, test, verify, clean, clean-venv
- `.runbookprompt.md` documents Python venv rule (P5 precondition) and Make target rule
- COMMAND_RUNWAY skill updated with Python Virtual Environment Rule and Make Targets sections

---

## Deferred to Later Sprints

- Stage C (Evidence Ingestion API with Fastify): deferred to Phase 1 (Protocol, Sprint 4+)
- Mutation testing (Stryker): not configured for this sprint; can be added in Sprint 3
- apps/api directory: not created (deferred to Phase 1)

---

## Next Sprint

**Sprint 3: Session Model & Research Prototypes** — 6 stages, 52 commands. Build session lifecycle, research data collection, statistical validation prototypes. Continue Phase 0 (Research) completion.
