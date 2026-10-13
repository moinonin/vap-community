/**
 * Dynamic Pricing Engine (VAE Sprint 12)
 *
 * Calculates attention value based on:
 * - Content type (article, video, audio, interactive, etc.)
 * - Viewer quality (premium, standard, basic)
 * - Market conditions (supply/demand, time of day, seasonality)
 * - Verification confidence
 * - Content engagement metrics
 * - Publisher reputation
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const ContentTypeSchema = z.enum([
  'ARTICLE',
  'VIDEO_SHORT',
  'VIDEO_LONG',
  'AUDIO_PODCAST',
  'AUDIO_MUSIC',
  'INTERACTIVE_GAME',
  'INTERACTIVE_QUIZ',
  'INTERACTIVE_POLL',
  'LIVE_STREAM',
  'SOCIAL_POST',
  'NEWSLETTER',
  'OTHER',
]);

export type ContentType = z.infer<typeof ContentTypeSchema>;

export const QualityTierSchema = z.enum(['PREMIUM', 'STANDARD', 'BASIC']);
export type QualityTier = z.infer<typeof QualityTierSchema>;

export const MarketConditionSchema = z.object({
  // Supply/demand ratio (0 = oversupply, 1 = balanced, >1 = undersupply)
  supplyDemandRatio: z.number().positive().default(1.0),
  // Time of day factor (0-1, peak hours = higher)
  timeOfDayFactor: z.number().min(0).max(2).default(1.0),
  // Seasonality factor (holidays, events)
  seasonalityFactor: z.number().positive().default(1.0),
  // Platform competition factor
  platformCompetition: z.number().positive().default(1.0),
  // Geographic market factor
  geoMarketFactor: z.number().positive().default(1.0),
});

export type MarketCondition = z.infer<typeof MarketConditionSchema>;

export const EngagementMetricsSchema = z.object({
  // Click-through rate
  ctr: z.number().min(0).max(1).optional(),
  // View-through rate
  vtr: z.number().min(0).max(1).optional(),
  // Average engagement time (seconds)
  avgEngagementTimeSec: z.number().int().nonnegative().optional(),
  // Completion rate
  completionRate: z.number().min(0).max(1).optional(),
  // Social shares per view
  sharesPerView: z.number().min(0).optional(),
  // Comments per view
  commentsPerView: z.number().min(0).optional(),
});

export type EngagementMetrics = z.infer<typeof EngagementMetricsSchema>;

export const PublisherReputationSchema = z.object({
  // Overall reputation score (0-1)
  reputationScore: z.number().min(0).max(1).default(0.5),
  // Historical fraud rate (0-1)
  fraudRate: z.number().min(0).max(1).default(0.0),
  // Average content quality (0-1)
  avgQuality: z.number().min(0).max(1).default(0.5),
  // Publisher age in days
  ageDays: z.number().int().nonnegative().default(0),
  // Total verified content count
  totalVerifiedContent: z.number().int().nonnegative().default(0),
});

export type PublisherReputation = z.infer<typeof PublisherReputationSchema>;

export const PricingInputSchema = z.object({
  // Base price in micros (from campaign)
  basePriceMicros: z.number().int().positive(),
  // Content type
  contentType: ContentTypeSchema,
  // Viewer quality tier
  qualityTier: QualityTierSchema,
  // Verification confidence (0-1)
  confidence: z.number().min(0).max(1),
  // Market conditions
  marketConditions: MarketConditionSchema.default({}),
  // Engagement metrics
  engagementMetrics: EngagementMetricsSchema.default({}),
  // Publisher reputation
  publisherReputation: PublisherReputationSchema.default({}),
  // Pricing configuration overrides
  config: z.object({
    // Content type base multipliers
    contentTypeMultipliers: z.record(ContentTypeSchema, z.number().positive()).default({
      ARTICLE: 1.0,
      VIDEO_SHORT: 1.3,
      VIDEO_LONG: 1.8,
      AUDIO_PODCAST: 1.2,
      AUDIO_MUSIC: 1.1,
      INTERACTIVE_GAME: 2.0,
      INTERACTIVE_QUIZ: 1.4,
      INTERACTIVE_POLL: 1.2,
      LIVE_STREAM: 2.5,
      SOCIAL_POST: 0.5,
      NEWSLETTER: 0.8,
      OTHER: 1.0,
    }),
    // Quality tier multipliers
    qualityTierMultipliers: z.record(QualityTierSchema, z.number().positive()).default({
      PREMIUM: 1.5,
      STANDARD: 1.0,
      BASIC: 0.7,
    }),
    // Confidence multiplier curve
    confidenceMultiplier: z.object({
      enabled: z.boolean().default(true),
      curve: z.enum(['LINEAR', 'EXPONENTIAL', 'STEP', 'SIGMOID']).default('SIGMOID'),
      minMultiplier: z.number().positive().default(0.5),
      maxMultiplier: z.number().positive().default(2.0),
    }).default({ enabled: true, curve: 'SIGMOID', minMultiplier: 0.5, maxMultiplier: 2.0 }),
    // Market condition weights
    marketWeights: z.object({
      supplyDemand: z.number().min(0).max(1).default(0.3),
      timeOfDay: z.number().min(0).max(1).default(0.1),
      seasonality: z.number().min(0).max(1).default(0.1),
      platformCompetition: z.number().min(0).max(1).default(0.2),
      geoMarket: z.number().min(0).max(1).default(0.1),
    }).default({ supplyDemand: 0.3, timeOfDay: 0.1, seasonality: 0.1, platformCompetition: 0.2, geoMarket: 0.1 }),
    // Engagement weights
    engagementWeights: z.object({
      ctr: z.number().min(0).max(1).default(0.2),
      vtr: z.number().min(0).max(1).default(0.15),
      engagementTime: z.number().min(0).max(1).default(0.2),
      completionRate: z.number().min(0).max(1).default(0.2),
      shares: z.number().min(0).max(1).default(0.15),
      comments: z.number().min(0).max(1).default(0.1),
    }).default({ ctr: 0.2, vtr: 0.15, engagementTime: 0.2, completionRate: 0.2, shares: 0.15, comments: 0.1 }),
    // Publisher reputation weights
    publisherWeights: z.object({
      reputationScore: z.number().min(0).max(1).default(0.3),
      fraudRate: z.number().min(0).max(1).default(0.2),
      avgQuality: z.number().min(0).max(1).default(0.3),
      age: z.number().min(0).max(1).default(0.1),
      volume: z.number().min(0).max(1).default(0.1),
    }).default({ reputationScore: 0.3, fraudRate: 0.2, avgQuality: 0.3, age: 0.1, volume: 0.1 }),
    // Price bounds
    minPriceMicros: z.number().int().nonnegative().default(0),
    maxPriceMicros: z.number().int().positive().optional(),
  }).default({}),
});

export type PricingInput = z.infer<typeof PricingInputSchema>;

export const PriceBreakdownSchema = z.object({
  basePriceMicros: z.number().int().positive(),
  contentTypeMultiplier: z.number().positive(),
  qualityTierMultiplier: z.number().positive(),
  confidenceMultiplier: z.number().positive(),
  marketMultiplier: z.number().positive(),
  engagementMultiplier: z.number().positive(),
  publisherMultiplier: z.number().positive(),
  finalPriceMicros: z.number().int().nonnegative(),
  capped: z.boolean(),
});

export type PriceBreakdown = z.infer<typeof PriceBreakdownSchema>;

export const PricingResultSchema = z.object({
  priceMicros: z.number().int().nonnegative(),
  breakdown: PriceBreakdownSchema,
  currency: z.string().length(3).default('USD'),
  calculatedAt: z.string().datetime(),
});

export type PricingResult = z.infer<typeof PricingResultSchema>;

export interface PricingEngine {
  calculatePrice(input: PricingInput): PricingResult;
  calculateBatch(inputs: PricingInput[]): PricingResult[];
  getDefaultConfig(): PricingInput['config'];
}

// ─── Pricing Engine Implementation ──────────────────────────────────────────

export class InMemoryPricingEngine implements PricingEngine {
  calculatePrice(input: PricingInput): PricingResult {
    const config = { ...this.getDefaultConfig(), ...input.config };
    const calculatedAt = new Date().toISOString();
    const currency = 'USD';

    let priceMicros = input.basePriceMicros;

    // 1. Content type multiplier
    const contentTypeMultiplier = config.contentTypeMultipliers[input.contentType] ?? 1.0;
    priceMicros = Math.round(priceMicros * contentTypeMultiplier);

    // 2. Quality tier multiplier
    const qualityTierMultiplier = config.qualityTierMultipliers[input.qualityTier] ?? 1.0;
    priceMicros = Math.round(priceMicros * qualityTierMultiplier);

    // 3. Confidence multiplier
    let confidenceMultiplier = 1.0;
    if (config.confidenceMultiplier.enabled) {
      const { curve, minMultiplier, maxMultiplier } = config.confidenceMultiplier;
      const c = input.confidence;
      
      let multiplier: number;
      switch (curve) {
        case 'LINEAR':
          multiplier = c;
          break;
        case 'EXPONENTIAL':
          multiplier = c * c;
          break;
        case 'STEP':
          if (c >= 0.9) multiplier = 1.5;
          else if (c >= 0.7) multiplier = 1.2;
          else if (c >= 0.5) multiplier = 1.0;
          else multiplier = 0.7;
          break;
        case 'SIGMOID':
          // Sigmoid centered at 0.5, steepness 10
          multiplier = 1 / (1 + Math.exp(-10 * (c - 0.5)));
          multiplier = 0.5 + multiplier * 1.5; // Scale to 0.5-2.0
          break;
        default:
          multiplier = c;
      }
      
      // Clamp to bounds
      confidenceMultiplier = Math.max(config.confidenceMultiplier.minMultiplier, 
        Math.min(config.confidenceMultiplier.maxMultiplier, multiplier));
    }
    priceMicros = Math.round(priceMicros * confidenceMultiplier);

    // 4. Market condition multiplier
    const mc = input.marketConditions;
    const marketWeights = config.marketWeights;
    const marketMultiplier = 1.0 + (
      ((mc.supplyDemandRatio ?? 1.0) - 1.0) * marketWeights.supplyDemand +
      ((mc.timeOfDayFactor ?? 1.0) - 1.0) * marketWeights.timeOfDay +
      ((mc.seasonalityFactor ?? 1.0) - 1.0) * marketWeights.seasonality +
      ((mc.platformCompetition ?? 1.0) - 1.0) * marketWeights.platformCompetition +
      ((mc.geoMarketFactor ?? 1.0) - 1.0) * marketWeights.geoMarket
    );
    priceMicros = Math.round(priceMicros * Math.max(0.5, marketMultiplier)); // Floor at 0.5x

    // 5. Engagement multiplier
    const em = input.engagementMetrics;
    const ew = config.engagementWeights;
    let engagementScore = 0;
    let engagementWeightSum = 0;

    if (em.ctr !== undefined) {
      engagementScore += em.ctr * ew.ctr;
      engagementWeightSum += ew.ctr;
    }
    if (em.vtr !== undefined) {
      engagementScore += em.vtr * ew.vtr;
      engagementWeightSum += ew.vtr;
    }
    if (em.avgEngagementTimeSec !== undefined) {
      // Normalize engagement time (assume 300s = 1.0)
      const normalizedTime = Math.min(em.avgEngagementTimeSec / 300, 1.0);
      engagementScore += normalizedTime * ew.engagementTime;
      engagementWeightSum += ew.engagementTime;
    }
    if (em.completionRate !== undefined) {
      engagementScore += em.completionRate * ew.completionRate;
      engagementWeightSum += ew.completionRate;
    }
    if (em.sharesPerView !== undefined) {
      // Normalize shares (assume 0.1 shares/view = 1.0)
      const normalizedShares = Math.min(em.sharesPerView / 0.1, 1.0);
      engagementScore += normalizedShares * ew.shares;
      engagementWeightSum += ew.shares;
    }
    if (em.commentsPerView !== undefined) {
      // Normalize comments (assume 0.05 comments/view = 1.0)
      const normalizedComments = Math.min(em.commentsPerView / 0.05, 1.0);
      engagementScore += normalizedComments * ew.comments;
      engagementWeightSum += ew.comments;
    }

    const engagementMultiplier = engagementWeightSum > 0 
      ? 1.0 + (engagementScore / engagementWeightSum - 0.5) * 0.5 // Range: 0.75x to 1.25x
      : 1.0;

    priceMicros = Math.round(priceMicros * engagementMultiplier);

    // 6. Publisher reputation multiplier
    const pr = input.publisherReputation;
    const pw = config.publisherWeights;
    let publisherScore = 0;
    let publisherWeightSum = 0;

    publisherScore += pr.reputationScore * pw.reputationScore;
    publisherWeightSum += pw.reputationScore;

    publisherScore += (1 - pr.fraudRate) * pw.fraudRate;
    publisherWeightSum += pw.fraudRate;

    publisherScore += pr.avgQuality * pw.avgQuality;
    publisherWeightSum += pw.avgQuality;

    // Normalize age (assume 365 days = 1.0)
    const normalizedAge = Math.min(pr.ageDays / 365, 1.0);
    publisherScore += normalizedAge * pw.age;
    publisherWeightSum += pw.age;

    // Normalize volume (assume 1000 = 1.0)
    const normalizedVolume = Math.min(pr.totalVerifiedContent / 1000, 1.0);
    publisherScore += normalizedVolume * pw.volume;
    publisherWeightSum += pw.volume;

    const publisherMultiplier = publisherWeightSum > 0
      ? 0.8 + (publisherScore / publisherWeightSum) * 0.4 // Range: 0.8x to 1.2x
      : 1.0;

    priceMicros = Math.round(priceMicros * publisherMultiplier);

    // Apply bounds
    let capped = false;
    if (config.minPriceMicros !== undefined && priceMicros < config.minPriceMicros) {
      priceMicros = config.minPriceMicros;
      capped = true;
    }
    if (config.maxPriceMicros !== undefined && priceMicros > config.maxPriceMicros) {
      priceMicros = config.maxPriceMicros;
      capped = true;
    }

    // Build breakdown
    const breakdown = {
      basePriceMicros: input.basePriceMicros,
      contentTypeMultiplier,
      qualityTierMultiplier,
      confidenceMultiplier,
      marketMultiplier: Math.max(0.5, marketMultiplier),
      engagementMultiplier,
      publisherMultiplier,
      finalPriceMicros: priceMicros,
      capped,
    };

    return {
      priceMicros,
      breakdown,
      currency: 'USD',
      calculatedAt: new Date().toISOString(),
    };
  }

  calculateBatch(inputs: PricingInput[]): PricingResult[] {
    return inputs.map(input => this.calculatePrice(input));
  }

  getDefaultConfig(): PricingInput['config'] {
    return {
      contentTypeMultipliers: {
        ARTICLE: 1.0,
        VIDEO_SHORT: 1.3,
        VIDEO_LONG: 1.8,
        AUDIO_PODCAST: 1.2,
        AUDIO_MUSIC: 1.1,
        INTERACTIVE_GAME: 2.0,
        INTERACTIVE_QUIZ: 1.4,
        INTERACTIVE_POLL: 1.2,
        LIVE_STREAM: 2.5,
        SOCIAL_POST: 0.5,
        NEWSLETTER: 0.8,
        OTHER: 1.0,
      },
      qualityTierMultipliers: {
        PREMIUM: 1.5,
        STANDARD: 1.0,
        BASIC: 0.7,
      },
      confidenceMultiplier: {
        enabled: true,
        curve: 'SIGMOID',
        minMultiplier: 0.5,
        maxMultiplier: 2.0,
      },
      marketWeights: {
        supplyDemand: 0.3,
        timeOfDay: 0.1,
        seasonality: 0.1,
        platformCompetition: 0.2,
        geoMarket: 0.1,
      },
      engagementWeights: {
        ctr: 0.2,
        vtr: 0.15,
        engagementTime: 0.2,
        completionRate: 0.2,
        shares: 0.15,
        comments: 0.1,
      },
      publisherWeights: {
        reputationScore: 0.3,
        fraudRate: 0.2,
        avgQuality: 0.3,
        age: 0.1,
        volume: 0.1,
      },
      minPriceMicros: 0,
      maxPriceMicros: undefined,
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _pricingEngine: PricingEngine | null = null;

export function getPricingEngine(): PricingEngine {
  if (!_pricingEngine) {
    _pricingEngine = new InMemoryPricingEngine();
  }
  return _pricingEngine;
}

export function setPricingEngine(engine: PricingEngine): void {
  _pricingEngine = engine;
}

// ─── Convenience Function ─────────────────────────────────────────────────────

/**
 * Calculate price for a single pricing input.
 */
export function calculatePrice(input: PricingInput): PricingResult {
  return getPricingEngine().calculatePrice(input);
}

/**
 * Calculate prices for a batch of inputs.
 */
export function calculateBatchPrices(inputs: PricingInput[]): PricingResult[] {
  return getPricingEngine().calculateBatch(inputs);
}

/**
 * Get default pricing configuration.
 */
export function getDefaultPricingConfig(): PricingInput['config'] {
  return getPricingEngine().getDefaultConfig();
}