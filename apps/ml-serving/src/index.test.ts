import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import * as httpModule from 'node:http';
import type { Server } from 'node:http';
import {
  AttentionServingModel,
  DriftDetector,
  retrainFromRecords,
  loadLabeledJsonl,
  nextVersion,
  startServingServer,
  stopServingServer,
  type LabeledRecord,
  type ScoreResponse,
} from './index.js';
import { FEATURE_DIM } from '@verified-attention/ml-attention-model';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Deterministic pseudo-random generator (LCG)
function makeRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Synthetic attentive feature row (mirrors ml-attention-model synthetic data, normalized) */
function syntheticRow(rand: () => number, attentive: boolean): number[] {
  if (attentive) {
    return [
      rand() * 0.05 + 0.01, Math.floor(rand() * 8), Math.floor(rand() * 5), Math.floor(rand() * 20),
      0.03 + rand() * 0.15, 0.7 + rand() * 0.3, 0.04 + rand() * 0.15, 0.8 + rand() * 0.2,
      0.7 + rand() * 0.3, 0.1 + rand() * 0.8, 0.05 + rand() * 0.5, rand() * 0.1,
      Math.floor(rand() * 720), 1, 0, 0, 0.8 + rand() * 0.2, rand() * 2,
      0.2 + rand() * 0.3, 0.8 + rand() * 0.2,
    ];
  }
  return [
    rand() * 0.5, Math.floor(rand() * 2), Math.floor(rand() * 1), Math.floor(rand() * 2),
    rand() * 0.02, rand() * 0.3, rand() * 0.02, rand() * 0.3, rand() * 0.3,
    0.02 + rand() * 0.1, rand() * 0.02, rand() * 0.1, Math.floor(rand() * 10),
    1, 0, 0, rand() * 0.5, rand() * 0.5, 0.6 + rand() * 0.4, 0.2 + rand() * 0.3,
  ];
}

function makeDataset(n: number, attentiveFraction = 0.5, seed = 42): LabeledRecord[] {
  const rand = makeRng(seed);
  const records: LabeledRecord[] = [];
  for (let i = 0; i < n; i++) {
    const attentive = rand() < attentiveFraction;
    records.push({ features: syntheticRow(rand, attentive), label: attentive ? 1 : 0 });
  }
  return records;
}

let testServer: Server | null = null;
let testModel: AttentionServingModel | null = null;

afterEach(async () => {
  if (testServer) {
    await stopServingServer(testServer);
    testServer = null;
  }
  if (testModel) {
    testModel.dispose();
    testModel = null;
  }
});

let trainedDataset: LabeledRecord[];

beforeAll(() => {
  trainedDataset = makeDataset(200);
}, 10_000);

describe('AttentionServingModel inference', () => {
  it('returns sane probabilities on synthetic features (untrained model)', async () => {
    testModel = new AttentionServingModel();
    await testModel.init();
    const result = await testModel.score(trainedDataset[0]!.features);
    expect(result.attentionProbability).toBeGreaterThanOrEqual(0);
    expect(result.attentionProbability).toBeLessThanOrEqual(1);
    expect(result.calibratedConfidence).toBeGreaterThanOrEqual(0);
    expect(result.calibratedConfidence).toBeLessThanOrEqual(1);
    expect(result.modelVersion).toBeTruthy();
  }, 30_000);

  it('scores a minimally trained model higher on attentive rows on average', async () => {
    const trained = await retrainFromRecords(
      trainedDataset,
      { hiddenUnits: 16, numLayers: 1 },
      { epochs: 8, batchSize: 32, validationSplit: 0.2 }
    );
    testModel = new AttentionServingModel();
    await testModel.init();
    testModel.swapModel(trained, nextVersion(testModel.getInfo().modelVersion), 'synthetic', true);

    const rand = makeRng(7);
    const attentiveScores: number[] = [];
    const inattentiveScores: number[] = [];
    for (let i = 0; i < 20; i++) {
      attentiveScores.push((await testModel.score(syntheticRow(rand, true))).attentionProbability);
      inattentiveScores.push((await testModel.score(syntheticRow(rand, false))).attentionProbability);
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(attentiveScores)).toBeGreaterThan(mean(inattentiveScores));
  }, 120_000);

  it('rejects malformed feature vectors', async () => {
    testModel = new AttentionServingModel();
    await testModel.init();
    await expect(testModel.score([1, 2, 3])).rejects.toThrow(/Invalid feature vector/);
    await expect(testModel.score(new Array(FEATURE_DIM).fill(NaN))).rejects.toThrow(/Invalid feature vector/);
  }, 30_000);
});

