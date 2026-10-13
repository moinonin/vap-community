/**
 * Feature Extraction Pipeline Stage
 * 
 * Extracts behavioral and contextual features from evidence for ML models.
 * Features include timing, interaction patterns, engagement, context, and trust signals.
 * 
 * @module @verified-attention/pipeline-features
 */

export {
  ExtractedFeaturesSchema,
  DEFAULT_EXTRACTION_OPTIONS,
  extractFeatures,
  extractFeaturesBatch,
  computeFeatureStatistics,
} from './features';

export type { ExtractedFeatures, FeatureExtractionOptions } from './features';