/**
 * Focus observer: window focus/blur events as FOCUS observations.
 */

import type { DomAdapter } from '../dom';
import type { ObservationSink } from '../types';

export class FocusObserver {
  private unsubscribers: Array<() => void> = [];

  constructor(private readonly adapter: DomAdapter) {}

  start(sink: ObservationSink): void {
    this.stop();
    this.unsubscribers.push(
      this.adapter.listen('window', 'focus', () => sink.emit('FOCUS', { focusType: 'focus' })),
      this.adapter.listen('window', 'blur', () => sink.emit('FOCUS', { focusType: 'blur' })),
    );
  }

  stop(): void {
    for (const off of this.unsubscribers.splice(0)) off();
  }
}
