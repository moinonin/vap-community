/**
 * Attention Model Serving App
 *
 * Serves the attention model (@verified-attention/ml-attention-model) over
 * HTTP with drift detection (PSI) and a retrain hook. Entrypoint boots a
 * service when run directly (`node dist/index.js`).
 *
 * Config via environment:
 *   PORT              listen port (default 8085)
 *   HOST              listen host (default 0.0.0.0)
 *   MODEL_PATH        optional directory with model.json + weights
 *   CALIBRATION_A/B   Platt calibration parameters (default 1 / 0)
 *
 * @module @verified-attention/ml-serving
 */

import util from 'node:util';
if (typeof (util as any).isNullOrUndefined !== 'function') {
  (util as any).isNullOrUndefined = (v: unknown): boolean => v === null || v === undefined;
}

export { AttentionServingModel, type ScoreResult, type ModelInfo, type CalibrationParams } from './model.js';
export { DriftDetector, DEFAULT_DRIFT_CONFIG, type DriftStatus, type DriftDetectorConfig } from './drift.js';
export { retrainFromJsonl, retrainFromRecords, loadLabeledJsonl, nextVersion, type LabeledRecord } from './retrain.js';
export {
  createServingServer,
  startServingServer,
  stopServingServer,
  DEFAULT_SERVING_CONFIG,
  type ScoreRequest,
  type ScoreResponse,
  type ServingAppConfig,
} from './app.js';

/** Boot the live service when run as a script (node dist/index.js). */
export async function main(): Promise<void> {
  const { AttentionServingModel } = await import('./model.js');
  const { DriftDetector } = await import('./drift.js');
  const { startServingServer } = await import('./app.js');

  const model = new AttentionServingModel();
  await model.init(process.env.MODEL_PATH, {
    a: process.env.CALIBRATION_A ? Number(process.env.CALIBRATION_A) : 1,
    b: process.env.CALIBRATION_B ? Number(process.env.CALIBRATION_B) : 0,
  });
  const drift = new DriftDetector();
  const { port } = await startServingServer(model, drift, {
    port: process.env.PORT ? Number(process.env.PORT) : 8085,
    host: process.env.HOST ?? '0.0.0.0',
  });
  console.log(`[ml-serving] attention model serving on :${port} (model ${model.getInfo().modelVersion})`);
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith('index.js') ||
  process.argv[1].endsWith('index.mjs') ||
  process.argv[1].endsWith('index.ts')
);
if (isMain) {
  main().catch(err => {
    console.error('[ml-serving] fatal:', err);
    process.exit(1);
  });
}
