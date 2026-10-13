/**
 * Interaction observer: throttled mouse clicks, scrolls and key presses.
 *
 * Emits canonical Observation payloads (CLICK / SCROLL / KEY_PRESS) matching
 * packages/core/src/observation.ts schemas. High-frequency events are
 * throttled so a busy page cannot flood the evidence queue.
 */

import type { DomAdapter } from '../dom';
import type { ObservationSink } from '../types';

export interface InteractionObserverOptions {
  /** Minimum ms between emitted samples of the same high-frequency signal. */
  throttleMs?: number; // default 150ms for scroll/key, clicks are never throttled
  now?: () => number;
}

export class InteractionObserver {
  private unsubscribers: Array<() => void> = [];
  private lastEmit = new Map<string, number>();
  private lastScroll: { x: number; y: number } | undefined;

  constructor(
    private readonly adapter: DomAdapter,
    private readonly opts: InteractionObserverOptions = {},
  ) {}

  start(sink: ObservationSink): void {
    this.stop();
    const now = this.opts.now ?? (() => Date.now());
    const throttleMs = this.opts.throttleMs ?? 150;
    const throttled = (kind: string): boolean => {
      const t = now();
      const last = this.lastEmit.get(kind);
      if (last !== undefined && t - last < throttleMs) return false;
      this.lastEmit.set(kind, t);
      return true;
    };

    // Clicks are discrete and meaningful — never throttled.
    this.unsubscribers.push(
      this.adapter.listen('window', 'click', (e) => {
        const ev = e as {
          clientX?: number;
          clientY?: number;
          button?: number;
          target?: { tagName?: string };
        };
        sink.emit('CLICK', {
          clientX: ev.clientX ?? 0,
          clientY: ev.clientY ?? 0,
          button: ev.button,
          elementTag: ev.target?.tagName,
        });
      }),
    );

    this.unsubscribers.push(
      this.adapter.listen('window', 'scroll', () => {
        if (!throttled('scroll')) return;
        const pos = this.adapter.scrollPosition();
        const prev = this.lastScroll ?? pos;
        this.lastScroll = pos;
        sink.emit('SCROLL', {
          deltaX: pos.x - prev.x,
          deltaY: pos.y - prev.y,
          positionX: pos.x,
          positionY: pos.y,
        });
      }),
    );

    this.unsubscribers.push(
      this.adapter.listen('window', 'keydown', (e) => {
        if (!throttled('key')) return;
        const ev = e as { key?: string; code?: string; repeat?: boolean };
        if (ev.repeat) return;
        sink.emit('KEY_PRESS', {
          key: ev.key ?? 'unknown',
          code: ev.code,
          isPrintable: typeof ev.key === 'string' && ev.key.length === 1,
        });
      }),
    );
  }

  stop(): void {
    for (const off of this.unsubscribers.splice(0)) off();
    this.lastEmit.clear();
    this.lastScroll = undefined;
  }
}
