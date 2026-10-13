# PLAN.md — Sprint 8: Attention Intelligence - Behaviour Models

**Task ID**: sprint-8-attention-intelligence
**Spec**: `docs/sprint-08/spec.yaml`
**Dependencies**: Sprint 7 (pipeline produces enriched evidence with features)
**Status**: PLANNED — implementation to follow

---

## 1. Sprint 8 Deliverable Audit (SPRINTS.md)

| Task | Deliverable | Status |
|------|-------------|--------|
| Attention feature engineering | `packages/ml/attention/features/` | 📝 Planned |
| Attention behaviour model (Transformer/GRU, AUC ≥ 0.95) | `packages/ml/attention/model/` | 📝 Planned |
| Model serving (gRPC/REST, batch + streaming, p99 < 50ms) | `apps/ml-serving/attention/` | 📝 Planned |
| Model versioning, A/B routing, canary | `apps/ml-serving/infra/` | 📝 Planned |
| Drift detection (KS test, PSI) | `packages/ml/attention/drift/` | 📝 Planned |
| Automated retraining pipeline | `packages/ml/attention/retrain/` | 📝 Planned |
| Conformance: deterministic outputs | `tests/conformance/ml-determinism/` | 📝 Planned |
| Integration: pipeline → features → model → confidence | `tests/integration/attention-ml/` | 📝 Planned |

---

## 2. Architecture Decisions

### ML Framework: **TensorFlow.js + @tensorflow/tfjs-node**
- Native Node.js bindings, no Python dependency
- Supports GRU, LSTM, Transformer layers
- Model save/load in TF.js format (compatible with TF Python via converter)
- Deterministic inference with fixed seed
- GPU acceleration via CUDA (optional, CPU fallback)

### Feature Schema (from research prototype)
```
E-INTERACTION: avg_scroll_velocity, scroll_direction_changes, click_count,
               keypress_count, interaction_duration_ms, engagement_score
E-VISIBLE:     visible_duration_ms, max_visibility_ratio, avg_visibility_ratio
E-DURATION:    session_duration_ms, active_duration_ms, idle_duration_ms, heartbeat_count
E-CONTEXT:     platform (browser/mobile/desktop) — one-hot
```

### Model Architecture
- **Input**: 20 features (normalized)
- **Encoder**: 2-layer GRU (hidden=64) or Transformer (4 heads, 2 layers, d_model=64)
- **Output**: Single sigmoid unit → probability of genuine attention
- **Target AUC**: ≥ 0.95 on held-out human vs. bot data

### Determinism Requirements
- Fixed random seed (42) for weight initialization
- Fixed seed for data shuffling during training
- Inference: no dropout, batch norm in eval mode
- Same input → bitwise identical output

---

## 3. Package Structure

```
packages/
  ml/
    attention/
      features/          # @verified-attention/ml-attention-features
        src/index.ts     # extractAttentionFeatures(evidence) -> number[]
        src/index.test.ts
        package.json
      model/             # @verified-attention/ml-attention-model
        src/index.ts     # AttentionModel class (train, predict, save, load)
        src/index.test.ts
        package.json
      drift/             # @verified-attention/ml-attention-drift
        src/index.ts     # detectDrift(reference, current) -> DriftResult
        src/index.test.ts
        package.json
      retrain/           # @verified-attention/ml-attention-retrain
        src/index.ts     # runRetrainPipeline() -> RetrainResult
        src/index.test.ts
        package.json
```

```
apps/
  ml-serving/
    attention/           # @verified-attention/ml-serving-attention
      src/index.ts       # HTTP/gRPC server, /predict endpoint
      src/index.test.ts
      package.json
    infra/               # @verified-attention/ml-serving-infra
      src/index.ts       # Versioning, A/B routing, canary logic
      src/index.test.ts
      package.json
```

---

## 4. Implementation Stages

### Stage 1: Attention Feature Engineering (L1)
- Create `packages/ml/attention/features/`
- Implement `extractAttentionFeatures(evidence: Evidence[])` → normalized feature vector (20 dims)
- Features match research prototype schema exactly
- Unit tests with synthetic evidence

### Stage 2: Attention Behaviour Model (L2)
- Create `packages/ml/attention/model/`
- Implement `AttentionModel` class with:
  - `train(trainingData: FeatureVector[], labels: number[])` → ModelArtifacts
  - `predict(features: FeatureVector)` → probability (0–1)
  - `save(path)` / `load(path)` for model persistence
