# SPEC-0020: Omni-Channel Social & Brand Space Verification (External Addon)

| Status | Proposed |
| :--- | :--- |
| **Author** | Nicholas Rotich & Engineering Team |
| **Date** | 2026-10-14 |
| **Version** | 1.0.0 |
| **Protocol Scope** | VAP Core Layer 2 (Cross-Domain Observation & Proof Federation) |

---

## 1. Executive Summary & Problem Definition

Traditional web analytics and the initial Verified Attention Protocol (VAP) implementation focus primarily on first-party domains where the brand controls the DOM and can directly embed `<script src="vap-sdk.js">`.

However, the majority of brand mindshare, executive engagement, and content consumption occurs across **third-party walled gardens**:
1. **LinkedIn Posts & Articles** (B2B thought leadership, talent branding, executive memos).
2. **YouTube Videos & Live Streams** (Product reveals, investor relations, technical keynotes).
3. **Substack / Medium / Dev.to** (Deep-dive technical whitepapers and corporate blogs).
4. **X (Twitter) & Threads** (Breaking brand communications, community town halls).

### The Critical Gap
Platform-native engagement metrics (LinkedIn "Impressions", YouTube "Views", X "Impressions") are:
- **Opaque & Unverifiable:** Black-box numbers reported by the platform with no mathematical audit trail.
- **Vulnerable to Synthetic Fraud:** Bot farms, scraping daemons, and background tab playback inflate counts by 20% to 65%.
- **Unportable:** Engagement on LinkedIn cannot be cryptographically proven to a sponsor, partner, or auditor.

### The Solution: VAP Omni-Channel Addon
SPEC-0020 standardizes a lightweight, privacy-preserving observation and attestation engine that allows brands to:
1. Issue **Canonical External Content URIs** for social posts and media (`urn:vap:content:social:<platform>:<id>`).
2. Collect **zero-PII cognitive engagement telemetry** via Browser Addon / MV3 Extension or Smart Redirect Interstitials.
3. Mint **Ed25519-signed Proofs of Attention (PoA)** for interactions that occur entirely off-domain.
4. Aggregate and clear these proofs within the enterprise Customer Console.

---

## 2. Architectural Topology

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 External Platform DOM                  │
                  │   (e.g., LinkedIn feed, YouTube watch page, Substack)   │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                      Platform Content Script Injection (MV3 Addon)
                                              │
                                              ▼
                    ┌────────────────────────────────────────────────────┐
                    │               Platform DOM Adapters                │
                    │   - LinkedInFeedAdapter (active viewport dwell)    │
                    │   - YouTubePlayerAdapter (HTML5 video focus/state) │
                    │   - LongformReaderAdapter (scroll + interaction)   │
                    └─────────────────────────┬──────────────────────────┘
                                              │
                                              ▼
                    ┌────────────────────────────────────────────────────┐
                    │            VAP Cognitive Evidence Queue            │
                    │   - Micro-interaction entropy calculation          │
                    │   - Hardware acceleration verification             │
                    │   - Zero-PII sanitization & minimisation           │
                    └─────────────────────────┬──────────────────────────┘
                                              │ Signed Payload (mTLS/Bearer)
                                              ▼
                    ┌────────────────────────────────────────────────────┐
                    │            VAP Ingestion Gateway (:3000)           │
                    │           POST /v1/evidence/external               │
                    └─────────────────────────┬──────────────────────────┘
                                              │
                                              ▼
                    ┌────────────────────────────────────────────────────┐
                    │          Verification & ML Engine (:8085)          │
                    │     Evaluates Temporal & Cognitive Heatmaps        │
                    └─────────────────────────┬──────────────────────────┘
                                              │
                                              ▼
                    ┌────────────────────────────────────────────────────┐
                    │            Ed25519 Hardware / Software HSM         │
                    │      Mints Proof: urn:vap:proof:<platform_id>      │
                    └────────────────────────────────────────────────────┘
