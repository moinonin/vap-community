import { describe, it, expect, beforeEach } from 'vitest';
import { 
  InMemoryCampaignEngine, 
  getCampaignEngine, 
  setCampaignEngine, 
  createCampaign, 
  calculatePrice, 
  checkCaps,
  type CampaignInput,
  type CampaignStatus,
  type PricingParams,
  type CapCheckParams
} from './index.js';

describe('InMemoryCampaignEngine', () => {
  let engine: InMemoryCampaignEngine;

  beforeEach(() => {
    engine = new InMemoryCampaignEngine();
    setCampaignEngine(engine);
  });

  it('should create a campaign with defaults', () => {
    const input: CampaignInput = {
      name: 'Test Campaign',
      description: 'A test campaign',
      startDate: new Date(Date.now() - 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      budget: {
        totalBudgetMicros: 1_000_000_000,
        spentBudgetMicros: 0,
        currency: 'USD',
        autoReplenish: { enabled: false },
      },
      pricing: {
        basePriceMicros: 100_000,
        contentTypeMultipliers: {},
        qualityTierMultipliers: {
          PREMIUM: 1.5,
          STANDARD: 1.0,
          BASIC: 0.7,
        },
        confidenceMultiplier: { enabled: true, curve: 'LINEAR' },
      },
      caps: {
        perUser: 10,
        dailyGlobal: 1000,
      },
      targeting: {
        contentTypes: [],
        qualityTiers: [],
      },
      eligibilityCriteria: {
        allowedOutcomes: ['PASS'],
        minConfidence: 0.5,
        allowedProofStates: ['PUBLISHED'],
        checkDeduplication: true,
      },
      tags: [],
    };

    const campaign = engine.createCampaign(input);

    expect(campaign.campaignId).toMatch(/^campaign_\d+_\d+$/);
    expect(campaign.name).toBe('Test Campaign');
    expect(campaign.status).toBe('ACTIVE');
    expect(campaign.budget.totalBudgetMicros).toBe(1_000_000_000);
  });

  it('should get a campaign by ID', () => {
    const input: CampaignInput = {
      name: 'Get Test',
      startDate: new Date(Date.now() + 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      budget: { 
        totalBudgetMicros: 100_000, 
        spentBudgetMicros: 0,
        currency: 'USD',
        autoReplenish: { enabled: false },
      },
      pricing: { 
        basePriceMicros: 100_000,
        contentTypeMultipliers: {},
        qualityTierMultipliers: {},
        confidenceMultiplier: { enabled: true, curve: 'LINEAR' },
      },
      caps: {},
      targeting: { contentTypes: [], qualityTiers: [] },
      eligibilityCriteria: {
        allowedOutcomes: ['PASS'],
        minConfidence: 0.5,
        allowedProofStates: ['PUBLISHED'],
        checkDeduplication: true,
      },
      tags: [],
    };

    const campaign = engine.createCampaign(input);
    const retrieved = engine.getCampaign(campaign.campaignId);

    expect(retrieved).toEqual(campaign);
  });

  it('should update a campaign', () => {
    const input: CampaignInput = {
      name: 'Update Test',
      startDate: new Date(Date.now() + 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      budget: { 
        totalBudgetMicros: 100_000, 
        spentBudgetMicros: 0,
        currency: 'USD',
        autoReplenish: { enabled: false },
      },
      pricing: { 
        basePriceMicros: 100_000,
        contentTypeMultipliers: {},
        qualityTierMultipliers: {},
        confidenceMultiplier: { enabled: true, curve: 'LINEAR' },
      },
      caps: {},
      targeting: { contentTypes: [], qualityTiers: [] },
      eligibilityCriteria: {
        allowedOutcomes: ['PASS'],
        minConfidence: 0.5,
        allowedProofStates: ['PUBLISHED'],
        checkDeduplication: true,
      },
      tags: [],
    };

    const campaign = engine.createCampaign(input);
    const updated = engine.updateCampaign({
      campaignId: campaign.campaignId,
      name: 'Updated Name',
      description: 'Updated description',
    });

    expect(updated).not.toBeUndefined();
    expect(updated!.name).toBe('Updated Name');
    expect(updated!.description).toBe('Updated description');
  });

  it('should list campaigns with filters', () => {
    engine.createCampaign({
      name: 'Campaign 1',
      startDate: new Date(Date.now() + 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      budget: { totalBudgetMicros: 100_000, spentBudgetMicros: 0, currency: 'USD', autoReplenish: { enabled: false } },
      pricing: { basePriceMicros: 100_000, contentTypeMultipliers: {}, qualityTierMultipliers: {}, confidenceMultiplier: { enabled: true, curve: 'LINEAR' } },
      caps: {},
      targeting: { contentTypes: [], qualityTiers: [] },
      eligibilityCriteria: { allowedOutcomes: ['PASS'], minConfidence: 0.5, allowedProofStates: ['PUBLISHED'], checkDeduplication: true },
      tags: ['tag1'],
    });

    engine.createCampaign({
      name: 'Campaign 2',
      startDate: new Date(Date.now() + 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      budget: { totalBudgetMicros: 200_000, spentBudgetMicros: 0, currency: 'USD', autoReplenish: { enabled: false } },
      pricing: { basePriceMicros: 200_000, contentTypeMultipliers: {}, qualityTierMultipliers: {}, confidenceMultiplier: { enabled: true, curve: 'LINEAR' } },
      caps: {},
      targeting: { contentTypes: [], qualityTiers: [] },
      eligibilityCriteria: { allowedOutcomes: ['PASS'], minConfidence: 0.5, allowedProofStates: ['PUBLISHED'], checkDeduplication: true },
      tags: ['tag2'],
    });

    const allCampaigns = engine.listCampaigns({});
    expect(allCampaigns.length).toBe(2);

    const taggedCampaigns = engine.listCampaigns({ tags: ['tag1'] });
    expect(taggedCampaigns.length).toBe(1);
    expect(taggedCampaigns[0].name).toBe('Campaign 1');
  });

  it('should calculate price with multipliers', () => {
    const campaign = createCampaign({
      name: 'Price Test',
      startDate: new Date(Date.now() + 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      budget: { totalBudgetMicros: 1_000_000_000, spentBudgetMicros: 0, currency: 'USD', autoReplenish: { enabled: false } },
      pricing: {
        basePriceMicros: 100_000,
        contentTypeMultipliers: { VIDEO_LONG: 1.8 },
        qualityTierMultipliers: { PREMIUM: 1.5, STANDARD: 1.0, BASIC: 0.7 },
        confidenceMultiplier: { enabled: true, curve: 'LINEAR' },
      },
      caps: {},
      targeting: { contentTypes: [], qualityTiers: [] },
      eligibilityCriteria: { allowedOutcomes: ['PASS'], minConfidence: 0.5, allowedProofStates: ['PUBLISHED'], checkDeduplication: true },
      tags: [],
    });

    const params: PricingParams = {
      basePriceMicros: 100_000,
      contentType: 'VIDEO_LONG',
      qualityTier: 'PREMIUM',
      confidence: 0.9,
    };

    const result = calculatePrice(campaign.campaignId, params);

    expect(result.priceMicros).toBeGreaterThan(100_000);
    expect(result.breakdown.contentTypeMultiplier).toBe(1.8);
    expect(result.breakdown.qualityTierMultiplier).toBe(1.5);
  });

  it('should check caps', () => {
    const campaign = createCampaign({
      name: 'Cap Test',
      startDate: new Date(Date.now() + 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      budget: { totalBudgetMicros: 1_000_000_000, spentBudgetMicros: 0, currency: 'USD', autoReplenish: { enabled: false } },
      pricing: { basePriceMicros: 100_000, contentTypeMultipliers: {}, qualityTierMultipliers: {}, confidenceMultiplier: { enabled: true, curve: 'LINEAR' } },
      caps: { perUser: 5, perSession: 5, dailyGlobal: 100 },
      targeting: { contentTypes: [], qualityTiers: [] },
      eligibilityCriteria: { allowedOutcomes: ['PASS'], minConfidence: 0.5, allowedProofStates: ['PUBLISHED'], checkDeduplication: true },
      tags: [],
    });

    const params: CapCheckParams = {
      userId: 'user1',
      sessionId: 'session1',
      contentId: 'content1',
      verifierId: 'verifier1',
      date: new Date().toISOString().split('T')[0],
    };

    for (let i = 0; i < 5; i++) {
      const result = checkCaps(campaign.campaignId, params);
      expect(result.allowed).toBe(true);
    }

    const result = checkCaps(campaign.campaignId, params);
    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('should match targeting rules', () => {
    const campaign = createCampaign({
      name: 'Targeting Test',
      startDate: new Date(Date.now() + 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      budget: { totalBudgetMicros: 1_000_000_000, spentBudgetMicros: 0, currency: 'USD', autoReplenish: { enabled: false } },
      pricing: { basePriceMicros: 100_000, contentTypeMultipliers: {}, qualityTierMultipliers: {}, confidenceMultiplier: { enabled: true, curve: 'LINEAR' } },
      caps: {},
      targeting: {
        contentTypes: ['ARTICLE', 'VIDEO_LONG'],
        qualityTiers: ['PREMIUM', 'STANDARD'],
        geoCountries: ['US', 'CA'],
      },
      eligibilityCriteria: { allowedOutcomes: ['PASS'], minConfidence: 0.5, allowedProofStates: ['PUBLISHED'], checkDeduplication: true },
      tags: [],
    });

    const matchingContext = {
      contentType: 'ARTICLE',
      qualityTier: 'PREMIUM' as const,
      geoCountry: 'US',
      platform: 'web',
      timestamp: new Date().toISOString(),
      customAttributes: {},
    };

    const nonMatchingContext = {
      contentType: 'SOCIAL_POST',
      qualityTier: 'BASIC' as const,
      geoCountry: 'FR',
      platform: 'mobile',
      timestamp: new Date().toISOString(),
      customAttributes: {},
    };

    expect(engine.matchTargeting(campaign.campaignId, matchingContext)).toBe(true);
    expect(engine.matchTargeting(campaign.campaignId, nonMatchingContext)).toBe(false);
  });

  it('should transition status correctly', () => {
    const campaign = createCampaign({
      name: 'Status Test',
      startDate: new Date(Date.now() - 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      budget: { totalBudgetMicros: 1_000_000_000, spentBudgetMicros: 0, currency: 'USD', autoReplenish: { enabled: false } },
      pricing: { basePriceMicros: 100_000, contentTypeMultipliers: {}, qualityTierMultipliers: {}, confidenceMultiplier: { enabled: true, curve: 'LINEAR' } },
      caps: {},
      targeting: { contentTypes: [], qualityTiers: [] },
      eligibilityCriteria: { allowedOutcomes: ['PASS'], minConfidence: 0.5, allowedProofStates: ['PUBLISHED'], checkDeduplication: true },
      tags: [],
    });

    expect(campaign.status).toBe('ACTIVE');

    const paused = engine.transitionStatus(campaign.campaignId, 'PAUSED');
    expect(paused?.status).toBe('PAUSED');

    const resumed = engine.transitionStatus(campaign.campaignId, 'ACTIVE');
    expect(resumed?.status).toBe('ACTIVE');
  });

  it('should fail invalid status transitions', () => {
    const campaign = createCampaign({
      name: 'Invalid Transition Test',
      startDate: new Date(Date.now() - 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      budget: { totalBudgetMicros: 1_000_000_000, spentBudgetMicros: 0, currency: 'USD', autoReplenish: { enabled: false } },
      pricing: { basePriceMicros: 100_000, contentTypeMultipliers: {}, qualityTierMultipliers: {}, confidenceMultiplier: { enabled: true, curve: 'LINEAR' } },
      caps: {},
      targeting: { contentTypes: [], qualityTiers: [] },
      eligibilityCriteria: { allowedOutcomes: ['PASS'], minConfidence: 0.5, allowedProofStates: ['PUBLISHED'], checkDeduplication: true },
      tags: [],
    });

    // Transition to EXHAUSTED (valid: ACTIVE -> EXHAUSTED)
    engine.transitionStatus(campaign.campaignId, 'EXHAUSTED');
    expect(() => engine.transitionStatus(campaign.campaignId, 'ACTIVE')).toThrow();
  });
});

describe('CampaignEngine Factory', () => {
  it('should return singleton instance', () => {
    const e1 = getCampaignEngine();
    const e2 = getCampaignEngine();
    expect(e1).toBe(e2);
  });

  it('should allow setting custom implementation', () => {
    const custom = new InMemoryCampaignEngine();
    setCampaignEngine(custom);
    expect(getCampaignEngine()).toBe(custom);
  });
});