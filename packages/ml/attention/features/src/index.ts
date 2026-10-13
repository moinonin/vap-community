/**
 * Attention Feature Engineering
 * 
 * Extracts 20 normalized features from VAP evidence matching the research prototype schema.
 * Features correspond to: E-INTERACTION, E-VISIBLE, E-DURATION, E-CONTEXT evidence types.
 */

import type { Evidence } from '@verified-attention/core';

/**
 * Feature vector dimension: 20 features
 * Order must match attention_features.json from research prototype
 */
export const ATTENTION_FEATURE_NAMES = [
  // E-INTERACTION (6 features)
  'avg_scroll_velocity',
  'scroll_direction_changes',
  'click_count',
  'keypress_count',
  'interaction_duration_ms',
  'engagement_score',
  // E-VISIBLE (3 features)
  'visible_duration_ms',
  'max_visibility_ratio',
  'avg_visibility_ratio',
  // E-DURATION (4 features)
  'session_duration_ms',
  'active_duration_ms',
  'idle_duration_ms',
  'heartbeat_count',
  // E-CONTEXT (3 features, one-hot platform)
  'platform_browser',
  'platform_mobile',
  'platform_desktop',
  // Engineered features (4 features)
  'visibility_consistency',
  'interaction_intensity',
  'reading_pause_ratio',
  'attention_stability',
] as const;

export type AttentionFeatureName = typeof ATTENTION_FEATURE_NAMES[number];

/**
 * Normalization bounds for each feature (min, max) from research data
 * Used for min-max scaling to [0, 1] range
 */
const FEATURE_BOUNDS: Record<AttentionFeatureName, [number, number]> = {
  // E-INTERACTION
  avg_scroll_velocity: [0, 5000],           // pixels/sec
  scroll_direction_changes: [0, 50],        // count
  click_count: [0, 100],                    // count
  keypress_count: [0, 500],                 // count
  interaction_duration_ms: [0, 3600000],    // 1 hour max
  engagement_score: [0, 1],                 // already normalized
  // E-VISIBLE
  visible_duration_ms: [0, 3600000],        // 1 hour max
  max_visibility_ratio: [0, 1],             // ratio
  avg_visibility_ratio: [0, 1],             // ratio
  // E-DURATION
  session_duration_ms: [10000, 3600000],    // 10s - 1 hour
  active_duration_ms: [0, 3600000],         // 1 hour max
  idle_duration_ms: [0, 3600000],           // 1 hour max
  heartbeat_count: [0, 720],                // 1 hour / 5s intervals
  // E-CONTEXT (one-hot, already 0/1)
  platform_browser: [0, 1],
  platform_mobile: [0, 1],
  platform_desktop: [0, 1],
  // Engineered features
  visibility_consistency: [0, 1],           // ratio
  interaction_intensity: [0, 100],          // events/sec * 1000
  reading_pause_ratio: [0, 1],              // ratio
  attention_stability: [0, 1],              // inverse of direction changes
};

/**
 * Clamp value to [min, max] range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Min-max normalize value to [0, 1] using predefined bounds
 */
