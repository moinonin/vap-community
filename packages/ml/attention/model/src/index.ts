/**
 * Attention Behaviour Model
 * 
 * GRU-based sequence model for attention detection.
 * Target AUC >= 0.95 on held-out human vs. bot data.
 */

import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractAttentionFeatures, ATTENTION_FEATURE_NAMES, type AttentionFeatureName } from '@verified-attention/ml-attention-features';

const req = createRequire(import.meta.url);
let tf: any;
try {
  tf = req('@tensorflow/tfjs-node');
} catch {
  tf = req('@tensorflow/tfjs');
}

export const MODEL_VERSION = '1.0.0';
export const FEATURE_DIM = ATTENTION_FEATURE_NAMES.length; // 20 features
export const SEED = 42;

/**
 * Model architecture configuration
 */
export interface ModelConfig {
  hiddenUnits: number;
  numLayers: number;
  dropoutRate: number;
  learningRate: number;
  sequenceLength: number;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  hiddenUnits: 64,
  numLayers: 2,
  dropoutRate: 0.2,
  learningRate: 0.001,
  sequenceLength: 10,
};

/**
 * Training configuration
 */
export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  validationSplit: number;
  earlyStoppingPatience: number;
  seed: number;
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  epochs: 50,
  batchSize: 32,
  validationSplit: 0.2,
  earlyStoppingPatience: 10,
  seed: SEED,
};

/**
 * Model artifacts for saving/loading
 */
export interface ModelArtifacts {
  modelJson: string;
  weights: Uint8Array[];
  config: ModelConfig;
  featureNames: string[];
  version: string;
  trainedAt: string;
  metrics: {
    trainLoss: number;
    trainAccuracy: number;
    valLoss: number;
    valAccuracy: number;
    valAUC?: number;
  };
}

/**
 * Attention Model class using GRU for sequence classification
 */
export class AttentionModel {
  private model: tf.LayersModel | null = null;
  private config: ModelConfig;
  private isBuilt = false;

  constructor(config: Partial<ModelConfig> = {}) {
    this.config = { ...DEFAULT_MODEL_CONFIG, ...config };
  }

  /**
   * Build the GRU model architecture
   */
  build(): tf.LayersModel {
    const input = tf.input({ 
      shape: [this.config.sequenceLength, FEATURE_DIM], 
      name: 'feature_sequence' 
    });

    let x = input;

    // Stack GRU layers
    for (let i = 0; i < this.config.numLayers; i++) {
      const isLastLayer = i === this.config.numLayers - 1;
      x = tf.layers.gru({
        units: this.config.hiddenUnits,
        returnSequences: !isLastLayer,
        dropout: this.config.dropoutRate,
        recurrentDropout: this.config.dropoutRate,
        name: `gru_${i + 1}`,
      }).apply(x) as tf.SymbolicTensor;
    }

    // Dense layers for classification
    x = tf.layers.dense({
      units: 32,
      activation: 'relu',
      name: 'dense_1',
    }).apply(x) as tf.SymbolicTensor;

    x = tf.layers.dropout({
      rate: this.config.dropoutRate,
      name: 'dropout_1',
    }).apply(x) as tf.SymbolicTensor;

    // Output: single sigmoid for binary classification
    const output = tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
      name: 'attention_probability',
    }).apply(x) as tf.SymbolicTensor;

    this.model = tf.model({ inputs: input, outputs: output, name: 'attention_model' });
    this.isBuilt = true;

    return this.model;
  }

  /**
   * Compile model with optimizer and loss
   */
  compile(): void {
    if (!this.model) throw new Error('Model not built. Call build() first.');
    
    this.model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });
  }

  /**
   * Train the model on feature sequences
   */
  async train(
    features: tf.Tensor3D,
    labels: tf.Tensor1D,
    config: Partial<TrainingConfig> = {}
  ): Promise<tf.History> {
    if (!this.model) throw new Error('Model not built. Call build() first.');

    const trainConfig = { ...DEFAULT_TRAINING_CONFIG, ...config };

    const callbacks = [
      tf.callbacks.earlyStopping({
        monitor: 'val_loss',
        mode: 'min',
        patience: trainConfig.earlyStoppingPatience,
        // restoreBestWeights: true is not implemented in tfjs-layers 4.22.0
      }),
    ];

    const history = await this.model!.fit(features, labels, {
      epochs: trainConfig.epochs,
      batchSize: trainConfig.batchSize,
      validationSplit: trainConfig.validationSplit,
      callbacks,
      shuffle: true,
      verbose: 1,
    });

    return history;
  }

  /**
   * Predict attention probability for a batch of sequences
   */
  async predict(features: tf.Tensor3D): Promise<tf.Tensor2D> {
    if (!this.model) throw new Error('Model not built. Call build() first.');
    
    return this.model.predict(features, { batchSize: features.shape[0] }) as tf.Tensor2D;
  }

  /**
   * Predict for a single feature vector
   */
  async predictSingle(features: number[]): Promise<number> {
    const sequence = tf.tensor3d(
      [Array(this.config.sequenceLength).fill(features)],
      [1, this.config.sequenceLength, FEATURE_DIM]
    );
    
    const prob = await this.predict(sequence);
    const result = prob.dataSync()[0];
    prob.dispose();
    sequence.dispose();
    return result;
  }

  /**
   * Save model to filesystem path
   */
  async saveToPath(targetPath: string): Promise<void> {
    if (!this.model) throw new Error('Model not built.');
    if (typeof tf.io.fileSystem === 'function') {
      await this.model.save(`file://${targetPath}`);
    } else {
      const ioHandler = {
        save: async (modelArtifacts: any) => {
          fs.mkdirSync(targetPath, { recursive: true });
          const weightsManifest = [{
            paths: ['./weights.bin'],
            weights: modelArtifacts.weightSpecs
          }];
          const modelJSON = {
            modelTopology: modelArtifacts.modelTopology,
            weightsManifest,
            format: modelArtifacts.format,
            generatedBy: modelArtifacts.generatedBy,
            convertedBy: modelArtifacts.convertedBy
          };
          fs.writeFileSync(path.join(targetPath, 'model.json'), JSON.stringify(modelJSON));
          if (modelArtifacts.weightData) {
            fs.writeFileSync(path.join(targetPath, 'weights.bin'), Buffer.from(modelArtifacts.weightData));
          }
          return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
        }
      };
      await this.model.save(ioHandler as any);
    }
  }

  /**
   * Load model from filesystem path
   */
  static async loadFromPath(sourcePath: string): Promise<AttentionModel> {
    let model: any;
    if (typeof tf.io.fileSystem === 'function') {
      model = await tf.loadLayersModel(`file://${sourcePath}/model.json`);
    } else {
      const ioHandler = {
        load: async () => {
          const modelJSON = JSON.parse(fs.readFileSync(path.join(sourcePath, 'model.json'), 'utf8'));
          let weightData: any;
          if (fs.existsSync(path.join(sourcePath, 'weights.bin'))) {
            const buf = fs.readFileSync(path.join(sourcePath, 'weights.bin'));
            weightData = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          }
          return {
            modelTopology: modelJSON.modelTopology,
            weightSpecs: modelJSON.weightsManifest ? modelJSON.weightsManifest[0].weights : undefined,
            weightData,
            format: modelJSON.format,
            generatedBy: modelJSON.generatedBy,
            convertedBy: modelJSON.convertedBy
          };
        }
      };
      model = await tf.loadLayersModel(ioHandler as any);
    }
    const attentionModel = new AttentionModel(DEFAULT_MODEL_CONFIG);
    attentionModel.model = model;
    attentionModel.isBuilt = true;
    return attentionModel;
  }

  /**
   * Get model summary
   */
  summary(): void {
    if (!this.model) throw new Error('Model not built.');
    this.model.summary();
  }

  /**
   * Dispose model resources
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isBuilt = false;
    }
  }

  /**
   * Get model config
   */
  getConfig(): ModelConfig {
    return { ...this.config };
  }

  /**
   * Check if model is ready for inference
   */
  isReady(): boolean {
    return this.isBuilt && this.model !== null;
  }
}

