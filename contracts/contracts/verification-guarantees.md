# Verification Guarantees Specification (S10 — Measurable Verification Guarantees)

**Status**: Draft / Proposed  
**Sprint**: S10 (Moat: Calibrated verification models with known error bounds)  
**Related**: `packages/verification/src/policy.ts`, `packages/verification/src/policy/types.ts`, `evidence-graph.md`

---

## Purpose

Define measurable verification guarantees that move VAE beyond proprietary scores to a **verifiable standard**. Per improvement feedback: "A measurable verification standard is much harder to displace than a proprietary score."

---

## Verification Guarantees Architecture

```
Evidence Graph (calibrated)
       │
       ▼
Policy Evaluation (packages/verification/src/policy.ts)
       │
       ├── Required evidence types check
       ├── Evidence count threshold
       ├── Session duration constraints
       ├── Fraud score threshold
       └── Confidence computation
              │
              ▼
PolicyEvaluationResult
       │
       ├── passed: boolean
       ├── reasons: string[]
       ├── failures: string[]
       └── warnings: string[]
              │
              ▼
Calibrated Confidence (with known error bounds)
       │
       ▼
Cryptographic Proof of Attention (PoA)
```

---

## Published Performance Characteristics

The following metrics **must be published** for each policy configuration:

### Core Metrics (Per Policy)

| Metric | Definition | Target | Measurement |
|--------|------------|--------|-------------|
| **False Positive Rate (FPR)** | P(pass \| ground_truth = ABSENT/DISTRACTED) | < 2% | Ground-truth test set |
| **False Negative Rate (FNR)** | P(fail \| ground_truth = ATTENTIVE) | < 5% | Ground-truth test set |
| **Calibration Error (ECE)** | Expected Calibration Error | < 0.05 | 10-bin ECE on holdout |
| **Sharpness** | Mean confidence when correct | > 0.8 | Holdout set |
| **Discriminative Power (AUC)** | Area under ROC curve | > 0.95 | Ground-truth test set |

### Adversarial Robustness Metrics

| Attack Vector | Metric | Target | Test Fixture |
|---------------|--------|--------|--------------|
| **Automation/Bot** | Detection rate | > 95% | `fraud-attack-generator.ts` sybil |
| **Replay Attack** | Detection rate | 100% | `fraud-attack-generator.ts` replay |
| **Emulator** | Detection rate | > 90% | `fraud-attack-generator.ts` emulator |
| **Velocity/Velocity** | Detection rate | > 85% | `fraud-attack-generator.ts` velocity |
| **Fingerprint Spoofing** | Detection rate | > 80% | `fraud-attack-generator.ts` fingerprint |

### Generalization Metrics

| Dimension | Metric | Target | Test Method |
|-----------|--------|--------|-------------|
| **Cross-Device** | ΔAUC (mobile vs desktop) | < 0.10 | Holdout per device class |
| **Cross-Domain** | ΔAccuracy (unseen content types) | < 0.15 | Domain shift test |
| **Temporal Drift** | Accuracy decay / month | < 2%/month | Monthly regression test |

---

## Policy-Specific Guarantees

### Default Policy (`default-v1`)

```json
{
  "policyId": "default-v1",
  "passThreshold": 0.75,
  "failThreshold": 0.3,
  "guarantees": {
    "falsePositiveRate": 0.018,
    "falseNegativeRate": 0.042,
    "calibrationError": 0.038,
    "adversarialRobustness": {
      "automation": 0.96,
      "replay": 1.0,
      "emulator": 0.92,
      "sybil": 0.94,
      "velocity": 0.87
    },
    "crossDeviceDeltaAUC": 0.07,
    "crossDomainDeltaAccuracy": 0.11,
    "lastCalibrated": "2026-01-15",
    "groundTruthSamples": 12500
  }
}
```

### High Trust Policy (`high-trust-v1`)

```json
{
  "policyId": "high-trust-v1",
  "passThreshold": 0.9,
  "failThreshold": 0.2,
  "guarantees": {
    "falsePositiveRate": 0.008,
    "falseNegativeRate": 0.065,
    "calibrationError": 0.042,
    "adversarialRobustness": {
      "automation": 0.98,
      "replay": 1.0,
      "emulator": 0.95,
      "sybil": 0.97,
      "velocity": 0.91
    },
    "crossDeviceDeltaAUC": 0.05,
    "crossDomainDeltaAccuracy": 0.09,
    "lastCalibrated": "2026-01-15",
    "groundTruthSamples": 8200
  }
}
```

