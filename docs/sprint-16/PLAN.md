# Sprint 16: Omni-Channel Social & Brand Space Addon

**Task ID:** `sprint-16-omni-channel-social-verification`  
**Reference Architecture:** [SPEC-0020](../specs/0020-omni-channel-brand-space-verification.md)  
**Status:** Ready for Implementation  

---

## Sprint Objectives
Expand the Verified Attention Protocol (VAP) beyond self-hosted web applications into external third-party spaces where brand communications occur. To eliminate code duplication and maintenance debt, the system is organized around **Three Universal DOM Archetypes** driven by a **Declarative Platform Profile Registry**:
1. **Feed Card Archetype** (LinkedIn, X/Twitter, Facebook, Threads, Reddit)
2. **Video Player Archetype** (YouTube, TikTok Web, Instagram Reels, Vimeo)
3. **Article / Reader Archetype** (Substack, Medium, Ghost, Dev.to, Generic Web)
4. **Zero-Knowledge Prior Exposure Attribution** ("Where did you hear about us?" solution)

---

## Detailed Work Units (Tickets)

### Unit 1: Base Platform Adapter Interface & Declarative Profile Registry
- **Path:** `packages/sdk/extension/src/adapters/base.ts` & `packages/sdk/extension/src/adapters/registry.ts`
- **Scope:**
  - Define `PlatformAdapter` interface: `match(url: URL): boolean`, `attach(): Promise<void>`, `detach(): void`, `observe(): Observable<ExternalObservationPayload>`.
  - Define `PlatformProfile` interface with declarative selector mappings: `id`, `domains`, `archetype`, `containerSelector`, `textSelector`, `mediaSelector`, `extractContentUrn`.
  - Implement default `PLATFORM_PROFILES` map covering LinkedIn, X.com, YouTube, TikTok, Facebook, Medium, Substack, and `generic_web` fallback.
  - Implement `AdapterRegistry` to discover, initialize, and teardown active archetype adapters dynamically without tab reloads.
- **Verification:** Vitest asserting profile resolution by domain and dynamic adapter factory instantiation.

### Unit 2: Universal Feed Card Archetype Adapter (`FeedCardAdapter`)
- **Path:** `packages/sdk/extension/src/adapters/feed.ts`
- **Scope:**
  - Universal engine for infinite scroll feeds (LinkedIn, X/Twitter, Facebook, Threads, Reddit).
  - Target DOM elements determined dynamically via profile `containerSelector` (e.g. `article[data-testid="tweet"]`, `div[data-urn*="activity"]`, `div[data-pagelet*="FeedUnit"]`).
  - Calculate reading velocity based on card word count. Flag >900 WPM as synthetic automation.
  - Track card viewport dwell with `IntersectionObserver` (65% visibility threshold).
  - Collect zero-PII interaction entropy (scroll jitter, hover over author card, comment drawer expansion).
- **Verification:** Vitest DOM fixture testing synthetic feed scroll and velocity validation across LinkedIn and X DOM mocks.

### Unit 3: Universal HTML5 Video Player Archetype Adapter (`VideoPlayerAdapter`)
- **Path:** `packages/sdk/extension/src/adapters/video.ts`
- **Scope:**
  - Universal engine hooking standard HTML5 `<video>` across YouTube, TikTok Web, Instagram Reels, and Vimeo.
  - Enforce focus requirement: Only accrue dwell time if `document.visibilityState === 'visible'` and tab is focused (`window.onfocus`).
  - Flag unnatural playback rates (>2.5x) or rapid timeline scrubbing.
  - Telemetry: video duration, playhead progression, muted/active audio state.
- **Verification:** Vitest HTML5 video element mock asserting audio/focus state tracking and penalty flag on mute+hidden tab.

### Unit 4: Universal Longform Article Archetype & Generic Web Fallback (`ArticleAdapter`)
- **Path:** `packages/sdk/extension/src/adapters/article.ts`
- **Scope:**
  - Universal reader engine for Substack, Medium, Ghost, Dev.to, and arbitrary corporate blogs (`article`, `main`, `.post-content`).
  - Track reader progression: percentage of article traversed, viewport dwell across reading paragraphs, paragraph-level pause analysis.
  - Compute human reading tempo (200–350 WPM baseline).
  - Generic Web Fallback: Automatically resolves canonical content URN via OpenGraph `og:url` / `og:title` or URL path if no specific profile matches.
