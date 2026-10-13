import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as tf from '@tensorflow/tfjs-node';
import {
  AttentionModel,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_TRAINING_CONFIG,
  createSequenceTensor,
  generateSyntheticTrainingData,
  FEATURE_DIM,
  SEED,
} from './index';

describe('AttentionModel', () => {
  let model: AttentionModel;

  beforeAll(() => {
    model = new AttentionModel(DEFAULT_MODEL_CONFIG);
    model.build();
    model.compile();
  });

  afterAll(() => {
    model.dispose();
  });

  it('should build model with correct architecture', () => {
    expect(model.isReady()).toBe(true);
    const config = model.getConfig();
    expect(config.hiddenUnits).toBe(DEFAULT_MODEL_CONFIG.hiddenUnits);
    expect(config.numLayers).toBe(DEFAULT_MODEL_CONFIG.numLayers);
  });

  it('should predict single feature vector', async () => {
    const features = new Array(FEATURE_DIM).fill(0.5);
    const prediction = await model.predictSingle(features);
    expect(typeof prediction).toBe('number');
    expect(prediction).toBeGreaterThanOrEqual(0);
    expect(prediction).toBeLessThanOrEqual(1);
  });

  it('should predict batch of sequences', async () => {
    const batchSize = 4;
    const seqLength = DEFAULT_MODEL_CONFIG.sequenceLength;
    const features = tf.randomUniform([batchSize, seqLength, FEATURE_DIM], 0, 1, 'float32', SEED);
    const predictions = await model.predict(features);
    expect(predictions.shape).toEqual([batchSize, 1]);
    const values = predictions.dataSync();
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    features.dispose();
    predictions.dispose();
  });

  it('should train on synthetic data', async () => {
    const { features, labels } = generateSyntheticTrainingData(100, DEFAULT_MODEL_CONFIG.sequenceLength);
    
    const history = await model.train(features, labels, {
      epochs: 3,
      batchSize: 16,
      validationSplit: 0.2,
      seed: SEED,
    });
    
    expect(history.history.loss).toBeDefined();
    expect(history.history.loss.length).toBe(3);
    expect(history.history.val_loss).toBeDefined();
    
    features.dispose();
    labels.dispose();
  });

  it('should save and load model', async () => {
    const tempDir = '/tmp/attention-model-test';
    await model.saveToPath(tempDir);
    
    const loadedModel = await AttentionModel.loadFromPath(tempDir);
    expect(loadedModel.isReady()).toBe(true);
    loadedModel.dispose();
  });

  it('should produce deterministic predictions with fixed seed', async () => {
    const features = new Array(FEATURE_DIM).fill(0.3);
    
    const pred1 = await model.predictSingle(features);
    const pred2 = await model.predictSingle(features);
    
    expect(pred1).toBe(pred2);
  });
});

describe('createSequenceTensor', () => {
  it('should create sequence tensor from evidence history', () => {
    const history = [
      { features: new Array(FEATURE_DIM).fill(0.1), label: 0, timestamp: 1000 },
      { features: new Array(FEATURE_DIM).fill(0.2), label: 0, timestamp: 2000 },
      { features: new Array(FEATURE_DIM).fill(0.3), label: 1, timestamp: 3000 },
      { features: new Array(FEATURE_DIM).fill(0.4), label: 1, timestamp: 4000 },
      { features: new Array(FEATURE_DIM).fill(0.5), label: 0, timestamp: 5000 },
    ];
    const sequenceLength = 3;
    
    const tensor = createSequenceTensor(history, sequenceLength);
    
    expect(tensor.shape).toEqual([3, sequenceLength, FEATURE_DIM]);
    tensor.dispose();
  });
});

describe('generateSyntheticTrainingData', () => {
  it('should generate tensor with correct shape', () => {
    const numSamples = 50;
    const sequenceLength = 10;
    
    const { features, labels } = generateSyntheticTrainingData(numSamples, sequenceLength);
    
    expect(features.shape).toEqual([numSamples, sequenceLength, FEATURE_DIM]);
    expect(labels.shape).toEqual([numSamples]);
    
    features.dispose();
    labels.dispose();
  });

  it('should generate labels as 0 or 1', () => {
    const { labels } = generateSyntheticTrainingData(100, 10);
    const values = labels.dataSync();
    for (const v of values) {
      expect(v === 0 || v === 1).toBe(true);
    }
    labels.dispose();
  });
});

describe('FEATURE_DIM', () => {
  it('should be 20', () => {
    expect(FEATURE_DIM).toBe(20);
  });
});

describe('SEED', () => {
  it('should be 42', () => {
    expect(SEED).toBe(42);
  });
});