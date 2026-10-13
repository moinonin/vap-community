/**
 * Confidence Model (VAP Section 8)
 *
 * Deterministic confidence calculation:
 * C = f(E_quality, E_completeness, E_count, reliability, contradiction_penalty)
 *
 * Same input + same rules = same output (no randomness, no Date.now())
 */

import { z } from 'zod';

/**
 * Confidence input — all fields needed to compute confidence
 */
export const ConfidenceInputSchema = z.object({
  // Evidence quality scores (0-1 per evidence item)
  evidenceQuality: z.array(z.number().min(0).max(1)),
  // Completeness: fraction of required evidence types present (0-1)
  completeness: z.number().min(0).max(1),
  // Number of evidence items
  evidenceCount: z.number().int().nonnegative(),
  // Source reliability scores (0-1 per evidence item)
  sourceReliability: z.array(z.number().min(0).max(1)),
  // Contradiction penalty (0 = no contradictions, 1 = fully contradictory)
  contradictionPenalty: z.number().min(0).max(1).default(0),
  // Optional fraud score (0 = no fraud, 1 = certain fraud)
  fraudScore: z.number().min(0).max(1).optional(),
  // Optional calibration map (raw score → calibrated score)
  calibrationMap: z.array(z.tuple([z.number(), z.number()])).optional(),
});

export type ConfidenceInput = z.infer<typeof ConfidenceInputSchema>;

/**
 * Confidence output — the computed confidence with metadata
 */
export const ConfidenceResultSchema = z.object({
  confidence: z.number().min(0).max(1),
  rawConfidence: z.number().min(0).max(1),
  calibratedConfidence: z.number().min(0).max(1),
  qualityScore: z.number().min(0).max(1),
  completenessScore: z.number().min(0).max(1),
  reliabilityScore: z.number().min(0).max(1),
  components: z.object({
    qualityWeight: z.number(),
    completenessWeight: z.number(),
    countWeight: z.number(),
    reliabilityWeight: z.number(),
    contradictionPenalty: z.number(),
    fraudPenalty: z.number(),
  }),
});

export type ConfidenceResult = z.infer<typeof ConfidenceResultSchema>;

/**
 * Confidence model configuration — weights for the weighted sum
 */
export const ConfidenceConfigSchema = z.object({
  // Weight for evidence quality (0-1)
  qualityWeight: z.number().min(0).max(1).default(0.35),
  // Weight for completeness (0-1)
  completenessWeight: z.number().min(0).max(1).default(0.25),
  // Weight for evidence count (0-1)
  countWeight: z.number().min(0).max(1).default(0.15),
  // Weight for source reliability (0-1)
  reliabilityWeight: z.number().min(0).max(1).default(0.25),
  // Diminishing returns factor for count (higher = faster diminishing)
  countDiminishingFactor: z.number().min(0).max(2).default(0.5),
  // Contradiction penalty multiplier
  contradictionMultiplier: z.number().min(0).max(2).default(1.0),
  // Fraud penalty multiplier
  fraudMultiplier: z.number().min(0).max(2).default(2.0),
});

export type ConfidenceConfig = z.infer<typeof ConfidenceConfigSchema>;

export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  qualityWeight: 0.35,
  completenessWeight: 0.25,
  countWeight: 0.15,
  reliabilityWeight: 0.25,
  countDiminishingFactor: 0.5,
  contradictionMultiplier: 1.0,
  fraudMultiplier: 2.0,
};

/**
 * Calculate quality score from array of quality values
 * Uses mean (deterministic)
 */
function calculateQualityScore(qualities: number[]): number {
  if (qualities.length === 0) return 0;
  const sum = qualities.reduce((acc, q) => acc + q, 0);
  return sum / qualities.length;
}

/**
 * Calculate reliability score from array of reliability values
 * Uses mean (deterministic)
 */
function calculateReliabilityScore(reliabilities: number[]): number {
  if (reliabilities.length === 0) return 0;
  const sum = reliabilities.reduce((acc, r) => acc + r, 0);
  return sum / reliabilities.length;
}

/**
 * Calculate count score with diminishing returns
 * score = 1 - exp(-count * factor)
 * This is deterministic: same count + same factor = same score
 */
function calculateCountScore(count: number, factor: number): number {
  if (count <= 0) return 0;
  return 1 - Math.exp(-count * factor);
}

/**
 * Calculate confidence deterministically
 *
 * Formula:
 * raw = w_q * quality + w_c * completeness + w_n * count_score + w_r * reliability
 * raw = clamp(raw, 0, 1)
 * calibrated = applyCalibration(raw)
 * penalized = calibrated * (1 - contradiction_penalty * contradiction_multiplier)
 * penalized = penalized * (1 - fraud_score * fraud_multiplier)
 * confidence = clamp(penalized, 0, 1)
 */