/**
 * Evidence record for training data
 */
export interface EvidenceRecord {
  features: number[];
  label: number;
  timestamp: number;
}

/**
 * Create a sequence tensor from evidence history
 */
export function createSequenceTensor(
  evidenceHistory: EvidenceRecord[],
  sequenceLength: number
): tf.Tensor3D {
  const sequences: number[][][] = [];
  const labels: number[] = [];

  for (let i = sequenceLength - 1; i < evidenceHistory.length; i++) {
    const window = evidenceHistory.slice(i - sequenceLength + 1, i + 1);
    sequences.push(window.map(e => e.features));
    labels.push(evidenceHistory[i].label);
  }

  return tf.tensor3d(sequences, [sequences.length, sequenceLength, FEATURE_DIM]);
}

/**
 * Generate synthetic training data
 */
export function generateSyntheticTrainingData(
  numSamples: number = 5000,
  sequenceLength: number = 10
): { features: tf.Tensor3D; labels: tf.Tensor1D } {
  // Simple pseudo-random with seed
  let seed = SEED;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const features: number[][][] = [];
  const labels: number[] = [];

  for (let i = 0; i < numSamples; i++) {
    const isAttentive = random() < 0.7;
    labels.push(isAttentive ? 1 : 0);
    
    const sequence: number[][] = [];
    for (let t = 0; t < sequenceLength; t++) {
      const feats = generateSyntheticFeatures(isAttentive, random);
      sequence.push(feats);
    }
    features.push(sequence);
  }

  return {
    features: tf.tensor3d(features, [numSamples, sequenceLength, FEATURE_DIM]),
    labels: tf.tensor1d(labels),
  };
}

/**
 * Generate synthetic features for a single timestep
 */
function generateSyntheticFeatures(isAttentive: boolean, rand: () => number): number[] {
  if (isAttentive) {
    return [
      rand() * 300 + 50,
      Math.floor(rand() * 8),
      Math.floor(rand() * 5),
      Math.floor(rand() * 20),
      rand() * 300000 + 60000,
      0.7 + rand() * 0.3,
      rand() * 300000 + 120000,
      0.8 + rand() * 0.2,
      0.7 + rand() * 0.3,
      rand() * 3000000 + 300000,
      rand() * 2400000 + 120000,
      rand() * 600000,
      Math.floor(rand() * 720),
      1, 0, 0,
      0.8 + rand() * 0.2,
      rand() * 2,
      0.2 + rand() * 0.3,
      0.8 + rand() * 0.2,
    ];
  } else {
    return [
      rand() * 5000,
      Math.floor(rand() * 2),
      Math.floor(rand() * 1),
      Math.floor(rand() * 2),
      rand() * 120000,
      rand() * 0.3,
      rand() * 120000,
      rand() * 0.3,
      rand() * 0.3,
      rand() * 600000 + 60000,
      rand() * 120000,
      rand() * 500000,
      Math.floor(rand() * 10),
      1, 0, 0,
      rand() * 0.5,
      rand() * 0.5,
      0.6 + rand() * 0.4,
      0.2 + rand() * 0.3,
    ];
  }
}