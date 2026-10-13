/**
 * Retrain Hook (documented, minimal trainer)
 *
 * Re-fits the attention model from a labeled dataset and hot-swaps the
 * model inside a running AttentionServingModel. Training is intentionally
 * simple: each labeled feature vector is tiled into a constant sequence
 * (same convention as AttentionModel.predictSingle) and the GRU is
 * trained on [n, sequenceLength, FEATURE_DIM] tensors.
 *
 * Dataset format — JSONL, one record per line:
 *   {"features": [0.1, 2, ...20 values], "label": 1}
 *
 * Intended invocation (e.g. a cron job or admin endpoint):
 *   const model = await retrainFromJsonl('./data/labeled.jsonl');
 *   serving.swapModel(model, nextVersion(currentVersion), 'retrain:./data/labeled.jsonl');
 *   drift.setReference(rows.map(r => r.features));
 *
 * The hook is pure with respect to the service: it returns a trained
 * model and lets the caller perform the swap, which keeps it trivially
 * testable with synthetic data.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { AttentionModel, DEFAULT_MODEL_CONFIG, FEATURE_DIM, type TrainingConfig, type ModelConfig } from '@verified-attention/ml-attention-model';
import { validateFeatureVector } from '@verified-attention/ml-attention-features';

const req = createRequire(import.meta.url);
let tf: any;
try {
  tf = req('@tensorflow/tfjs-node');
} catch {
  tf = req('@tensorflow/tfjs');
}

export interface LabeledRecord {
  features: number[];
  label: 0 | 1;
}

/**
 * Load a JSONL dataset of labeled feature vectors.
 * Throws on malformed lines so bad data never reaches training.
 */
export async function loadLabeledJsonl(path: string): Promise<LabeledRecord[]> {
  const raw = await readFile(path, 'utf8');
  const records: LabeledRecord[] = [];
  raw.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(`Invalid JSON on line ${i + 1} of ${path}`);
    }
    const rec = parsed as Partial<LabeledRecord>;
    if (!Array.isArray(rec.features) || !validateFeatureVector(rec.features)) {
      throw new Error(`Invalid feature vector on line ${i + 1} of ${path}`);
    }
    if (rec.label !== 0 && rec.label !== 1) {
      throw new Error(`Invalid label on line ${i + 1} of ${path} (expected 0 or 1)`);
    }
    records.push({ features: rec.features, label: rec.label });
  });
  if (records.length === 0) throw new Error(`No records found in ${path}`);
  return records;
}

/**
 * Train a fresh model on labeled records (feature vectors tiled to
 * constant sequences) and return it, ready for hot-swapping.
 */
export async function retrainFromRecords(
  records: LabeledRecord[],
  modelConfig: Partial<ModelConfig> = {},
  trainingConfig: Partial<TrainingConfig> = {}
): Promise<AttentionModel> {
  const config = { ...DEFAULT_MODEL_CONFIG, ...modelConfig };
  const sequences: number[][][] = records.map(r =>
    Array.from({ length: config.sequenceLength }, () => r.features.slice())
  );
  const xs = tf.tensor3d(sequences, [records.length, config.sequenceLength, FEATURE_DIM]);
  const ys = tf.tensor1d(records.map(r => r.label));

  const model = new AttentionModel(config);
  model.build();
  model.compile();
  try {
    await model.train(xs, ys, trainingConfig);
  } finally {
    xs.dispose();
    ys.dispose();
  }
  return model;
}

/** Convenience wrapper: load JSONL from disk, then train. */
export async function retrainFromJsonl(
  path: string,
  modelConfig: Partial<ModelConfig> = {},
  trainingConfig: Partial<TrainingConfig> = {}
): Promise<{ model: AttentionModel; records: LabeledRecord[] }> {
  const records = await loadLabeledJsonl(path);
  const model = await retrainFromRecords(records, modelConfig, trainingConfig);
  return { model, records };
}

/**
 * Bump a semver-ish version string's patch component: "1.0.0" -> "1.0.1".
 */
export function nextVersion(version: string): string {
  const parts = version.split('.');
  const patch = Number(parts[2] ?? '0');
  parts[2] = String(Number.isFinite(patch) ? patch + 1 : 1);
  return parts.join('.');
}