export function calculateConfidence(
  input: ConfidenceInput,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): ConfidenceResult {
  const qualityScore = calculateQualityScore(input.evidenceQuality);
  const completenessScore = input.completeness;
  const countScore = calculateCountScore(input.evidenceCount, config.countDiminishingFactor);
  const reliabilityScore = calculateReliabilityScore(input.sourceReliability);

  // Weighted sum
  const totalWeight =
    config.qualityWeight +
    config.completenessWeight +
    config.countWeight +
    config.reliabilityWeight;

  let raw = 0;
  if (totalWeight > 0) {
    raw =
      (config.qualityWeight * qualityScore +
        config.completenessWeight * completenessScore +
        config.countWeight * countScore +
        config.reliabilityWeight * reliabilityScore) /
      totalWeight;
  }

  // Clamp raw
  raw = Math.max(0, Math.min(1, raw));

  // Apply calibration (if provided)
  let calibrated = raw;
  if (input.calibrationMap && input.calibrationMap.length > 0) {
    // Find nearest calibration point
    const sortedKeys: number[] = input.calibrationMap.map(([k]: [number, number]) => k).sort((a: number, b: number) => a - b);
    let lowerKey: number = sortedKeys[0]!;
    let upperKey: number = sortedKeys[sortedKeys.length - 1]!;
    for (const key of sortedKeys) {
      if (key <= raw) lowerKey = key;
      if (key >= raw) {
        upperKey = key;
        break;
      }
    }
    const lowerEntry = input.calibrationMap.find(([k]: [number, number]) => k === lowerKey);
    const upperEntry = input.calibrationMap.find(([k]: [number, number]) => k === upperKey);
    const lowerVal: number = lowerEntry![1];
    const upperVal: number = upperEntry![1];
    if (lowerKey === upperKey) {
      calibrated = lowerVal;
    } else {
      // Linear interpolation
      const t = (raw - lowerKey) / (upperKey - lowerKey);
      calibrated = lowerVal + t * (upperVal - lowerVal);
    }
    calibrated = Math.max(0, Math.min(1, calibrated));
  }

  // Apply contradiction penalty
  let penalized = calibrated * (1 - input.contradictionPenalty * config.contradictionMultiplier);

  // Apply fraud penalty
  if (input.fraudScore !== undefined) {
    penalized = penalized * (1 - input.fraudScore * config.fraudMultiplier);
  }

  // Clamp final
  const confidence = Math.max(0, Math.min(1, penalized));

  return {
    confidence,
    rawConfidence: raw,
    calibratedConfidence: calibrated,
    qualityScore,
    completenessScore,
    reliabilityScore,
    components: {
      qualityWeight: config.qualityWeight,
      completenessWeight: config.completenessWeight,
      countWeight: config.countWeight,
      reliabilityWeight: config.reliabilityWeight,
      contradictionPenalty: input.contradictionPenalty,
      fraudPenalty: input.fraudScore ?? 0,
    },
  };
}

/**
 * Calibration interface for ML models
 * Allows plugging in external calibration (isotonic regression, conformal, etc.)
 */
export interface Calibrator {
  calibrate(rawConfidence: number): number;
  calibrateBatch(rawConfidences: number[]): number[];
}

/**
 * Identity calibrator (no-op)
 */
export class IdentityCalibrator implements Calibrator {
  calibrate(rawConfidence: number): number {
    return rawConfidence;
  }
  calibrateBatch(rawConfidences: number[]): number[] {
    return [...rawConfidences];
  }
}

/**
 * Isotonic regression calibrator (simplified — uses a lookup table)
 */
export class IsotonicCalibrator implements Calibrator {
  private lookupTable: Map<number, number>;

  constructor(pairs: Array<[number, number]>) {
    // Sort by raw value
    const sorted = [...pairs].sort((a, b) => a[0] - b[0]);
    this.lookupTable = new Map(sorted);
  }

  calibrate(rawConfidence: number): number {
    const sortedKeys = Array.from(this.lookupTable.keys()).sort((a, b) => a - b);
    if (sortedKeys.length === 0) return rawConfidence;

    let lowerKey = sortedKeys[0]!;
    let upperKey = sortedKeys[sortedKeys.length - 1]!;

    for (const key of sortedKeys) {
      if (key <= rawConfidence) lowerKey = key;
      if (key >= rawConfidence) {
        upperKey = key;
        break;
      }
    }

    const lowerVal = this.lookupTable.get(lowerKey)!;
    const upperVal = this.lookupTable.get(upperKey)!;

    if (lowerKey === upperKey) return lowerVal;

    const t = (rawConfidence - lowerKey) / (upperKey - lowerKey);
    return lowerVal + t * (upperVal - lowerVal);
  }

  calibrateBatch(rawConfidences: number[]): number[] {
    return rawConfidences.map((r) => this.calibrate(r));
  }
}
