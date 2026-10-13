import { describe, it, expect } from 'vitest';
import { 
  extractAttentionFeatures, 
  getAttentionFeatureNames, 
  validateFeatureVector, 
  ATTENTION_FEATURE_NAMES 
} from './index.js';
import type { Evidence } from '@verified-attention/core';
import { EvidenceType } from '@verified-attention/core';

// Helper to create valid E-INTERACTION evidence
function createInteractionEvidence(overrides: Partial<Evidence['payload']> = {}): Evidence {
  return {
    evidenceId: 'urn:vap:evidence:test-interaction-1',
    sessionId: 'urn:vap:session:test-1',
    sourceId: 'urn:vap:source:browser-extension-v1',
    timestamp: new Date().toISOString(),
    evidenceType: EvidenceType.INTERACTION,
    confidence: 0.9,
    payload: {
      avgScrollVelocity: 150,
      scrollDirectionChanges: 3,
      clickCount: 2,
      keyPressCount: 10,
      interactionDurationMs: 120000,
      engagementScore: 0.85,
      ...overrides,
    },
    provenance: {
      observationIds: ['obs-1'],
      observationHash: 'abc123',
      sourceId: 'urn:vap:source:browser-extension-v1',
    },
    signature: 'test-sig',
  };
}

// Helper to create valid E-VISIBLE evidence
function createVisibleEvidence(overrides: Partial<Evidence['payload']> = {}): Evidence {
  return {
    evidenceId: 'urn:vap:evidence:test-visible-1',
    sessionId: 'urn:vap:session:test-1',
    sourceId: 'urn:vap:source:browser-extension-v1',
    timestamp: new Date().toISOString(),
    evidenceType: EvidenceType.VISIBLE,
    confidence: 0.9,
    payload: {
      visibleDurationMs: 300000,
      maxVisibilityRatio: 0.95,
      avgVisibilityRatio: 0.85,
      ...overrides,
    },
    provenance: {
      observationIds: ['obs-2'],
      observationHash: 'def456',
      sourceId: 'urn:vap:source:browser-extension-v1',
    },
    signature: 'test-sig',
  };
}

// Helper to create valid E-DURATION evidence
function createDurationEvidence(overrides: Partial<Evidence['payload']> = {}): Evidence {
  return {
    evidenceId: 'urn:vap:evidence:test-duration-1',
    sessionId: 'urn:vap:session:test-1',
    sourceId: 'urn:vap:source:browser-extension-v1',
    timestamp: new Date().toISOString(),
    evidenceType: EvidenceType.DURATION,
    confidence: 0.85,
    payload: {
      sessionDurationMs: 360000,
      activeDurationMs: 240000,
      idleDurationMs: 120000,
      heartbeatCount: 60,
      ...overrides,
    },
    provenance: {
      observationIds: ['obs-3'],
      observationHash: 'ghi789',
      sourceId: 'urn:vap:source:browser-extension-v1',
    },
    signature: 'test-sig',
  };
}

