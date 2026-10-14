import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdapterRegistry, PLATFORM_PROFILES } from './registry';
import { FeedCardAdapter } from './feed';
import { VideoPlayerAdapter } from './video';
import { ArticleAdapter } from './article';
import type { ExternalObservationPayload } from './base';

// Simple mock element for Node environment
class FakeElement {
  public tagName: string;
  public textContent: string = '';
  public attributes: Map<string, string> = new Map();
  public children: FakeElement[] = [];

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, val: string) {
    this.attributes.set(name, val);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) || null;
  }

  querySelector(selector: string): FakeElement | null {
    if (selector.includes('status') && this.attributes.has('href')) {
      return this;
    }
    return this.children[0] || null;
  }

  querySelectorAll(): FakeElement[] {
    return this.children;
  }

  closest(): FakeElement | null {
    return this;
  }

  addEventListener() {}
  removeEventListener() {}
}

class FakeVideoElement extends FakeElement {
  public duration = 120;
  public currentTime = 60;
  public paused = false;
  public ended = false;
  public muted = false;
  public volume = 0.8;
  public playbackRate = 1.0;

  constructor() {
    super('VIDEO');
  }
}

describe('Omni-Channel Platform Adapters (Sprint 16)', () => {
  let registry: AdapterRegistry;
  let originalDocument: any;
  let originalWindow: any;

  beforeEach(() => {
    registry = new AdapterRegistry();
    originalDocument = (globalThis as any).document;
    originalWindow = (globalThis as any).window;

    (globalThis as any).document = {
      visibilityState: 'visible',
      documentElement: { scrollHeight: 2000 },
      body: new FakeElement('BODY'),
      createElement: (tag: string) => {
        if (tag.toLowerCase() === 'video') return new FakeVideoElement();
        return new FakeElement(tag);
      },
      querySelectorAll: () => [],
      querySelector: () => new FakeElement('ARTICLE'),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    (globalThis as any).window = {
      location: { href: 'https://www.linkedin.com/feed' },
      innerHeight: 800,
      scrollY: 600,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    (globalThis as any).HTMLVideoElement = FakeVideoElement;
  });

  afterEach(() => {
    registry.teardown();
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  describe('Unit 1: AdapterRegistry & Declarative Profiles', () => {
    it('should find matching profile for LinkedIn URL', () => {
      const url = new URL('https://www.linkedin.com/feed/update/urn:li:activity:72518293819238');
      const profile = registry.findProfileForUrl(url);
      expect(profile).toBeDefined();
      expect(profile?.id).toBe('linkedin');
      expect(profile?.archetype).toBe('feed');
    });

    it('should find matching profile for X.com / Twitter URL', () => {
      const url = new URL('https://x.com/karakana_io/status/1842918274928172');
      const profile = registry.findProfileForUrl(url);
      expect(profile).toBeDefined();
      expect(profile?.id).toBe('x');
      expect(profile?.archetype).toBe('feed');
    });

    it('should find matching profile for YouTube URL', () => {
      const url = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      const profile = registry.findProfileForUrl(url);
      expect(profile).toBeDefined();
      expect(profile?.id).toBe('youtube');
      expect(profile?.archetype).toBe('video');
    });

    it('should find matching profile for TikTok Web URL', () => {
      const url = new URL('https://www.tiktok.com/@techbrand/video/7281928471928371');
      const profile = registry.findProfileForUrl(url);
      expect(profile).toBeDefined();
      expect(profile?.id).toBe('tiktok');
      expect(profile?.archetype).toBe('video');
    });

    it('should find matching profile for Substack URL', () => {
      const url = new URL('https://engineering.substack.com/p/architecture-verified-attention');
      const profile = registry.findProfileForUrl(url);
      expect(profile).toBeDefined();
      expect(profile?.id).toBe('longform');
      expect(profile?.archetype).toBe('article');
    });

    it('should fall back to generic_web profile for unknown domain', () => {
      const url = new URL('https://randomcorporateblog.io/posts/release-notes');
      const profile = registry.findProfileForUrl(url);
      expect(profile).toBeDefined();
      expect(profile?.id).toBe('generic_web');
      expect(profile?.archetype).toBe('article');
    });

    it('should instantiate appropriate adapter by archetype', () => {
      const feedAdapter = registry.createAdapter(new URL('https://www.linkedin.com/feed'));
      expect(feedAdapter).toBeInstanceOf(FeedCardAdapter);

      const videoAdapter = registry.createAdapter(new URL('https://www.youtube.com/watch?v=123'));
      expect(videoAdapter).toBeInstanceOf(VideoPlayerAdapter);

      const articleAdapter = registry.createAdapter(new URL('https://medium.com/@dev/post'));
      expect(articleAdapter).toBeInstanceOf(ArticleAdapter);
    });

    it('should allow registering custom brand profile with priority', () => {
      registry.registerProfile({
        id: 'custom_blog',
        domains: ['brand.internal'],
        archetype: 'article',
        containerSelector: '.custom-content',
        extractContentUrn: (_, url) => `urn:vap:content:custom:${url.pathname}`
      });

      const profile = registry.findProfileForUrl(new URL('https://brand.internal/memo'));
      expect(profile?.id).toBe('custom_blog');
    });
  });

  describe('Unit 2: FeedCardAdapter (LinkedIn, X, Facebook)', () => {
    it('should calculate reading velocity and emit valid observation payload', () => {
      const profile = PLATFORM_PROFILES.find((p) => p.id === 'linkedin')!;
      const adapter = new FeedCardAdapter(profile);

      const observations: ExternalObservationPayload[] = [];
      adapter.onObservation((obs) => observations.push(obs));

      const card = (document as any).createElement('div');
      card.setAttribute('data-urn', 'urn:li:activity:999999');
      card.textContent = 'This is an insightful post about verified attention protocol architecture. '.repeat(10);

      // Simulate active dwell tracking
      (adapter as any).activeDwells.set(card, {
        startTime: Date.now() - 5000, // 5s dwell
        entropyCount: 15
      });

      adapter.emitCardObservation(card as any, 0.85);

      expect(observations.length).toBe(1);
      const obs = observations[0];
      expect(obs.platform).toBe('linkedin');
      expect(obs.archetype).toBe('feed');
      expect(obs.contentUri).toBe('urn:li:activity:999999');
      expect(obs.dwellTimeMs).toBeGreaterThanOrEqual(5000);
      expect(obs.viewportCoverageRatio).toBe(0.85);
      expect(obs.readingVelocityWpm).toBeGreaterThan(0);
      expect(obs.readingVelocityWpm).toBeLessThan(900); // realistic human velocity
      expect(obs.interactionEntropy).toBeGreaterThan(0);
    });
  });

  describe('Unit 3: VideoPlayerAdapter (YouTube, TikTok Web)', () => {
    it('should track video playback and emit media telemetry', () => {
      const profile = PLATFORM_PROFILES.find((p) => p.id === 'youtube')!;
      const adapter = new VideoPlayerAdapter(profile);

      const observations: ExternalObservationPayload[] = [];
      adapter.onObservation((obs) => observations.push(obs));

      const video = (document as any).createElement('video');
      video.duration = 120;
      video.currentTime = 60;
      video.paused = false;
      video.muted = false;
      video.volume = 0.8;
      video.playbackRate = 1.0;

      (adapter as any).trackedVideos.set(video, {
        startTime: Date.now() - 30000,
        lastTime: 30,
        totalPlayMs: 30000,
        scrubCount: 1,
        focusMs: 27000,
        lastTick: Date.now()
      });

      adapter.emitVideoObservation(video as any);

      expect(observations.length).toBe(1);
      const obs = observations[0];
      expect(obs.platform).toBe('youtube');
      expect(obs.archetype).toBe('video');
      expect(obs.mediaTelemetry).toBeDefined();
      expect(obs.mediaTelemetry?.playDurationMs).toBe(30000);
      expect(obs.mediaTelemetry?.audioActive).toBe(true);
      expect(obs.mediaTelemetry?.completionPercentage).toBe(50);
      expect(obs.activeFocusRatio).toBe(0.9);
      expect(obs.interactionEntropy).toBe(1.0);
    });

    it('should penalize entropy on unnatural playback speed (>2.5x)', () => {
      const profile = PLATFORM_PROFILES.find((p) => p.id === 'youtube')!;
      const adapter = new VideoPlayerAdapter(profile);

      const observations: ExternalObservationPayload[] = [];
      adapter.onObservation((obs) => observations.push(obs));

      const video = (document as any).createElement('video');
      video.duration = 100;
      video.currentTime = 50;
      video.playbackRate = 3.0; // Fast speed

      (adapter as any).trackedVideos.set(video, {
        startTime: Date.now() - 10000,
        lastTime: 20,
        totalPlayMs: 10000,
        scrubCount: 0,
        focusMs: 10000,
        lastTick: Date.now()
      });

      adapter.emitVideoObservation(video as any);

      expect(observations[0].interactionEntropy).toBeLessThanOrEqual(0.3);
    });
  });

  describe('Unit 4: ArticleAdapter (Substack, Medium, Generic Web)', () => {
    it('should track reading progression and emit article payload', () => {
      const profile = PLATFORM_PROFILES.find((p) => p.id === 'longform')!;
      const adapter = new ArticleAdapter(profile);

      const observations: ExternalObservationPayload[] = [];
      adapter.onObservation((obs) => observations.push(obs));

      const article = (document as any).createElement('article');
      article.textContent = 'This is an in-depth technical analysis of decentralized attention verification systems. '.repeat(20);

      (adapter as any).startTime = Date.now() - 15000;
      (adapter as any).activeFocusMs = 15000;
      (adapter as any).maxScrollProgress = 0.75;
      (adapter as any).mouseMoves = 20;
      (adapter as any).scrollEvents = 10;

      adapter.emitArticleObservation();

      expect(observations.length).toBe(1);
      const obs = observations[0];
      expect(obs.platform).toBe('longform');
      expect(obs.archetype).toBe('article');
      expect(obs.viewportCoverageRatio).toBe(0.75); // 75% scroll progression
      expect(obs.activeFocusRatio).toBe(1.0);
      expect(obs.readingVelocityWpm).toBeGreaterThan(0);
    });
  });
});
