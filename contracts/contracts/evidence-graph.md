# Evidence Graph Specification (S9 — Proprietary Attention Evidence Dataset)

**Status**: Draft / Proposed  
**Sprint**: S9 (Moat: Build proprietary evidence dataset)  
**Related**: `fraud-attack-generator.ts`, `privacy-regression-fixtures.ts`

---

## Purpose

Define the structure, provenance, and calibration pipeline for the **proprietary evidence graph** — a continuously expanding dataset of human digital attention sessions with ground-truth labels, calibrated models, and measurable verification accuracy. This is the core moat per improvement feedback.

---

## Evidence Graph Architecture

```
Observation (raw signals)
    │
    ├── device_signal (mouse, keyboard, touch, scroll)
    ├── viewport (visibility, position, size)
    ├── interaction (clicks, hovers, focus events)
    ├── timing (duration, latency, intervals)
    ├── content_visibility (element in view, obscuration)
    ├── focus_state (tab active, window focused)
    ├── behavioral_sequence (patterns, anomalies)
    └── environmental_signals (device, OS, network, timezone)
              │
              ▼
        Evidence Graph (validated, immutable records)
              │
       ┌──────┴──────┐
       ▼             ▼
Attention Model   Fraud Model
       │             │
       └──────┬──────┘
              ▼
           Claim (e.g., "human_attended_content")
              │
              ▼
        Confidence (calibrated 0.0–1.0)
              │
              ▼
        Cryptographic Proof (PoA)
```

---

## Data Schema

### Evidence Record

```typescript
interface EvidenceRecord {
  // Provenance
  evidenceId: string;           // UUID v4
  sessionId: string;            // Session correlation
  sourceId: string;             // SDK/device identifier
  timestamp: string;            // ISO 8601
  schemaVersion: number;        // Evidence schema version

  // Signal categories
  deviceSignal: DeviceSignal;   // Mouse, keyboard, touch, scroll
  viewport: ViewportSignal;     // Visibility, position, obscuration
  interaction: InteractionSignal; // Clicks, hovers, focus
  timing: TimingSignal;         // Durations, intervals, latency
  contentVisibility: VisibilitySignal; // In-view, obscuration %
  focusState: FocusSignal;      // Tab/window focus
  behavioralSequence: SequenceSignal; // Pattern analysis
  environment: EnvironmentSignal; // Device, OS, network

  // Validation
  integrityHash: string;        // SHA-256 of canonical evidence
  validatorId: string;          // Verifier that validated
  validatedAt: string;          // ISO 8601

  // Ground truth (when available)
  groundTruth?: GroundTruthLabel; // Optional: attention label from study
}
```

### Ground Truth Label

```typescript
interface GroundTruthLabel {
  label: 'ATTENTIVE' | 'DISTRACTED' | 'ABSENT' | 'UNCERTAIN';
  confidence: number;           // 0.0–1.0 label confidence
  source: 'EYE_TRACKING' | 'SELF_REPORT' | 'BEHAVIORAL_STUDY' | 'EXPERT_REVIEW';
  studyId: string;              // Reference to ground-truth study
  labeledAt: string;            // ISO 8601
  labelerId: string;            // Anonymized labeler identifier
}
```

---

## Calibration Metrics (Per Improvement Feedback)

The evidence graph must produce **measurable verification guarantees**:

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **False Positive Rate (FPR)** | < 2% | Sessions labeled ABSENT/DISTRACTED incorrectly passing |
| **False Negative Rate (FNR)** | < 5% | Sessions labeled ATTENTIVE incorrectly failing |
| **Calibration Error (ECE)** | < 0.05 | Expected Calibration Error across confidence bins |
| **Adversarial Robustness** | > 90% | Attack success rate on fraud-attack-generator.ts fixtures |
| **Replay Resistance** | 100% | Replay attack detection rate |
| **Bot Resistance** | > 95% | Synthetic bot traffic detection (sybil/automation vectors) |
| **Cross-Device Robustness** | < 0.1 ΔAUC | AUC variance across desktop/mobile/tablet |
| **Cross-Domain Generalization** | < 0.15 ΔAccuracy | Accuracy drop on unseen content domains |

