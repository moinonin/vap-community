# SPRINTS.md

## Systematic Implementation Plan for Verified Attention Engine (VAE)

Version: 1.0

Status: Living Document

> **Operational Authority Notice**:  
> While `SPRINTS.md` serves as the strategic lifecycle roadmap across all phases, the individual sprint directories (`docs/sprint-*/spec.yaml` and `docs/sprint-*/PLAN.md`) represent the **operational and machine-verifiable source of truth**. Each `docs/sprint-*/spec.yaml` defines the precise task IDs, dependency graphs, file expectations, and automated test commands executed by CI and agent tooling.

---

# 1. Sprint Framework

## Sprint Cadence

- **Duration**: 2 weeks (10 working days)
- **Planning**: Day 1 (2 hours)
- **Review**: Day 10 (1 hour)
- **Retrospective**: Day 10 (30 min)
- **Buffer**: 1 day per sprint for unplanned work, technical debt, hardening

## Sprint Roles

- **Sprint Lead**: Owns sprint goal, coordinates dependencies, communicates status
- **Protocol Engineer**: VAP conformance, evidence models, verification logic
- **Platform Engineer**: Infrastructure, pipelines, deployment, observability
- **ML Engineer**: Attention models, fraud models, confidence calibration
- **SDK Engineer**: Browser, mobile, desktop SDKs
- **QA Engineer**: Conformance tests, integration tests, fraud simulation
- **Security/Privacy Engineer**: Threat modelling, privacy audits, penetration testing

## Definition of Done (DoD)

A sprint story is DONE when:

- [ ] Code merged to `main` with passing CI
- [ ] Unit tests ≥ 80% coverage for new code
- [ ] Integration tests pass for affected flows
- [ ] VAP conformance tests pass (where applicable)
- [ ] Documentation updated (API docs, architecture decision records)
- [ ] Security review completed (for security-relevant changes)
- [ ] Privacy impact assessment completed (for data-relevant changes)
- [ ] Deployed to staging with smoke tests passing
- [ ] Sprint Lead sign-off

---

# 2. Phase Mapping to Sprints

| Phase | Charter Section | Sprints | Focus |
|-------|----------------|---------|-------|
| Phase 0: Research | 12 | Sprints 1–3 | Foundations, literature, prototypes |
| Phase 1: Protocol | 12 | Sprints 4–6 | VAP specification, test suite |
| Phase 2: Reference Engine | 12 | Sprints 7–15 | Core VAE implementation |
| Phase 3: Browser Extension | 12 | Sprints 16–18 | Browser SDK + extension |
| Phase 4: Developer APIs | 12 | Sprints 19–21 | Public APIs, SDK docs, onboarding |
| Phase 5: Marketplace | 12 | Sprints 22–24 | Attention marketplace (post-VAE 1.0) |
| Phase 6: Ecosystem | 12 | Sprints 25+ | Standards, certification, community |

**Total estimated sprints to VAE 1.0 (Phases 0–4): 21 sprints ≈ 42 weeks**

---

# 3. Sprint-by-Sprint Plan

## Phase 0: Research (Sprints 1–3)

### Sprint 1: Foundations & Environment

**Goal**: Establish development environment, architecture decisions, and research baseline.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Set up monorepo with workspace structure | Platform Eng | `packages/` structure, shared config | `pnpm install && pnpm build` succeeds |
| Configure CI/CD pipeline (GitHub Actions) | Platform Eng | `.github/workflows/ci.yml` | Lint, typecheck, test, build on PR |
| Define ADR template and create ADR-001 (Language/Framework Selection) | Sprint Lead | `docs/adr/0001-language-framework.md` | Decision recorded with rationale |
| Literature review: Attention measurement, behavioural biometrics, fraud detection | ML Eng | `research/literature-review.md` | ≥ 30 papers categorised, gaps identified |
| Prototype: Minimal evidence ingestion → validation → storage | Protocol Eng | `scripts/prototype-ingest.py` | End-to-end flow with mock data |
| Threat model workshop (STRIDE) | Security Eng | `docs/security/threat-model.md` | All components analysed, mitigations listed |
| Privacy impact assessment (DPIA) baseline | Privacy Eng | `docs/privacy/dpia-baseline.md` | Data flows mapped, legal basis documented |

**Dependencies**: None (first sprint)

---

### Sprint 2: Evidence Model & Pipeline Skeleton

**Goal**: Implement core evidence data model and processing pipeline skeleton.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement VAP Evidence model (Section 5) as TypeScript/Python classes | Protocol Eng | `packages/core/evidence/` | All required fields, validation, serialization |
| Implement Observation model (VAP Section 4) | Protocol Eng | `packages/core/observation/` | Observation types, normalization hooks |
| Build evidence ingestion API (REST + WebSocket) | Platform Eng | `apps/api/src/evidence/` | POST /evidence, WebSocket stream, auth |
| Implement validation pipeline stage (schema, timestamp, replay protection) | Protocol Eng | `packages/pipeline/validation/` | Invalid evidence rejected with error codes |
| Implement normalization pipeline stage (platform → canonical) | Protocol Eng | `packages/pipeline/normalization/` | Browser/mobile/desktop → same canonical form |
| Set up evidence store (append-only, immutable) | Platform Eng | `packages/store/evidence/` | Write-only, indexed by session_id, EID |
| Unit tests for all above | QA Eng | `tests/unit/evidence/`, `tests/unit/pipeline/` | ≥ 80% coverage, mutation testing pass |

