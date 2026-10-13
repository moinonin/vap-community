import { describe, it, expect, beforeEach } from 'vitest';
import { 
  InMemoryPricingEngine, 
  getPricingEngine, 
  setPricingEngine, 
  calculatePrice, 
  calculateBatchPrices,
  getDefaultPricingConfig,
  type PricingInput,
  type PricingResult
} from './index.js';

describe('InMemoryPricingEngine', () => {
  let engine: InMemoryPricingEngine;

  beforeEach(() => {
    engine = new InMemoryPricingEngine();
  });

  it('should calculate price with all multipliers', () => {
    const input: PricingInput = {
      basePriceMicros: 100_000,
      contentType: 'VIDEO_LONG',
      qualityTier: 'PREMIUM',
      confidence: 0.9,
      marketConditions: {
        supplyDemandRatio: 1.2,
        timeOfDayFactor: 1.1,
        seasonalityFactor: 1.0,
        platformCompetition: 1.0,
        geoMarketFactor: 1.0,
      },
      engagementMetrics: {
        ctr: 0.2,
        vtr: 0.9,
        avgEngagementTimeSec: 280,
        completionRate: 0.9,
        sharesPerView: 0.08,
        commentsPerView: 0.04,
      },
      publisherReputation: {
        reputationScore: 0.8,
        fraudRate: 0.01,
        avgQuality: 0.8,
        ageDays: 365,
        totalVerifiedContent: 100,
      },
      config: {
        contentTypeMultipliers: {
          ARTICLE: 1.0,
          VIDEO_LONG: 1.8,
        },
        qualityTierMultipliers: {
          PREMIUM: 1.5,
          STANDARD: 1.0,
          BASIC: 0.7,
        },
        confidenceMultiplier: { enabled: true, curve: 'SIGMOID', minMultiplier: 0.5, maxMultiplier: 2.0 },
        marketWeights: { supplyDemand: 0.3, timeOfDay: 0.1, seasonality: 0.1, platformCompetition: 0.2, geoMarket: 0.1 },
        engagementWeights: { ctr: 0.2, vtr: 0.15, engagementTime: 0.2, completionRate: 0.2, shares: 0.15, comments: 0.1 },
        publisherWeights: { reputationScore: 0.3, fraudRate: 0.2, avgQuality: 0.3, age: 0.1, volume: 0.1 },
        minPriceMicros: 0,
      },
    };

    const result = engine.calculatePrice(input);

    expect(result.priceMicros).toBeGreaterThan(100_000);
    expect(result.breakdown.contentTypeMultiplier).toBe(1.8); // VIDEO_LONG
    expect(result.breakdown.qualityTierMultiplier).toBe(1.5); // PREMIUM
    expect(result.breakdown.confidenceMultiplier).toBeGreaterThan(1.0);
    expect(result.breakdown.marketMultiplier).toBeGreaterThan(1.0);
    expect(result.breakdown.engagementMultiplier).toBeGreaterThan(1.0);
    expect(result.breakdown.publisherMultiplier).toBeGreaterThan(1.0);
    expect(result.currency).toBe('USD');
    expect(result.calculatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should apply min/max price bounds', () => {
    const input: PricingInput = {
      basePriceMicros: 100_000,
      contentType: 'ARTICLE',
      qualityTier: 'STANDARD',
      confidence: 0.5,
      marketConditions: {},
      engagementMetrics: {},
      publisherReputation: {
        reputationScore: 0.5,
        fraudRate: 0.0,
        avgQuality: 0.5,
        ageDays: 100,
        totalVerifiedContent: 10,
      },
      config: {
        minPriceMicros: 50_000,
        maxPriceMicros: 200_000,
      },
    };

    const result = engine.calculatePrice(input);

    expect(result.priceMicros).toBeGreaterThanOrEqual(50_000);
    expect(result.priceMicros).toBeLessThanOrEqual(200_000);
    expect(result.breakdown.capped).toBeDefined();
  });

  it('should handle batch calculation', () => {
    const inputs = [
      {
        basePriceMicros: 100_000,
        contentType: 'ARTICLE' as const,
        qualityTier: 'STANDARD' as const,
        confidence: 0.7,
        marketConditions: {},
        engagementMetrics: {},
        publisherReputation: { reputationScore: 0.5, fraudRate: 0.0, avgQuality: 0.5, ageDays: 100, totalVerifiedContent: 10 },
      },
      {
        basePriceMicros: 200_000,
        contentType: 'VIDEO_SHORT' as const,
        qualityTier: 'PREMIUM' as const,
        confidence: 0.9,
        marketConditions: {},
        engagementMetrics: {},
        publisherReputation: { reputationScore: 0.8, fraudRate: 0.01, avgQuality: 0.8, ageDays: 365, totalVerifiedContent: 100 },
      },
    ];

    const results = engine.calculateBatch(inputs);

    expect(results).toHaveLength(2);
    expect(results[0].priceMicros).toBeGreaterThan(0);
    expect(results[1].priceMicros).toBeGreaterThan(results[0].priceMicros);
  });

  it('should return default config', () => {
    const config = engine.getDefaultConfig();

    expect(config.contentTypeMultipliers.ARTICLE).toBe(1.0);
    expect(config.qualityTierMultipliers.PREMIUM).toBe(1.5);
    expect(config.confidenceMultiplier.curve).toBe('SIGMOID');
    expect(config.marketWeights.supplyDemand).toBe(0.3);
  });
});

describe('PricingEngine Factory', () => {
  it('should return singleton instance', () => {
    const e1 = getPricingEngine();
    const e2 = getPricingEngine();
    expect(e1).toBe(e2);
  });

  it('should allow setting custom implementation', () => {
    const custom = new InMemoryPricingEngine();
    setPricingEngine(custom);
    expect(getPricingEngine()).toBe(custom);
  });
});

describe('Convenience Functions', () => {
  it('should calculate price via convenience function', () => {
    const input = {
      basePriceMicros: 100_000,
      contentType: 'VIDEO_LONG' as const,
      qualityTier: 'PREMIUM' as const,
      confidence: 0.8,
      marketConditions: { supplyDemandRatio: 1.1 },
      engagementMetrics: { ctr: 0.05 },
      publisherReputation: { reputationScore: 0.7, fraudRate: 0.02, avgQuality: 0.7, ageDays: 200, totalVerifiedContent: 50 },
    };

    const result = calculatePrice(input);

    expect(result.priceMicros).toBeGreaterThan(100_000);
  });

  it('should calculate batch prices via convenience function', () => {
    const inputs = [
      { basePriceMicros: 100_000, contentType: 'ARTICLE' as const, qualityTier: 'STANDARD' as const, confidence: 0.7, marketConditions: {}, engagementMetrics: {}, publisherReputation: { reputationScore: 0.5, fraudRate: 0.0, avgQuality: 0.5, ageDays: 100, totalVerifiedContent: 10 } },
      { basePriceMicros: 200_000, contentType: 'VIDEO_SHORT' as const, qualityTier: 'PREMIUM' as const, confidence: 0.9, marketConditions: {}, engagementMetrics: {}, publisherReputation: { reputationScore: 0.8, fraudRate: 0.01, avgQuality: 0.8, ageDays: 365, totalVerifiedContent: 100 } },
    ];

    const results = calculateBatchPrices(inputs);

    expect(results).toHaveLength(2);
  });

  it('should get default config', () => {
    const config = getDefaultPricingConfig();

    expect(config.contentTypeMultipliers.ARTICLE).toBe(1.0);
    expect(config.qualityTierMultipliers.PREMIUM).toBe(1.5);
    expect(config.confidenceMultiplier.curve).toBe('SIGMOID');
    expect(config.marketWeights.supplyDemand).toBe(0.3);
  });
});