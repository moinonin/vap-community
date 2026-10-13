import { describe, it, expect } from 'vitest';
import { extractFeatures, extractFeaturesBatch, computeFeatureStatistics, ExtractedFeaturesSchema } from './features';

describe('Feature Extraction', () => {
  const createMockEvidence = (overrides: any = {}) => ({
    evidenceType: 'E-INTERACTION',
    payload: {
      clickCount: 5,
      avgScrollVelocity: 200,
      interactionDurationMs: 5000,
      engagementScore: 0.8,
    },
    metadata: {
      viewportWidth: 1920,
      viewportHeight: 1080,
      devicePixelRatio: 2,
    },
    ...overrides,
  });

  it('should extract timing features from interaction evidence', () => {
    const result = extractFeatures(createMockEvidence()) as any;
    expect(result.dwellTime).toBe(5000);
    expect(result.scrollVelocity).toBe(200);
  });

  it('should extract interaction features', () => {
    const result = extractFeatures(createMockEvidence()) as any;
    expect(result.clickCount).toBe(5);
  });

  it('should extract engagement features', () => {
    const result = extractFeatures(createMockEvidence()) as any;
    expect(result.engagementDepth).toBe(0.8);
  });

  it('should not extract features from non-interaction evidence', () => {
    const result = extractFeatures(createMockEvidence({ evidenceType: 'E-CONTEXT' })) as any;
    expect(result.clickCount).toBeUndefined();
  });

  it('should include raw values when enabled', () => {
    const result = extractFeatures(createMockEvidence(), { includeRaw: true }) as any;
    expect(result.rawValues).toBeDefined();
    expect(result.rawValues.clickCount).toBe(5);
  });

  it('should handle batch extraction', () => {
    const items = [createMockEvidence(), createMockEvidence({ payload: { clickCount: 10 } })];
    const results = extractFeaturesBatch(items as any);
    expect(results).toHaveLength(2);
    expect((results[0] as any).clickCount).toBe(5);
    expect((results[1] as any).clickCount).toBe(10);
  });

  it('should compute statistics', () => {
    const items = [createMockEvidence(), createMockEvidence({ payload: { clickCount: 15 } })];
    const features = extractFeaturesBatch(items as any);
    const stats = computeFeatureStatistics(features as any);
    expect(stats.clickCount.mean).toBe(10);
    expect(stats.clickCount.min).toBe(5);
    expect(stats.clickCount.max).toBe(15);
    expect(stats.clickCount.count).toBe(2);
  });

  it('should validate against schema', () => {
    const result = extractFeatures(createMockEvidence());
    expect(() => ExtractedFeaturesSchema.parse(result)).not.toThrow();
  });
});