**Dependencies**: Sprint 1 (repo, CI, ADR-001)

---

### Sprint 3: Session Model & Research Prototypes

**Goal**: Session lifecycle management; attention/fraud model prototypes.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement Session model (VAP Section 6) with state machine | Protocol Eng | `packages/core/session/` | All states, transitions, guards tested |
| Session API: create, get, update, close, expire | Platform Eng | `apps/api/src/sessions/` | CRUD + state transitions via API |
| Prototype attention behaviour model (reading patterns, scroll velocity) | ML Eng | `research/models/attention-prototype/` | Jupyter notebook, baseline AUC on synthetic data |
| Prototype fraud detection model (automation, replay, emulator) | ML Eng | `research/models/fraud-prototype/` | Jupyter notebook, baseline AUC on synthetic data |
| Confidence calibration prototype (isotonic regression, conformal prediction) | ML Eng | `research/models/confidence-prototype/` | Calibration curves, reliability diagrams |
| Define evidence feature extraction schema (VAP Section 5 evidence types) | ML Eng | `packages/pipeline/features/schema.json` | All E-INTERACTION, E-VISIBLE, E-DURATION features |
| ADR-002: Model serving architecture (batch vs. streaming vs. hybrid) | ML Eng | `docs/adr/0002-model-serving.md` | Decision with latency/throughput trade-offs |

**Dependencies**: Sprint 2 (evidence model, pipeline, store)

---

## Phase 1: Protocol (Sprints 4–6)

### Sprint 4: VAP Specification Finalization & Conformance Test Framework

**Goal**: Complete VAP 1.0-draft specification; build conformance test harness.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Finalize VAP specification (all sections 1–14, appendices) | Protocol Eng | `docs/specs/0001-verified-attention-protocol.md` | Internal review pass, no TODOs |
| Build conformance test framework (test runner, fixtures, assertions) | QA Eng | `packages/conformance/` | Runs test suites, outputs JUnit XML |
| Implement conformance tests: Evidence model validation | QA Eng | `tests/conformance/evidence/` | All VAP Section 5 requirements covered |
| Implement conformance tests: Session state machine | QA Eng | `tests/conformance/session/` | All VAP Section 6 transitions covered |
| Implement conformance tests: Proof object structure & signature | QA Eng | `tests/conformance/proof/` | All VAP Section 10 fields, crypto verified |
| Implement conformance tests: Protocol messages | QA Eng | `tests/conformance/messages/` | SubmitEvidence, ClaimRequest, VerificationCreate |
| Publish VAP 1.0-draft for external review | Sprint Lead | GitHub Release `vap-1.0-draft` | Publicly accessible, issue tracker open |

**Dependencies**: Sprint 3 (core models implemented)

---

### Sprint 5: Verification Engine Core & Policy Engine

**Goal**: Implement verification decision engine with configurable policies.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement Claim model (VAP Section 7) | Protocol Eng | `packages/core/claim/` | Claim types, metadata, evidence references |
| Implement Confidence Model (VAP Section 8) with calibration interface | ML Eng | `packages/verification/confidence/` | Deterministic: same input → same output |
| Implement Verification Engine (VAP Section 9) | Protocol Eng | `packages/verification/engine/` | Lifecycle: evidence→claims→confidence→decision |
| Implement Policy Engine (VAE Section 10) | Protocol Eng | `packages/verification/policy/` | JSON policy config, threshold evaluation |
| Verification outcome codes: PASS, FAIL, INSUFFICIENT, PENDING | Protocol Eng | `packages/verification/outcomes/` | Enum with semantics, tests for each |
| Conformance tests for verification engine | QA Eng | `tests/conformance/verification/` | All VAP Section 9 requirements covered |
| Integration test: Full session → evidence → verification → decision | QA Eng | `tests/integration/verification-flow/` | End-to-end with mock evidence |

**Dependencies**: Sprint 4 (VAP spec, claim/confidence models defined)

---

### Sprint 6: Proof Generation & Cryptographic Signing

**Goal**: Complete Proof of Attention generation with cryptographic integrity.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement Proof of Attention object (VAP Section 10) | Protocol Eng | `packages/core/proof/` | All 7 fields, serialization, hash computation |
| Implement verifier key management (Ed25519, rotation, HSM interface) | Security Eng | `packages/crypto/keys/` | Key gen, rotation, signing, audit log |
| Implement proof signing service | Platform Eng | `apps/verifier/src/proof-signing/` | Signs proof, emits proof event, stores proof |
| Implement proof verification (signature + hash validation) | Protocol Eng | `packages/core/proof/verify.ts` | Independent verification without verifier |
| Proof store (append-only, indexed by PID, session_id) | Platform Eng | `packages/store/proof/` | Write-only, query by session/content/verifier |
| Conformance tests: Proof structure, signature, immutability | QA Eng | `tests/conformance/proof/` | All VAP Section 10 + Appendix A requirements |
| ADR-003: Verifier identity & trust model (centralized vs. federated) | Security Eng | `docs/adr/0003-verifier-trust.md` | Decision with migration path |

**Dependencies**: Sprint 5 (verification engine produces decisions)

---

## Phase 2: Reference Engine (Sprints 7–15)

### Sprint 7: Evidence Processing Pipeline - Production Hardening