---

## Data Pipeline

### 1. Collection (SDK → Evidence Pipeline)
- Browser/mobile/desktop SDKs emit raw observations
- Evidence pipeline validates, normalizes, deduplicates
- Cryptographic integrity hash computed per record

### 2. Ground Truth Subset
- Stratified sampling: 1–5% of sessions sent for ground-truth labeling
- Eye-tracking studies (partner with ATTEX-style providers)
- Behavioral studies (controlled lab environments)
- Expert review for edge cases

### 3. Model Training
- Attention model: Predict `ATTENTIVE` vs `DISTRACTED/ABSENT` from evidence
- Fraud model: Detect automation, replay, sybil, emulator vectors
- Calibration: Platt scaling / isotonic regression on holdout set

### 4. Continuous Expansion
- Every verified session → new evidence record
- Periodic retraining (weekly/monthly)
- Model versioning with performance regression tests

---

## Contract Tests (Expanded Fixtures)

### Evidence Graph Contract

```typescript
// contracts/contracts/evidence-graph.ts
export const evidenceGraphContract = {
  // Provenance requirements
  integrityHashAlgorithm: 'SHA-256',
  schemaVersion: 2,
  requiredFields: [
    'evidenceId', 'sessionId', 'sourceId', 'timestamp',
    'deviceSignal', 'viewport', 'interaction', 'timing',
    'contentVisibility', 'focusState', 'behavioralSequence', 'environment',
    'integrityHash', 'validatorId', 'validatedAt'
  ],

  // Calibration requirements
  calibration: {
    minGroundTruthSamples: 10000,
    maxCalibrationError: 0.05,
    confidenceBins: 10,
    recalibrationIntervalDays: 7,
  },

  // Performance targets
  performance: {
    maxFalsePositiveRate: 0.02,
    maxFalseNegativeRate: 0.05,
    maxCalibrationError: 0.05,
    minAdversarialRobustness: 0.90,
    minReplayResistance: 1.0,
    minBotResistance: 0.95,
    maxCrossDeviceDeltaAUC: 0.10,
    maxCrossDomainDeltaAccuracy: 0.15,
  },

  // Replay/bot resistance
  replayResistance: {
    detectionRate: 1.0,
    maxTimeWindowMs: 5000,
  },
  botResistance: {
    sybilDetectionRate: 0.95,
    automationDetectionRate: 0.95,
    emulatorDetectionRate: 0.90,
  },
};
```

---

## Integration Points

| Component | Integration |
|-----------|-------------|
| `packages/verification/src/policy.ts` | Uses evidence graph for calibration lookup |
| `contracts/contract-tests/provider-verify.js` | Validates evidence graph contract compliance |
| `fraud-attack-generator.ts` | Generates adversarial test cases for robustness |
| `privacy-regression-fixtures.ts` | Ensures privacy compliance in evidence handling |

---

## Deliverables (S9)

1. `contracts/contracts/evidence-graph.md` — This specification
2. `contracts/contracts/evidence-graph.ts` — Machine-readable contract
3. Expanded fixtures in `contracts/contracts/` with calibration metrics
4. Ground-truth labeling pipeline documentation (partner integration)
4. Model versioning + regression test suite (`packages/verification/test/calibration.test.ts`)

---

## Success Criteria

- [ ] Evidence graph schema implemented and validated
- [ ] Ground-truth pipeline operational (partner or synthetic)
- [ ] Calibration metrics meeting targets (FPR < 2%, FNR < 5%, ECE < 0.05)
- [ ] Adversarial robustness > 90% on fraud-attack-generator.ts
- [ ] Contract tests pass independently (provider-verify.js)
- [ ] Documentation in `docs/specs/0001-verified-attention-protocol.md` references evidence graph