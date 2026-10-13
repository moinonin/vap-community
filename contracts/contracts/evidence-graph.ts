/**
 * Evidence Graph Contract (S9)
 * Machine-readable contract for proprietary attention evidence dataset
 */
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

  // Ground truth labeling
  groundTruth: {
    requiredFields: ['label', 'confidence', 'source', 'studyId', 'labeledAt', 'labelerId'],
    allowedLabels: ['ATTENTIVE', 'DISTRACTED', 'ABSENT', 'UNCERTAIN'],
    allowedSources: ['EYE_TRACKING', 'SELF_REPORT', 'BEHAVIORAL_STUDY', 'EXPERT_REVIEW'],
  }
};