/**
 * Verification Guarantees Contract (S10)
 * Machine-readable contract for measurable verification guarantees
 */
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
  },

  // Policy-specific guarantee templates
  policyGuarantees: {
    'default-v1': {
      falsePositiveRate: 0.018,
      falseNegativeRate: 0.042,
      calibrationError: 0.038,
      adversarialRobustness: {
        automation: 0.96,
        replay: 1.0,
        emulator: 0.92,
        sybil: 0.94,
        velocity: 0.87
      },
      crossDeviceDeltaAUC: 0.07,
      crossDomainDeltaAccuracy: 0.11,
      groundTruthSamples: 12500,
      lastCalibrated: '2026-01-15'
    },
    'high-trust-v1': {
      falsePositiveRate: 0.008,
      falseNegativeRate: 0.065,
      calibrationError: 0.042,
      adversarialRobustness: {
        automation: 0.98,
        replay: 1.0,
        emulator: 0.95,
        sybil: 0.97,
        velocity: 0.91
      },
      crossDeviceDeltaAUC: 0.05,
      crossDomainDeltaAccuracy: 0.09,
      groundTruthSamples: 8200,
      lastCalibrated: '2026-01-15'
    },
    'low-friction-v1': {
      falsePositiveRate: 0.035,
      falseNegativeRate: 0.028,
      calibrationError: 0.048,
      adversarialRobustness: {
        automation: 0.91,
        replay: 1.0,
        emulator: 0.85,
        sybil: 0.88,
        velocity: 0.82
      },
      crossDeviceDeltaAUC: 0.12,
      crossDomainDeltaAccuracy: 0.14,
      groundTruthSamples: 15800,
      lastCalibrated: '2026-01-15'
    }
  }
};

/**
 * Extended Policy Evaluation Result (for integration with policy engine)
 */
export interface ExtendedPolicyEvaluationResult {
  passed: boolean;
  reasons: string[];
  failures: string[];
  warnings: string[];
  outcome: 'PASS' | 'FAIL' | 'INSUFFICIENT' | 'PENDING';
  confidence: number;
  evidenceGaps: string[];
  guarantees: VerificationGuarantees;
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