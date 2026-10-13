# RUNBOOK.md — Sprint 8: Attention Intelligence - Behaviour Models

**Task ID**: sprint-8-attention-intelligence
**Mode**: PLANNING → EXECUTE (once Sprint 7 verified complete)
**Derived From**: `docs/sprint-08/spec.yaml`
**Agent**: Hermes Agent + Human Reviewer
**Created**: 2026-07-27

---

## 0. Taxonomy

| Layer | Unit | Purpose | Typical Size |
|-------|------|---------|--------------|
| Feature | Whole runbook | One deliverable from spec | 1–5 stages |
| Stage | Verification gate | Independently verifiable increment | < 1 hour; 5–15 commands |
| Command | Atomic action | One tool invocation | One tool call |

**Rules**: ⏾ (inspect) before ✎ (mutate) in same stage. ✓ (verify) after ✎. No stage closes until its ✓ commands pass. Global checks only at stage completion.

---

## 1. Intent & Goals

### Global Project Goals (must not break)
- G3: Evidence pipeline end-to-end — `pnpm test:integration --filter=@verified-attention/pipeline` passes
- G16: Observability — Prometheus, Grafana, OpenTelemetry, alerting
- G17: Load test — 10K evidence/sec sustained 1hr (p99 < 500ms)

### Task-Local Goals (what "done" means for this sprint)
- **L1**: `packages/ml/attention/features/` exports `extractAttentionFeatures(evidence)` → 20-dim normalized vector
- **L2**: `packages/ml/attention/model/` exports `AttentionModel` class (train, predict, save, load), AUC ≥ 0.95
- **L3**: `apps/ml-serving/attention/` HTTP/gRPC `/predict` endpoint, p99 < 50ms
- **L4**: `apps/ml-serving/infra/` model registry, A/B routing, canary, rollback < 1min
- **L5**: `packages/ml/attention/drift/` KS test + PSI, alert on p < 0.01 / PSI > 0.25
- **L6**: `packages/ml/attention/retrain/` weekly pipeline, promotes if AUC improves
- **L7**: Conformance — deterministic inference (fixed seed)
- **L8**: Integration — pipeline → features → model → confidence score

---

## 2. Preconditions

| # | Precondition | Verified How |
|---|--------------|--------------|
| P1 | Node.js ≥ 20 | `node --version` |
| P2 | pnpm ≥ 9 | `pnpm --version` |
| P3 | Dependencies installed | `pnpm install` exits 0 |
| P4 | Sprint 7 complete | `docs/sprint-07/RUNBOOK.md` shows all ✅ |
| P5 | Pipeline package exists | `test -f packages/pipeline/src/index.ts` |
| P6 | Research prototype assets exist | `test -f research/models/attention-prototype/attention_features.json` |

---

## 3. Command Runway

### Stage 1: Attention Feature Engineering (L1)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | — | ⏾ | `cat research/models/attention-prototype/attention_features.json` | 20 feature names | Log missing, regenerate from prototype |
| C2 | — | ⏾ | `cat research/models/attention-prototype/attention_prototype.py \| head -100` | Feature extraction logic | Port manually from Python |
| C3 | — | ✎ | `mkdir -p packages/ml/attention/features/src packages/ml/attention/features/tests` | Dir structure created | Retry mkdir |
| C4 | C3 | ✎ | `write_file packages/ml/attention/features/package.json` | Package config with @tensorflow/tfjs-node | Fix JSON syntax |
| C5 | C3 | ✎ | `write_file packages/ml/attention/features/src/index.ts` | `extractAttentionFeatures()` implementation | Re-read prototype, patch |
| C6 | C3 | ✎ | `write_file packages/ml/attention/features/src/index.test.ts` | Unit tests: synthetic evidence → 20-dim vector | Fix test expectations |
| C7 | C4,C5,C6 | ✓ | `pnpm --filter @verified-attention/ml-attention-features typecheck` | Exit 0 | Fix TS errors, re-run |
| C8 | C7 | ✓ | `pnpm --filter @verified-attention/ml-attention-features test` | All tests pass | Debug failing tests |
| C9 | C8 | ✓ | `pnpm --filter @verified-attention/ml-attention-features build` | dist/ created | Fix build errors |

