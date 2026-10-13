# Developer Portal & Customer Console (Sprint 19/20)

The **Developer Portal** and **Customer Console** are unified and fully implemented inside **[`apps/portal`](../../apps/portal)** as a single, self-contained application (`apps/portal/public/index.html` + `apps/portal/server.mjs`).

> **Architecture Clarification:** No separate `apps/developer-portal` or standalone Redoc app needs to be built. All developer portal features (interactive API explorer, live proof verification, OpenAPI references, policy simulator) and commercial customer console capabilities (API keys, Policy Studio, analytics, usage estimation) are consolidated into `apps/portal`.

## Portal & Console Capabilities in `apps/portal`

| Feature | Description | Location in Portal |
|---|---|---|
| **Live Protocol Explorer** | Test interactive session lifecycle, observe simulated evidence, and trigger real-time proof generation | `#interactive-demo` |
| **API Reference & OpenAPI** | Integrated endpoints guide backed by OpenAPI 3.1 specification | [apps/api/openapi.yaml](../../apps/api/openapi.yaml) & `#how-it-works` |
| **Policy Studio** | Visual policy builder (dwell time, confidence threshold, evidence types) | `#console-policies` in Customer Console |
| **API Keys Management** | Self-serve API key generator with read/write scopes and webhook setup | `#console-api-keys` in Customer Console |
| **Whitepaper & Specs** | Direct whitepaper PDF download and normative VAP protocol specs | `/whitepaper.pdf` & [../specs/](../specs/) |
| **SDK Guides** | Direct integration guides for Browser, Mobile, Desktop, and MV3 Extension | [packages/sdk/browser/README.md](../../packages/sdk/browser/README.md) |

## Running the Portal Locally

Run the portal server directly or through pnpm:

```bash
# Start the portal on http://localhost:4000
node apps/portal/server.mjs
# or:
pnpm --filter @verified-attention/portal start
```

If connecting to a live backend VAE API:
```bash
VAP_API_URL=http://127.0.0.1:3000 PORT=4000 node apps/portal/server.mjs
```
*Note: If no backend is running, `apps/portal` automatically switches to interactive simulated/demo mode.*
