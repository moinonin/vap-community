/**
 * Evidence pipeline: normalization stage
 *
 * Maps platform-specific observation data into canonical VAP evidence format.
 * Each implementation MUST define mapping from native event shapes to VAP
 * Canonical observation payloads (VAP Section 4).
 */

import type {
  Observation,
  ObservationSchema
} from '@verified-attention/core';

/**
 * Canonical timestamp normalized to RFC3339 with microsecond precision
 */
export function normalizeTimestamp(raw: string | number): string {
  if (typeof raw === 'number') {
    return new Date(raw).toISOString();
  }
  return raw.endsWith('Z') ? raw : raw + 'Z';
}

/**
 * Platform type
 */
export type Platform = 'browser' | 'mobile' | 'desktop' | 'server';

/**
 * Normalize browser scroll event
 */
export function normalizeBrowserScroll(raw: Record<string, any>): Record<string, unknown> {
  return {
    signalType: 'SCROLL',
    payload: {
      deltaX: Number(raw.deltaX ?? raw.wheelDeltaX ?? 0),
      deltaY: Number(raw.deltaY ?? raw.wheelDeltaY ?? 0),
      positionX: Number(raw.scrollX ?? 0),
      positionY: Number(raw.scrollY ?? 0)
    }
  };
}

/**
 * Normalize browser click event
 */
export function normalizeBrowserClick(raw: Record<string, any>): Record<string, unknown> {
  return {
    signalType: 'CLICK',
    payload: {
      elementSelector: (raw.target as any)?.localName,
      clientX: Number(raw.pageX ?? raw.screenX ?? 0),
      clientY: Number(raw.pageY ?? raw.screenY ?? 0)
    }
  };
}

/**
 * Normalize browser keypress
 */
export function normalizeBrowserKeypress(raw: Record<string, any>): Record<string, unknown> {
  return {
    signalType: 'KEY_PRESS',
    payload: {
      key: String(raw.key ?? ''),
      code: raw.code ? String(raw.code) : undefined,
      repeat: Boolean(raw.repeat)
    }
  };
}

/**
 * Normalize viewport visibility signal
 */
export function normalizeViewportVisibility(ratio: number): Record<string, unknown> {
  return {
    signalType: 'VIEWPORT_VISIBILITY',
    payload: {
      visibilityRatio: Math.max(0, Math.min(1, ratio))
    }
  };
}

/**
 * Normalize browser focus change
 */
export function normalizeBrowserFocus(focused: boolean, element?: string): Record<string, unknown> {
  return {
    signalType: 'FOCUS',
    payload: {
      focusType: focused ? 'focus' : 'blur',
      elementSelector: element
    }
  };
}

/**
 * Normalize device motion data
 */
export function normalizeDeviceMotion(raw: Record<string, any>): Record<string, unknown> {
  return {
    signalType: 'DEVICE_MOTION',
    payload: {
      accelerationX: raw.accelerationX,
      accelerationY: raw.accelerationY,
      accelerationZ: raw.accelerationZ,
      rotationAlpha: raw.rotationRate?.['alpha'],
      rotationBeta: raw.rotationRate?.['beta'],
      rotationGamma: raw.rotationRate?.['gamma']
    }
  };
}

/**
 * Compute aggregate interaction evidence from a batch of observations
 */
export function aggregateInteractionEvidence(
  observations: Observation[]
): Record<string, unknown> {
  const clicks = observations.filter(o => o.signalType === 'CLICK').length;
  const keys = observations.filter(o => o.signalType === 'KEY_PRESS').length;
  const scrolls = observations.filter(o => o.signalType === 'SCROLL').length;

  return {
    clickCount: clicks,
    keyPressCount: keys,
    scrollDirectionChanges: Math.min(scrolls, 1),
    engagementScore: Math.min(1.0, clicks * 0.05 + keys * 0.02 + scrolls * 0.005)
  };
}

/**
 * Compute aggregate visibility evidence from a batch of observations
 */
export function aggregateVisibilityEvidence(
  observations: Observation[]
): Record<string, unknown> {
  const visibility = observations.filter(o => o.signalType === 'VIEWPORT_VISIBILITY');
  if (visibility.length === 0) {
    return { visibleDurationMs: 0, maxVisibilityRatio: 0, avgVisibilityRatio: 0 };
  }

  const ratios: number[] = [];
  for (const o of visibility) {
    if (typeof o.payload === 'object' && o.payload !== null) {
      const r = (o.payload as Record<string, unknown>).visibilityRatio as number | undefined;
      if (r != null) ratios.push(r);
    }
  }
  const maxRatio = ratios.length ? Math.max(...ratios) : 0;
  const avgRatio = ratios.length ? ratios.reduce((s, v) => s + v, 0) / ratios.length : 0;

  return {
    visibleDurationMs: visibility.length * 1000, // rough estimate: 1s per observation
    maxVisibilityRatio: maxRatio,
    avgVisibilityRatio: avgRatio
  };
}

/**
 * Compute minimum viable observation window
 * Returns true if observations span at least signalled duration in milliseconds
 */
export function meetsMinimumSpan(
  observations: Observation[],
  minSpanMs: number
): boolean {
  if (observations.length < 2) return false;
  const start = new Date(observations[0]!.timestamp).getTime();
  const end = new Date(observations[observations.length - 1]!.timestamp).getTime();
  return (end - start) >= minSpanMs;
}