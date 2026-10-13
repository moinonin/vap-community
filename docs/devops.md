# Verified Attention Protocol (VAP) & Engine (VAE) — DevOps Guide

> **Scope**: Complete End-to-End operations guide covering local testing, containerized cluster development, CI/CD pipeline, and cloud production deployment.

---

## 1. System Architecture & Component Roles

The Verified Attention Ecosystem is an evidence-centric infrastructure network. It separates client-side passive observation capture from backend ingestion, verification, calibrated scoring, settlement, and immutable audit stores.

```mermaid
flowchart TD
    subgraph ClientLayer["1. Client Layer (SDKs & Observers)"]
        BrowserSDK["Browser SDK (@verified-attention/sdk-browser)"]
        Extension["Chrome Extension (MV3)"]
        CLI["Developer CLI (vap)"]
    end

    subgraph IngestionGateway["2. Ingestion & API Gateway"]
        Proxy["Traefik / Nginx (Port 80/443 -> 3000/8002)"]
        APIService["Node REST API (apps/api :3000)"]
        PyBackend["Python Analytics/Ingest (scripts/server.py :8002)"]
        PortalUI["Portal Web UI & Explorer (apps/portal :4000)"]
    end

    subgraph AsyncQueues["3. State & Queue Backbone"]
        RedisQueue["Redis 7.2 (:6379) - Ingestion & Job Queue"]
        PostgresDB["PostgreSQL 16 (:5432) - Sessions & Auditable Proofs"]
        Jaeger["Jaeger Tracing (:16686 / :4317 OTLP)"]
    end

    subgraph ProcessingWorkers["4. Workers & Inference Engines"]
        VerifierWorker["Verifier Daemon (apps/verifier)"]
        SettlementWorker["Settlement Worker (packages/reward/settlement)"]
        MLServing["ML Attention Scoring (apps/ml-serving :8085)"]
    end

    ClientLayer -->|Stream Observations| IngestionGateway
    IngestionGateway -->|Push Events / Cache| AsyncQueues
    AsyncQueues -->|Pull Jobs| ProcessingWorkers
    ProcessingWorkers -->|Commit Signed Proofs & Ledger| PostgresDB
    ProcessingWorkers -->|Telemetry| Jaeger
```

### Component Port & Service Matrix

| Service | Context / Dockerfile | Base Image | Local Port | Role & Healthcheck |
| :--- | :--- | :--- | :--- | :--- |
| **`portal`** | `apps/portal/Dockerfile` | `node:22-alpine` | `4000` | Web portal, interactive explorer, customer console (`GET /`) |
| **`api`** | `apps/api/Dockerfile` | `node:22-alpine` | `3000` | REST API for sessions, evidence, policies, proofs (`GET /health`) |
| **`ml-serving`** | `apps/ml-serving/Dockerfile` | `node:22-slim` | `8085` | TFJS attention scoring & PSI drift detection (`GET /health`) |
| **`python-backend`** | `scripts/Dockerfile` | `python:3.11-slim` | `8002` | Python 3.11 high-throughput observation ingestion (`GET /health`) |
| **`verifier`** | `apps/verifier/Dockerfile` | `node:22-alpine` | *Daemon* | Replay queue, policy evaluator & Ed25519 proof issuer |
| **`settlement-worker`** | `packages/reward/settlement/Dockerfile` | `node:22-alpine` | *Daemon* | Settlement clearing, micropayments & ledger reconciliation |
| **`postgres`** | `postgres:16-alpine` | Standard image | `5432` | Relational store for sessions, proofs, and ledger accounts |
| **`redis`** | `redis:7.2-alpine` | Standard image | `6379` | Queue broker, sliding rate-limiter, and session cache |
| **`jaeger`** | `jaegertracing/all-in-one:1.54`| Standard image | `16686`, `4317` | OpenTelemetry distributed tracing UI & OTLP receiver |

*(Note: Port `3001` is strictly avoided to prevent host collisions with external applications).*

---

## 2. End-to-End Local Development & Testing

