import type { PlatformAdapter, PlatformProfile, ExternalObservationPayload, ObservationCallback } from './base';

export class ArticleAdapter implements PlatformAdapter {
  public readonly id: string;
  public readonly profile: PlatformProfile;
  private callback: ObservationCallback | null = null;
  private isAttached = false;
  private startTime = 0;
  private maxScrollProgress = 0;
  private mouseMoves = 0;
  private scrollEvents = 0;
  private scrollListener: (() => void) | null = null;
  private mouseListener: (() => void) | null = null;
  private visibilityListener: (() => void) | null = null;
  private activeFocusMs = 0;
  private lastFocusTick = 0;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;

  constructor(profile: PlatformProfile) {
    this.profile = profile;
    this.id = `${profile.id}-article-adapter`;
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
    this.startTime = Date.now();
    this.lastFocusTick = Date.now();
    this.activeFocusMs = 0;

    // Track scroll progression
    this.scrollListener = () => {
      this.scrollEvents++;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const progress = Math.min(1.0, Math.max(0, window.scrollY / scrollHeight));
        if (progress > this.maxScrollProgress) {
          this.maxScrollProgress = progress;
        }
      }
    };
    window.addEventListener('scroll', this.scrollListener, { passive: true });

    // Track mouse micro-movements
    this.mouseListener = () => {
      this.mouseMoves++;
    };
    window.addEventListener('mousemove', this.mouseListener, { passive: true });

    // Track focus
    this.intervalTimer = setInterval(() => {
      const now = Date.now();
      const delta = now - this.lastFocusTick;
      this.lastFocusTick = now;
      if (document.visibilityState === 'visible') {
        this.activeFocusMs += delta;
      }
    }, 1000);
  }

  public emitArticleObservation(): void {
    if (!this.callback || typeof document === 'undefined') return;

    const dwellTimeMs = Date.now() - this.startTime;
    if (dwellTimeMs < 3000) {
      // Discard sub-3-second bounces
      return;
    }

    const container = document.querySelector(this.profile.containerSelector) || document.body;
    const text = container.textContent || '';
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length || 1;
    const dwellMinutes = dwellTimeMs / 60000;
    const velocityWpm = Math.round(wordCount / Math.max(dwellMinutes, 0.05));

    const totalSeconds = dwellTimeMs / 1000;
    const focusRatio = Number((this.activeFocusMs / dwellTimeMs).toFixed(2));

    // Entropy: healthy human reading has periodic mouse moves + gradual scrolls
    const expectedEvents = totalSeconds * 1.5;
    const entropy = Number(Math.min(1.0, (this.mouseMoves + this.scrollEvents) / Math.max(1, expectedEvents)).toFixed(2));

    let contentUri: string;
    try {
      const currentUrl = typeof window !== 'undefined' ? new URL(window.location.href) : new URL('https://localhost');
      contentUri = this.profile.extractContentUrn(container, currentUrl);
    } catch {
      contentUri = `urn:vap:content:${this.profile.id}:article`;
    }

    const payload: ExternalObservationPayload = {
      platform: this.profile.id,
      archetype: 'article',
      contentUri,
      dwellTimeMs,
      activeFocusRatio: focusRatio,
      interactionEntropy: entropy,
      viewportCoverageRatio: Number(this.maxScrollProgress.toFixed(2)),
      readingVelocityWpm: velocityWpm,
      timestamp: new Date().toISOString()
    };

    this.callback(payload);
  }

  public detach(): void {
    if (!this.isAttached) return;
    this.emitArticleObservation();

    if (this.scrollListener && typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = null;
    }
    if (this.mouseListener && typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.mouseListener);
      this.mouseListener = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isAttached = false;
  }
}