### Stage 2: Attention Behaviour Model (L2)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C10 | C9 | ⏾ | `cat research/models/attention-prototype/attention_prototype.py` | Full training logic | Port manually |
| C11 | C10 | ✎ | `mkdir -p packages/ml/attention/model/src packages/ml/attention/model/tests` | Dir structure | Retry |
| C12 | C11 | ✎ | `write_file packages/ml/attention/model/package.json` | Package config with ml-attention-features dep | Fix JSON |
| C13 | C11 | ✎ | `write_file packages/ml/attention/model/src/index.ts` | `AttentionModel` class (GRU, train/predict/save/load) | Iterate on architecture |
| C14 | C11 | ✎ | `write_file packages/ml/attention/model/src/index.test.ts` | Tests: train on synthetic, predict, save/load, AUC check | Adjust thresholds |
| C15 | C12,C13,C14 | ✓ | `pnpm --filter @verified-attention/ml-attention-model typecheck` | Exit 0 | Fix TS errors |
| C16 | C15 | ✓ | `pnpm --filter @verified-attention/ml-attention-model test` | All pass, AUC ≥ 0.95 logged | Retrain with more data / tune hyperparams |
| C17 | C16 | ✓ | `pnpm --filter @verified-attention/ml-attention-model build` | dist/ created | Fix build |

### Stage 3: Model Serving (L3)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C18 | C17 | ✎ | `mkdir -p apps/ml-serving/attention/src apps/ml-serving/attention/tests` | Dir structure | Retry |
| C19 | C18 | ✎ | `write_file apps/ml-serving/attention/package.json` | Package config with deps | Fix JSON |
| C20 | C18 | ✎ | `write_file apps/ml-serving/attention/src/index.ts` | Fastify server + `/predict` endpoint + gRPC | Fix routing |
| C21 | C18 | ✎ | `write_file apps/ml-serving/attention/src/index.test.ts` | Test: /predict returns confidence, p99 < 50ms | Benchmark tuning |
| C22 | C19,C20,C21 | ✓ | `pnpm --filter @verified-attention/ml-serving-attention typecheck` | Exit 0 | Fix TS |
| C23 | C22 | ✓ | `pnpm --filter @verified-attention/ml-serving-attention test` | Tests pass, latency check | Optimize / fix |
| C24 | C23 | ✓ | `pnpm --filter @verified-attention/ml-serving-attention build` | dist/ created | Fix build |

### Stage 4: Model Versioning & Canary (L4)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C25 | C24 | ✎ | `mkdir -p apps/ml-serving/infra/src apps/ml-serving/infra/tests` | Dir structure | Retry |
| C26 | C25 | ✎ | `write_file apps/ml-serving/infra/package.json` | Package config | Fix JSON |
| C27 | C25 | ✎ | `write_file apps/ml-serving/infra/src/index.ts` | ModelRegistry, A/B router, CanaryDeployer classes | Iterate design |
| C28 | C25 | ✎ | `write_file apps/ml-serving/infra/src/index.test.ts` | Tests: versioning, A/B split, canary rollout, rollback | Fix logic |
| C29 | C26,C27,C28 | ✓ | `pnpm --filter @verified-attention/ml-serving-infra typecheck` | Exit 0 | Fix TS |
| C30 | C29 | ✓ | `pnpm --filter @verified-attention/ml-serving-infra test` | All pass | Fix tests |
| C31 | C30 | ✓ | `pnpm --filter @verified-attention/ml-serving-infra build` | dist/ created | Fix build |

### Stage 5: Drift Detection (L5)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C32 | C31 | ✎ | `mkdir -p packages/ml/attention/drift/src packages/ml/attention/drift/tests` | Dir structure | Retry |
| C33 | C32 | ✎ | `write_file packages/ml/attention/drift/package.json` | Package config | Fix JSON |
| C34 | C32 | ✎ | `write_file packages/ml/attention/drift/src/index.ts` | `detectDrift()` with KS test + PSI | Validate stats |
| C35 | C32 | ✎ | `write_file packages/ml/attention/drift/src/index.test.ts` | Tests: known drift → alert, no drift → silent | Adjust thresholds |
| C36 | C33,C34,C35 | ✓ | `pnpm --filter @verified-attention/ml-attention-drift typecheck` | Exit 0 | Fix TS |
| C37 | C36 | ✓ | `pnpm --filter @verified-attention/ml-attention-drift test` | All pass | Fix tests |
| C38 | C37 | ✓ | `pnpm --filter @verified-attention/ml-attention-drift build` | dist/ created | Fix build |

