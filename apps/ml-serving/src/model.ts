/**
 * Attention Model Serving
 *
 * Loads the attention model from @verified-attention/ml-attention-model
 * (either a saved artifact directory or a freshly built GRU) and scores
 * 20-dim feature vectors. Applies Platt calibration on top of the raw
 * model logit (same sigmoid(A * logit + B) scheme as the fraud ensemble)
 * to produce a calibrated confidence.
 */

import { AttentionModel, DEFAULT_MODEL_CONFIG, MODEL_VERSION, FEATURE_DIM } from '@verified-attention/ml-attention-model';
import { validateFeatureVector } from '@verified-attention/ml-attention-features';

export interface CalibrationParams {
  /** Platt scaling param A: confidence = sigmoid(A * logit + B) */
  a: number;
  /** Platt scaling param B */
  b: number;
}

export interface ScoreResult {
  attentionProbability: number;
  calibratedConfidence: number;
  modelVersion: string;
}

export interface ModelInfo {
  modelVersion: string;
  featureDim: number;
  loadedFrom: string | null;
  loadedAt: string;
  retrainCount: number;
  calibration: CalibrationParams;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

const EPS = 1e-7;

export class AttentionServingModel {
  private model: AttentionModel | null = null;
  private loadedFrom: string | null = null;
  private loadedAt: string = new Date().toISOString();
  private retrainCount = 0;
  private version = MODEL_VERSION;
  private calibration: CalibrationParams = { a: 1, b: 0 };

  /**
   * Load model from a saved artifact directory (model.json + weights),
   * or build a fresh untrained model when no path is given.
   */
  async init(modelPath?: string, calibration: Partial<CalibrationParams> = {}): Promise<void> {
    this.calibration = { ...this.calibration, ...calibration };
    const model = modelPath ? await AttentionModel.loadFromPath(modelPath) : new AttentionModel(DEFAULT_MODEL_CONFIG);
    if (!modelPath) {
      model.build();
    }
    this.swapModel(model, MODEL_VERSION, modelPath ?? null, false);
  }

  /**
   * Hot-swap the active model (used by the retrain hook) after disposal
   * of the previous model's tensors.
   */
  swapModel(model: AttentionModel, version: string, loadedFrom: string | null, countAsRetrain = true): void {
    const old = this.model;
    this.model = model;
    this.version = version;
    this.loadedFrom = loadedFrom;
    this.loadedAt = new Date().toISOString();
    if (countAsRetrain) this.retrainCount += 1;
    old?.dispose();
  }

  /**
   * Score a single 20-dim feature vector.
   * Returns the raw attention probability and a Platt-calibrated confidence.
   */
  async score(features: number[]): Promise<ScoreResult> {
    if (!this.model || !this.model.isReady()) {
      throw new Error('Model not loaded. Call init() first.');
    }
    if (!validateFeatureVector(features)) {
      throw new Error(`Invalid feature vector: expected ${FEATURE_DIM} finite numbers`);
    }
    const prob = await this.model.predictSingle(features);
    const logit = Math.log(Math.min(1 - EPS, Math.max(EPS, prob)) / Math.min(1 - EPS, Math.max(EPS, 1 - prob)));
    const calibrated = sigmoid(this.calibration.a * logit + this.calibration.b);
    return {
      attentionProbability: prob,
      calibratedConfidence: calibrated,
      modelVersion: this.version,
    };
  }

  getInfo(): ModelInfo {
    return {
      modelVersion: this.version,
      featureDim: FEATURE_DIM,
      loadedFrom: this.loadedFrom,
      loadedAt: this.loadedAt,
      retrainCount: this.retrainCount,
      calibration: { ...this.calibration },
    };
  }

  setCalibration(params: Partial<CalibrationParams>): void {
    this.calibration = { ...this.calibration, ...params };
  }

  isReady(): boolean {
    return this.model !== null && this.model.isReady();
  }

  dispose(): void {
    this.model?.dispose();
    this.model = null;
  }
}
