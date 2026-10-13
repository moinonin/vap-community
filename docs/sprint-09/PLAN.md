# PLAN.md — Sprint 9: Fraud Intelligence - Detection Models

**Task ID**: sprint-9-fraud-intelligence
**Spec**: `docs/sprint-09/spec.yaml`
**Dependencies**: Sprint 8 (ML serving infra, feature pipeline)
**Status**: PLANNED — implementation follows Sprint 8

---

## 1. Sprint 9 Deliverable Audit (SPRINTS.md)

| Task | Deliverable | Status |
|------|-------------|--------|
| Behavioural biometrics features | `packages/ml/fraud/biometrics/` | 📝 Planned |
| Device fingerprinting (entropy ≥ 18 bits) | `packages/ml/fraud/fingerprint/` | 📝 Planned |
| Automation detection (≥ 99% rate) | `packages/ml/fraud/automation/` | 📝 Planned |
| Sybil detection (graph clustering) | `packages/ml/fraud/sybil/` | 📝 Planned |
| Reputation scoring (time-decayed) | `packages/ml/fraud/reputation/` | 📝 Planned |
| Fraud ensemble model (AUC ≥ 0.98, P ≥ 0.95 @ 0.1% FPR) | `packages/ml/fraud/ensemble/` | 📝 Planned |
| Fraud model serving (shared infra) | `apps/ml-serving/fraud/` | 📝 Planned |
| Conformance: deterministic scores | `tests/conformance/fraud-determinism/` | 📝 Planned |
| Integration: fraud signals → verification engine | `tests/integration/fraud-verification/` | 📝 Planned |

---

## 2. Architecture Decisions

### ML Framework: **XGBoost (native) + TensorFlow.js (neural)**
- XGBoost for gradient boosting ensemble (best for tabular fraud features)
- TensorFlow.js for neural component (autoencoder for anomaly detection)
- Both run in Node.js via native bindings
- Deterministic with fixed seed

### Feature Categories

**Biometrics** (mouse, keystroke, pressure):
- Mouse curvature, velocity, acceleration, pause patterns
- Keystroke hold time, flight time, pressure (if available)
- Touch pressure, swipe velocity (mobile)

**Device Fingerprinting** (browser, canvas, WebGL, audio, battery):
- Canvas fingerprint (hash of rendered image)
- WebGL renderer/vendor/extensions
- AudioContext fingerprint
- Battery API (if available)
- Screen resolution, color depth, timezone, language
- Target entropy: ≥ 18 bits

**Automation Detection**:
- Headless Chrome flags (`navigator.webdriver`, `--headless`)
- Puppeteer/Selenium/Playwright specific properties
- Timing anomalies (too-fast interactions)
- Missing browser APIs

**Sybil Detection**:
- IP clustering (subnet /24, /16)
- Device fingerprint correlation across sessions
- Velocity checks (impossible travel, session frequency)
- Graph-based community detection

**Reputation Scoring**:
- Device reputation (historical fraud rate)
- IP reputation (abuse databases, ASN reputation)
- Subnet/ASN reputation
- Time-decayed weights (half-life ~30 days)

### Ensemble Architecture
- **Gradient Boosting** (XGBoost): main classifier on engineered features
- **Neural Autoencoder**: anomaly detection on raw feature vectors
- **Meta-learner**: weighted combination (configurable)
- Output: calibrated fraud probability [0, 1]

### Target Metrics
- AUC ≥ 0.98 on held-out test
- Precision ≥ 0.95 at 0.1% FPR
- Deterministic: same input → same score

---

## 3. Package Structure

```
packages/
  ml/
    fraud/
      biometrics/        # @verified-attention/ml-fraud-biometrics
        src/index.ts     # extractBiometricFeatures(observations) -> number[]
      fingerprint/       # @verified-attention/ml-fraud-fingerprint
        src/index.ts     # fingerprintDevice(clientData) -> FingerprintResult
      automation/        # @verified-attention/ml-fraud-automation
        src/index.ts     # detectAutomation(clientData) -> AutomationResult
      sybil/             # @verified-attention/ml-fraud-sybil
        src/index.ts     # detectSybil(sessions) -> SybilResult
      reputation/        # @verified-attention/ml-fraud-reputation
        src/index.ts     # calculateReputation(entityId, type) -> ReputationScore
      ensemble/          # @verified-attention/ml-fraud-ensemble
        src/index.ts     # FraudEnsemble class (predict, train, save, load)
```

```
apps/
  ml-serving/
    fraud/               # @verified-attention/ml-serving-fraud
      src/index.ts       # HTTP/gRPC /predict endpoint (shared infra with attention)
```

---

## 4. Implementation Stages

### Stage 1: Biometrics Features (L1)
- Extract from observation payloads (mouse, keyboard, touch)
- Normalize to fixed-length vector
- Unit tests with synthetic observation sequences

### Stage 2: Device Fingerprinting (L2)
- Collect client-side signals (canvas, WebGL, audio, battery, screen, nav)
- Compute entropy, verify ≥ 18 bits
- Stable across sessions for same device