- Architecture: 2-layer GRU (64 hidden) + dense(1, sigmoid)
- Training script using synthetic data generator (ported from Python prototype)
- Target AUC ≥ 0.95

### Stage 3: Model Serving (L3)
- Create `apps/ml-serving/attention/`
- Fastify/Express server with `/predict` endpoint (POST batch)
- gRPC service definition for high-throughput internal calls
- Request validation, response with confidence + metadata
- p99 < 50ms benchmark test

### Stage 4: Model Versioning & Canary (L4)
- Create `apps/ml-serving/infra/`
- Model registry: version → model artifacts + metadata
- A/B routing: percentage traffic to candidate version
- Canary deployment: gradual rollout with health checks
- Rollback < 1 minute

### Stage 5: Drift Detection (L5)
- Create `packages/ml/attention/drift/`
- Implement:
  - KS test for feature distribution shift
  - Population Stability Index (PSI) for feature importance shift
  - Prediction distribution monitoring
- Alert thresholds: KS p-value < 0.01, PSI > 0.25
- Integration with observability metrics

### Stage 6: Automated Retraining (L6)
- Create `packages/ml/attention/retrain/`
- Pipeline: collect recent evidence → extract features → label (via verification outcomes) → train → validate → promote if AUC improves
- Weekly cron trigger (configurable)
- Artifact versioning, rollback on regression

### Stage 7: Conformance Tests (L7)
- Deterministic inference test: same input × 100 = identical output
- Feature extraction determinism
- Model save/load round-trip

### Stage 8: Integration Tests (L8)
- End-to-end: pipeline evidence → features → model → confidence score
- Verify confidence feeds into verification engine

---

## 5. Research Prototype Assets to Port

From `research/models/attention-prototype/`:
- `attention_prototype.py` → feature engineering logic, synthetic data generator
- `attention_features.json` → feature names/order (20 features)
- `attention_evaluation.json` → AUC 0.9999, feature importances (validate against)
- `attention_model.joblib` → reference model (convert to TF.js or retrain)

---

## 6. Dependencies to Add

```json
// packages/ml/attention/features/package.json
{
  "dependencies": {
    "@verified-attention/core": "workspace:*",
    "@tensorflow/tfjs-node": "^4.22.0"
  }
}

// packages/ml/attention/model/package.json
{
  "dependencies": {
    "@verified-attention/ml-attention-features": "workspace:*",
    "@tensorflow/tfjs-node": "^4.22.0"
  }
}

// apps/ml-serving/attention/package.json
{
  "dependencies": {
    "@verified-attention/ml-attention-model": "workspace:*",
    "fastify": "^4.28.0",
    "@grpc/grpc-js": "^1.10.0",
    "@grpc/proto-loader": "^0.7.0"
  }
}
```

---

## 7. Verification Commands

```bash
# Feature extraction
pnpm --filter @verified-attention/ml-attention-features test

# Model training + inference
pnpm --filter @verified-attention/ml-attention-model test

# Drift detection
pnpm --filter @verified-attention/ml-attention-drift test

# Retraining pipeline
pnpm --filter @verified-attention/ml-attention-retrain test

# Model serving
pnpm --filter @verified-attention/ml-serving-attention test

# ML infra (versioning, canary)
pnpm --filter @verified-attention/ml-serving-infra test

# Conformance: deterministic
pnpm test --filter=@verified-attention/ml-attention-model -- --testPathPattern=ml-determinism

# Integration
pnpm test --filter=@verified-attention/pipeline -- --testPathPattern=attention-ml

# Full typecheck + build
pnpm --filter @verified-attention/ml-attention-features typecheck && pnpm --filter @verified-attention/ml-attention-features build
pnpm --filter @verified-attention/ml-attention-model typecheck && pnpm --filter @verified-attention/ml-attention-model build
pnpm --filter @verified-attention/ml-attention-drift typecheck && pnpm --filter @verified-attention/ml-attention-drift build
pnpm --filter @verified-attention/ml-attention-retrain typecheck && pnpm --filter @verified-attention/ml-attention-retrain build
pnpm --filter @verified-attention/ml-serving-attention typecheck && pnpm --filter @verified-attention/ml-serving-attention build
pnpm --filter @verified-attention/ml-serving-infra typecheck && pnpm --filter @verified-attention/ml-serving-infra build
```