describe('DriftDetector (PSI)', () => {
  it('reports no drift when observations match the reference distribution', () => {
    const rand = makeRng(1);
    const detector = new DriftDetector();
    detector.setReference(Array.from({ length: 300 }, () => syntheticRow(rand, true)));
    for (let i = 0; i < 100; i++) detector.observe(syntheticRow(rand, true));
    const status = detector.getStatus();
    expect(status.driftDetected).toBe(false);
    expect(status.psi).toBeLessThan(status.threshold);
  });

  it('fires on shifted synthetic distribution', () => {
    const randRef = makeRng(2);
    const detector = new DriftDetector();
    detector.setReference(Array.from({ length: 300 }, () => syntheticRow(randRef, true)));

    const randShift = makeRng(3);
    // Shift: inattentive rows (engagement/visibility collapse vs. attentive reference)
    for (let i = 0; i < 100; i++) detector.observe(syntheticRow(randShift, false));
    const status = detector.getStatus();
    expect(status.psi).toBeGreaterThan(status.threshold);
    expect(status.driftDetected).toBe(true);
  });

  it('reports empty status before reference is set', () => {
    const detector = new DriftDetector();
    expect(detector.getStatus()).toMatchObject({ psi: 0, driftDetected: false, windowSize: 0 });
  });
});

describe('retrain hook', () => {
  it('trains from JSONL and hot-swaps the model version', async () => {
    testModel = new AttentionServingModel();
    await testModel.init();
    const infoBefore = testModel.getInfo();
    expect(infoBefore.retrainCount).toBe(0);

    const dir = await mkdtemp(join(tmpdir(), 'ml-serving-'));
    const path = join(dir, 'labeled.jsonl');
    await writeFile(path, makeDataset(120).map(r => JSON.stringify(r)).join('\n'));

    const records = await loadLabeledJsonl(path);
    expect(records).toHaveLength(120);

    const newModel = await retrainFromRecords(
      records,
      { hiddenUnits: 16, numLayers: 1 },
      { epochs: 3, batchSize: 32, validationSplit: 0.2 }
    );
    testModel.swapModel(newModel, nextVersion(infoBefore.modelVersion), `retrain:${path}`);

    const infoAfter = testModel.getInfo();
    expect(infoAfter.modelVersion).toBe(nextVersion(infoBefore.modelVersion));
    expect(infoAfter.modelVersion).not.toBe(infoBefore.modelVersion);
    expect(infoAfter.retrainCount).toBe(1);
    expect(testModel.isReady()).toBe(true);

    const scored = await testModel.score(records[0]!.features);
    expect(scored.modelVersion).toBe(infoAfter.modelVersion);
  }, 120_000);

  it('rejects malformed datasets', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ml-serving-bad-'));
    const path = join(dir, 'bad.jsonl');
    await writeFile(path, '{"features":[1,2],"label":1}');
    await expect(loadLabeledJsonl(path)).rejects.toThrow(/Invalid feature vector/);
  });

  it('bumps semver patch versions', () => {
    expect(nextVersion('1.0.0')).toBe('1.0.1');
    expect(nextVersion('0.1.9')).toBe('0.1.10');
  });
});

describe('HTTP server', () => {
  function fetchLocal(port: number, path: string, options: { method?: string; body?: unknown } = {}): Promise<{ status: number; body: unknown }> {
    const { method = 'GET', body } = options;
    return new Promise((resolve, reject) => {
      const req = httpModule.request(
        { host: '127.0.0.1', port, path, method, headers: { 'Content-Type': 'application/json' } },
        res => {
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode || 0, body: data });
            }
          });
        }
      );
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  it('serves POST /v1/score and GET /v1/model/info', async () => {
    testModel = new AttentionServingModel();
    await testModel.init();
    const rand = makeRng(9);
    const drift = new DriftDetector();
    drift.setReference(Array.from({ length: 100 }, () => syntheticRow(rand, true)));

    const started = await startServingServer(testModel, drift, { port: 0, host: '127.0.0.1' });
    testServer = started.server;

    const bad = await fetchLocal(started.port, '/v1/score', { method: 'POST', body: {} });
    expect(bad.status).toBe(400);

    const ok = await fetchLocal(started.port, '/v1/score', {
      method: 'POST',
      body: { features: syntheticRow(rand, true) },
    });
    expect(ok.status).toBe(200);
    const score = ok.body as ScoreResponse;
    expect(score.attentionProbability).toBeGreaterThanOrEqual(0);
    expect(score.attentionProbability).toBeLessThanOrEqual(1);
    expect(score.calibratedConfidence).toBeGreaterThanOrEqual(0);
    expect(score).toHaveProperty('drift.psi');
    expect(score).toHaveProperty('drift.driftDetected');
    expect(score.modelVersion).toBeTruthy();

    const info = await fetchLocal(started.port, '/v1/model/info');
    expect(info.status).toBe(200);
    const infoBody = info.body as { modelVersion: string; featureDim: number; drift: { windowSize: number } };
    expect(infoBody.featureDim).toBe(FEATURE_DIM);
    expect(infoBody.drift.windowSize).toBe(1); // one scored request observed

    const health = await fetchLocal(started.port, '/health');
    expect(health.status).toBe(200);

    const missing = await fetchLocal(started.port, '/nope');
    expect(missing.status).toBe(404);
  }, 60_000);
});
