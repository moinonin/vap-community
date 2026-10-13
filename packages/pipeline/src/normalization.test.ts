/**
 * Unit tests for Normalization Pipeline stage
 * Tests platform-specific normalization, timestamp normalization, aggregation
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeTimestamp,
  normalizeBrowserScroll,
  normalizeBrowserClick,
  normalizeBrowserKeypress,
  normalizeViewportVisibility,
  normalizeBrowserFocus,
  normalizeDeviceMotion,
  aggregateInteractionEvidence,
  aggregateVisibilityEvidence,
  meetsMinimumSpan,
  type Platform,
} from './normalization';
import type { Observation } from '@verified-attention/core';

// ─── normalizeTimestamp ─────────────────────────────────────────────────────

describe('normalizeTimestamp', () => {
  it('should convert epoch ms to ISO string', () => {
    const ts = normalizeTimestamp(1705312200000);
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should append Z if missing on string input', () => {
    const ts = normalizeTimestamp('2024-01-15T10:30:00.123456');
    expect(ts).toBe('2024-01-15T10:30:00.123456Z');
  });

  it('should leave Z-suffixed strings unchanged', () => {
    const ts = normalizeTimestamp('2024-01-15T10:30:00.123456Z');
    expect(ts).toBe('2024-01-15T10:30:00.123456Z');
  });

  it('should handle millisecond-precision ISO string', () => {
    const ts = normalizeTimestamp('2024-01-15T10:30:00.123Z');
    expect(ts).toBe('2024-01-15T10:30:00.123Z');
  });
});

// ─── normalizeBrowserScroll ───────────────────────────────────────────────

describe('normalizeBrowserScroll', () => {
  it('should map standard scroll event fields', () => {
    const r = normalizeBrowserScroll({ deltaX: 5, deltaY: 10, scrollX: 100, scrollY: 200 });
    expect(r.signalType).toBe('SCROLL');
    expect(r.payload).toEqual({ deltaX: 5, deltaY: 10, positionX: 100, positionY: 200 });
  });

  it('should fall back to wheelDelta if deltaX missing', () => {
    const r = normalizeBrowserScroll({ wheelDeltaX: 3, wheelDeltaY: 7 } as any);
    expect((r.payload as any).deltaX).toBe(3);
    expect((r.payload as any).deltaY).toBe(7);
  });

  it('should default to 0 if all fields missing', () => {
    const r = normalizeBrowserScroll({});
    expect(r.payload).toEqual({ deltaX: 0, deltaY: 0, positionX: 0, positionY: 0 });
  });
});

// ─── normalizeBrowserClick ────────────────────────────────────────────────

describe('normalizeBrowserClick', () => {
  it('should map click event with pageX/pageY', () => {
    const r = normalizeBrowserClick({ pageX: 100, pageY: 200, target: { localName: 'button' } });
    expect(r.signalType).toBe('CLICK');
    expect((r.payload as any).clientX).toBe(100);
    expect((r.payload as any).clientY).toBe(200);
    expect((r.payload as any).elementSelector).toBe('button');
  });

  it('should fall back to screenX/screenY', () => {
    const r = normalizeBrowserClick({ screenX: 10, screenY: 20 });
    expect((r.payload as any).clientX).toBe(10);
    expect((r.payload as any).clientY).toBe(20);
  });

  it('should default coords to 0', () => {
    const r = normalizeBrowserClick({});
    expect((r.payload as any).clientX).toBe(0);
    expect((r.payload as any).clientY).toBe(0);
  });
});

// ─── normalizeBrowserKeypress ────────────────────────────────────────────

describe('normalizeBrowserKeypress', () => {
  it('should map keypress with key and code', () => {
    const r = normalizeBrowserKeypress({ key: 'a', code: 'KeyA', repeat: false });
    expect(r.signalType).toBe('KEY_PRESS');
    expect((r.payload as any).key).toBe('a');
    expect((r.payload as any).code).toBe('KeyA');
    expect((r.payload as any).repeat).toBe(false);
  });

  it('should set code to undefined if missing', () => {
    const r = normalizeBrowserKeypress({ key: 'a' });
    expect((r.payload as any).code).toBeUndefined();
  });

  it('should default key to empty string', () => {
    const r = normalizeBrowserKeypress({});
    expect((r.payload as any).key).toBe('');
  });
});

// ─── normalizeViewportVisibility ──────────────────────────────────────────

describe('normalizeViewportVisibility', () => {
  it('should produce ratio in [0, 1]', () => {
    const r = normalizeViewportVisibility(0.8);
    expect(r.signalType).toBe('VIEWPORT_VISIBILITY');
    expect((r.payload as any).visibilityRatio).toBe(0.8);
  });

  it('should clamp negative ratio to 0', () => {
    const r = normalizeViewportVisibility(-0.5);
    expect((r.payload as any).visibilityRatio).toBe(0);
  });

  it('should clamp ratio > 1 to 1', () => {
    const r = normalizeViewportVisibility(1.5);
    expect((r.payload as any).visibilityRatio).toBe(1);
  });
});

// ─── normalizeBrowserFocus ────────────────────────────────────────────────

describe('normalizeBrowserFocus', () => {
  it('should produce focus event for true', () => {
    const r = normalizeBrowserFocus(true, '#input');
    expect(r.signalType).toBe('FOCUS');
    expect((r.payload as any).focusType).toBe('focus');
    expect((r.payload as any).elementSelector).toBe('#input');
  });

  it('should produce blur event for false', () => {
    const r = normalizeBrowserFocus(false);
    expect((r.payload as any).focusType).toBe('blur');
  });

  it('should set elementSelector to undefined when not provided', () => {
    const r = normalizeBrowserFocus(true);
    expect((r.payload as any).elementSelector).toBeUndefined();
  });
});

// ─── normalizeDeviceMotion ────────────────────────────────────────────────

describe('normalizeDeviceMotion', () => {
  it('should map acceleration fields', () => {
    const r = normalizeDeviceMotion({ accelerationX: 0.1, accelerationY: 0.2, accelerationZ: 9.8 });
    expect(r.signalType).toBe('DEVICE_MOTION');
    expect((r.payload as any).accelerationX).toBe(0.1);
    expect((r.payload as any).accelerationY).toBe(0.2);
    expect((r.payload as any).accelerationZ).toBe(9.8);
  });

  it('should map rotationRate nested object', () => {
    const r = normalizeDeviceMotion({ rotationRate: { alpha: 1, beta: 2, gamma: 3 } });
    expect((r.payload as any).rotationAlpha).toBe(1);
    expect((r.payload as any).rotationBeta).toBe(2);
    expect((r.payload as any).rotationGamma).toBe(3);
  });

  it('should handle empty input', () => {
    const r = normalizeDeviceMotion({});
    expect((r.payload as any).accelerationX).toBeUndefined();
  });
});

// ─── aggregateInteractionEvidence ──────────────────────────────────────────

function makeObs(signalType: string, payload: Record<string, unknown> = {}, ts = '2024-01-15T10:30:00.123456Z'): Observation {
  return {
    observationId: '550e8400-e29b-41d4-a716-446655440000',
    sourceId: 'src',
    sessionId: 'urn:vap:session:550e8400-e29b-41d4-a716-446655440000',
    contentId: 'urn:vap:content:c1',
    timestamp: ts,
    signalType: signalType as any,
    payload,
  } as Observation;
}

describe('aggregateInteractionEvidence', () => {
  it('should count clicks, keypresses, scrolls', () => {
    const obs = [
      makeObs('CLICK', { clientX: 1, clientY: 2 }),
      makeObs('CLICK', { clientX: 3, clientY: 4 }),
      makeObs('KEY_PRESS', { key: 'a' }),
      makeObs('SCROLL', { deltaX: 0, deltaY: 5, positionX: 0, positionY: 10 }),
    ];
    const r = aggregateInteractionEvidence(obs);
    expect(r.clickCount).toBe(2);
    expect(r.keyPressCount).toBe(1);
    expect(r.scrollDirectionChanges).toBe(1);
  });

  it('should compute engagementScore from interaction counts', () => {
    const obs = [
      makeObs('CLICK', { clientX: 1, clientY: 2 }),
      makeObs('KEY_PRESS', { key: 'a' }),
      makeObs('SCROLL', { deltaX: 0, deltaY: 5, positionX: 0, positionY: 10 }),
    ];
    const r = aggregateInteractionEvidence(obs);
    expect(r.engagementScore).toBeGreaterThan(0);
    expect(r.engagementScore).toBeLessThanOrEqual(1);
  });

  it('should cap engagementScore at 1.0', () => {
    const obs = Array.from({ length: 50 }, () => makeObs('CLICK', { clientX: 1, clientY: 2 }));
    const r = aggregateInteractionEvidence(obs);
    expect(r.engagementScore).toBeLessThanOrEqual(1);
  });

  it('should return zeros for empty observations', () => {
    const r = aggregateInteractionEvidence([]);
    expect(r.clickCount).toBe(0);
    expect(r.keyPressCount).toBe(0);
    expect(r.scrollDirectionChanges).toBe(0);
    expect(r.engagementScore).toBe(0);
  });
});

// ─── aggregateVisibilityEvidence ──────────────────────────────────────────

describe('aggregateVisibilityEvidence', () => {
  it('should compute max and avg visibility from observations', () => {
    const obs = [
      makeObs('VIEWPORT_VISIBILITY', { visibilityRatio: 0.5 }),
      makeObs('VIEWPORT_VISIBILITY', { visibilityRatio: 0.8 }),
      makeObs('VIEWPORT_VISIBILITY', { visibilityRatio: 0.3 }),
    ];
    const r = aggregateVisibilityEvidence(obs);
    expect(r.maxVisibilityRatio).toBe(0.8);
    expect(r.avgVisibilityRatio).toBeCloseTo((0.5 + 0.8 + 0.3) / 3, 5);
    expect(r.visibleDurationMs).toBe(3000);
  });

  it('should return zeros for no visibility observations', () => {
    const obs = [makeObs('CLICK', { clientX: 1, clientY: 2 })];
    const r = aggregateVisibilityEvidence(obs);
    expect(r.visibleDurationMs).toBe(0);
    expect(r.maxVisibilityRatio).toBe(0);
    expect(r.avgVisibilityRatio).toBe(0);
  });

  it('should skip observations with missing visibilityRatio', () => {
    const obs = [
      makeObs('VIEWPORT_VISIBILITY', { visibilityRatio: 0.5 }),
      makeObs('VIEWPORT_VISIBILITY', {}),
    ];
    const r = aggregateVisibilityEvidence(obs);
    // Only the first observation has a ratio
    expect(r.maxVisibilityRatio).toBe(0.5);
  });
});

// ─── meetsMinimumSpan ─────────────────────────────────────────────────────

describe('meetsMinimumSpan', () => {
  it('should return true when span exceeds minimum', () => {
    const obs = [
      makeObs('CLICK', {}, '2024-01-15T10:30:00.000Z'),
      makeObs('CLICK', {}, '2024-01-15T10:30:05.000Z'),
    ];
    expect(meetsMinimumSpan(obs, 4000)).toBe(true);
  });

  it('should return false when span below minimum', () => {
    const obs = [
      makeObs('CLICK', {}, '2024-01-15T10:30:00.000Z'),
      makeObs('CLICK', {}, '2024-01-15T10:30:01.000Z'),
    ];
    expect(meetsMinimumSpan(obs, 5000)).toBe(false);
  });

  it('should return false for < 2 observations', () => {
    expect(meetsMinimumSpan([makeObs('CLICK')], 100)).toBe(false);
    expect(meetsMinimumSpan([], 100)).toBe(false);
  });

  it('should boundary check exact span', () => {
    const obs = [
      makeObs('CLICK', {}, '2024-01-15T10:30:00.000Z'),
      makeObs('CLICK', {}, '2024-01-15T10:30:05.000Z'),
    ];
    expect(meetsMinimumSpan(obs, 5000)).toBe(true);
    expect(meetsMinimumSpan(obs, 5001)).toBe(false);
  });
});

// ─── Platform type ────────────────────────────────────────────────────────

describe('Platform type', () => {
  it('should accept valid platform values', () => {
    const p: Platform = 'browser';
    expect(p).toBe('browser');
  });
});
