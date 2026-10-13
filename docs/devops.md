# Verified Attention Engine (VAE) — DevOps Documentation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VERIFIED ATTENTION ENGINE (VAE)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐ │
│  │   Core       │    │  Pipeline    │    │   Reward     │    │   Apps   │ │
│  │  (Protocol)  │───▶│ (Ingestion)  │───▶│  (Economics) │───▶│ (API/    │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    │ Verifier)│ │
│         ▲                   ▲                   ▲            └──────────┘ │
│         │                   │                   │                     ▲     │
│         └───────────────────┴───────────────────┴─────────────────────┘     │
│                              │                                              │
│                    ┌─────────▼─────────┐                                    │
│                    │   ML Packages     │                                    │
│                    │ (Fraud Detection, │                                    │
│                    │  Attention Intel) │                                    │
│                    └───────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Package Breakdown

| Package | Purpose | Deploy Target |
|---------|---------|---------------|
| `@verified-attention/core` | VAP types, schemas, cryptographic primitives | **NPM package** (shared library) |
| `@verified-attention/pipeline` | Evidence validation, normalization, dedup, enrichment, DLQ | **Service** (ingestion worker) |
| `@verified-attention/reward-*` | Pricing, campaigns, eligibility, budget, settlement | **Services** (reward workers) |
| `@verified-attention/verification` | Replay, review queue, verification engine | **Service** (verification worker) |
| `@verified-attention/ml-*` | Fraud detection, attention features, models | **Services** (ML workers) |
| `@verified-attention/api` | REST API (Fastify/Express) | **HTTP Service** (public API) |
| `@verified-attention/verifier` | Verification execution, proof generation | **Service** (worker + API) |

---

## How It Gets Deployed

### 1. **Development**

```bash
make install      # .venv + pnpm install
make build        # pnpm -r build (tsdown)
make test         # vitest across all packages
make verify       # build + typecheck + lint + test
```

### 2. **Production Deployment** (containerized services)

Each app/package with a `main` entry point becomes a Docker service:

```dockerfile
# Example: apps/api/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 3. **Service Topology** (Kubernetes/Docker Compose)

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway / LB                         │
│                          (nginx/Traefik)                        │
└────────────────────────────────┬────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   API Service │      │  Verifier API │      │  Webhook      │
│  (REST + WS)  │      │  (internal)   │      │  Receiver     │
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Message Queue (Redis/RabbitMQ)              │
│  evidence.ingest  │  verification.jobs  │  proof.generation    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  Ingestion    │      │ Verification  │      │  Proof Gen    │
│  Workers      │      │  Workers      │      │  Workers      │
│ (pipeline)    │      │ (verification)│      │ (proof-gen)   │
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL + TimescaleDB                    │
│  sessions  │  evidence  │  claims  │  proofs  │  rewards  │ ... │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Reward Workers (separate pods)               │
│  pricing  │  campaigns  │  eligibility  │  budget  │ settlement │
└─────────────────────────────────────────────────────────────────┘
```

### 4. **Database Schema** (PostgreSQL + TimescaleDB for time-series evidence)

```sql
-- Core tables (from VAP spec)
CREATE TABLE sessions (...);
CREATE TABLE evidence (...);           -- hypertable for time-series
CREATE TABLE claims (...);
CREATE TABLE proofs (...);
CREATE TABLE verifications (...);
CREATE TABLE rewards (...);
CREATE TABLE campaigns (...);
CREATE TABLE budgets (...);
CREATE TABLE settlements (...);
CREATE TABLE ledger_entries (...);
```

### 5. **Infrastructure Components**

| Component | Technology | Purpose |
|-----------|------------|---------|
| **API Gateway** | Traefik/nginx | TLS termination, routing, rate limiting |
| **Message Queue** | Redis Streams / RabbitMQ | Async job processing |
| **Database** | PostgreSQL + TimescaleDB | Primary storage, time-series evidence |
| **Cache** | Redis | Session cache, rate limits, dedup index |
| **Object Storage** | S3/MinIO | Evidence exports, settlement files |
| **Secrets** | Vault / SealedSecrets | Signing keys, API keys |
| **Observability** | Prometheus + Grafana + Loki | Metrics, logs, traces |
| **ML Serving** | Triton / vLLM | Fraud detection models |

---

## DevOps Pipeline

```yaml
# .github/workflows/ci.yml (conceptual)
name: CI/CD
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm -r typecheck
      - run: pnpm -r lint
      - run: pnpm -r test

  docker:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/owner/vae-api:${{ github.sha }}
          # Repeat for each service

  deploy-staging:
    needs: docker
    runs-on: ubuntu-latest
    steps:
      - run: kubectl set image deployment/api api=ghcr.io/owner/vae-api:${{ github.sha }}
      - run: kubectl rollout status deployment/api
      # Repeat for all services

  deploy-prod:
    needs: deploy-staging
    environment: production
    runs-on: ubuntu-latest
    steps:
      - run: kubectl set image deployment/api api=ghcr.io/owner/vae-api:${{ github.sha }}
      # Blue/green or canary via Argo Rollouts
```

---

## How Publishers Integrate (Client Side)

Publishers **don't install this**. They integrate via:

1. **JavaScript SDK** (separate repo, not in this monorepo) - loaded on their pages:
   ```html
   <script src="https://cdn.verified-attention.io/vap-sdk.js"></script>
   <script>
     VAP.init({ publisherId: 'pub_123', verifierUrl: 'https://api.vae.example.com' });
     VAP.trackAttention(); // Auto-collects observations
   </script>
   ```

2. **Mobile SDKs** (iOS/Android) - native libraries

3. **Server-to-server** - backend integration for reward redemption

---

## Your 3-Machine Cluster Deployment

Based on your memory (M1 16GB, Ryzen 9 64GB RTX3050, i7-7700 16GB):

| Machine | Role | Services |
|---------|------|----------|
| **M1** | API Gateway + API Service + Verifier API | Low latency, user-facing |
| **Ryzen 9** | Workers (ingestion, verification, proof-gen, reward, ML) | Heavy compute, GPU for ML |
| **i7-7700** | PostgreSQL + TimescaleDB + Redis + MinIO | Storage, message queue |

---

## Summary

- **Not a browser extension** - it's backend infrastructure
- **Monorepo** with 15+ npm packages (core, pipeline, reward-*, ml-*, api, verifier)
- **Deployed as containerized microservices** (K8s or Docker Compose)
- **Publishers integrate via JS SDK** loaded on their pages
- **DevOps**: pnpm → Docker → K8s with GitHub Actions CI/CD
- **Data flow**: SDK → API → Queue → Workers → DB → Rewards → Settlement