### 2.1 Prerequisites
- **Node.js**: ≥ 20.0.0 (Node 22 recommended)
- **pnpm**: ≥ 9.0.0 (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- **Python**: 3.10+ with `virtualenv`
- **Docker & Docker Compose**: v2.20+

### 2.2 Local Installation & Workspace Build
```bash
# 1. Install workspace dependencies
pnpm install

# 2. Compile all monorepo TypeScript packages
pnpm build

# 3. Setup Python virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install ruff fastapi uvicorn pydantic
```

### 2.3 Running Tests & Contract Audits
```bash
# Unit & integration tests across all packages
pnpm test

# Verify API contracts against specs (Githeri)
githeri verify

# Lint Python and TypeScript codebases
ruff check .
pnpm lint

# Static typecheck
pnpm typecheck
```

### 2.4 Running the Local 9-Service Docker Compose Stack
The unified Docker Compose configuration orchestrates the complete ecosystem with pre-configured healthchecks and network dependencies:

```bash
# Start all services in the background with fresh container builds
docker compose up -d --build

# Verify all containers are Up and Healthy
docker compose ps

# Tail service logs in real time
docker compose logs -f api verifier settlement-worker ml-serving

# Verify endpoints respond
curl -f http://localhost:4000/          # Portal
curl -f http://localhost:3000/health    # API
curl -f http://localhost:8002/health    # Python backend
curl -f http://localhost:8085/health    # ML Serving

# Stop and clean up cluster containers
docker compose down
```

### 2.5 Local End-to-End Flow Walkthrough
1. **Client Simulation**: Visit `http://localhost:4000` to interact with the Reading Sandbox. Scroll and generate micro-dwell events.
2. **Session Creation**: The frontend triggers `POST /v1/sessions` on `http://localhost:3000`.
3. **Evidence Ingestion**: Streaming micro-observations are batched and posted to `POST /v1/evidence`.
4. **Scoring & Verification**:
   - `api` proxies attention features to `ml-serving` on `:8085/v1/score`.
   - `verifier` evaluates the session evidence against active policy rules.
   - Verifier signs an Ed25519 Proof of Attention (`PoA`).
5. **Settlement**: `settlement-worker` consumes the completed proof, validates publisher eligibility, and records an auditable credit ledger record.
6. **CLI Verification**:
   ```bash
   # Use the vap CLI to verify the newly minted proof
   export VAP_API_URL=http://localhost:3000
   node packages/cli/dist/index.js verify <proof_id>
   ```

---

## 3. Production Deployment Architecture

In production, the architecture scales from single-host Docker Compose into a Kubernetes (EKS / GKE) cluster with dedicated worker pools, hardware security modules (HSM) for cryptographic signing, and managed datastores.

```
┌────────────────────────────────────────────────────────────────────────┐
│                    Cloudflare / AWS CloudFront                         │
│             (Global CDN, DDoS Protection, Edge Caching)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│              Ingress Controller (Traefik / AWS ALB)                    │
│                  TLS Termination (Let's Encrypt)                       │
└───────────┬───────────────────────────────┬────────────────────────────┘
            │                               │
            ▼ (port 4000)                   ▼ (port 3000 / 8002)
   ┌─────────────────┐             ┌─────────────────┐
   │ portal Pods     │             │ api Pods        │ (HPA: 5-50 replicas)
   └─────────────────┘             └────────┬────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
      ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
      │ Redis Cluster   │          │ Amazon Aurora   │          │ ML Triton /     │
      │ (ElastiCache)   │          │ PostgreSQL 16   │          │ ml-serving Pods │
      └────────┬────────┘          └────────┬────────┘          └─────────────────┘
               │                            │
               ▼                            │
      ┌─────────────────┐                   │
      │ Worker Pool     │                   │
      │ - verifier      ├───────────────────┘
      │ - settlement    │ (Committed Proofs & Ledgers)
      └────────┬────────┘
               │
               ▼
      ┌─────────────────┐
      │ Cloud HSM / KMS │ (FIPS 140-2 Level 3 Ed25519 Signing)
      └─────────────────┘
```

### 3.1 Production Environment Variables

| Variable | Target Component | Production Value Example | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | All Node apps | `production` | Optimizes runtime performance and suppresses verbose stack traces |
| `PORT` | All Web apps | Configured port (`3000`, `4000`, `8085`, `8002`) | Container listening port |
| `DATABASE_URL` | `api`, `verifier`, `settlement` | `postgresql://vae_user:SECRET@aurora-cluster.internal:5432/verified_attention?sslmode=verify-full` | Managed PostgreSQL connection string |
| `REDIS_URL` | `api`, `verifier`, `settlement` | `rediss://:SECRET@elasticache-cluster.internal:6379` | TLS-encrypted Redis broker & cache |
| `SIGNING_KEY_ID` | `verifier` | `arn:aws:kms:us-east-1:123456789012:key/...` | Cloud KMS / HSM key reference for Ed25519 PoA signing |
| `OTEL_EXPORTER_OTLP_ENDPOINT`| All services | `http://otel-collector.observability:4317` | Distributed tracing collector |
| `VAP_API_URL` | `portal` | `https://api.verified-attention.io` | Public REST API base URL |
| `CORS_ORIGIN` | `api` | `https://portal.verified-attention.io,https://*.publisher-network.com` | Restricts API access to verified domains |

---

## 4. Multi-Host Infrastructure Deployment (Bare-Metal / Hybrid Cluster)

When deploying across dedicated physical nodes (e.g. 3-node cluster):

| Machine / Node | Specifications | Assigned Roles & Services |
| :--- | :--- | :--- |
| **Node 1: Edge & Ingestion** | Low-latency CPU, 16GB+ RAM | Ingress Proxy (Nginx/Traefik), `portal`, `api` (public HTTP) |
| **Node 2: Processing & Workers** | High-core CPU (e.g., Ryzen 9), 64GB RAM | `verifier` daemons, `settlement-worker`, `ml-serving` |
| **Node 3: Persistence & State** | High I/O NVMe storage, 16GB+ RAM | PostgreSQL 16 (TimescaleDB), Redis 7.2, MinIO / S3 backups |

---

## 5. Security, Secrets & Key Management

1. **Cryptographic Signing Keys**:
   - **Local Testing**: Uses in-memory or development Ed25519 keypairs (`packages/crypto`).
   - **Production**: Private signing keys **MUST NEVER** be stored in environment variables or container filesystems. They must be managed via Hardware Security Modules (**AWS CloudHSM**, **Google Cloud KMS**, or **HashiCorp Vault**) via the `HSMProvider` interface in `packages/verification/src/hsm.ts`.
2. **Database & Redis Credentials**:
   - Injected at runtime using Kubernetes Secrets, AWS Secrets Manager, or Doppler.
3. **Network Isolation**:
   - Only `portal` (port 443) and `api` (port 443) are exposed through public ingress.
   - `postgres`, `redis`, `verifier`, `settlement-worker`, and `ml-serving` communicate strictly inside private VPC subnets (`vae-net`).

---

## 6. Observability, Health Checks & SLAs

- **Liveness & Readiness Probes**:
  - `portal`: `GET /` (HTTP 200)
  - `api`: `GET /health` (Verifies DB connection pool and Redis reachability)
  - `python-backend`: `GET /health` (Verifies ingestion workers)
  - `ml-serving`: `GET /health` (Verifies TFJS model weights are loaded in memory)
- **Distributed Tracing**:
  - Every incoming session ingestion request is assigned a `traceparent` W3C header.
  - Spans propagate across `api` &rarr; `verifier` &rarr; `ml-serving` to monitor latency bottlenecks via Jaeger / OpenTelemetry.
- **Alerting Thresholds**:
  - Ingestion DLQ backlog > 500 messages &rarr; PagerDuty Alert.
  - Verification error rate > 1.0% over 5 minutes &rarr; High Priority Incident.
  - Model PSI Drift score > 0.25 &rarr; Automated retrain hook triggered on `ml-serving`.