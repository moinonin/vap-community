# ADR-001: Language and Framework Selection

## Status
Accepted

## Date
2026-07-22

## Context

The Verified Attention Engine (VAE) requires a polyglot architecture spanning:
- Cross-platform SDKs (browser, mobile, desktop)
- High-throughput evidence ingestion pipeline
- ML model training and serving (attention + fraud models)
- Public APIs with strict protocol conformance
- Cryptographic operations (signing, verification)
- Operational tooling (CLI, dashboards)

Key constraints from the Project Charter and VAP specification:
- Evidence-Centric Architecture: immutable, append-only evidence store
- Protocol conformance: every VAP requirement must be testable
- Privacy by design: data minimisation, pseudonymisation, consent
- Horizontal scaling: millions of sessions, billions of evidence events/day
- Developer experience: SDKs < 50KB, well-typed, documented

## Decision

We adopt a **hybrid TypeScript/Python architecture** with clear domain boundaries:

### TypeScript (via pnpm workspaces + Turborepo)
**Primary domain**: SDKs, API layer, pipeline orchestration, core protocol types

| Component | Framework | Rationale |
|-----------|-----------|-----------|
| Browser SDK | Vanilla TS (Rollup) | < 50KB gzipped, no framework deps, universal |
| Mobile SDK (Android) | Kotlin + JNI bridge to TS core | Native performance, shared logic via WASM/compile |
| Mobile SDK (iOS) | Swift + JSI bridge to TS core | Native performance, shared logic |
| Desktop SDK | Tauri (Rust backend + TS frontend) | Small bundle, native access, shared TS core |
| Public API | Fastify (Node.js) | High throughput, TypeScript-native, schema validation |
| Evidence Pipeline | Node.js workers + Kafka | Stream processing, exactly-once semantics |
| Core Protocol Types | Zod + TypeScript | Single source of truth for VAP objects |
| CLI / Dev Tools | TypeScript (Commander/oclif) | Consistent with API types |
| Developer Portal | Next.js + TypeDoc | Auto-generated from OpenAPI |

### Python (via uv + isolated environments)
**Primary domain**: ML research, model training, model serving, data science

| Component | Framework | Rationale |
|-----------|-----------|-----------|
| Attention Models | PyTorch + Lightning | Research flexibility, production export |
| Fraud Models | PyTorch + scikit-learn | Ensemble methods, calibration tools |
| Model Serving | FastAPI + Triton/vLLM | High-throughput inference, batching |
| Research/Prototyping | Jupyter + uv | Reproducible environments, fast installs |
| Data Processing | Polars + Pandas | Columnar analytics, feature engineering |
| Conformance Fixtures | Python | Shared test data generation |

### Shared Infrastructure
| Layer | Technology | Purpose |
|-------|------------|---------|
| Message Bus | Apache Kafka / Redpanda | Evidence stream, exactly-once |
| Evidence Store | PostgreSQL (metadata) + ClickHouse (analytics) | Append-only, indexed by session/EID |
| Proof Store | PostgreSQL + object storage (S3/GCS) | Immutable proofs, long retention |
| ML Feature Store | Feast + Redis | Online/offline feature consistency |
| Secrets | HashiCorp Vault / Cloud KMS | Key rotation, HSM signing |
| Observability | OpenTelemetry + Prometheus + Grafana + Tempo | Unified metrics, traces, logs |
| Orchestration | Kubernetes (Helm) | Horizontal scaling, self-healing |

### Interop Strategy
1. **Protocol types as source of truth**: `@verified-attention/core` (TS/Zod) defines all VAP objects
2. **Python consumes via codegen**: `pydantic` models generated from Zod schemas (or JSON Schema)
3. **Model serving contract**: gRPC/REST with OpenAPI spec, input/output validated against VAP schemas
4. **Pipeline ↔ ML**: Evidence features written to Kafka → Feast → model inference → results back to Kafka
5. **No shared runtime**: TypeScript and Python services communicate only via well-defined APIs

## Consequences

### Positive
- **Type safety across boundary**: VAP objects validated at every ingress/egress point
- **Optimal tooling per domain**: TS for product/API/SDK, Python for ML/research
- **Team autonomy**: Protocol engineers work in TS; ML engineers work in Python
- **SDK size**: Browser SDK stays tiny (no Python runtime)
- **Conformance testing**: Single Zod schema source → tests in both languages
- **Hiring**: Access to both TS and Python talent pools

### Negative
- **Two runtimes**: Operational complexity (Node.js + Python containers)
- **Schema sync**: Must maintain Zod↔Pydantic parity (mitigated by codegen)
- **Debugging cross-language**: Distributed tracing required (OpenTelemetry)
- **Build complexity**: Turborepo for TS, uv for Python, separate CI pipelines

### Mitigations
- CI enforces schema compatibility check on every PR
- Shared conformance test suite runs against both implementations
- All inter-service communication via typed contracts (OpenAPI/gRPC)
- Documentation explicitly maps component → language

## Alternatives Considered

| Option | Rejected Because |
|--------|------------------|
| **Pure TypeScript** (TensorFlow.js, ONNX Runtime) | ML ecosystem maturity, model export friction, training tooling gaps |
| **Pure Python** (FastAPI for everything) | SDK bundle size, browser runtime, mobile native performance, type safety for protocol |
| **Go** for pipeline/API | Smaller ML ecosystem, protocol types need generics (Go 1.21+), SDK story weaker |
| **Rust** for everything | ML ecosystem immature, steeper learning curve, overkill for API layer |

## Related Decisions
- ADR-002: Model Serving Architecture (batch vs streaming vs hybrid)
- ADR-003: Verifier Identity & Trust Model (centralised vs federated)

## References
- [Project Charter §18 Design Philosophy](docs/specs/0000-project-charter.md#18-design-philosophy)
- [VAP Specification §5 Evidence Model](docs/specs/0001-verified-attention-protocol.md#5-evidence-model)
- [VAE Architecture §4 System Overview](docs/specs/0010-verified-attention-engine.md#4-system-overview)