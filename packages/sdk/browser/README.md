# @verified-attention/browser-sdk

Real browser SDK for the Verified Attention Protocol (S16).

Consent-gated observers capture canonical VAP observations, which the session
manager aggregates into signed evidence records that an offline-tolerant queue
delivers to the VAE ingestion API.

## Features

- **Observers** (`src/observers/`) — visibility (`document.visibilitychange` +
  `IntersectionObserver` on the content element), throttled interaction
  (click/scroll/keypress), and focus (window focus/blur). All emit canonical
  `Observation` records matching `@verified-attention/core` schemas.
- **Session lifecycle** (`src/session/`) — `POST /v1/sessions`, heartbeat
  interval (`PATCH`), graceful close, and observation → evidence mapping
  (`E-CONTEXT` / `E-VISIBLE` / `E-INTERACTION` / `E-DURATION`). Evidence is
  signed with an ephemeral per-session ECDSA P-256 key (WebCrypto).
- **Offline-tolerant queue** (`src/queue/`) — in-memory + `localStorage`
  persistence, flush on interval and on batch size, exponential backoff on
  transient failures, permanent drop on 4xx.
- **Consent gate** (`src/consent/`) — no collection starts until the
  configurable `consentProvider` resolves `GRANTED`.
- **Pre-send validation** (`src/validation/`) — zod schema duplicating the
  core evidence fields, invalid records are dropped before they leave the
  client.

## Usage

```ts
import { VerifiedAttention } from '@verified-attention/browser-sdk';

const va = new VerifiedAttention({
  apiUrl: 'https://api.example.com',
  policyId: 'pol_reading_30s',
  contentId: 'article_12345',
  contentElement: document.querySelector('article'),
  consentProvider: { requestConsent: () => cmp.getConsent() },
  onProof: (proof) => console.log('Verified:', proof),
});

await va.startSession();
// ... later (e.g. on pagehide):
await va.stopSession();
```

## Notes

- **Dependency-free at runtime** except `zod` (pre-send validation):
  browser integration uses standard Web APIs (`fetch`, `IntersectionObserver`,
  WebCrypto, `localStorage`). All DOM access goes through an injectable
  `DomAdapter`, so tests run in plain Node without a browser.
- **Bundle size**: the built ESM bundle (`dist/index.mjs`) is ~27 KB raw /
  ~8 KB gzipped — under the 50 KB budget from the VAE spec.
- Type-only imports from `@verified-attention/core` keep protocol types in
  sync without pulling `node:crypto` into the bundle.

```bash
pnpm test        # vitest (node env, fake adapters)
pnpm build       # tsdown
pnpm typecheck
```