### Stage 6: Automated Retraining (L6)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C39 | C38 | ✎ | `mkdir -p packages/ml/attention/retrain/src packages/ml/attention/retrain/tests` | Dir structure | Retry |
| C40 | C39 | ✎ | `write_file packages/ml/attention/retrain/package.json` | Package config | Fix JSON |
| C41 | C39 | ✎ | `write_file packages/ml/attention/retrain/src/index.ts` | `runRetrainPipeline()` weekly cron logic | Iterate |
| C42 | C39 | ✎ | `write_file packages/ml/attention/retrain/src/index.test.ts` | Tests: pipeline runs, promotes on AUC improvement | Mock time/data |
| C43 | C40,C41,C42 | ✓ | `pnpm --filter @verified-attention/ml-attention-retrain typecheck` | Exit 0 | Fix TS |
| C44 | C43 | ✓ | `pnpm --filter @verified-attention/ml-attention-retrain test` | All pass | Fix tests |
| C45 | C44 | ✓ | `pnpm --filter @verified-attention/ml-attention-retrain build` | dist/ created | Fix build |

### Stage 7: Conformance — Deterministic Inference (L7)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C46 | C45 | ⏾ | `grep -r "ml-determinism" packages/ml/attention/model/tests/ 2>/dev/null || echo "ADD_TEST"` | Test location | Add test to model package |
| C47 | C46 | ✎ | `patch packages/ml/attention/model/src/index.test.ts` add determinism test | 100 identical inputs → identical outputs | Fix seed logic |
| C48 | C47 | ✓ | `pnpm test --filter=@verified-attention/ml-attention-model -- --testPathPattern=ml-determinism` | Exit 0 | Debug non-determinism |
| C49 | C48 | ✓ | `pnpm test --filter=@verified-attention/ml-attention-features -- --testPathPattern=ml-determinism` | Exit 0 | Fix feature extraction |

### Stage 8: Integration Test (L8)

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C50 | C49 | ⏾ | `mkdir -p packages/pipeline/tests/integration` | Integration test dir | Retry |
| C51 | C50 | ✎ | `write_file packages/pipeline/tests/integration/attention-ml.test.ts` | Pipeline → features → model → confidence | Debug wiring |
| C52 | C51 | ✓ | `pnpm test --filter=@verified-attention/pipeline -- --testPathPattern=attention-ml` | Exit 0, confidence score in range | Fix integration |

### Stage 9: Global Verification

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C53 | C52 | ✓ | `pnpm --filter @verified-attention/ml-attention-features typecheck && pnpm --filter @verified-attention/ml-attention-features build` | Exit 0 | Fix |
| C54 | C53 | ✓ | `pnpm --filter @verified-attention/ml-attention-model typecheck && pnpm --filter @verified-attention/ml-attention-model build` | Exit 0 | Fix |
| C55 | C54 | ✓ | `pnpm --filter @verified-attention/ml-attention-drift typecheck && pnpm --filter @verified-attention/ml-attention-drift build` | Exit 0 | Fix |
| C56 | C55 | ✓ | `pnpm --filter @verified-attention/ml-attention-retrain typecheck && pnpm --filter @verified-attention/ml-attention-retrain build` | Exit 0 | Fix |
| C57 | C56 | ✓ | `pnpm --filter @verified-attention/ml-serving-attention typecheck && pnpm --filter @verified-attention/ml-serving-attention build` | Exit 0 | Fix |
| C58 | C57 | ✓ | `pnpm --filter @verified-attention/ml-serving-infra typecheck && pnpm --filter @verified-attention/ml-serving-infra build` | Exit 0 | Fix |
| C59 | C58 | ✓ | `pnpm test --filter=@verified-attention/pipeline` | All pipeline tests pass (132+) | Fix regressions |
| C60 | C59 | ✓ | `pnpm test` (full suite) | All tests pass | Fix any breakage |

---

## 4. Execution Log

_Filled in during execution. Capture reality — failures and retries are logged, not hidden._

