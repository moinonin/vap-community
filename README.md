# Verified Attention Engine (VAE)

**Reference implementation of the Verified Attention Protocol (VAP)** — an open, interoperable protocol for verifying human digital engagement with cryptographic provenance, calibrated confidence, and independent verification.

*Current capability: protocol specification (VAP) + reference engine (VAE) + contract test suite. Target: Internet infrastructure layer for verified engagement. See [Protocol vs Capability](#protocol-vs-capability) for details.*

--------------------------------------------------------------------------------

## The Problem

Human attention is the scarcest resource on the Internet. It drives advertising, education, compliance, research, media, healthcare, and AI training. Yet **no infrastructure layer exists to independently verify that a human genuinely engaged with digital content**.

Today's platforms measure their own metrics; advertisers trust platform reports; educators trust completion certificates; researchers trust self-reported data. All are proxy metrics—vulnerable to fraud, gaming, and misaligned incentives. Estimated 20–40% of digital ad spend is wasted on non-human traffic.

--------------------------------------------------------------------------------

## The Solution

**Verified Attention** is a standard, interoperable mechanism for independently verifying human attention with measurable confidence, while preserving privacy and application neutrality.

It is not an advertising technology. It is not an analytics tool. It is not a payment system. It is the **infrastructure** that makes attention verifiable—the same way DNS makes names resolvable, TLS makes connections trustworthy, and HTTP makes resources addressable.

### Core Innovation: Evidence-Centric Architecture (ECA)

```
Observation → Evidence → Claim → Confidence → Verification → Proof of Attention → Applications
```

Evidence is the primary architectural primitive. Everything derives from evidence. No decision without evidence. No evidence without provenance. Evidence is immutable.

--------------------------------------------------------------------------------

## Document Hierarchy

This repository follows a strict document hierarchy (per [AI_AUTHORING_GUIDE.md](docs/AI_AUTHORING_GUIDE.md)):

| Document                                                                            | Purpose                                                                               | Status     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| [Project Charter](docs/specs/0000-project-charter.md)                               | What VAE intends to build — scope, phases, governance, roadmap                        | ✅ Complete |
| [Verified Attention Protocol (VAP)](docs/specs/0001-verified-attention-protocol.md) | Normative protocol specification — evidence, claims, confidence, proofs, conformance  | ✅ Complete |
| [Verified Attention Engine (VAE)](docs/specs/0010-verified-attention-engine.md)     | Reference implementation architecture — pipelines, ML, APIs, security, deployment     | ✅ Complete |
| [SPRINTS.md](SPRINTS.md)                                                            | Systematic 21-sprint implementation plan (42 weeks to VAE 1.0)                        | ✅ Complete |

**Rule**: Lower-level documents implement higher-level principles. They never redefine them.

\\--------------------------------------------------------------------------------

## Protocol vs Capability

This repository distinguishes four layers to avoid premature infrastructure claims:

| Layer | Status | What exists today |
|-------|--------|-------------------|
| **Protocol Specification (VAP)** | ✅ Complete | `docs/specs/0001-verified-attention-protocol.md` — normative spec for evidence, claims, confidence, proofs, conformance (CC0) |
| **Reference Implementation (VAE)** | ✅ Complete | `docs/specs/0010-verified-attention-engine.md` + working code: `apps/api/`, `apps/verifier/`, `packages/verification/`, contract tests |
| **Target Infrastructure** | 🔄 In Progress | Deploy-level Docker (`make start-cluster`), CI contracts, observability, security hardening |
| **Future Moat** | 📋 Planned | Proprietary evidence dataset (S9), calibrated verification guarantees (S10), protocol network effects (S11), SDK distribution (S12) |

**Current capability** = VAP spec + VAE engine + contract tests.
**Target infrastructure** = production-deployable VAE with independent verifiers, publishers, consumers.
**Future moat** = data + validation + network effects + trust (not code alone).

\\--------------------------------------------------------------------------------

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           VERIFIED ATTENTION ECOSYSTEM                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Client SDKs  ──▶  Evidence Collection  ──▶  Attention Intelligence (ML)     │
│  (Browser,    │      Pipeline                  │                             │
│   Mobile,     │      │                           ▼                           │
│   Desktop,    │      ▼                  Fraud Intelligence (ML)              │
│   Extension)  │  Verification Engine  ──▶  Claims → Confidence               │
│               │  (Policy → Decision)         → Proof of Attention            │
│               │      │                           │                           │
│               │      ▼                           ▼                           │
│               │  Proof Generation: Sign → Store → Index → Webhook            │
│               │      │                           │                           │
│               ▼      ▼                           ▼                           │
│         Public APIs  │  Reward Intelligence  │  Analytics & Dashboards       │
└──────────────────────────────────────────────────────────────────────────────┘
```

--------------------------------------------------------------------------------

## Key Concepts

| Concept                      | Definition                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Observation**              | Raw signal from interaction environment (mouse move, scroll, key press, viewport change, focus event)                   |
| **Evidence**                 | Validated, immutable record derived from observations, tagged with session, timestamp, source, cryptographic integrity  |
| **Claim**                    | Semantic assertion about an attention session derived from evidence (e.g., "human was present," "content visible >30s") |
| **Confidence**               | Calibrated probability (0.0–1.0) that a claim is correct, computed deterministically from evidence                      |
| **Verification**             | Process of evaluating evidence against policy to produce decision: PASS, FAIL, INSUFFICIENT, PENDING                    |
| **Proof of Attention (PoA)** | Digitally signed, auditable record confirming a session achieved verified attention with a given confidence             |
| **Viewer**                   | The human whose attention is being verified                                                                             |
| **Publisher**                | Entity making content available and requesting attention verification                                                   |
| **Verifier**                 | Entity that evaluates evidence and issues Proofs of Attention                                                           |
| **Consumer**                 | Entity that receives and acts upon Proofs of Attention (advertiser, educator, researcher, etc.)                         |

--------------------------------------------------------------------------------

## Applications (Beyond Advertising)

Verified Attention is **application-neutral infrastructure**. Advertising is merely one application.

| Domain                   | Use Case                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------- |
| **Education**            | Verified course completion, competency-based credentials, remote assessment integrity |
| **Compliance**           | Mandatory training verification, regulatory disclosure confirmation, audit trails     |
| **Research**             | Ground-truth attention datasets, clinical trial adherence, survey quality filtering   |
| **Healthcare**           | Patient education verification, therapy adherence, clinical trial compliance          |
| **AI Training**          | Human feedback with verified attention (RLHF), training data quality filtering        |
| **Public Communication** | Emergency alert reach verification, civic engagement measurement                      |
| **Enterprise**           | Documentation effectiveness, meeting engagement, knowledge validation                 |
| **Streaming**            | Verified viewership for licensing, engagement-based creator compensation              |

--------------------------------------------------------------------------------

## Quick Start & Running the Apps

This monorepo contains services, applications, and client SDKs. Here is how to run and test each component locally.

### Prerequisites

- **Node.js**: ≥ 20.0.0
- **pnpm**: ≥ 9.0.0 (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- **Python**: 3.10+ (for ingestion prototype & contract validation)
- **Docker**: (Optional, for full Compose cluster)

```bash
# Clone repository and install dependencies
git clone https://github.com/moinonin/vap-community.git
cd verified-attention
pnpm install

# Build all monorepo packages and apps
pnpm build
```

---

### Running the Applications

#### 1. Verified Attention Portal (`apps/portal`)
The unified public web application, interactive live protocol explorer, and customer console.
```bash
# Start portal in demo/standalone mode (serves on http://localhost:4000)
node apps/portal/server.mjs
# or via pnpm:
pnpm --filter @verified-attention/portal start

# Or connect to a live VAE API backend:
VAP_API_URL=http://127.0.0.1:3000 PORT=4000 node apps/portal/server.mjs
```
* **Web UI**: Open `http://localhost:4000` to view the Protocol Landing Page, Live Explorer, and Customer Console (API keys, Policy Studio).
* **Whitepaper**: Downloadable at `http://localhost:4000/whitepaper.pdf`.

#### 2. Public REST API Service (`apps/api`)
The core VAP REST API handling sessions, evidence ingestion, policies, and proofs.
```bash
# Build the API
pnpm --filter @verified-attention/api run build

# Start long-running API dev server on port 3000 (or 3001)
node --input-type=module -e "
import('./apps/api/dist/index.js').then(({ createServer }) => {
  createServer().listen(3000, '0.0.0.0');
  console.log('VAE API running on http://127.0.0.1:3000');
});"
```
Or run the complete end-to-end publishing and verification script:
```bash
node examples/publish-and-verify.mjs
```

#### 3. Full Service Cluster with Docker Compose
Launches the unified Verified Attention ecosystem across all core services:
* **Portal & Explorer** (`portal`): `http://localhost:4000` (Protocol overview, live explorer, customer console)
* **Core REST & Ingestion API** (`api`): `http://localhost:3000` (`/health`, `/v1/sessions`, `/v1/evidence`, `/v1/policies`, `/v1/proofs`, `/v1/privacy`)
* **Attention ML Scoring & Drift** (`ml-serving`): `http://localhost:8085` (`/health`, `/v1/score`, `/v1/model/info`, PSI drift detection)
* **Python Ingestion & Analytics Backend** (`python-backend`): `http://localhost:8002` (`/health`, `/v1/ingest`, `/v1/sessions/:id`)
* **Verification Engine Worker** (`verifier`): Background replay, review queue, and proof generation daemon
* **Settlement Engine Worker** (`settlement-worker`): Background queue worker and reconciliation engine
* **PostgreSQL Database** (`postgres`): `localhost:5432` (`verified_attention`)
* **Redis Queue & Cache** (`redis`): `localhost:6379`
* **Jaeger Distributed Tracing** (`jaeger`): Web UI on `http://localhost:16686`, OTLP on `4317` (gRPC) and `4318` (HTTP)

*(Note: Port 3001 is intentionally reserved and avoided to prevent host collisions with external applications).*

```bash
# Start all cluster containers with build
docker compose up -d --build
# or via Makefile:
make start-cluster

# Inspect status of all containers
docker compose ps

# View service logs
docker compose logs -f

# Stop and clean cluster containers
docker compose down
# or via Makefile:
make stop-cluster
```

---

### Building the 6 Community Service Containers

The community repository provides source build contexts for 6 services and background workers:

| Service / Container | Context & Dockerfile | Base Image | Role / Entrypoint |
| :--- | :--- | :--- | :--- |
| **`portal`** | `apps/portal/Dockerfile` | `node:22-alpine` | Web landing, live explorer & community console (port `4000`) |
| **`api`** | `apps/api/Dockerfile` | `node:22-alpine` | REST API, session ingestion, policies, proofs (port `3000`) |
| **`ml-serving`** | `apps/ml-serving/Dockerfile` | `node:22-slim` | Baseline TFJS attention calibration & drift monitoring (port `8085`) |
| **`python-backend`** | `scripts/Dockerfile` | `python:3.11-slim` | High-throughput observation ingestion server (port `8002`) |
| **`verifier`** | `apps/verifier/Dockerfile` | `node:22-alpine` | Verification engine daemon, proof generation & review worker |
| **`settlement-worker`** | `packages/reward/settlement/Dockerfile` | `node:22-alpine` | Settlement queue daemon & reward reconciliation worker |

#### Step-by-Step Local Build

1. **Install Dependencies & Prime Monorepo Cache**
   ```bash
   pnpm install
   pnpm build
   ```

2. **Build and Run All Services via Docker Compose**
   ```bash
   docker compose up -d --build
   ```

   *Or build any individual service container directly:*
   ```bash
   docker compose build portal api ml-serving python-backend verifier settlement-worker
   ```

#### 4. Attention ML Serving (`apps/ml-serving`)
Serves attention scoring and drift detection over HTTP:
```bash
pnpm --filter @verified-attention/ml-serving run build
node apps/ml-serving/dist/index.js
# Serves on http://localhost:8085 (configurable via PORT and HOST env vars)
```

#### 5. Verification & Proof Generation Service (`apps/verifier`)
Verification engine, proof generation, replay service, and review queue:
```bash
pnpm --filter @verified-attention/verifier run build
pnpm --filter @verified-attention/verifier test
```

#### 6. Command Line Interface (`packages/cli`)
The `vap` developer CLI for interacting with sessions, evidence, policies, and proofs:
```bash
pnpm --filter @verified-attention/cli run build

# Show CLI commands
node packages/cli/dist/index.js --help

# Create a session
export VAP_API_URL=http://127.0.0.1:3000
node packages/cli/dist/index.js session create article_12345 --participant user_demo

# Ingest evidence
node packages/cli/dist/index.js evidence ingest sample_evidence.json

# Verify a proof
node packages/cli/dist/index.js verify sample_proof.json
```

---

### Running Tests & Verification

```bash
# Run all tests across the monorepo
pnpm test

# Run contract tests
make test

# Full static typecheck
pnpm typecheck

# Lint check
pnpm lint
```

--------------------------------------------------------------------------------

## Repository Structure

```
verified-attention/
├── docs/
│   ├── AI_AUTHORING_GUIDE.md           # Writing standards for all documents
│   ├── quickstart.md                   # 5-minute local walkthrough
│   ├── developer-portal/               # Developer portal & API reference mapping
│   ├── whitepaper/                     # Protocol whitepaper (LaTeX + rendered PDF)
│   └── specs/
│       ├── 0000-project-charter.md     # What VAE builds
│       ├── 0001-verified-attention-protocol.md  # VAP normative spec
│       └── 0010-verified-attention-engine.md    # VAE architecture
├── SPRINTS.md                          # Systematic implementation plan
├── packages/
│   ├── core/                           # Shared types: Evidence, Claim, Proof, Session
│   ├── pipeline/                       # Evidence processing pipeline (dedup, features, enrichment)
│   ├── verification/                   # Verification engine, confidence model, policies
│   ├── ml/                             # Attention & fraud ML models and features
│   ├── reward/                         # Eligibility, campaigns, pricing, settlement
│   ├── crypto/                         # Key management, signing, HSM abstraction
│   ├── store/                          # Evidence store, proof store, audit log
│   ├── observability/                  # Tracing (OTel), metrics, alerting, tracing UI
│   ├── auth/                           # OAuth2/OIDC, API keys, RBAC
│   ├── privacy/                        # Consent gate, minimisation, pseudonymisation, retention
│   ├── cli/                            # Command-line interface (`vap` command)
│   └── sdk/                            # Client SDK implementations
│       ├── browser/                    # Web browser SDK (DOM observers, queue, consent)
│       ├── extension/                  # MV3 browser extension (background worker, popup UI)
│       ├── mobile/                     # Mobile SDK wrapper (React Native / iOS / Android)
│       └── desktop/                    # Desktop SDK wrapper (Electron / Tauri)
├── apps/
│   ├── portal/                         # Unified Portal: Web landing, live explorer & customer console
│   ├── api/                            # Public REST/Streaming API service
│   ├── verifier/                       # Verification & proof generation worker service
│   └── ml-serving/                     # Model inference server (drift detection & scoring)
├── contracts/                          # Integration, chaos, and provider contract tests
├── examples/                           # Runnable end-to-end integration examples
└── docker-compose.yml                  # Full cluster deployment specification
```

--------------------------------------------------------------------------------

## Protocol Conformance

Any implementation claiming VAP compliance **MUST** pass the conformance test suite:

```
# Run conformance tests against your implementation
pnpm test:conformance -- --target=
```