**Goal**: Harden pipeline for production throughput, reliability, observability.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement deduplication pipeline stage (content-hash + session) | Platform Eng | `packages/pipeline/dedup/` | No duplicate evidence in store |
| Implement feature extraction pipeline stage | ML Eng | `packages/pipeline/features/` | All schema features computed, unit tested |
| Implement evidence enrichment (context, device trust, source reliability) | ML Eng | `packages/pipeline/enrichment/` | Enriched evidence passes conformance |
| Pipeline observability: metrics (latency, throughput, error rates, backlog) | Platform Eng | `packages/observability/pipeline-metrics/` | Prometheus metrics, Grafana dashboards |
| Pipeline distributed tracing (OpenTelemetry) | Platform Eng | `packages/observability/tracing/` | Trace ingestion→validation→normalization→store |
| Dead letter queue for failed evidence with retry logic | Platform Eng | `packages/pipeline/dlq/` | Failed evidence quarantined, retryable, alertable |
| Load test: 10K evidence/sec sustained for 1 hour | QA Eng | `tests/load/pipeline-10k/` | p99 latency < 500ms, 0% data loss |
| Chaos test: Kill pipeline nodes, verify no data loss | QA Eng | `tests/chaos/pipeline-resilience/` | Recovery < 30s, zero evidence loss |

**Dependencies**: Sprint 6 (pipeline skeleton exists)

---

### Sprint 8: Attention Intelligence - Behaviour Models

**Goal**: Production attention models with continuous learning pipeline.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement attention feature engineering (reading speed, pause dist, engagement depth) | ML Eng | `packages/ml/attention/features/` | Features match research prototype schema |
| Train attention behaviour model (Transformer/GRU for sequence modelling) | ML Eng | `packages/ml/attention/model/` | AUC ≥ 0.95 on held-out human vs. bot data |
| Implement model serving (gRPC/REST, batch + streaming) | ML Eng | `apps/ml-serving/attention/` | p99 < 50ms, horizontal scaling |
| Implement model versioning, A/B routing, canary deployment | Platform Eng | `apps/ml-serving/infra/` | Blue/green, rollback < 1 min |
| Implement continuous learning: drift detection (KS test, population stability index) | ML Eng | `packages/ml/attention/drift/` | Alert on drift, auto-trigger retrain |
| Implement automated retraining pipeline (data → train → validate → deploy) | ML Eng | `packages/ml/attention/retrain/` | Weekly retrain, promotes if AUC improves |
| Conformance: Model output deterministic for same input (fixed seed) | QA Eng | `tests/conformance/ml-determinism/` | Bitwise identical outputs |
| Integration test: Pipeline → features → model → confidence score | QA Eng | `tests/integration/attention-ml/` | End-to-end with real evidence samples |

**Dependencies**: Sprint 7 (pipeline produces enriched evidence with features)

---

### Sprint 9: Fraud Intelligence - Detection Models

**Goal**: Production fraud detection covering all threat vectors.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement behavioural biometrics features (mouse curvature, keystroke dynamics, pressure) | ML Eng | `packages/ml/fraud/biometrics/` | Features extracted per session |
| Implement device fingerprinting (browser attrs, canvas, WebGL, audio, battery) | ML Eng | `packages/ml/fraud/fingerprint/` | Stable FP across sessions, entropy ≥ 18 bits |
| Implement automation detection (headless, Puppeteer, Selenium, Playwright signatures) | ML Eng | `packages/ml/fraud/automation/` | Detection rate ≥ 99% on known tools |
| Implement Sybil detection (IP clustering, device correlation, velocity checks) | ML Eng | `packages/ml/fraud/sybil/` | Graph-based clustering, alert on anomalies |
| Implement reputation scoring (device, IP, subnet, ASN reputation) | ML Eng | `packages/ml/fraud/reputation/` | Time-decayed scores, configurable windows |
| Train fraud ensemble model (gradient boosting + neural) | ML Eng | `packages/ml/fraud/ensemble/` | AUC ≥ 0.98, precision ≥ 0.95 at 0.1% FPR |
| Implement fraud model serving (same infra as attention) | Platform Eng | `apps/ml-serving/fraud/` | p99 < 50ms, shared infra |
| Conformance: Fraud scores deterministic, auditable | QA Eng | `tests/conformance/fraud-determinism/` | Same input → same score |
| Integration test: Fraud signals feed verification engine policy | QA Eng | `tests/integration/fraud-verification/` | High fraud score → FAIL outcome |

**Dependencies**: Sprint 8 (ML serving infra, feature pipeline)

---

### Sprint 10: Verification Engine - Policy & Decision Hardening

**Goal**: Complete verification engine with all policy types, manual review queue.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement policy types: evidence requirements, confidence thresholds, fraud limits, session constraints | Protocol Eng | `packages/verification/policy/types.ts` | All VAP policy dimensions covered |
| Implement policy CRUD API (create, list, get, update, deprecate) | Platform Eng | `apps/api/src/policies/` | Versioned policies, audit log |
| Implement manual review queue (verification outcomes = INCONCLUSIVE) | Platform Eng | `apps/verifier/src/review-queue/` | UI + API, reviewer assignment, SLA tracking |
| Implement verification audit log (immutable, queryable) | Platform Eng | `packages/store/verification-audit/` | Every decision logged with full context |
| Implement verification replay (re-run decision on same evidence with new policy) | Protocol Eng | `apps/verifier/src/replay/` | Deterministic replay, diff output |
| Conformance: All VAP Section 9 verification lifecycle requirements | QA Eng | `tests/conformance/verification-full/` | 100% VAP Section 9 coverage |
| Load test: 1K verifications/sec with mixed policies | QA Eng | `tests/load/verification-1k/` | p99 < 200ms, 0% errors |