describe('extractAttentionFeatures', () => {
  it('should return 20-dimensional feature vector', () => {
    const evidence = [
      createInteractionEvidence(),
      createVisibleEvidence(),
      createDurationEvidence(),
    ];
    const features = extractAttentionFeatures(evidence);
    expect(features).toHaveLength(20);
  });

  it('should return all values in [0, 1] range', () => {
    const evidence = [
      createInteractionEvidence(),
      createVisibleEvidence(),
      createDurationEvidence(),
    ];
    const features = extractAttentionFeatures(evidence);
    for (const f of features) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('should handle empty evidence array', () => {
    const features = extractAttentionFeatures([]);
    expect(features).toHaveLength(20);
    // For empty evidence:
    // - platform defaults to 'browser' so platform_browser = 1 (index 13)
    // - attention_stability = 1 when sessionDurationMs=0 (index 19)
    // - All other features should be 0
    expect(features[13]).toBe(1); // platform_browser
    expect(features[14]).toBe(0); // platform_mobile
    expect(features[15]).toBe(0); // platform_desktop
    expect(features[19]).toBe(1); // attention_stability (defaults to 1 when no session duration)
    // Verify all other indices are 0
    for (let i = 0; i < 20; i++) {
      if (i === 13 || i === 19) continue;
      expect(features[i]).toBe(0);
    }
  });

  it('should handle only E-INTERACTION evidence', () => {
    const evidence = [createInteractionEvidence()];
    const features = extractAttentionFeatures(evidence);
    expect(features).toHaveLength(20);
    // Interaction features should be non-zero
    expect(features[0]).toBeGreaterThan(0); // avg_scroll_velocity
    expect(features[1]).toBeGreaterThan(0); // scroll_direction_changes
    // Duration/platform features should be zero (no E-DURATION/E-VISIBLE evidence)
    expect(features[9]).toBe(0); // session_duration_ms
    // platform_browser should be 1 (default from sourceId)
    expect(features[13]).toBe(1); // platform_browser
  });

  it('should handle only E-VISIBLE evidence', () => {
    const evidence = [createVisibleEvidence()];
    const features = extractAttentionFeatures(evidence);
    expect(features).toHaveLength(20);
    // Visible features should be non-zero
    expect(features[6]).toBeGreaterThan(0); // visible_duration_ms
    expect(features[7]).toBeGreaterThan(0); // max_visibility_ratio
    // Interaction features should be zero
    expect(features[0]).toBe(0); // avg_scroll_velocity
  });

  it('should handle only E-DURATION evidence', () => {
    const evidence = [createDurationEvidence()];
    const features = extractAttentionFeatures(evidence);
    expect(features).toHaveLength(20);
    // Duration features should be non-zero
    expect(features[9]).toBeGreaterThan(0); // session_duration_ms
    // Other features should be zero
    expect(features[0]).toBe(0); // avg_scroll_velocity
    expect(features[6]).toBe(0); // visible_duration_ms
  });

  it('should set platform based on sourceId', () => {
    const browserEvidence = [
      createInteractionEvidence({}), 
      createVisibleEvidence({}), 
      createDurationEvidence({})
    ];
    browserEvidence[0].sourceId = 'urn:vap:source:browser-extension-v1';
    
    const mobileEvidence = [
      createInteractionEvidence({}), 
      createVisibleEvidence({}), 
      createDurationEvidence({})
    ];
    mobileEvidence[0].sourceId = 'urn:vap:source:mobile-app-v1';
    
    const desktopEvidence = [
      createInteractionEvidence({}), 
      createVisibleEvidence({}), 
      createDurationEvidence({})
    ];
    desktopEvidence[0].sourceId = 'urn:vap:source:desktop-app-v1';

    const browserFeatures = extractAttentionFeatures(browserEvidence);
    const mobileFeatures = extractAttentionFeatures(mobileEvidence);
    const desktopFeatures = extractAttentionFeatures(desktopEvidence);

    // platform_browser (index 13)
    expect(browserFeatures[13]).toBe(1);
    expect(mobileFeatures[13]).toBe(0);
    expect(desktopFeatures[13]).toBe(0);

    // platform_mobile (index 14)
    expect(browserFeatures[14]).toBe(0);
    expect(mobileFeatures[14]).toBe(1);
    expect(desktopFeatures[14]).toBe(0);

    // platform_desktop (index 15)
    expect(browserFeatures[15]).toBe(0);
    expect(mobileFeatures[15]).toBe(0);
    expect(desktopFeatures[15]).toBe(1);
  });

  it('should compute engineered features', () => {
    const evidence = [
      createInteractionEvidence({ 
        avgScrollVelocity: 100,
        scrollDirectionChanges: 2,
        clickCount: 1,
        keyPressCount: 5,
        interactionDurationMs: 60000,
      }),
      createVisibleEvidence({ 
        visibleDurationMs: 240000,
        maxVisibilityRatio: 0.9,
        avgVisibilityRatio: 0.8,
      }),
      createDurationEvidence({ 
        sessionDurationMs: 300000,
        activeDurationMs: 240000,
        idleDurationMs: 60000,
        heartbeatCount: 50,
      }),
    ];
    const features = extractAttentionFeatures(evidence);
    
    // visibility_consistency (index 16): avg/max = 0.8/0.9 = 0.888...
    expect(features[16]).toBeGreaterThan(0);
    // interaction_intensity (index 17): (1+5+2)/60000 * 1000 = 0.133...
    expect(features[17]).toBeGreaterThan(0);
    // reading_pause_ratio (index 18): 60000/(240000+60000) = 0.2
    expect(features[18]).toBeGreaterThan(0);
    // attention_stability (index 19): exp(-2/5) = 0.67...
    expect(features[19]).toBeGreaterThan(0);
  });
});

describe('getAttentionFeatureNames', () => {
  it('should return array of 20 feature names', () => {
    const names = getAttentionFeatureNames();
    expect(names).toHaveLength(20);
    expect(names).toEqual(ATTENTION_FEATURE_NAMES);
  });
});

describe('validateFeatureVector', () => {
  it('should return true for valid 20-dim vector', () => {
    expect(validateFeatureVector(new Array(20).fill(0.5))).toBe(true);
  });

  it('should return false for wrong dimension', () => {
    expect(validateFeatureVector(new Array(19).fill(0.5))).toBe(false);
    expect(validateFeatureVector(new Array(21).fill(0.5))).toBe(false);
  });

  it('should return false for NaN/Infinity', () => {
    const vec = new Array(20).fill(0.5);
    vec[0] = NaN;
    expect(validateFeatureVector(vec)).toBe(false);
    vec[0] = Infinity;
    expect(validateFeatureVector(vec)).toBe(false);
    vec[0] = -Infinity;
    expect(validateFeatureVector(vec)).toBe(false);
  });
});

describe('ATTENTION_FEATURE_NAMES', () => {
  it('should have 20 feature names', () => {
    expect(ATTENTION_FEATURE_NAMES).toHaveLength(20);
  });

  it('should match expected order', () => {
    expect(ATTENTION_FEATURE_NAMES[5]).toBe('engagement_score');
    expect(ATTENTION_FEATURE_NAMES[6]).toBe('visible_duration_ms');
    expect(ATTENTION_FEATURE_NAMES[9]).toBe('session_duration_ms');
    expect(ATTENTION_FEATURE_NAMES[10]).toBe('active_duration_ms');
    expect(ATTENTION_FEATURE_NAMES[11]).toBe('idle_duration_ms');
    expect(ATTENTION_FEATURE_NAMES[12]).toBe('heartbeat_count');
    expect(ATTENTION_FEATURE_NAMES[13]).toBe('platform_browser');
    expect(ATTENTION_FEATURE_NAMES[16]).toBe('visibility_consistency');
    expect(ATTENTION_FEATURE_NAMES[19]).toBe('attention_stability');
  });
});