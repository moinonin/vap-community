/**
 * Feature Extraction Types and Schemas
 * 
 * Defines the schema and types for extracted evidence features.
 */

import { z } from 'zod';

/**
 * Schema for extracted features from evidence
 */
export const ExtractedFeaturesSchema = z.object({
  // Timing features
  readingSpeed: z.number().optional(),
  pauseDuration: z.number().optional(),
  dwellTime: z.number().optional(),

  // Interaction pattern features
  clickCount: z.number().int().min(0).optional(),
  scrollDepth: z.number().min(0).max(1).optional(),
  scrollVelocity: z.number().optional(),

  // Engagement features
  engagementDepth: z.number().min(0).max(1).optional(),
  attentionScore: z.number().min(0).max(1).optional(),

  // Context features
  viewportWidth: z.number().int().positive().optional(),
  viewportHeight: z.number().int().positive().optional(),
  devicePixelRatio: z.number().positive().optional(),

  // Trust features
  deviceTrustScore: z.number().min(0).max(1).optional(),
  sourceReliability: z.number().min(0).max(1).optional(),

  // Raw computed values (for debugging/tracing)
  rawValues: z.record(z.unknown()).optional(),
});

export type ExtractedFeatures = z.infer<typeof ExtractedFeaturesSchema>;

/**
 * Feature extraction options
 */
export interface FeatureExtractionOptions {
  includeTiming?: boolean;
  includeInteraction?: boolean;
  includeEngagement?: boolean;
  includeContext?: boolean;
  includeTrust?: boolean;
  includeRaw?: boolean;
}

/**
 * Default extraction options
 */
export const DEFAULT_EXTRACTION_OPTIONS: Required<FeatureExtractionOptions> = {
  includeTiming: true,
  includeInteraction: true,
  includeEngagement: true,
  includeContext: true,
  includeTrust: true,
  includeRaw: false,
};

/**
 * Minimal Evidence interface for feature extraction
 */
export interface Evidence {
  evidenceType: string;
  payload: Record<string, unknown>;
  metadata?: {
    viewportWidth?: number;
    viewportHeight?: number;
    devicePixelRatio?: number;
    deviceTrustScore?: number;
    sourceReliability?: number;
  };
}

/**
 * Extract features from a single evidence item
 */
export function extractFeatures(
  evidence: any,
  options: FeatureExtractionOptions = {}
): any {
  const opts = { ...DEFAULT_EXTRACTION_OPTIONS, ...options };
  const features: any = {};

  // Extract timing features from interaction evidence
  if (opts.includeTiming && evidence.evidenceType === 'E-INTERACTION') {
    const payload = evidence.payload as any;
    if (payload.readingSpeed !== undefined) features.readingSpeed = payload.readingSpeed;
    if (payload.pauseDuration !== undefined) features.pauseDuration = payload.pauseDuration;
    if (payload.interactionDurationMs !== undefined) features.dwellTime = payload.interactionDurationMs;
  }

  // Extract interaction features
  if (opts.includeInteraction && evidence.evidenceType === 'E-INTERACTION') {
    const payload = evidence.payload as any;
    if (payload.clickCount !== undefined) features.clickCount = payload.clickCount;
    if (payload.scrollDepth !== undefined) features.scrollDepth = Math.max(0, Math.min(1, payload.scrollDepth));
    if (payload.avgScrollVelocity !== undefined) features.scrollVelocity = payload.avgScrollVelocity;
  }

  // Extract engagement features
  if (opts.includeEngagement && evidence.evidenceType === 'E-INTERACTION') {
    const payload = evidence.payload as any;
    if (payload.engagementScore !== undefined) {
      features.engagementDepth = Math.max(0, Math.min(1, payload.engagementScore));
    }
    if (payload.attentionScore !== undefined) {
      features.attentionScore = Math.max(0, Math.min(1, payload.attentionScore));
    }
  }

  // Extract context features
  if (opts.includeContext && evidence.metadata) {
    if (evidence.metadata.viewportWidth) features.viewportWidth = evidence.metadata.viewportWidth;
    if (evidence.metadata.viewportHeight) features.viewportHeight = evidence.metadata.viewportHeight;
    if (evidence.metadata.devicePixelRatio) features.devicePixelRatio = evidence.metadata.devicePixelRatio;
  }

  // Extract trust features
  if (opts.includeTrust && evidence.metadata) {
    if (evidence.metadata.deviceTrustScore !== undefined) {
      features.deviceTrustScore = Math.max(0, Math.min(1, evidence.metadata.deviceTrustScore));
    }
    if (evidence.metadata.sourceReliability !== undefined) {
      features.sourceReliability = Math.max(0, Math.min(1, evidence.metadata.sourceReliability));
    }
  }

  // Include raw values for debugging
  if (opts.includeRaw && evidence.payload) {
    features.rawValues = { ...evidence.payload as Record<string, unknown> };
  }

  return features;
}

/**
 * Extract features from multiple evidence items
 */
export function extractFeaturesBatch(
  evidenceList: any[],
  options?: any
): any[] {
  return evidenceList.map(e => extractFeatures(e, options));
}

/**
 * Compute statistics from multiple feature extractions
 */
export function computeFeatureStatistics(
  featuresList: any[]
): Record<string, { mean: number; min: number; max: number; count: number }> {
  const stats: Record<string, number[]> = {};

  for (const features of featuresList) {
    for (const [key, value] of Object.entries(features)) {
      if (typeof value === 'number' && !isNaN(value) && key !== 'rawValues') {
        if (!stats[key]) stats[key] = [];
        stats[key].push(value);
      }
    }
  }

  const result: Record<string, { mean: number; min: number; max: number; count: number }> = {};
  for (const [key, values] of Object.entries(stats)) {
    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      result[key] = {
        mean: sum / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    }
  }

  return result;
}