**Dependencies**: Sprint 9 (fraud signals available), Sprint 5 (verification core)

---

### Sprint 11: Proof Generation - Production Ready

**Goal**: Proof generation at scale with full audit trail.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement proof generation pipeline (async, batched, idempotent) | Platform Eng | `apps/verifier/src/proof-gen/` | Exactly-once semantics, retry-safe |
| Implement proof signing with HSM / cloud KMS integration | Security Eng | `packages/crypto/hsm/` | Keys never in memory, audit trail |
| Implement proof revocation & supplementary proofs (VAP Section 10) | Protocol Eng | `packages/core/proof/revocation.ts` | Revoked flag, version chain, audit |
| Implement proof retrieval API (by PID, session, content, verifier, time range) | Platform Eng | `apps/api/src/proofs/` | Paginated, filtered, indexed queries |
| Implement proof webhook delivery (retry, backoff, dead letter, HMAC sig) | Platform Eng | `apps/verifier/src/webhooks/` | At-least-once delivery, consumer verifies |
| Conformance: Proof structure, signature, immutability, revocation | QA Eng | `tests/conformance/proof-full/` | 100% VAP Section 10 + Appendix A |
| Load test: 10K proofs/min generation + signing | QA Eng | `tests/load/proof-gen-10k/` | p99 < 1s, signing bottleneck measured |

**Dependencies**: Sprint 10 (verification produces PASS decisions)

---

### Sprint 12: Reward Intelligence

**Goal**: Reward recommendation engine (eligibility, pricing, budget, ledger prep).

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement eligibility engine (policy match, proof validation, deduplication) | Protocol Eng | `packages/reward/eligibility/` | Proof → eligible/ineligible with reasons |
| Implement campaign policy engine (budget, pricing rules, caps, targeting) | Protocol Eng | `packages/reward/campaigns/` | JSON config, evaluated per proof |
| Implement dynamic pricing (attention value by content type, viewer quality, market) | ML Eng | `packages/reward/pricing/` | Model or rule-based, configurable |
| Implement budget allocation (pacing, caps, rollover, exhaustion handling) | Platform Eng | `packages/reward/budget/` | No overspend, real-time tracking |
| Implement settlement preparation (ledger entries, export formats, reconciliation) | Platform Eng | `packages/reward/settlement/` | CSV/JSON/Parquet, idempotent, auditable |
| Conformance: Reward recommendations traceable to proofs & policies | QA Eng | `tests/conformance/reward/` | Full audit trail from proof → recommendation |
| Integration test: Proof → eligibility → pricing → budget → settlement prep | QA Eng | `tests/integration/reward-flow/` | End-to-end with test campaigns |

**Dependencies**: Sprint 11 (proofs generated and retrievable)

---

### Sprint 13: Analytics & Observability Platform

**Goal**: Operational and business analytics dashboards, alerting.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement analytics data warehouse (columnar, partitioned by time) | Platform Eng | `packages/analytics/warehouse/` | Evidence, sessions, proofs, verifications, rewards |
| Implement operational metrics (throughput, latency, error rates, queue depths) | Platform Eng | `packages/observability/ops-metrics/` | Prometheus + Grafana, pre-built dashboards |
| Implement attention metrics (verified sessions, confidence dist, fraud rates) | ML Eng | `packages/analytics/attention-metrics/` | Daily/hourly rollups, trend detection |
| Implement fraud metrics (detection rates, false positives, new vectors) | ML Eng | `packages/analytics/fraud-metrics/` | Model performance monitoring |
| Implement business metrics (reward payout, campaign ROI, publisher yield) | Platform Eng | `packages/analytics/business-metrics/` | Real-time + historical |
| Implement alerting rules (PagerDuty/Slack/email) for all critical paths | Platform Eng | `packages/observability/alerting/` | Runbook-linked alerts, no unactionable pages |
| Implement distributed tracing query UI (Jaeger/Tempo integration) | Platform Eng | `packages/observability/tracing-ui/` | Trace search by session_id, PID, error |
| Conformance: All metrics queryable via API for external consumers | QA Eng | `tests/conformance/analytics-api/` | REST API with OpenAPI spec |

**Dependencies**: Sprint 7–12 (all subsystems producing metrics/events)

---

### Sprint 14: Security Hardening & Penetration Testing

**Goal**: Production-grade security posture.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement authentication (OAuth2/OIDC, API keys, mTLS for service-to-service) | Security Eng | `packages/auth/` | All APIs protected, scopes enforced |
| Implement authorization (RBAC: admin, operator, reviewer, consumer, publisher) | Security Eng | `packages/auth/rbac.ts` | Least privilege, audit log |
| Implement secrets management (HashiCorp Vault / cloud secrets, rotation) | Security Eng | `packages/security/secrets/` | No secrets in code/config, rotation automated |
| Implement encryption at rest (evidence store, proof store, analytics warehouse) | Platform Eng | `packages/security/encryption-at-rest/` | AES-256, key per tenant/environment |
| Implement TLS everywhere (internal mTLS, external TLS 1.3) | Platform Eng | `packages/security/tls/` | Cert-manager, auto-rotation, HSTS |
| Conduct penetration test (internal + external) | Security Eng | `docs/security/pentest-report.md` | Critical/high findings remediated |
| Conduct dependency scan (SBOM, CVE monitoring, license compliance) | Security Eng | `docs/security/sbom.json` | Zero critical/unpatched CVEs in prod deps |
| Implement security headers, CSP, rate limiting, WAF rules | Platform Eng | `apps/api/src/security/` | OWASP ASVS Level 2 compliance |

