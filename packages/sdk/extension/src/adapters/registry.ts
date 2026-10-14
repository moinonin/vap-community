import type { PlatformProfile, PlatformAdapter, ObservationCallback } from './base';
import { FeedCardAdapter } from './feed';
import { VideoPlayerAdapter } from './video';
import { ArticleAdapter } from './article';

export const PLATFORM_PROFILES: PlatformProfile[] = [
  // 1. LinkedIn (Feed & Articles)
  {
    id: 'linkedin',
    domains: ['linkedin.com'],
    archetype: 'feed',
    containerSelector: 'div[data-urn*="activity"], .feed-shared-update-v2, article',
    textSelector: '.feed-shared-update-v2__description, .feed-shared-text, .update-components-text',
    extractContentUrn: (el, url) => el.getAttribute('data-urn') || `urn:vap:content:linkedin:${url.pathname}`
  },
  // 2. X / Twitter (Feed Cards)
  {
    id: 'x',
    domains: ['x.com', 'twitter.com'],
    archetype: 'feed',
    containerSelector: 'article[data-testid="tweet"]',
    textSelector: 'div[data-testid="tweetText"]',
    extractContentUrn: (el) => {
      const link = el.querySelector('a[href*="/status/"]')?.getAttribute('href') || '';
      const statusId = link.split('/status/')[1]?.split('?')[0] || '';
      return `urn:vap:content:x:status:${statusId || 'tweet'}`;
    }
  },
  // 3. YouTube (Video Player)
  {
    id: 'youtube',
    domains: ['youtube.com'],
    archetype: 'video',
    containerSelector: '#movie_player, video.html5-main-video',
    mediaSelector: 'video',
    extractContentUrn: (_, url) => `urn:vap:content:youtube:video:${url.searchParams?.get('v') || url.pathname}`
  },
  // 4. TikTok Web (Video Feed)
  {
    id: 'tiktok',
    domains: ['tiktok.com'],
    archetype: 'video',
    containerSelector: 'div[data-e2e="recommend-list-item-container"], video',
    mediaSelector: 'video',
    extractContentUrn: (_, url) => {
      const parts = url.pathname.split('/');
      return `urn:vap:content:tiktok:video:${parts[parts.length - 1] || 'video'}`;
    }
  },
  // 5. Facebook / Meta (Feed)
  {
    id: 'facebook',
    domains: ['facebook.com'],
    archetype: 'feed',
    containerSelector: 'div[role="feed"] div[data-pagelet*="FeedUnit"], div[data-ad-preview="message"]',
    textSelector: 'div[dir="auto"]',
    extractContentUrn: (el) => `urn:vap:content:facebook:${el.getAttribute('data-urn') || 'post'}`
  },
  // 6. Substack, Medium, Dev.to (Longform Reader)
  {
    id: 'longform',
    domains: ['substack.com', 'medium.com', 'dev.to'],
    archetype: 'article',
    containerSelector: 'article, .post-content, .reader-container, .main-article',
    textSelector: 'p, h1, h2, h3, blockquote',
    extractContentUrn: (_, url) => `urn:vap:content:article:${url.hostname}:${url.pathname}`
  },
  // 7. Generic Fallback (Universal Web Support)
  {
    id: 'generic_web',
    domains: ['*'],
    archetype: 'article',
    containerSelector: 'article, main, [role="main"], .content',
    textSelector: 'p',
    extractContentUrn: (_, url) => `urn:vap:content:web:${url.origin}${url.pathname}`
  }
];

export class AdapterRegistry {
  private profiles: PlatformProfile[] = [...PLATFORM_PROFILES];
  private activeAdapter: PlatformAdapter | null = null;

  public registerProfile(profile: PlatformProfile): void {
    // Prepend so custom profiles take precedence over default
    this.profiles.unshift(profile);
  }

  public getProfiles(): readonly PlatformProfile[] {
    return this.profiles;
  }

  public findProfileForUrl(url: URL): PlatformProfile | undefined {
    const hostname = url.hostname.toLowerCase();
    for (const profile of this.profiles) {
      for (const domain of profile.domains) {
        if (domain === '*') return profile;
        if (typeof domain === 'string') {
          if (hostname === domain || hostname.endsWith(`.${domain}`)) {
            return profile;
          }
        } else if (domain instanceof RegExp && domain.test(hostname)) {
          return profile;
        }
      }
    }
    return undefined;
  }

  public createAdapter(url: URL): PlatformAdapter | null {
    const profile = this.findProfileForUrl(url);
    if (!profile) return null;

    switch (profile.archetype) {
      case 'feed':
        return new FeedCardAdapter(profile);
      case 'video':
        return new VideoPlayerAdapter(profile);
      case 'article':
        return new ArticleAdapter(profile);
      default:
        return null;
    }
  }

  public route(url: URL, callback: ObservationCallback): PlatformAdapter | null {
    if (this.activeAdapter) {
      this.activeAdapter.detach();
      this.activeAdapter = null;
    }
    const adapter = this.createAdapter(url);
    if (adapter) {
      adapter.onObservation(callback);
      adapter.attach();
      this.activeAdapter = adapter;
    }
    return adapter;
  }

  public getActiveAdapter(): PlatformAdapter | null {
    return this.activeAdapter;
  }

  public teardown(): void {
    if (this.activeAdapter) {
      this.activeAdapter.detach();
      this.activeAdapter = null;
    }
  }
}