function normalize(value: number, featureName: AttentionFeatureName): number {
  const [min, max] = FEATURE_BOUNDS[featureName];
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

/**
 * Extract platform from evidence metadata
 */
function extractPlatform(evidence: Evidence[]): 'browser' | 'mobile' | 'desktop' {
  // Look for platform info in evidence metadata
  for (const e of evidence) {
    const meta = e.metadata as Record<string, unknown> | undefined;
    if (meta?.platform) {
      const p = String(meta.platform).toLowerCase();
      if (p === 'mobile' || p === 'ios' || p === 'android') return 'mobile';
      if (p === 'desktop') return 'desktop';
      return 'browser';
    }
    // Infer from sourceId
    if (e.sourceId.includes('mobile')) return 'mobile';
    if (e.sourceId.includes('desktop')) return 'desktop';
  }
  return 'browser'; // default
}

/**
 * Calculate visibility consistency: ratio of avg to max visibility
 * Higher = more consistent attention
 */
function calcVisibilityConsistency(avgVis: number, maxVis: number): number {
  if (maxVis === 0) return 0;
  return clamp(avgVis / maxVis, 0, 1);
}

/**
 * Calculate interaction intensity: total interactions per second
 */
function calcInteractionIntensity(
  clickCount: number,
  keypressCount: number,
  scrollChanges: number,
  interactionDurationMs: number
): number {
  if (interactionDurationMs <= 0) return 0;
  const totalInteractions = clickCount + keypressCount + scrollChanges;
  return (totalInteractions / interactionDurationMs) * 1000; // per second
}

/**
 * Calculate reading pause ratio: idle / (active + idle)
 * Higher = more reading-like pauses
 */
function calcReadingPauseRatio(idleMs: number, activeMs: number): number {
  const total = idleMs + activeMs;
  if (total === 0) return 0;
  return idleMs / total;
}

/**
 * Calculate attention stability: inverse of scroll direction changes per minute
 * More stable = fewer erratic direction changes
 */
function calcAttentionStability(scrollChanges: number, sessionDurationMs: number): number {
  if (sessionDurationMs <= 0) return 1;
  const changesPerMinute = (scrollChanges / sessionDurationMs) * 60000;
  return Math.exp(-changesPerMinute / 10); // exponential decay
}

/**
 * Main feature extraction function
 * Takes array of VAP Evidence and returns 20-dim normalized feature vector
 */
export function extractAttentionFeatures(evidence: Evidence[]): number[] {
  // Initialize accumulators
  let totalScrollVelocity = 0;
  let totalScrollChanges = 0;
  let totalClicks = 0;
  let totalKeypresses = 0;
  let totalInteractionDuration = 0;
  let totalEngagementScore = 0;
  let interactionCount = 0;
  
  let totalVisibleDuration = 0;
  let totalMaxVisibility = 0;
  let totalAvgVisibility = 0;
  let visibleCount = 0;
  
  let sessionDurationMs = 0;
  let activeDurationMs = 0;
  let idleDurationMs = 0;
  let heartbeatCount = 0;
  let durationCount = 0;
  
  // Process each evidence item by type
  for (const e of evidence) {
    const payload = e.payload as Record<string, unknown>;
    
    switch (e.evidenceType) {
      case 'E-INTERACTION': {
        totalScrollVelocity += Number(payload.avgScrollVelocity ?? 0);
        totalScrollChanges += Number(payload.scrollDirectionChanges ?? 0);
        totalClicks += Number(payload.clickCount ?? 0);
        totalKeypresses += Number(payload.keyPressCount ?? 0);
        totalInteractionDuration += Number(payload.interactionDurationMs ?? 0);
        totalEngagementScore += Number(payload.engagementScore ?? 0);
        interactionCount++;
        break;
      }
      case 'E-VISIBLE': {
        totalVisibleDuration += Number(payload.visibleDurationMs ?? 0);
        totalMaxVisibility += Number(payload.maxVisibilityRatio ?? 0);
        totalAvgVisibility += Number(payload.avgVisibilityRatio ?? 0);
        visibleCount++;
        break;
      }
      case 'E-DURATION': {
        sessionDurationMs = Math.max(sessionDurationMs, Number(payload.sessionDurationMs ?? 0));
        activeDurationMs = Math.max(activeDurationMs, Number(payload.activeDurationMs ?? 0));
        idleDurationMs = Math.max(idleDurationMs, Number(payload.idleDurationMs ?? 0));
        heartbeatCount = Math.max(heartbeatCount, Number(payload.heartbeatCount ?? 0));
        durationCount++;
        break;
      }
    }
  }
  
  // Calculate averages
  const avgScrollVelocity = interactionCount > 0 ? totalScrollVelocity / interactionCount : 0;
  const avgEngagementScore = interactionCount > 0 ? totalEngagementScore / interactionCount : 0;
  const avgMaxVisibility = visibleCount > 0 ? totalMaxVisibility / visibleCount : 0;
  const avgAvgVisibility = visibleCount > 0 ? totalAvgVisibility / visibleCount : 0;
  
  // Platform one-hot
  const platform = extractPlatform(evidence);
  const platformBrowser = platform === 'browser' ? 1 : 0;
  const platformMobile = platform === 'mobile' ? 1 : 0;
  const platformDesktop = platform === 'desktop' ? 1 : 0;
  
  // Engineered features
  const visibilityConsistency = calcVisibilityConsistency(avgAvgVisibility, avgMaxVisibility);
  const interactionIntensity = calcInteractionIntensity(
    totalClicks,
    totalKeypresses,
    totalScrollChanges,
    totalInteractionDuration
  );
  const readingPauseRatio = calcReadingPauseRatio(idleDurationMs, activeDurationMs);
  const attentionStability = calcAttentionStability(totalScrollChanges, sessionDurationMs);
  
  // Build feature vector in exact order matching ATTENTION_FEATURE_NAMES
  const rawFeatures: Record<AttentionFeatureName, number> = {
    // E-INTERACTION
    avg_scroll_velocity: avgScrollVelocity,
    scroll_direction_changes: totalScrollChanges,
    click_count: totalClicks,
    keypress_count: totalKeypresses,
    interaction_duration_ms: totalInteractionDuration,
    engagement_score: avgEngagementScore,
    // E-VISIBLE
    visible_duration_ms: totalVisibleDuration,
    max_visibility_ratio: avgMaxVisibility,
    avg_visibility_ratio: avgAvgVisibility,
    // E-DURATION
    session_duration_ms: sessionDurationMs,
    active_duration_ms: activeDurationMs,
    idle_duration_ms: idleDurationMs,
    heartbeat_count: heartbeatCount,
    // E-CONTEXT
    platform_browser: platformBrowser,
    platform_mobile: platformMobile,
    platform_desktop: platformDesktop,
    // Engineered
    visibility_consistency: visibilityConsistency,
    interaction_intensity: interactionIntensity,
    reading_pause_ratio: readingPauseRatio,
    attention_stability: attentionStability,
  };
  
  // Normalize each feature to [0, 1]
  return ATTENTION_FEATURE_NAMES.map(name => normalize(rawFeatures[name], name));
}

/**
 * Get feature names for model input/output mapping
 */
export function getAttentionFeatureNames(): readonly string[] {
  return ATTENTION_FEATURE_NAMES;
}

/**
 * Validate feature vector dimension
 */
export function validateFeatureVector(features: number[]): boolean {
  return features.length === ATTENTION_FEATURE_NAMES.length && 
         features.every(f => typeof f === 'number' && isFinite(f));
}