```

---

## 3. Protocol Data Structures & Schema Extensions

### 3.1 Canonical Social Content URIs
External assets conform to deterministic URN naming conventions:
- **LinkedIn:** `urn:vap:content:linkedin:activity:<activity_id>` or `urn:vap:content:linkedin:article:<slug>`
- **YouTube:** `urn:vap:content:youtube:video:<video_id>`
- **Substack:** `urn:vap:content:substack:post:<publication>:<slug>`
- **X (Twitter):** `urn:vap:content:x:status:<status_id>`

### 3.2 External Attestation Observation Payload
```typescript
export interface ExternalObservationPayload {
  platform: 'linkedin' | 'youtube' | 'substack' | 'x' | 'generic_web';
  contentUri: string;
  organizationId: string;
  dwellTimeMs: number;
  activeFocusRatio: number; // 0.00 to 1.00 (tab active + window focused)
  interactionEntropy: number; // Normalized micro-movement entropy
  viewportCoverageRatio: number; // Percentage of post/video visible in viewport
  mediaTelemetry?: {
    playDurationMs?: number;
    audioActive?: boolean;
    playbackRate?: number;
    completionPercentage?: number;
  };
  clientSignature?: string;
  timestamp: string;
}
```

---

## 4. Universal Archetypes & Declarative Profile Engine

To prevent brittle code maintenance, DOM class drift, and endless code duplication across dozens of social networks, VAP standardizes on **Three Universal DOM Archetypes** paired with a **Declarative Platform Profile Registry**.

### 4.1 The Three Universal DOM Archetypes

| Archetype | Covered Platforms | Core Attestation Logic |
| :--- | :--- | :--- |
| **1. Feed Card (`feed`)** | **LinkedIn, X.com (Twitter), Facebook, Threads, Reddit** | Observes bounded content cards in infinite scroll feeds. Uses `IntersectionObserver` ($\ge 65\%$ viewport visibility threshold), measures dwell time, computes reading velocity based on card word count, and flags bot velocity ($>900\text{ WPM}$). |
| **2. Video Player (`video`)** | **YouTube, TikTok Web, Instagram Reels, Facebook Watch, Vimeo** | Hooks standard HTML5 `<video>` element. Enforces foreground tab visibility (`document.visibilityState === 'visible'`) and active window focus (`window.onfocus`). Muted or background tab playback yields zero confidence. Audits scrubbing jumps and playback acceleration ($>2.5\times$). |
| **3. Longform Article (`article`)** | **Substack, Medium, Ghost, Dev.to, any corporate blog** | Observes longform reading containers (`article`, `main`, `.post-content`). Tracks scroll progression percentage, paragraph-level pause cadences, and computes natural reading tempo (200–350 WPM baseline). |

### 4.2 Declarative Profile Engine

Adding support for any new platform requires zero new TypeScript classes. Platforms are declared via configuration objects:

```typescript
export interface PlatformProfile {
  id: string;
  domains: (string | RegExp)[];
  archetype: 'feed' | 'video' | 'article';
  containerSelector: string;
  textSelector?: string;
  mediaSelector?: string;
  extractContentUrn: (el: Element, url: URL) => string;
}