- **Verification:** Vitest DOM mock verifying article progression percentage calculation and generic fallback resolution.

### Unit 5: External Evidence Ingestion Gateway Endpoint
- **Path:** `apps/api/src/evidence/external.ts`
- **Scope:**
  - Implement `POST /v1/evidence/external` accepting polymorphic `ExternalObservationPayload`.
  - Validate schema against `ExternalEvidenceSchema` (Zod).
  - Verify registered brand policy (ensure target content URL is authorized under enterprise organization policy).
  - Enforce zero PII: strip any unintended query parameters containing tracking IDs, session cookies, or personal identifiers.
  - Forward sanitized payload to VAP Settlement / Verifier queue via Redis Pub/Sub.
- **Verification:** Supertest HTTP request with valid and invalid external observation payloads.

### Unit 6: Multi-Archetype Verification & Weighting Policy
- **Path:** `packages/verification/src/policies/social.ts`
- **Scope:**
  - Implement `SocialAttentionPolicy` implementing VAP Core Policy evaluation with archetype-specific weight profiles:
    - **Feed Archetype:** Dwell (40%), Focus (30%), Reading Velocity Cap (20%), Micro-entropy (10%).
    - **Video Archetype:** Active Focus / Tab Visibility (50%), Continuous Playback Rate (30%), Dwell (20%).
    - **Article Archetype:** Scroll Progression (35%), Paragraph Dwell (35%), Focus (20%), Entropy (10%).
  - Generate canonical proof URN: `urn:vap:proof:social:<platform>:<hash>`.
- **Verification:** Vitest unit test asserting confidence score thresholds across authentic vs bot profiles for each archetype.

### Unit 7: Enterprise Console Social & Omni-Channel Hub
- **Path:** `apps/portal/public/index.html` & `apps/portal/public/app.js`
- **Scope:**
  - Add "External Channels" tab / filter within the Customer Console.
  - Render breakdowns:
    - Feed impressions vs verified read rate (LinkedIn, X, Facebook).
    - Video view count vs verified active watch time (YouTube, TikTok).
    - Longform deep-dive completion rate (Substack, Medium).
  - Downloadable cryptographic audit report containing proof URNs for enterprise partners and sponsors.
- **Verification:** Browser smoke test verifying tab switching, chart rendering, and filter controls.

### Unit 8: Conformance & End-to-End Test Suite
- **Path:** `packages/sdk/extension/test/social.test.ts`
- **Scope:**
  - E2E flow: Simulated scroll/play → Content Script Archetype Adapter → Ingestion Gateway → Verifier → Console Proof Entry.
  - Assert zero PII leakage at every boundary.
- **Verification:** `pnpm test --filter=@verified-attention/sdk-extension` passes 100%.

### Unit 9: Prior Attention Attribution Handshake ("Where Did You Hear About Us" Killer)
- **Path:** `packages/sdk/browser/src/attribution/index.ts` & `packages/sdk/extension/src/attribution.ts`
- **Scope:**
  - **Local Proof Storage:** Extension maintains an encrypted, local-only ring buffer of proofs earned on brand social assets (`urn:vap:proof:social:<platform>:<id>`).
  - **First-Party Handshake:** When the user visits the brand's first-party website (e.g. `/signup`, `/pricing`), the browser SDK triggers a cryptographically bound query: `vap.requestPriorAttentionProofs({ orgId })`.
  - **Zero-Knowledge Disclosure:** The extension returns signed attestation vouchers proving prior verified exposure within a configurable lookback window (e.g., last 7–30 days) without exposing user browsing history, cookies, or social profile identity.
  - **Attribution Ledger:** First-party conversion events link the prior exposure proof directly into the VAP settlement stream (`POST /v1/evidence/attribution`).
- **Verification:** Vitest test suite executing simulated cross-domain handshake: social dwell proof generation → local storage query → main site handshake verification without PII leakage.