**Dependencies**: Sprint 13 (all APIs and stores exist)

---

### Sprint 15: Privacy Compliance & Data Governance

**Goal**: Full privacy compliance (GDPR, CCPA), data minimisation enforced.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement consent management (capture, store, query, revoke per session) | Privacy Eng | `packages/privacy/consent/` | Consent linked to session, auditable |
| Implement data minimisation enforcement (schema validation, field stripping) | Privacy Eng | `packages/privacy/minimisation/` | Only VAP-required fields stored |
| Implement pseudonymisation (session IDs unlinkable, no PII in evidence) | Privacy Eng | `packages/privacy/pseudonymisation/` | Verified by automated tests |
| Implement retention policies (evidence: 90d, proofs: 7y, analytics: aggregated only) | Privacy Eng | `packages/privacy/retention/` | Automated deletion jobs, audit log |
| Implement data subject rights API (access, rectification, erasure, portability) | Privacy Eng | `apps/api/src/privacy/` | GDPR Art 15–20 compliance |
| Implement selective disclosure for proofs (confidence-only, evidence-hash-only) | Protocol Eng | `packages/core/proof/disclosure.ts` | ZK-ready interface, v1 = field filtering |
| Conduct independent privacy audit (DPIA update, legal review) | Privacy Eng | `docs/privacy/dpia-final.md` | Auditor sign-off, findings remediated |
| Conformance: Privacy requirements from VAP Section 17 | QA Eng | `tests/conformance/privacy/` | All VAP privacy rules tested |

**Dependencies**: Sprint 14 (security baseline), Sprint 11 (proofs), Sprint 7 (evidence pipeline)

---

## Phase 3: Browser Extension (Sprints 16–18)

### Sprint 16: Omni-Channel Social & Brand Space Addon (SPEC-0020)

**Goal**: Extend VAP to third-party brand spaces (LinkedIn, YouTube, X, TikTok, Facebook, Substack) using 3 Universal DOM Archetypes + Declarative Profiles, and implement zero-knowledge prior exposure attribution ("Where did you hear about us?" solution). Reference: `docs/specs/0020-omni-channel-brand-space-verification.md` & `docs/sprint-16/spec.yaml`.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| U1: Base Adapter Interface & Declarative Profile Registry | SDK Eng | `packages/sdk/extension/src/adapters/registry.ts` & `base.ts` | Dynamic adapter discovery, declarative selector map |
| U2: Universal Feed Card Archetype (LinkedIn, X, FB, Reddit) | SDK Eng | `packages/sdk/extension/src/adapters/feed.ts` | Intersection dwell ($\ge 65\%$), 900 WPM velocity cap |
| U3: Universal HTML5 Video Archetype (YouTube, TikTok, Reels) | SDK Eng | `packages/sdk/extension/src/adapters/video.ts` | Active tab focus enforcement, audio/scrub auditing |
| U4: Universal Longform Article & Generic Web Fallback | SDK Eng | `packages/sdk/extension/src/adapters/article.ts` | Paragraph dwell, scroll progression, universal web fallback |
| U5: External Observation Ingestion Route | Platform Eng | `apps/api/src/evidence/external.ts` | `POST /v1/evidence/external` with zero-PII sanitization |
| U6: Multi-Archetype Verification & Weighting Policy | Protocol Eng | `packages/verification/src/policies/social.ts` | Archetype weights (feed, video, article) |
| U7: Enterprise Console Social & Omni-Channel Hub | Platform Eng | `apps/portal/public/index.html` & `app.js` | Social proof breakdowns & audit export |
| U8: Conformance & End-to-End Test Suite | QA Eng | `packages/sdk/extension/test/social.test.ts` | Vitest synthetic verification tests pass |
| U9: Prior Attention Attribution Handshake | SDK Eng | `packages/sdk/browser/src/attribution/` & `packages/sdk/extension/src/attribution.ts` | ZK prior exposure voucher query at conversion time |

**Dependencies**: Sprint 15 (privacy compliance), Sprint 11 (proof generation), Sprint 7 (evidence pipeline)

---

### Sprint 17: Browser SDK - Advanced Features & Extension

**Goal**: Advanced SDK features + browser extension for user-facing verification.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement advanced features: reading detection, engagement scoring, attention heatmap | SDK Eng | `packages/sdk/browser/advanced/` | Features match ML feature schema |
| Implement publisher integration API (init, configure, callbacks) | SDK Eng | `packages/sdk/browser/publisher-api/` | Simple JS API, TypeScript types |
| Build browser extension (Manifest V3) with user dashboard | SDK Eng | `packages/extension/` | Shows active verifications, proofs earned |
| Extension: Consent management UI, proof history, reward display | SDK Eng | `packages/extension/ui/` | React/Vanilla, accessible, i18n-ready |
| Extension: Content script for publisher-less verification (user-initiated) | SDK Eng | `packages/extension/content-script/` | Works on any page with user consent |
| Extension store submission (Chrome Web Store, Firefox Add-ons, Edge Add-ons) | SDK Eng | `packages/extension/store/` | Approved listings, privacy policies |
| Conformance: Extension produces same evidence as SDK | QA Eng | `tests/conformance/extension/` | Evidence parity with SDK |
| Documentation: SDK integration guide, extension user guide | SDK Eng | `docs/sdk/browser/` | Complete, with examples |