| Cmd# | Deps | Start | End | Exit | Retry# | Output Summary / Artifact Hash |
|------|------|-------|-----|------|--------|--------------------------------|
| C1 | — | | | | | |
| C2 | — | | | | | |
| C3 | — | | | | | |
| C4 | C3 | | | | | |
| C5 | C3 | | | | | |
| C6 | C3 | | | | | |
| C7 | C4,C5,C6 | | | | | |
| C8 | C7 | | | | | |
| C9 | C8 | | | | | |
| C10 | C9 | | | | | |
| C11 | C10 | | | | | |
| C12 | C11 | | | | | |
| C13 | C11 | | | | | |
| C14 | C11 | | | | | |
| C15 | C12,C13,C14 | | | | | |
| C16 | C15 | | | | | |
| C17 | C16 | | | | | |
| C18 | C17 | | | | | |
| C19 | C18 | | | | | |
| C20 | C18 | | | | | |
| C21 | C18 | | | | | |
| C22 | C19,C20,C21 | | | | | |
| C23 | C22 | | | | | |
| C24 | C23 | | | | | |
| C25 | C24 | | | | | |
| C26 | C25 | | | | | |
| C27 | C25 | | | | | |
| C28 | C25 | | | | | |
| C29 | C26,C27,C28 | | | | | |
| C30 | C29 | | | | | |
| C31 | C30 | | | | | |
| C32 | C31 | | | | | |
| C33 | C32 | | | | | |
| C34 | C32 | | | | | |
| C35 | C32 | | | | | |
| C36 | C33,C34,C35 | | | | | |
| C37 | C36 | | | | | |
| C38 | C37 | | | | | |
| C39 | C38 | | | | | |
| C40 | C39 | | | | | |
| C41 | C39 | | | | | |
| C42 | C39 | | | | | |
| C43 | C40,C41,C42 | | | | | |
| C44 | C43 | | | | | |
| C45 | C44 | | | | | |
| C46 | C45 | | | | | |
| C47 | C46 | | | | | |
| C48 | C47 | | | | | |
| C49 | C48 | | | | | |
| C50 | C49 | | | | | |
| C51 | C50 | | | | | |
| C52 | C51 | | | | | |
| C53 | C52 | | | | | |
| C54 | C53 | | | | | |
| C55 | C54 | | | | | |
| C56 | C55 | | | | | |
| C57 | C56 | | | | | |
| C58 | C57 | | | | | |
| C59 | C58 | | | | | |
| C60 | C59 | | | | | |

---

## 5. Goal Verification

_Local checks after stage commands. Global checks at stage completion._

### Local Goal Checks
- **L1**: `grep -n "extractAttentionFeatures" packages/ml/attention/features/src/index.ts` → function exists ⬜
- **L2**: `grep -n "class AttentionModel" packages/ml/attention/model/src/index.ts` → class exists ⬜
- **L3**: `curl -X POST localhost:8080/predict -d '{"features": [...]}'` → confidence 0–1, p99 < 50ms ⬜
- **L4**: `grep -n "CanaryDeployer" apps/ml-serving/infra/src/index.ts` → class exists ⬜
- **L5**: `grep -n "detectDrift" packages/ml/attention/drift/src/index.ts` → function exists ⬜
- **L6**: `grep -n "runRetrainPipeline" packages/ml/attention/retrain/src/index.ts` → function exists ⬜
- **L7**: `pnpm test --filter=@verified-attention/ml-attention-model -- --testPathPattern=ml-determinism` exits 0 ⬜
- **L8**: `pnpm test --filter=@verified-attention/pipeline -- --testPathPattern=attention-ml` exits 0 ⬜

### Global Regression Quick-Checks (at stage completion)
- **G3**: `pnpm test:integration --filter=@verified-attention/pipeline` passes ⬜
- **G16**: Observability dashboards render, alerts fire on synthetic drift ⬜
- **G17**: Load test 10K evidence/sec, p99 < 500ms ⬜

---

## 6. Iteration & Notes

- **Deviations from runway**: 
- **Blockers**: 
- **Commands that needed rework**: 
- **Lessons learned**: 
- **Next runways**: Sprint 9 (Fraud Intelligence), Sprint 10 (Verification Hardening)

---

## 7. Machine-Readable Extension (JSON)

