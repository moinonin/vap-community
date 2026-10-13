/**
 * Drift Detection
 *
 * Population Stability Index (PSI) over recently scored feature vectors
 * versus a reference window (e.g. the training distribution).
 *
 * Per feature f:           PSI_f = Σ_bins (p - q) * ln(p / q)
 * where q are bin fractions measured on the reference window (decile
 * edges, duplicates merged) and p are the fractions of the current
 * bins. The reported PSI is the mean across features; the common rule of
 * thumb flags drift at PSI > 0.25.
 */

export interface DriftStatus {
  psi: number;
  driftDetected: boolean;
  threshold: number;
  windowSize: number;
  featureCount: number;
}

export interface DriftDetectorConfig {
  /** Number of quantile bins per feature */
  bins: number;
  /** PSI threshold above which drift is flagged */
  threshold: number;
  /** Max number of recent feature vectors kept in the observation window */
  windowSize: number;
  /** Small constant to avoid ln(0) / division by zero */
  epsilon: number;
}

export const DEFAULT_DRIFT_CONFIG: DriftDetectorConfig = {
  bins: 10,
  threshold: 0.25,
  windowSize: 500,
  epsilon: 1e-4,
};

export class DriftDetector {
  private config: DriftDetectorConfig;
  /** bin edges (upper bound per bin, deduped) per feature index */
  private binEdges: number[][] = [];
  /** reference fraction per bin per feature index */
  private referenceFractions: number[][] = [];
  /** recent observation window: one row per scored request */
  private window: number[][] = [];

  constructor(config: Partial<DriftDetectorConfig> = {}) {
    this.config = { ...DEFAULT_DRIFT_CONFIG, ...config };
  }

  /**
   * Establish the reference distribution (e.g. training features).
   * Call once at startup and again after each retrain.
   *
   * Bins are deciles of the reference values with duplicate edges merged
   * (so constant or tied features collapse to fewer bins), and expected
   * fractions are taken from the reference counts themselves rather than
   * assumed uniform — this keeps same-distribution PSI near zero even for
   * integer or constant features.
   */
  setReference(rows: number[][]): void {
    if (rows.length === 0) throw new Error('Reference window must not be empty');
    const featureCount = rows[0]!.length;
    this.binEdges = [];
    this.referenceFractions = [];
    for (let f = 0; f < featureCount; f++) {
      const values = rows.map(r => r[f]!).sort((a, b) => a - b);
      const edges: number[] = [];
      for (let b = 1; b < this.config.bins; b++) {
        const edge = values[Math.floor((values.length * b) / this.config.bins)]!;
        if (edges.length === 0 || edge > edges[edges.length - 1]!) edges.push(edge);
      }
      edges.push(Number.POSITIVE_INFINITY);
      const counts = new Array(edges.length).fill(0) as number[];
      for (const v of values) {
        let b = 0;
        while (b < edges.length - 1 && v > edges[b]!) b++;
        counts[b]!++;
      }
      this.binEdges.push(edges);
      this.referenceFractions.push(counts.map(c => c / values.length));
    }
    this.window = [];
  }

  /** Record a scored feature vector into the observation window. */
  observe(features: number[]): void {
    if (this.binEdges.length === 0) return;
    this.window.push(features);
    if (this.window.length > this.config.windowSize) {
      this.window.splice(0, this.window.length - this.config.windowSize);
    }
  }

  /** Mean PSI of the current observation window vs reference. */
  getStatus(): DriftStatus {
    const featureCount = this.binEdges.length;
    if (featureCount === 0 || this.window.length === 0) {
      return { psi: 0, driftDetected: false, threshold: this.config.threshold, windowSize: this.window.length, featureCount };
    }
    const { epsilon } = this.config;
    let total = 0;
    for (let f = 0; f < featureCount; f++) {
      const edges = this.binEdges[f]!;
      const expected = this.referenceFractions[f]!;
      const counts = new Array(edges.length).fill(0) as number[];
      for (const row of this.window) {
        const v = row[f]!;
        let b = 0;
        while (b < edges.length - 1 && v > edges[b]!) b++;
        counts[b]!++;
      }
      let psi = 0;
      for (let b = 0; b < edges.length; b++) {
        const p = Math.max(counts[b]! / this.window.length, epsilon);
        const q = Math.max(expected[b]!, epsilon);
        psi += (p - q) * Math.log(p / q);
      }
      total += psi;
    }
    const psi = total / featureCount;
    return {
      psi,
      driftDetected: psi > this.config.threshold,
      threshold: this.config.threshold,
      windowSize: this.window.length,
      featureCount,
    };
  }

  resetWindow(): void {
    this.window = [];
  }
}