**Dependencies**: Sprint 16 (core SDK)

---

### Sprint 18: Mobile & Desktop SDKs

**Goal**: Native mobile (Android/iOS) and desktop SDKs.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Android SDK (Kotlin): Observers, consent, queue, session, network | SDK Eng | `packages/sdk/android/` | All VAP observers, same evidence schema |
| iOS SDK (Swift): Observers, consent, queue, session, network | SDK Eng | `packages/sdk/ios/` | All VAP observers, same evidence schema |
| Desktop SDK (Electron/Tauri + native modules): Windows, macOS, Linux | SDK Eng | `packages/sdk/desktop/` | Window focus, idle, input observers |
| Cross-platform evidence parity tests | QA Eng | `tests/conformance/cross-platform/` | Same session → equivalent evidence |
| Mobile app store compliance (privacy manifests, data use declarations) | SDK Eng | `packages/sdk/mobile/compliance/` | App Store / Play Store ready |
| Documentation: Mobile/desktop integration guides | SDK Eng | `docs/sdk/mobile/`, `docs/sdk/desktop/` | Complete, with sample apps |

**Dependencies**: Sprint 17 (SDK patterns established), Sprint 7 (ingestion API stable)

---

## Phase 4: Developer APIs (Sprints 19–21)

### Sprint 19: Public API - Stabilization & Documentation

**Goal**: Production-ready public REST/Streaming APIs with full documentation.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Stabilize all API endpoints (evidence, sessions, proofs, verifications, policies, rewards) | Platform Eng | `apps/api/src/` | No breaking changes after this sprint |
| Implement API versioning (URL path, headers, deprecation policy) | Platform Eng | `apps/api/src/versioning.ts` | v1 stable, v2 planning documented |
| Generate OpenAPI 3.1 spec from code (auto-generated, always current) | Platform Eng | `apps/api/openapi.yaml` | CI validates spec matches implementation |
| Implement API gateway (rate limiting, auth, logging, request ID, tracing) | Platform Eng | `apps/api-gateway/` | Kong/Envoy/AWS API GW config |
| Build developer portal (reference docs, quickstarts, API explorer) | SDK Eng | `apps/developer-portal/` | Redoc/Stoplight, Try It feature |
| Implement SDK generation from OpenAPI (TypeScript, Python, Go, Rust) | SDK Eng | `packages/sdk/generated/` | CI publishes to npm/PyPI/crates.io |
| Conformance: API matches VAP protocol messages exactly | QA Eng | `tests/conformance/api/` | All VAP Section 14 messages covered |

**Dependencies**: Sprint 15 (APIs exist, privacy/security done)

---

### Sprint 20: Integration Tools & Onboarding

**Goal**: Developer onboarding experience, integration testing, sample applications.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Build CLI tool (verification, proof retrieval, policy management) | Platform Eng | `packages/cli/` | `vap verify`, `vap proof get`, `vap policy create` |
| Build integration test framework (testcontainers, mock verifier, fixtures) | QA Eng | `tests/integration/framework/` | Spin up full stack locally in < 2 min |
| Create sample applications: Publisher demo, Advertiser dashboard, Research notebook | SDK Eng | `examples/` | Runnable, documented, realistic |
| Create quickstart guides (5-min, 30-min, production) | SDK Eng | `docs/quickstart/` | Tested by external developers |
| Implement sandbox environment (free tier, rate limited, auto-provisioned) | Platform Eng | `infra/sandbox/` | Self-serve signup, auto-cleanup |
| Conformance: Sample apps pass VAP conformance | QA Eng | `tests/conformance/examples/` | All examples produce valid proofs |

**Dependencies**: Sprint 19 (stable APIs, generated SDKs)

---

### Sprint 21: Beta Program & Feedback Integration

**Goal**: External beta with real publishers, iterate on feedback.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Recruit 5–10 beta publishers (diverse verticals: news, edu, e-comm, docs) | Sprint Lead | `docs/beta/participants.md` | Signed agreements, integration started |
| Beta support rotation (daily standups, dedicated Slack, issue triage) | All Eng | `docs/beta/support-plan.md` | SLA: 4h response, 24h fix for blocking |
| Collect feedback (usability, API gaps, performance, documentation) | Sprint Lead | `docs/beta/feedback.md` | Categorized, prioritized, tracked |
| Implement top 10 feedback items (API fixes, SDK improvements, doc updates) | All Eng | Various | Beta participants unblocked |
| Load test with beta traffic (real patterns, real volumes) | QA Eng | `tests/load/beta-traffic/` | System stable at 2x expected launch load |
| Prepare launch checklist (monitoring, runbooks, rollback, communications) | Platform Eng | `docs/launch/checklist.md` | All items verified, stakeholders aligned |
| VAE 1.0 Release Candidate | Sprint Lead | GitHub Release `vae-1.0-rc1` | All Phase 0–4 DoD met |

**Dependencies**: Sprint 20 (onboarding ready)

---

## Phase 5: Marketplace (Sprints 22–24) — Post VAE 1.0

### Sprint 22: Marketplace Core - Discovery & Matching