export const PLATFORM_PROFILES: PlatformProfile[] = [
  // 1. LinkedIn (Feed & Articles)
  {
    id: 'linkedin',
    domains: ['linkedin.com'],
    archetype: 'feed',
    containerSelector: 'div[data-urn*="activity"], .feed-shared-update-v2, article',
    textSelector: '.feed-shared-update-v2__description, .feed-shared-text',
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
      return `urn:vap:content:x:status:${statusId}`;
    }
  },
  // 3. YouTube (Video Player)
  {
    id: 'youtube',
    domains: ['youtube.com'],
    archetype: 'video',
    containerSelector: '#movie_player, video.html5-main-video',
    mediaSelector: 'video',
    extractContentUrn: (_, url) => `urn:vap:content:youtube:video:${url.searchParams.get('v') || url.pathname}`
  },
  // 4. TikTok Web (Video Feed)
  {
    id: 'tiktok',
    domains: ['tiktok.com'],
    archetype: 'video',
    containerSelector: 'div[data-e2e="recommend-list-item-container"], video',
    mediaSelector: 'video',
    extractContentUrn: (_, url) => `urn:vap:content:tiktok:video:${url.pathname.split('/').pop()}`
  },
  // 5. Facebook / Meta (Feed)
  {
    id: 'facebook',
    domains: ['facebook.com'],
    archetype: 'feed',
    containerSelector: 'div[role="feed"] div[data-pagelet*="FeedUnit"]',
    extractContentUrn: (el) => `urn:vap:content:facebook:${el.getAttribute('data-urn') || 'post'}`
  },
  // 6. Substack & Medium (Longform Reader)
  {
    id: 'longform',
    domains: ['substack.com', 'medium.com', 'dev.to'],
    archetype: 'article',
    containerSelector: 'article, .post-content, .reader-container',
    extractContentUrn: (_, url) => `urn:vap:content:article:${url.hostname}:${url.pathname}`
  },
  // 7. Generic Fallback (Universal Web Support)
  {
    id: 'generic_web',
    domains: ['*'],
    archetype: 'article',
    containerSelector: 'article, main, [role="main"], .content',
    extractContentUrn: (_, url) => `urn:vap:content:web:${url.origin}${url.pathname}`
  }
];
```

### 4.3 Zero-Install Smart Redirect Interstitial (`AttestationRedirector`)
- For visitors without the browser extension installed, companies can share smart tracking URLs: `https://vap.link/p/<brand_slug>/<encoded_destination>`.
- The interstitial performs a 400ms cryptographic proof-of-work / human cognitive check before passing the user seamlessly to the destination social post.

---

## 5. Security & Privacy Guarantees
1. **Zero Social PII Scraping:** The addon **never** reads, transmits, or logs user profile names, connection lists, private messages, or account IDs.
2. **Strict URL Matching:** Content observation only activates on URLs specifically registered under the brand's VAP Policy Studio.
3. **Local Entropy Compilation:** Micro-movements are compiled into entropy scores locally in memory; raw mouse coordinate arrays are destroyed immediately.

---

## 6. Zero-Knowledge Prior Exposure Attribution Protocol ("Dark Social" Solution)

### 6.1 The Business Problem: Broken Multi-Touch Attribution
Consumers frequently discover brands on social platforms (e.g., reading a founder's LinkedIn breakdown or watching an architecture video on YouTube), close the tab, and days later navigate directly to the company website to convert. Because cross-site tracking cookies are blocked, web analytics platforms categorize this traffic as "Direct / None", forcing companies to rely on unreliable "Where did you hear about us?" checkout drop-down surveys.

### 6.2 The Protocol Handshake
```
   [ External Social Space ]                      [ User Extension Wallet ]                     [ First-Party Brand Site ]
(LinkedIn / YouTube / Substack)                 (Local Encrypted Ring Buffer)                    (e.g., brand.com/signup)
              │                                               │                                              │
              │ 1. Verified Dwell & Engagement               │                                              │
              ├──────────────────────────────────────────────>│                                              │
              │    Stores: urn:vap:proof:social:linkedin:123  │                                              │
              │    (Signed PoA Voucher, Zero PII)             │                                              │
              │                                               │                                              │
              │               ... 3 days later ...            │                                              │
              │                                               │         2. User visits /signup page          │
              │                                               │<─────────────────────────────────────────────┤
              │                                               │         `vap.requestPriorAttentionProofs()`  │
              │                                               │                                              │
              │                                               │ 3. Selective Zero-Knowledge Attestation      │
              │                                               ├─────────────────────────────────────────────>│
              │                                               │    Returns: Signed voucher proving 45s dwell │
              │                                               │    on brand's post within lookback window.   │
              │                                               │    NO browsing history, NO personal ID.      │
              │                                               │                                              │
              │                                               │                               4. Ingest Proof│
              │                                               │                                  POST /v1/   │
              │                                               │                           evidence/attribute │
```

### 6.3 Attestation Voucher Format
```typescript
export interface PriorAttentionVoucher {
  organizationId: string;
  channel: 'linkedin' | 'youtube' | 'substack' | 'x';
  proofUrn: string;
  exposureTimestamp: string;
  confidenceScore: number; // e.g. 0.94
  lookbackWindowDays: number;
  attestationSignature: string; // Ed25519 signature from local extension wallet
}
```
This enables enterprise marketers to achieve 100% cryptographically verified multi-touch attribution without third-party cookies or intrusive surveillance.