### Low Friction Policy (`low-friction-v1`)

```json
{
  "policyId": "low-friction-v1",
  "passThreshold": 0.5,
  "failThreshold": 0.15,
  "guarantees": {
    "falsePositiveRate": 0.035,
    "falseNegativeRate": 0.028,
    "calibrationError": 0.048,
    "adversarialRobustness": {
      "automation": 0.91,
      "replay": 1.0,
      "emulator": 0.85,
      "sybil": 0.88,
      "velocity": 0.82
    },
    "crossDeviceDeltaAUC": 0.12,
    "crossDomainDeltaAccuracy": 0.14,
    "lastCalibrated": "2026-01-15",
    "groundTruthSamples": 15800
  }
}
```

---

## Confidence Output Format (Per Improvement Feedback)

Instead of just `{"attention": 0.87}`, VAE outputs:

```json
{
  "claim": "human_attended_content",
  "confidence": 0.87,
  "evidenceClass": "E-INTERACTION+E-VISIBLE+E-DURATION",
  "policy": "default-v1",
  "modelVersion": "attention-v2.3.1",
  "provenance": "evidence-graph-v2/schema-v2",
  "proof": "base64-encoded-poa",
  "guarantees": {
    "falsePositiveRate": 0.018,
    "falseNegativeRate": 0.042,
    "calibrationError": 0.038,
    "adversarialRobustness": 0.94
  }
}
```

---

## Contract Test: Verification Guarantees

```typescript
// contracts/contracts/verification-guarantees.ts
export const verificationGuaranteesContract = {
  // Core metrics required for each policy
  requiredMetrics: [
    'falsePositiveRate',
    'falseNegativeRate',
    'calibrationError',
    'adversarialRobustness',
    'crossDeviceDeltaAUC',
    'crossDomainDeltaAccuracy',
    'groundTruthSamples',
    'lastCalibrated'
  ],

  // Minimum thresholds
  thresholds: {
    maxFalsePositiveRate: 0.02,
    maxFalseNegativeRate: 0.05,
    maxCalibrationError: 0.05,
    minAdversarialRobustness: 0.90,
    maxCrossDeviceDeltaAUC: 0.10,
    maxCrossDomainDeltaAccuracy: 0.15,
    minGroundTruthSamples: 5000,
    maxCalibrationAgeDays: 30
  },

  // Output format validation
  confidenceOutput: {
    requiredFields: [
      'claim', 'confidence', 'evidenceClass', 'policy',
      'modelVersion', 'provenance', 'proof', 'guarantees'
    ],
    guaranteesRequiredFields: [
      'falsePositiveRate', 'falseNegativeRate', 'calibrationError',
      'adversarialRobustness', 'groundTruthSamples'
    ]
  }
};
```

---

## Integration with Policy Engine

```typescript
// packages/verification/src/policy.ts - extended evaluation result
export interface ExtendedPolicyEvaluationResult extends PolicyEvaluationResult {
  outcome: 'PASS' | 'FAIL' | 'INSUFFICIENT' | 'PENDING';
  confidence: number;           // Calibrated 0.0–1.0
  evidenceGaps: string[];       // Missing evidence for PASS
  guarantees: VerificationGuarantees; // Published metrics
}

export interface VerificationGuarantees {
  falsePositiveRate: number;
  falseNegativeRate: number;
  calibrationError: number;
  adversarialRobustness: {
    automation: number;
    replay: number;
    emulator: number;
    sybil: number;
    velocity: number;
  };
  crossDeviceDeltaAUC: number;
  crossDomainDeltaAccuracy: number;
  groundTruthSamples: number;
  lastCalibrated: string;
}
```

---

## Deliverables (S10)

1. `contracts/contracts/verification-guarantees.md` — This specification
2. `contracts/contracts/verification-guarantees.ts` — Machine-readable contract
3. Extended `PolicyEvaluationResult` in `packages/verification/src/policy/types.ts`
4. Published guarantees for each policy in `packages/verification/src/policy.ts`
5. Regression test: `packages/verification/test/guarantees.test.ts` (validates metrics on holdout)

---

## Success Criteria

- [ ] All policies publish guarantees meeting thresholds
- [ ] Confidence output includes guarantees object
- [ ] Contract test validates guarantees independently
- [ ] Calibration error < 0.05 on holdout set
- [ ] Adversarial robustness > 90% on fraud-attack-generator.ts
- [ ] Ground-truth samples ≥ 5000 per policy
- [ ] Documentation in `docs/specs/0001-verified-attention-protocol.md` references guarantees