```json
{
  "task_id": "sprint-8-attention-intelligence",
  "status": "Planned",
  "goals": {
    "local": [
      {"id": "L1", "description": "Attention feature engineering", "assert": {"cmd": "grep -n 'extractAttentionFeatures' packages/ml/attention/features/src/index.ts", "exit_code": 0}},
      {"id": "L2", "description": "Attention behaviour model (AUC ≥ 0.95)", "assert": {"cmd": "pnpm --filter @verified-attention/ml-attention-model test", "exit_code": 0}},
      {"id": "L3", "description": "Model serving p99 < 50ms", "assert": {"cmd": "pnpm --filter @verified-attention/ml-serving-attention test", "exit_code": 0}},
      {"id": "L4", "description": "Model versioning, A/B, canary", "assert": {"cmd": "pnpm --filter @verified-attention/ml-serving-infra test", "exit_code": 0}},
      {"id": "L5", "description": "Drift detection (KS + PSI)", "assert": {"cmd": "pnpm --filter @verified-attention/ml-attention-drift test", "exit_code": 0}},
      {"id": "L6", "description": "Automated retraining pipeline", "assert": {"cmd": "pnpm --filter @verified-attention/ml-attention-retrain test", "exit_code": 0}},
      {"id": "L7", "description": "Conformance deterministic inference", "assert": {"cmd": "pnpm test --filter=@verified-attention/ml-attention-model -- --testPathPattern=ml-determinism", "exit_code": 0}},
      {"id": "L8", "description": "Integration pipeline→model→confidence", "assert": {"cmd": "pnpm test --filter=@verified-attention/pipeline -- --testPathPattern=attention-ml", "exit_code": 0}}
    ],
    "global": ["G3", "G16", "G17"]
  },
  "preconditions": [
    {"id": "P1", "check": "node --version", "expect_regex": "v2[0-9]\\."},
    {"id": "P2", "check": "pnpm --version", "expect_regex": "9\\."},
    {"id": "P3", "check": "pnpm install", "expect_exit": 0},
    {"id": "P4", "check": "test -f docs/sprint-07/RUNBOOK.md", "expect_exit": 0},
    {"id": "P5", "check": "test -f packages/pipeline/src/index.ts", "expect_exit": 0},
    {"id": "P6", "check": "test -f research/models/attention-prototype/attention_features.json", "expect_exit": 0}
  ],
  "stages": [
    {"id": "Stage1", "name": "Attention Feature Engineering", "commands": ["C1","C2","C3","C4","C5","C6","C7","C8","C9"], "completion": "C9 exits 0"},
    {"id": "Stage2", "name": "Attention Behaviour Model", "commands": ["C10","C11","C12","C13","C14","C15","C16","C17"], "completion": "C17 exits 0"},
    {"id": "Stage3", "name": "Model Serving", "commands": ["C18","C19","C20","C21","C22","C23","C24"], "completion": "C24 exits 0"},
    {"id": "Stage4", "name": "Model Versioning & Canary", "commands": ["C25","C26","C27","C28","C29","C30","C31"], "completion": "C31 exits 0"},
    {"id": "Stage5", "name": "Drift Detection", "commands": ["C32","C33","C34","C35","C36","C37","C38"], "completion": "C38 exits 0"},
    {"id": "Stage6", "name": "Automated Retraining", "commands": ["C39","C40","C41","C42","C43","C44","C45"], "completion": "C45 exits 0"},
    {"id": "Stage7", "name": "Conformance Determinism", "commands": ["C46","C47","C48","C49"], "completion": "C49 exits 0"},
    {"id": "Stage8", "name": "Integration Test", "commands": ["C50","C51","C52"], "completion": "C52 exits 0"},
    {"id": "Stage9", "name": "Global Verification", "commands": ["C53","C54","C55","C56","C57","C58","C59","C60"], "completion": "C60 exits 0"}
  ]
}
```

---

## Execution Rules (Mandatory)

1. ⏾ commands complete before ✎ in the same stage
2. No stage closes until its ✓ commands pass
3. On ✓ failure: stop, diagnose (Section 6), retry — don't advance
4. Every command is atomic: one tool invocation
5. No implicit steps — if not in the table, it doesn't happen
6. Failures logged with Retry# — never hidden
7. Local checks per command; global checks per stage (not per command)
8. Never weaken an assertion to pass — fix the implementation or the test
9. Update "Last Updated" timestamp on every edit or log entry