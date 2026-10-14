import type { PlatformAdapter, PlatformProfile, ExternalObservationPayload, ObservationCallback, MediaTelemetry } from './base';

export class VideoPlayerAdapter implements PlatformAdapter {
  public readonly id: string;
  public readonly profile: PlatformProfile;
  private callback: ObservationCallback | null = null;
  private isAttached = false;
  private trackedVideos: Map<
    HTMLVideoElement,
    {
      startTime: number;
      lastTime: number;
      totalPlayMs: number;
      scrubCount: number;
      focusMs: number;
      lastTick: number;
    }
  > = new Map();
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private boundTimeUpdate: ((e: Event) => void) | null = null;

  constructor(profile: PlatformProfile) {
    this.profile = profile;
    this.id = `${profile.id}-video-adapter`;
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
    if (this.isAttached || typeof document === 'undefined') return;
    this.isAttached = true;

    this.scanVideos();

    // Periodic heartbeat to track focus and playhead
    this.intervalTimer = setInterval(() => {
      this.tick();
    }, 1000);
  }

  public scanVideos(): void {
    if (typeof document === 'undefined') return;
    const mediaSelector = this.profile.mediaSelector || 'video';
    const videos = document.querySelectorAll(mediaSelector);

    videos.forEach((el) => {
      if (el instanceof HTMLVideoElement && !this.trackedVideos.has(el)) {
        this.trackedVideos.set(el, {
          startTime: Date.now(),
          lastTime: el.currentTime,
          totalPlayMs: 0,
          scrubCount: 0,
          focusMs: 0,
          lastTick: Date.now()
        });

        // Event listeners on video element
        el.addEventListener('pause', () => this.emitVideoObservation(el));
        el.addEventListener('ended', () => this.emitVideoObservation(el));
      }
    });
  }

  private tick(): void {
    const now = Date.now();
    const isFocused = typeof document !== 'undefined' && document.visibilityState === 'visible';

    for (const [video, state] of this.trackedVideos.entries()) {
      const delta = now - state.lastTick;
      state.lastTick = now;

      if (!video.paused && !video.ended) {
        state.totalPlayMs += delta;
        if (isFocused) {
          state.focusMs += delta;
        }

        // Detect discontinuous scrub (playhead jumped > 3s without time passing)
        const expectedTime = state.lastTime + delta / 1000;
        if (Math.abs(video.currentTime - expectedTime) > 3.0) {
          state.scrubCount++;
        }
        state.lastTime = video.currentTime;
      }
    }
  }

  public emitVideoObservation(video: HTMLVideoElement): void {
    if (!this.callback) return;
    const state = this.trackedVideos.get(video);
    if (!state || state.totalPlayMs < 2000) {
      // Discard interactions under 2 seconds
      return;
    }

    const duration = video.duration && !isNaN(video.duration) ? video.duration : 1;
    const completionPercentage = Math.min(100, Math.round((video.currentTime / duration) * 100));
    const activeFocusRatio = state.totalPlayMs > 0 ? Number((state.focusMs / state.totalPlayMs).toFixed(2)) : 0;

    // Entropy is penalised if playbackRate is abnormally accelerated (>2.5x) or heavy scrubbing
    const ratePenalty = video.playbackRate > 2.5 ? 0.3 : 1.0;
    const scrubPenalty = state.scrubCount > 5 ? 0.5 : 1.0;
    const entropy = Number((ratePenalty * scrubPenalty).toFixed(2));

    const mediaTelemetry: MediaTelemetry = {
      playDurationMs: state.totalPlayMs,
      audioActive: !video.muted && video.volume > 0.05,
      playbackRate: video.playbackRate,
      completionPercentage
    };

    let contentUri: string;
    try {
      const currentUrl = typeof window !== 'undefined' ? new URL(window.location.href) : new URL('https://localhost');
      contentUri = this.profile.extractContentUrn(video, currentUrl);
    } catch {
      contentUri = `urn:vap:content:${this.profile.id}:video`;
    }

    const payload: ExternalObservationPayload = {
      platform: this.profile.id,
      archetype: 'video',
      contentUri,
      dwellTimeMs: state.totalPlayMs,
      activeFocusRatio,
      interactionEntropy: entropy,
      viewportCoverageRatio: 1.0,
      mediaTelemetry,
      timestamp: new Date().toISOString()
    };

    this.callback(payload);

    // Reset counters for next interval
    state.totalPlayMs = 0;
    state.focusMs = 0;
    state.scrubCount = 0;
  }

  public detach(): void {
    if (!this.isAttached) return;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    for (const [video] of this.trackedVideos.entries()) {
      this.emitVideoObservation(video);
    }
    this.trackedVideos.clear();
    this.isAttached = false;
  }
}
