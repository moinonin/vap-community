/**
 * Campaign Engine (VAE Sprint 12)
 *
 * Manages reward campaigns with:
 * - Budget management (total, spent, remaining)
 * - Pricing rules (base price, multipliers, caps)
 * - Targeting rules (content types, viewer quality, geographic)
 * - Cap management (per-user, per-session, global)
 * - Campaign lifecycle (draft, active, paused, exhausted, expired)
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export const CampaignStatusEnum = z.enum([
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'EXHAUSTED',
  'EXPIRED',
  'CANCELLED',
]);

export type CampaignStatus = z.infer<typeof CampaignStatusEnum>;

export const TargetingRuleSchema = z.object({
  // Content type targeting
  contentTypes: z.array(z.string()).optional(),
  // Viewer quality tier targeting
  qualityTiers: z.array(z.enum(['PREMIUM', 'STANDARD', 'BASIC'])).optional(),
  // Geographic targeting (ISO country codes)
  geoCountries: z.array(z.string()).optional(),
  // Platform targeting
  platforms: z.array(z.string()).optional(),
  // Time window targeting
  timeWindows: z.array(z.object({
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(0).max(23),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  })).optional(),
  // Custom targeting attributes
  customAttributes: z.record(z.unknown()).optional(),
});

export type TargetingRule = z.infer<typeof TargetingRuleSchema>;

export const PricingRuleSchema = z.object({
  // Base price per unit of attention (in micros of base currency)
  basePriceMicros: z.number().int().positive(),
  // Multiplier based on content type
  contentTypeMultipliers: z.record(z.string(), z.number().positive()).default({}),
  // Multiplier based on viewer quality
  qualityTierMultipliers: z.record(z.enum(['PREMIUM', 'STANDARD', 'BASIC']), z.number().positive()).default({
    PREMIUM: 1.5,
    STANDARD: 1.0,
    BASIC: 0.7,
  }),
  // Multiplier based on verification confidence
  confidenceMultiplier: z.object({
    enabled: z.boolean().default(true),
    curve: z.enum(['LINEAR', 'EXPONENTIAL', 'STEP']).default('LINEAR'),
  }).default({ enabled: true, curve: 'LINEAR' }),
  // Maximum price cap
  maxPriceMicros: z.number().int().positive().optional(),
  // Minimum price floor
  minPriceMicros: z.number().int().nonnegative().optional(),
});

export type PricingRule = z.infer<typeof PricingRuleSchema>;

export const CapRuleSchema = z.object({
  // Per-user cap (max rewards per user)
  perUser: z.number().int().positive().optional(),
  // Per-session cap (max rewards per session)
  perSession: z.number().int().positive().optional(),
  // Per-content cap (max rewards per content piece)
  perContent: z.number().int().positive().optional(),
  // Per-verifier cap (max rewards per verifier)
  perVerifier: z.number().int().positive().optional(),
  // Global daily cap
  dailyGlobal: z.number().int().positive().optional(),
  // Global total cap for campaign
  totalGlobal: z.number().int().positive().optional(),
});

export type CapRule = z.infer<typeof CapRuleSchema>;

export const BudgetSchema = z.object({
  // Total budget in micros
  totalBudgetMicros: z.number().int().positive(),
  // Spent budget in micros
  spentBudgetMicros: z.number().int().nonnegative().default(0),
  // Currency code (ISO 4217)
  currency: z.string().length(3).default('USD'),
  // Auto-replenishment config
  autoReplenish: z.object({
    enabled: z.boolean().default(false),
    thresholdPercent: z.number().min(0).max(100).default(10),
    replenishAmountMicros: z.number().int().positive().optional(),
  }).optional(),
});

export type Budget = z.infer<typeof BudgetSchema>;

export const CampaignSchema = z.object({
  campaignId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: CampaignStatusEnum.default('DRAFT'),
  // Campaign schedule
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  // Budget configuration
  budget: BudgetSchema,
  // Pricing rules
  pricing: PricingRuleSchema,
  // Cap rules
  caps: CapRuleSchema,
  // Targeting rules
  targeting: TargetingRuleSchema,
  // Eligibility criteria for rewards
  eligibilityCriteria: z.object({
    allowedOutcomes: z.array(z.enum(['PASS', 'FAIL', 'INCONCLUSIVE', 'REVIEW'])).default(['PASS']),
    minConfidence: z.number().min(0).max(1).default(0.5),
    allowedProofStates: z.array(z.enum(['UNSIGNED', 'SIGNED', 'PUBLISHED', 'REVOKED', 'EXPIRED'])).default(['PUBLISHED']),
    checkDeduplication: z.boolean().default(true),
  }).default({}),
  // Metadata
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  updatedAt: z.string().datetime().optional(),
  createdBy: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export type Campaign = z.infer<typeof CampaignSchema>;

export const CampaignInputSchema = CampaignSchema.omit({
  campaignId: true,
  createdAt: true,
  updatedAt: true,
});

export type CampaignInput = z.infer<typeof CampaignInputSchema>;

export const CampaignUpdateSchema = CampaignSchema.partial().omit({
  campaignId: true,
  createdAt: true,
}).extend({
  campaignId: z.string().min(1),
});

export type CampaignUpdate = z.infer<typeof CampaignUpdateSchema>;

export interface CampaignEngine {
  createCampaign(input: CampaignInput): Campaign;
  getCampaign(campaignId: string): Campaign | undefined;
  updateCampaign(update: CampaignUpdate): Campaign | undefined;
  deleteCampaign(campaignId: string): boolean;
  listCampaigns(filters?: CampaignFilters): Campaign[];
  getCampaignStatus(campaignId: string): CampaignStatus | undefined;
  getBudgetStatus(campaignId: string): BudgetStatus | undefined;
  calculatePrice(campaignId: string, params: PricingParams): PriceResult;
  checkCaps(campaignId: string, params: CapCheckParams): CapCheckResult;
  matchTargeting(campaignId: string, context: TargetingContext): boolean;
  transitionStatus(campaignId: string, newStatus: CampaignStatus): Campaign | undefined;
}

export interface CampaignFilters {
  status?: CampaignStatus;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface BudgetStatus {
  totalBudgetMicros: number;
  spentBudgetMicros: number;
  remainingBudgetMicros: number;
  utilizationPercent: number;
  currency: string;
}

export interface PricingParams {
  basePriceMicros: number;
  contentType: string;
  qualityTier: 'PREMIUM' | 'STANDARD' | 'BASIC';
  confidence: number;
}

export interface PriceResult {
  priceMicros: number;
  breakdown: {
    basePriceMicros: number;
    contentTypeMultiplier: number;
    qualityTierMultiplier: number;
    confidenceMultiplier: number;
  };
  capped: boolean;
}

export interface CapCheckParams {
  userId: string;
  sessionId: string;
  contentId: string;
  verifierId: string;
  date: string; // YYYY-MM-DD
}

export interface CapCheckResult {
  allowed: boolean;
  violations: Array<{
    capType: string;
    current: number;
    limit: number;
  }>;
}

export interface TargetingContext {
  contentType: string;
  qualityTier: 'PREMIUM' | 'STANDARD' | 'BASIC';
  geoCountry: string;
  platform: string;
  timestamp: string;
  customAttributes: Record<string, unknown>;
}

// ─── In-Memory Campaign Engine ──────────────────────────────────────────────

export class InMemoryCampaignEngine implements CampaignEngine {
  private campaigns: Map<string, Campaign> = new Map();
  private capCounters: Map<string, Map<string, number>> = new Map(); // campaignId -> (capKey -> count)
  private campaignCounter = 0;

  createCampaign(input: CampaignInput): Campaign {
    const campaignId = `campaign_${Date.now()}_${++this.campaignCounter}`;
    const now = new Date().toISOString();

    const campaign: Campaign = {
      ...input,
      campaignId,
      createdAt: now,
      updatedAt: now,
    };

    // Validate dates
    const start = new Date(campaign.startDate).getTime();
    const end = campaign.endDate ? new Date(campaign.endDate).getTime() : Infinity;
    const nowTime = Date.now();

    if (end < start) {
      throw new Error('End date must be after start date');
    }

    // Set initial status based on dates
    if (nowTime < start) {
      campaign.status = 'DRAFT';
    } else if (nowTime > end) {
      campaign.status = 'EXPIRED';
    } else {
      campaign.status = 'ACTIVE';
    }

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  getCampaign(campaignId: string): Campaign | undefined {
    return this.campaigns.get(campaignId);
  }

  updateCampaign(update: CampaignUpdate): Campaign | undefined {
    const existing = this.campaigns.get(update.campaignId);
    if (!existing) return undefined;

    const updated: Campaign = {
      ...existing,
      ...update,
      updatedAt: new Date().toISOString(),
    };

    // Recalculate status if dates changed
    if (update.startDate || update.endDate) {
      const start = new Date(updated.startDate).getTime();
      const end = updated.endDate ? new Date(updated.endDate).getTime() : Infinity;
      const nowTime = Date.now();

      if (nowTime < start) {
        updated.status = 'DRAFT';
      } else if (nowTime > end) {
        updated.status = 'EXPIRED';
      } else if (updated.status !== 'PAUSED' && updated.status !== 'CANCELLED' && updated.status !== 'EXHAUSTED') {
        updated.status = 'ACTIVE';
      }
    }

    this.campaigns.set(update.campaignId, updated);
    return updated;
  }

  deleteCampaign(campaignId: string): boolean {
    return this.campaigns.delete(campaignId);
  }

  listCampaigns(filters: CampaignFilters = {}): Campaign[] {
    let campaigns = Array.from(this.campaigns.values());

    if (filters.status) {
      campaigns = campaigns.filter(c => c.status === filters.status);
    }
    if (filters.tags && filters.tags.length > 0) {
      campaigns = campaigns.filter(c => filters.tags!.some(t => c.tags.includes(t)));
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      campaigns = campaigns.filter(c => new Date(c.createdAt).getTime() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime();
      campaigns = campaigns.filter(c => new Date(c.createdAt).getTime() <= to);
    }

    campaigns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters.offset) {
      campaigns = campaigns.slice(filters.offset);
    }
    if (filters.limit) {
      campaigns = campaigns.slice(0, filters.limit);
    }

    return campaigns;
  }

  getCampaignStatus(campaignId: string): CampaignStatus | undefined {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return undefined;

    // Check if status should be auto-transitioned
    const now = Date.now();
    const start = new Date(campaign.startDate).getTime();
    const end = campaign.endDate ? new Date(campaign.endDate).getTime() : Infinity;

    if (campaign.status === 'ACTIVE') {
      if (now > end) return 'EXPIRED';
      if (now < start) return 'DRAFT';
    }

    return campaign.status;
  }

  getBudgetStatus(campaignId: string): { totalBudgetMicros: number; spentBudgetMicros: number; remainingBudgetMicros: number; utilizationPercent: number; currency: string } | undefined {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return undefined;

    const { totalBudgetMicros, spentBudgetMicros, currency } = campaign.budget;
    const remaining = totalBudgetMicros - spentBudgetMicros;
    const utilization = totalBudgetMicros > 0 ? (spentBudgetMicros / totalBudgetMicros) * 100 : 0;

    return {
      totalBudgetMicros,
      spentBudgetMicros,
      remainingBudgetMicros: remaining,
      utilizationPercent: Math.round(utilization * 100) / 100,
      currency,
    };
  }

  calculatePrice(campaignId: string, params: { basePriceMicros: number; contentType: string; qualityTier: 'PREMIUM' | 'STANDARD' | 'BASIC'; confidence: number }): { priceMicros: number; breakdown: { basePriceMicros: number; contentTypeMultiplier: number; qualityTierMultiplier: number; confidenceMultiplier: number }; capped: boolean } {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const pricing = campaign.pricing;
    let priceMicros = params.basePriceMicros;

    // Apply content type multiplier
    const contentTypeMultiplier = pricing.contentTypeMultipliers[params.contentType] ?? 1.0;
    priceMicros = Math.round(priceMicros * contentTypeMultiplier);

    // Apply quality tier multiplier
    const qualityTierMultiplier = pricing.qualityTierMultipliers[params.qualityTier] ?? 1.0;
    priceMicros = Math.round(priceMicros * qualityTierMultiplier);

    // Apply confidence multiplier
    let confidenceMultiplier = 1.0;
    if (pricing.confidenceMultiplier.enabled) {
      if (pricing.confidenceMultiplier.curve === 'LINEAR') {
        confidenceMultiplier = params.confidence;
      } else if (pricing.confidenceMultiplier.curve === 'EXPONENTIAL') {
        confidenceMultiplier = params.confidence * params.confidence;
      } else if (pricing.confidenceMultiplier.curve === 'STEP') {
        if (params.confidence >= 0.9) confidenceMultiplier = 1.5;
        else if (params.confidence >= 0.7) confidenceMultiplier = 1.2;
        else if (params.confidence >= 0.5) confidenceMultiplier = 1.0;
        else confidenceMultiplier = 0.5;
      }
      priceMicros = Math.round(priceMicros * confidenceMultiplier);
    }

    // Apply caps
    let capped = false;
    if (pricing.minPriceMicros !== undefined && priceMicros < pricing.minPriceMicros) {
      priceMicros = pricing.minPriceMicros;
      capped = true;
    }
    if (pricing.maxPriceMicros !== undefined && priceMicros > pricing.maxPriceMicros) {
      priceMicros = pricing.maxPriceMicros;
      capped = true;
    }

    return {
      priceMicros,
      breakdown: {
        basePriceMicros: params.basePriceMicros,
        contentTypeMultiplier,
        qualityTierMultiplier,
        confidenceMultiplier,
      },
      capped,
    };
  }

  checkCaps(campaignId: string, params: { userId: string; sessionId: string; contentId: string; verifierId: string; date: string }): { allowed: boolean; violations: Array<{ capType: string; current: number; limit: number }> } {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const caps = campaign.caps;
    const violations: Array<{ capType: string; current: number; limit: number }> = [];

    // Get or create counters for this campaign
    let campaignCaps = this.capCounters.get(campaignId);
    if (!campaignCaps) {
      campaignCaps = new Map();
      this.capCounters.set(campaignId, campaignCaps);
    }

    const checkCap = (capType: string, key: string, limit: number) => {
      const current = campaignCaps.get(key) || 0;
      if (current >= limit) {
        violations.push({ capType, current, limit });
      } else {
        campaignCaps.set(key, current + 1);
      }
    };

    if (caps.perUser) checkCap('perUser', `user:${params.userId}`, caps.perUser);
    if (caps.perSession) checkCap('perSession', `session:${params.sessionId}`, caps.perSession);
    if (caps.perContent) checkCap('perContent', `content:${params.contentId}`, caps.perContent);
    if (caps.perVerifier) checkCap('perVerifier', `verifier:${params.verifierId}`, caps.perVerifier);
    if (caps.dailyGlobal) checkCap('dailyGlobal', `daily:${params.date}`, caps.dailyGlobal);
    if (caps.totalGlobal) checkCap('totalGlobal', 'total', caps.totalGlobal);

    return {
      allowed: violations.length === 0,
      violations,
    };
  }

  matchTargeting(campaignId: string, context: { contentType: string; qualityTier: 'PREMIUM' | 'STANDARD' | 'BASIC'; geoCountry: string; platform: string; timestamp: string; customAttributes: Record<string, unknown> }): boolean {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return false;

    const targeting = campaign.targeting;

    if (targeting.contentTypes && targeting.contentTypes.length > 0) {
      if (!targeting.contentTypes.includes(context.contentType)) return false;
    }

    if (targeting.qualityTiers && targeting.qualityTiers.length > 0) {
      if (!targeting.qualityTiers.includes(context.qualityTier)) return false;
    }

    if (targeting.geoCountries && targeting.geoCountries.length > 0) {
      if (!targeting.geoCountries.includes(context.geoCountry)) return false;
    }

    if (targeting.platforms && targeting.platforms.length > 0) {
      if (!targeting.platforms.includes(context.platform)) return false;
    }

    if (targeting.timeWindows && targeting.timeWindows.length > 0) {
      const timestamp = new Date(context.timestamp);
      const hour = timestamp.getUTCHours();
      const dayOfWeek = timestamp.getUTCDay();

      const matchesWindow = targeting.timeWindows.some((window: typeof targeting.timeWindows[0]) => {
        if (hour < window.startHour || hour >= window.endHour) return false;
        if (window.daysOfWeek && !window.daysOfWeek.includes(dayOfWeek)) return false;
        return true;
      });

      if (!matchesWindow) return false;
    }

    // Custom attributes matching (all must match)
    if (targeting.customAttributes) {
      for (const [key, value] of Object.entries(targeting.customAttributes)) {
        if (context.customAttributes[key] !== value) return false;
      }
    }

    return true;
  }

  transitionStatus(campaignId: string, newStatus: CampaignStatus): Campaign | undefined {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return undefined;

    const validTransitions: Record<CampaignStatus, CampaignStatus[]> = {
      DRAFT: ['ACTIVE', 'CANCELLED'],
      ACTIVE: ['PAUSED', 'EXHAUSTED', 'EXPIRED', 'CANCELLED'],
      PAUSED: ['ACTIVE', 'CANCELLED'],
      EXHAUSTED: [],
      EXPIRED: [],
      CANCELLED: [],
    };

    if (!validTransitions[campaign.status]?.includes(newStatus)) {
      throw new Error(`Invalid status transition: ${campaign.status} -> ${newStatus}`);
    }

    campaign.status = newStatus;
    campaign.updatedAt = new Date().toISOString();
    return campaign;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _campaignEngine: CampaignEngine | null = null;

export function getCampaignEngine(): CampaignEngine {
  if (!_campaignEngine) {
    _campaignEngine = new InMemoryCampaignEngine();
  }
  return _campaignEngine;
}

export function setCampaignEngine(engine: CampaignEngine): void {
  _campaignEngine = engine;
}

// ─── Convenience Function ─────────────────────────────────────────────────────

/**
 * Create a new campaign with sensible defaults.
 */
export function createCampaign(input: CampaignInput): Campaign {
  return getCampaignEngine().createCampaign(input);
}

/**
 * Calculate price for a campaign with given parameters.
 */
export function calculatePrice(campaignId: string, params: { basePriceMicros: number; contentType: string; qualityTier: 'PREMIUM' | 'STANDARD' | 'BASIC'; confidence: number }): { priceMicros: number; breakdown: { basePriceMicros: number; contentTypeMultiplier: number; qualityTierMultiplier: number; confidenceMultiplier: number }; capped: boolean } {
  return getCampaignEngine().calculatePrice(campaignId, params);
}

/**
 * Check caps for a campaign.
 */
export function checkCaps(campaignId: string, params: { userId: string; sessionId: string; contentId: string; verifierId: string; date: string }): { allowed: boolean; violations: Array<{ capType: string; current: number; limit: number }> } {
  return getCampaignEngine().checkCaps(campaignId, params);
}