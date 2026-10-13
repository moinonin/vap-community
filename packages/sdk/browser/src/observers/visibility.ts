/**
 * Visibility observer: document visibility changes plus viewport
 * intersection of the tracked content element.
 *
 * Emits VIEWPORT_VISIBILITY observations (packages/core observation schema):
 * - ratio 0 when the document becomes hidden, 1-equivalent context when visible
 * - IntersectionObserver ratios for the content element
 */

import type { DomAdapter } from '../dom';
import type { ObservationSink } from '../types';

export class VisibilityObserver {
  private unsubscribers: Array<() => void> = [];

  constructor(
    private readonly adapter: DomAdapter,
    private readonly contentElement?: unknown,
  ) {}

  start(sink: ObservationSink): void {
    this.stop();

    this.unsubscribers.push(
      this.adapter.listen('document', 'visibilitychange', () => {
        const state = this.adapter.visibilityState();
        sink.emit('VIEWPORT_VISIBILITY', {
          // Document hidden ⇒ content cannot be visible.
          visibilityRatio: state === 'visible' ? 1 : 0,
        });
      }),
    );

    if (this.contentElement !== undefined) {
      this.unsubscribers.push(
        this.adapter.observeIntersection(this.contentElement, (ratio, rect) => {
          sink.emit('VIEWPORT_VISIBILITY', {
            visibilityRatio: Math.min(1, Math.max(0, ratio)),
            ...(rect
              ? {
                  boundingRect: rect,
                  visibleArea: ratio * rect.width * rect.height,
                  totalArea: rect.width * rect.height,
                }
              : {}),
          });
        }),
      );
    }
  }

  stop(): void {
    for (const off of this.unsubscribers.splice(0)) off();
  }
}