**Goal**: Attention marketplace connecting publishers and consumers.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement publisher inventory API (content + policy + pricing) | Platform Eng | `apps/marketplace/inventory/` | CRUD, search, filters, real-time updates |
| Implement consumer demand API (campaigns, targeting, budgets) | Platform Eng | `apps/marketplace/demand/` | Campaign CRUD, targeting rules |
| Implement matching engine (auction, fixed-price, programmatic) | ML Eng | `apps/marketplace/matching/` | Clearing logic, latency < 100ms |
| Implement settlement preparation (marketplace fees, payouts, reconciliation) | Platform Eng | `apps/marketplace/settlement/` | Accurate, auditable, idempotent |
| Marketplace conformance (proofs from VAE verifiable by marketplace) | QA Eng | `tests/conformance/marketplace/` | Proof verification integrated |

**Dependencies**: VAE 1.0 released, Sprint 12 (reward intelligence)

---

### Sprint 23: Marketplace Features - Reputation & Credentials

**Goal**: Attention reputation, credentials, advanced marketplace features.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Implement content reputation (aggregate verified attention → quality score) | ML Eng | `apps/marketplace/reputation/` | Transparent algorithm, manipulation-resistant |
| Implement viewer attention credentials (W3C VC, ZK-disclosure ready) | Protocol Eng | `packages/credentials/` | Portable, verifiable, privacy-preserving |
| Implement publisher analytics dashboard (yield, fill rate, attention quality) | Platform Eng | `apps/marketplace/publisher-dash/` | Real-time + historical, exportable |
| Implement consumer analytics (ROI, attention quality, fraud exposure) | Platform Eng | `apps/marketplace/consumer-dash/` | Campaign-level + aggregate |

**Dependencies**: Sprint 22 (core marketplace)

---

### Sprint 24: Marketplace Launch & Ecosystem Onboarding

**Goal**: Public marketplace launch, ecosystem partnerships.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Marketplace beta with 10+ publishers, 5+ consumers | Sprint Lead | `docs/marketplace/beta.md` | Live transactions, feedback collected |
| Legal/compliance review (financial regulations, consumer protection) | Sprint Lead | `docs/legal/marketplace-review.md` | Counsel sign-off |
| Launch marketing, documentation, partner integrations | Sprint Lead | `docs/marketplace/launch/` | Press kit, case studies, API partners |
| Marketplace 1.0 Release | Sprint Lead | GitHub Release `marketplace-1.0` | All features stable, monitored |

**Dependencies**: Sprint 23

---

## Phase 6: Ecosystem (Sprint 25+) — Ongoing

### Sprint 25: Standards Submission & Certification Program

**Goal**: Submit VAP to standards body, launch conformance certification.

| Task | Owner | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Prepare VAP submission to IETF/W3C (Internet-Draft / W3C Community Group) | Sprint Lead | `standards/submission/` | Submitted, acknowledged |
| Build conformance certification program (test suite, badge, registry) | QA Eng | `certification/` | Automated certification, public registry |
| Certify VAE as first reference implementation | QA Eng | `certification/vae-cert.md` | Full conformance, published |
| Recruit 2+ independent implementations for certification | Sprint Lead | `certification/implementations.md` | Commitments secured |

**Dependencies**: VAP stable, VAE 1.0, Marketplace 1.0

---

### Sprint 26+: Continuous Evolution

**Ongoing sprint themes** (rotate focus each sprint):

- **Protocol Evolution**: RFC process for VAP extensions (federated verification, cross-device, immersive)
- **ML Improvement**: New fraud vectors, better calibration, accessibility fairness
- **Scalability**: Multi-region, edge inference, cost optimization
- **Ecosystem Growth**: SDKs for new platforms, language bindings, community support
- **Research Publication**: Academic papers, benchmark releases, open datasets

---

# 4. Cross-Cutting Concerns (Every Sprint)

| Concern | Implementation |
|---------|----------------|
| **Technical Debt** | 10% capacity reserved; tracked in `DEBT.md` with sprint paydown |
| **Documentation** | Docs-as-code; updated in same PR as code; reviewed in sprint review |
| **Security** | Threat model updated per sprint; secrets scanned in CI; dep scan weekly |
| **Privacy** | DPIA updated per sprint; data flow map current; retention jobs monitored |
| **Observability** | New metrics/alerts for every new component; SLOs defined and tracked |
| **Testing** | Conformance tests for every VAP requirement; contract tests for APIs |
| **Dependencies** | Renovate bot for updates; license check; SBOM generated per release |

---

# 5. Resource Requirements

| Role | Sprint 1–3 | Sprint 4–6 | Sprint 7–15 | Sprint 16–18 | Sprint 19–21 |
|------|------------|------------|-------------|--------------|--------------|
| Sprint Lead | 1 | 1 | 1 | 1 | 1 |
| Protocol Engineer | 1 | 2 | 2 | 1 | 1 |
| Platform Engineer | 1 | 1 | 2 | 1 | 2 |
| ML Engineer | 1 | 1 | 2 | 0 | 0 |
| SDK Engineer | 0 | 0 | 0 | 2 | 2 |
| QA Engineer | 0.5 | 1 | 1 | 1 | 1 |
| Security/Privacy Engineer | 0.5 | 0.5 | 1 | 0.5 | 0.5 |
| **Total FTE** | **5** | **6.5** | **9** | **6.5** | **7.5** |

**Infrastructure** (scales with sprints):
- Kubernetes cluster (dev/staging/prod)
- Kafka/Event streaming (evidence pipeline)
- PostgreSQL (metadata, policies, sessions)
- ClickHouse/Apache Druid (analytics warehouse)
- S3/GCS (evidence/proof cold storage)
- GPU nodes (ML training/serving)
- HSM/KMS (key management)
- Monitoring stack (Prometheus, Grafana, Tempo, Alertmanager)