### Stage 3: Automation Detection (L3)
- Detect headless, Puppeteer, Selenium, Playwright signatures
- Timing anomaly detection
- Target: ≥ 99% detection on known tools

### Stage 4: Sybil Detection (L4)
- Graph construction: nodes = sessions, edges = shared IP/device/fingerprint
- Community detection (Louvain/Label Propagation)
- Alert on suspicious clusters

### Stage 5: Reputation Scoring (L5)
- Time-decayed scoring per entity (device, IP, subnet, ASN)
- Configurable half-life, minimum observations
- Integration with external threat intel (optional)

### Stage 6: Fraud Ensemble Model (L6)
- Train XGBoost + neural autoencoder on labeled fraud data
- Combine via meta-learner
- Validate AUC ≥ 0.98, P ≥ 0.95 @ 0.1% FPR
- Calibration (isotonic) for probability output

### Stage 7: Fraud Model Serving (L7)
- Shared infrastructure with attention serving
- `/predict` endpoint accepting fraud feature vector
- Returns fraud probability + component scores

### Stage 8: Conformance Tests (L8)
- Deterministic inference (fixed seed)
- Feature extraction determinism
- Model save/load round-trip

### Stage 9: Integration Tests (L9)
- Fraud score → verification engine policy → FAIL outcome
- High fraud score triggers FAIL regardless of confidence

---

## 5. Research Prototype Assets to Port

From `research/models/fraud-prototype/`:
- `fraud_prototype.py` → feature engineering, model training logic
- `fraud_features.json` → feature names/order
- `fraud_evaluation.json` → AUC, metrics (validate against)
- `fraud_model.joblib` → reference model (convert or retrain)

---

## 6. Dependencies to Add

```json
// packages/ml/fraud/biometrics/package.json
{
  "dependencies": {
    "@verified-attention/core": "workspace:*"
  }
}

// packages/ml/fraud/fingerprint/package.json
{
  "dependencies": {
    "@verified-attention/core": "workspace:*"
  }
}

// packages/ml/fraud/automation/package.json
{
  "dependencies": {
    "@verified-attention/core": "workspace:*"
  }
}

// packages/ml/fraud/sybil/package.json
{
  "dependencies": {
    "@verified-attention/core": "workspace:*",
    "graphology": "^0.25.0"
  }
}

// packages/ml/fraud/reputation/package.json
{
  "dependencies": {
    "@verified-attention/core": "workspace:*"
  }
}

// packages/ml/fraud/ensemble/package.json
{
  "dependencies": {
    "@verified-attention/ml-fraud-biometrics": "workspace:*",
    "@verified-attention/ml-fraud-fingerprint": "workspace:*",
    "@verified-attention/ml-fraud-automation": "workspace:*",
    "@verified-attention/ml-fraud-sybil": "workspace:*",
    "@verified-attention/ml-fraud-reputation": "workspace:*",
    "xgboost": "^3.0.0",
    "@tensorflow/tfjs-node": "^4.22.0"
  }
}

// apps/ml-serving/fraud/package.json
{
  "dependencies": {
    "@verified-attention/ml-fraud-ensemble": "workspace:*",
    "fastify": "^4.28.0",
    "@grpc/grpc-js": "^1.10.0"
  }
}
```

---

## 7. Verification Commands

```bash
# Biometrics
pnpm --filter @verified-attention/ml-fraud-biometrics test

# Fingerprinting
pnpm --filter @verified-attention/ml-fraud-fingerprint test

# Automation
pnpm --filter @verified-attention/ml-fraud-automation test

# Sybil
pnpm --filter @verified-attention/ml-fraud-sybil test

# Reputation
pnpm --filter @verified-attention/ml-fraud-reputation test

# Ensemble
pnpm --filter @verified-attention/ml-fraud-ensemble test

# Fraud serving
pnpm --filter @verified-attention/ml-serving-fraud test

# Conformance: deterministic
pnpm test --filter=@verified-attention/ml-fraud-ensemble -- --testPathPattern=fraud-determinism

# Integration: fraud → verification
pnpm test --filter=@verified-attention/verification -- --testPathPattern=fraud-verification

# Full typecheck + build
pnpm --filter @verified-attention/ml-fraud-biometrics typecheck && pnpm --filter @verified-attention/ml-fraud-biometrics build
pnpm --filter @verified-attention/ml-fraud-fingerprint typecheck && pnpm --filter @verified-attention/ml-fraud-fingerprint build
pnpm --filter @verified-attention/ml-fraud-automation typecheck && pnpm --filter @verified-attention/ml-fraud-automation build
pnpm --filter @verified-attention/ml-fraud-sybil typecheck && pnpm --filter @verified-attention/ml-fraud-sybil build
pnpm --filter @verified-attention/ml-fraud-reputation typecheck && pnpm --filter @verified-attention/ml-fraud-reputation build
pnpm --filter @verified-attention/ml-fraud-ensemble typecheck && pnpm --filter @verified-attention/ml-fraud-ensemble build
pnpm --filter @verified-attention/ml-serving-fraud typecheck && pnpm --filter @verified-attention/ml-serving-fraud build
```