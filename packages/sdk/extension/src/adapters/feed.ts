import type { PlatformAdapter, PlatformProfile, ExternalObservationPayload, ObservationCallback } from './base';

export class FeedCardAdapter implements PlatformAdapter {
  public readonly id: string;
  public readonly profile: PlatformProfile;
  private callback: ObservationCallback | null = null;
  private observer: IntersectionObserver | null = null;
  private activeDwells: Map<Element, { startTime: number; entropyCount: number }> = new Map();
  private mouseListener: ((e: MouseEvent) => void) | null = null;
  private visibilityListener: (() => void) | null = null;
  private isAttached = false;

  constructor(profile: PlatformProfile) {
    this.profile = profile;
    this.id = `${profile.id}-feed-adapter`;
  }

  public match(url: URL): boolean {
    const hostname = url.hostname.toLowerCase();
    return this.profile.domains.some((d) => {
      if (d === '*') return true;
      if (typeof d === 'string') return hostname === d || hostname.endsWith(`.${d}`);
      return d.test(hostname);
    });
  }

  public onObservation(callback: ObservationCallback): void {
    this.callback = callback;
  }

  public attach(): void {
    if (this.isAttached || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    this.isAttached = true;

    // Track mouse entropy
    this.mouseListener = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      const card = target.closest(this.profile.containerSelector);
      if (card && this.activeDwells.has(card)) {
        const state = this.activeDwells.get(card)!;
        state.entropyCount++;
      }
    };
    window.addEventListener('mousemove', this.mouseListener, { passive: true });

    // Track window focus / visibility changes
    this.visibilityListener = () => {
      if (document.visibilityState !== 'visible') {
        // flush or pause
        this.flushVisibleCards();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityListener);

    // Setup intersection observer
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(
        (entries) => {
          const now = Date.now();
          for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
              if (!this.activeDwells.has(entry.target)) {
                this.activeDwells.set(entry.target, { startTime: now, entropyCount: 0 });
              }
            } else {
              // Card exited threshold -> emit observation if dwell was significant
              if (this.activeDwells.has(entry.target)) {
                this.emitCardObservation(entry.target, entry.intersectionRatio);
                this.activeDwells.delete(entry.target);
              }
            }
          }
        },
        { threshold: [0.65] }
      );

      // Query current cards and observe
      this.scanCards();
    }
  }

  public scanCards(): void {
    if (!this.observer || typeof document === 'undefined') return;
    const cards = document.querySelectorAll(this.profile.containerSelector);
    cards.forEach((card) => this.observer?.observe(card));
  }

  private flushVisibleCards(): void {
    for (const [el] of this.activeDwells.entries()) {
      this.emitCardObservation(el, 0.65);
    }
    this.activeDwells.clear();
  }

  public emitCardObservation(element: Element, ratio: number): void {
    if (!this.callback) return;
    const state = this.activeDwells.get(element);
    if (!state) return;

    const dwellTimeMs = Date.now() - state.startTime;
    if (dwellTimeMs < 1000) {
      // Discard sub-second accidental passes
      return;
    }

    const textEl = this.profile.textSelector ? element.querySelector(this.profile.textSelector) : element;
    const rawText = textEl?.textContent || '';
    const wordCount = rawText.trim().split(/\s+/).filter(Boolean).length || 1;
    const dwellMinutes = dwellTimeMs / 60000;
    const velocityWpm = Math.round(wordCount / Math.max(dwellMinutes, 0.01));

    // Entropy calculation normalized to 0.0 - 1.0 (threshold ~ 5 moves per sec)
    const expectedMoves = Math.max(1, (dwellTimeMs / 1000) * 3);
    const entropy = Math.min(1.0, state.entropyCount / expectedMoves);

    const isFocused = typeof document !== 'undefined' && document.visibilityState === 'visible';
    const focusRatio = isFocused ? 1.0 : 0.0;

    let contentUri: string;
    try {
      const currentUrl = typeof window !== 'undefined' ? new URL(window.location.href) : new URL('https://localhost');
      contentUri = this.profile.extractContentUrn(element, currentUrl);
    } catch {
      contentUri = `urn:vap:content:${this.profile.id}:unknown`;
    }

    const payload: ExternalObservationPayload = {
      platform: this.profile.id,
      archetype: 'feed',
      contentUri,
      dwellTimeMs,
      activeFocusRatio: focusRatio,
      interactionEntropy: Number(entropy.toFixed(3)),
      viewportCoverageRatio: Number(ratio.toFixed(2)),
      readingVelocityWpm: velocityWpm,
      timestamp: new Date().toISOString()
    };

    this.callback(payload);
  }

  public detach(): void {
    if (!this.isAttached) return;
    this.flushVisibleCards();

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.mouseListener && typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.mouseListener);
      this.mouseListener = null;
    }
    if (this.visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
    this.activeDwells.clear();
    this.isAttached = false;
  }
}