---

# 6. Risk Register & Mitigations per Phase

| Phase | Risk | Likelihood | Impact | Mitigation |
|-------|------|------------|--------|------------|
| 0–1 | VAP specification changes invalidate implementation | Medium | High | Implement to interfaces; conformance tests drive implementation; ADR for breaking changes |
| 0–1 | Attention/fraud models insufficient accuracy | High | High | Research sprints first; synthetic data generation; continuous benchmarking; human-in-loop labeling |
| 2 | Pipeline throughput bottleneck at scale | Medium | High | Load test early (Sprint 7); design for horizontal scaling; backpressure + DLQ |
| 2 | ML model serving latency exceeds budget | Medium | Medium | Model optimization (quantization, distillation); batch inference; caching |
| 2 | Fraud arms race outpaces detection | High | High | Red team sprints; bug bounty; threat intel sharing; adaptive retraining |
| 3 | Browser/OS restrictions break evidence collection | Medium | High | Platform-specific strategies; fallback modes; standards advocacy (W3C) |
| 3 | SDK bundle size / performance hurts adoption | Medium | Medium | Strict budgets; tree-shaking; lazy loading; web workers |
| 4 | API design flaws require breaking changes | Low | High | OpenAPI-first design; consumer-driven contracts; long beta |
| 4 | Insufficient beta feedback / adoption | Medium | Medium | Recruit diverse verticals; dedicated support; incentive program |
| 5 | Marketplace liquidity failure (two-sided network) | High | High | Seed supply/demand; guarantee minimum volume; focus on high-value verticals first |
| 5 | Regulatory classification as financial market | Low | Very High | Legal counsel from Sprint 22; compliance by design; jurisdiction strategy |
| All | Key person dependency | Medium | High | Pair programming; documentation; cross-training; bus factor ≥ 2 |
| All | Scope creep beyond charter | Medium | Medium | Sprint goals locked; change control via ADR; charter Section 8 boundaries |

---

# 7. Milestone Calendar (Capability-Based)

| Milestone | Target Sprint | Criteria |
|-----------|---------------|----------|
| M0: Research Complete | Sprint 3 | Literature review, prototypes, ADRs 001–002 |
| M1: VAP 1.0-Draft Published | Sprint 4 | Spec complete, conformance framework running |
| M2: Verification Engine Core Working | Sprint 6 | Session → evidence → verification → proof |
| M3: Pipeline Production-Hardened | Sprint 7 | 10K evid/sec, chaos-tested |
| M4: ML Models Production-Ready | Sprint 9 | Attention + fraud models serving, calibrated |
| M5: VAE Feature-Complete | Sprint 15 | All subsystems integrated, security/privacy audited |
| M6: SDKs Complete | Sprint 18 | Browser, mobile, desktop, extension shipped |
| M7: Public API Stable | Sprint 19 | OpenAPI spec, generated SDKs, developer portal |
| M8: VAE 1.0 Release Candidate | Sprint 21 | Beta feedback integrated, launch checklist done |
| M9: VAE 1.0 General Availability | Sprint 21+2 weeks | RC validated, docs complete, support ready |
| M10: Marketplace 1.0 | Sprint 24 | Live transactions, legal cleared, partners onboarded |
| M11: Standards Submission | Sprint 25 | IETF/W3C submission acknowledged |
| M12: First Independent Certification | Sprint 26+ | Third-party implementation certified |

---

# 8. Sprint Planning Template

```markdown
## Sprint N: [Name]

**Goal**: [One-sentence sprint goal aligned with phase objective]

**Capacity**: [N] FTE × 10 days = [N*8] ideal hours (minus 20% buffer = [N*6.4] planned hours)

### Stories

| ID | Story | Owner | Estimate (hrs) | Dependencies | Acceptance Criteria |
|----|-------|-------|----------------|--------------|---------------------|
| S-N-1 | [Title] | [Role] | [H] | [Dep IDs] | [Criteria] |
| S-N-2 | [Title] | [Role] | [H] | [Dep IDs] | [Criteria] |

### Risks This Sprint

| Risk | Mitigation |
|------|------------|
| [Risk] | [Action] |

### Sprint Review Demo Plan

- [ ] [Component 1] demo
- [ ] [Component 2] demo
- [ ] Metrics dashboard walkthrough
```

---

# 9. Retrospective Themes (Rotating)

| Sprint | Focus |
|--------|-------|
| 1, 4, 7, 10, 13, 16, 19, 22, 25 | Process & Planning |
| 2, 5, 8, 11, 14, 17, 20, 23 | Technical Quality & Debt |
| 3, 6, 9, 12, 15, 18, 21, 24 | Team Dynamics & Learning |
| Every 5th | Strategic Alignment (charter, thesis, roadmap) |

---

# 10. Definition of Ready (for Sprint Planning)

A story is READY for sprint planning when:

- [ ] Clear acceptance criteria (testable, unambiguous)
- [ ] Dependencies identified and available or scheduled
- [ ] UX/API design reviewed (for user-facing stories)
- [ ] Security/privacy impact assessed (for data-relevant stories)
- [ ] Estimate provided by implementing engineer
- [ ] Conformance test approach defined (for VAP-relevant stories)
- [ ] No external blockers (approvals, access, legal)

---

*End of SPRINTS.md v1.0*

*This document is a living plan. Update at each sprint planning. Major changes require ADR.*