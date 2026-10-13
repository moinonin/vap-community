import { describe, expect, it } from 'vitest';
import { FocusObserver } from './focus';
import { InteractionObserver } from './interaction';
import { VisibilityObserver } from './visibility';
import { FakeDomAdapter } from '../test-support';
import type { Observation } from '../types';

function collect(): {
  emissions: Array<[string, unknown]>;
  sink: { emit(t: Observation['signalType'], p: Observation['payload']): void };
} {
  const emissions: Array<[string, unknown]> = [];
  return {
    emissions,
    sink: { emit: (t, p) => emissions.push([t, p]) },
  };
}

describe('observers', () => {
  it('interaction observer emits CLICK/SCROLL/KEY_PRESS and throttles high-frequency events', () => {
    const adapter = new FakeDomAdapter();
    const { emissions, sink } = collect();
    let now = 0;
    const obs = new InteractionObserver(adapter, { throttleMs: 100, now: () => now });
    obs.start(sink);
    adapter.trigger('window', 'click', { clientX: 1, clientY: 2, target: { tagName: 'A' } });
    adapter.setScroll(0, 10);
    adapter.trigger('window', 'scroll');
    adapter.setScroll(0, 20);
    adapter.trigger('window', 'scroll'); // throttled (same kind, <100ms)
    adapter.trigger('window', 'keydown', { key: 'a', code: 'KeyA' });
    now += 200;
    adapter.trigger('window', 'scroll');
    const kinds = emissions.map(([t]) => t);
    expect(kinds).toEqual(['CLICK', 'SCROLL', 'KEY_PRESS', 'SCROLL']);
    const scrolls = emissions.filter(([t]) => t === 'SCROLL').map(([, p]) => p) as Array<{
      deltaY: number;
    }>;
    expect(scrolls[0]!.deltaY).toBe(0); // no previous position on first sample
    expect(scrolls[1]!.deltaY).toBe(10);
    obs.stop();
    adapter.trigger('window', 'click', { clientX: 3, clientY: 4 });
    expect(emissions).toHaveLength(4); // no more events after stop
  });

  it('visibility observer maps document hidden to ratio 0 and forwards intersections', () => {
    const adapter = new FakeDomAdapter();
    let state = 'visible';
    adapter.visibilityState = () => state;
    const { emissions, sink } = collect();
    const obs = new VisibilityObserver(adapter, { tag: 'element' });
    obs.start(sink);
    adapter.intersectionCb?.(0.5, { x: 0, y: 0, width: 100, height: 100 });
    state = 'hidden';
    adapter.trigger('document', 'visibilitychange');
    expect(emissions[0]).toEqual([
      'VIEWPORT_VISIBILITY',
      expect.objectContaining({ visibilityRatio: 0.5, totalArea: 10000 }),
    ]);
    expect(emissions[1]).toEqual(['VIEWPORT_VISIBILITY', { visibilityRatio: 0 }]);
    obs.stop();
  });

  it('focus observer emits focus/blur FOCUS events', () => {
    const adapter = new FakeDomAdapter();
    const { emissions, sink } = collect();
    const obs = new FocusObserver(adapter);
    obs.start(sink);
    adapter.trigger('window', 'focus');
    adapter.trigger('window', 'blur');
    expect(emissions).toEqual([
      ['FOCUS', { focusType: 'focus' }],
      ['FOCUS', { focusType: 'blur' }],
    ]);
    obs.stop();
  });
});
