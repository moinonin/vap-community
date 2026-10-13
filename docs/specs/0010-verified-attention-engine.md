# Verified Attention Engine (VAE)

## Reference Implementation of the Verified Attention Protocol

Version: 1.0

Status: Draft

---

# 1. Introduction

## Purpose

This document defines the architecture, subsystems, and engineering practices of the Verified Attention Engine (VAE) — the reference implementation of the Verified Attention Protocol (VAP). VAE demonstrates that VAP can be implemented at production scale, producing auditable Proofs of Attention from real user interactions while meeting the privacy, latency, and accuracy requirements established in the Project Charter.

VAE is not the only possible implementation of VAP. It is the reference implementation: the definitive example against which conformance is measured. Other implementations MAY differ in programming language, deployment topology, internal architecture, or optimisation strategy, provided they conform to the normative requirements of VAP.

## Scope

This document covers:

- The complete VAE system architecture and subsystem decomposition
- The Verified Attention Lifecycle from observation through proof generation
- Evidence collection strategies for browser, mobile, and desktop environments
- The evidence processing pipeline (validation, normalization, enrichment, storage)
- The Attention Intelligence subsystem (behaviour modelling, confidence estimation)
- The Fraud Intelligence subsystem (threat detection, biometrics, risk scoring)
- The Verification Engine (rules, thresholds, decision policies)
- The Proof Generation subsystem (cryptographic signing, audit trails)
- The Reward Intelligence subsystem (eligibility, pricing, ledger)
- The Analytics and Observability framework
- Public interfaces (APIs, SDKs, webhooks)
- Security architecture and threat model
- Privacy architecture and data governance
- Scalability design and deployment topology
- Quality assurance strategy and testing framework
- Research infrastructure for continuous improvement

This document does NOT redefine VAP normative requirements. It implements them. Where VAP says "MUST", VAE shows how.

## Audience

This document is intended for:

- Engineers contributing to the VAE codebase
- Third-party implementers building alternative VAP implementations
- Operators deploying VAE in production
- Integrators connecting applications to VAE via APIs
- Auditors verifying VAE conformance to VAP

## Relationship to VAP

VAP defines the protocol. VAE implements it. Every architecture decision in this document SHOULD reference the VAP requirement it satisfies. Where VAE deviates from a literal reading of VAP, the deviation MUST be documented and justified.

## Relationship to Project Charter

The Project Charter defines VAE's scope and vision. This document provides the technical architecture that realises that vision. It assumes the Charter's objectives, success criteria, guiding principles, and project boundaries.

## Terminology

This document inherits VAP's controlled terminology (Observation, Evidence, Claim, Confidence, Verification, Proof of Attention). Additional VAE-specific terms are defined in context.

---

# 2. Architectural North Star

## Engineering Philosophy

Every subsystem of the Verified Attention Engine exists to serve a single purpose:

> Increase confidence in independently verified human attention while preserving privacy, interoperability, scalability, and scientific integrity.

This principle governs every engineering decision in VAE. When trade-offs arise — latency versus accuracy, throughput versus detail, simplicity versus extensibility — the correct choice is the one that best serves this principle.

## Implications for Architecture

**Privacy is not a feature. It is a structural constraint.** The architecture enforces data minimization at every stage. Raw sensor data never leaves the pipeline boundary. Personal identifiers are never stored alongside evidence. Analytics operate on aggregated, anonymised data.

**Fraud is a first-class adversary, not an edge case.** The architecture treats fraud as an ongoing arms race. Fraud intelligence is not an optional module — it is a core subsystem with equal standing to the Verification Engine. Models are continuously updated.

**Evidence is immutable and auditable.** Every piece of evidence entering the system is hashed, timestamped, and stored in append-only structures. No component can modify evidence after it has been accepted. Corrections take the form of supplementary evidence, not edits.

**Verification is reproducible.** Given the same evidence and the same policy, the same verification result MUST be produced across any VAP-compliant verifier. This is validated by the conformance test suite.

**Protocol conformance is enforceable.** The system can only execute operations defined in the protocol. Extension points exist for new evidence types or claim types — but all decisions remain evidence-grounded and auditable.

---

# 3. Design Goals

## Primary Goals

**1. Production-scale throughput.**

VAE MUST handle millions of concurrent attention sessions and billions of evidence events per day. The architecture is designed for horizontal scaling via distributed processing and stream-based ingestion.

**2. Sub-second verification decisions.** For typical sessions with sufficient evidence, the time between final evidence submission and verification decision should be under one second.

**3. Measurable confidence calibration.**

Confidence scores produced by VAE must undergo empirical VAE testing against ground truth data. The calibration methodology must be reproducible by independent researchers.

**4. Privacy compliance and consent.**

VAE must operate under strict data minimization controls — no storage of raw identifiers, no data sale or brokerage, time-bound retention policies, and user-accessible consent management.

## Secondary Goals

**5. Modular architecture.** Each subsystem must have well-defined interfaces to enable independent evolution. Replace a verification policy without reworking the collector.

**6. Developer experience.** SDKs must have minimal physical footprint (< 50 KB for browser extension JavaScript). APIs must be well-documented, stable, and versioned. Embed integrations should be possible in under one hour.

**7. Operational excellence.** Logs, metrics, distributed tracing, and error reporting must be built-in, not bolted on. The system must be operable by a small team with minimal tribal knowledge.

## Non-Goals

- Real-time consensus across verifier nodes (initial implementation is centralized verification with plans for federated)
- General-purpose video analytics
- HTTP/3 stream proxies for third-party data
- Ad-bidding at the time of verification

## Success Criteria

Link back to Charter Section 4: Time to first publication of a Proof of Attention < 1 months from first alpha; conformance test pass against third-party verification tooling; user acceptance evidence that VAF consistently distinguishes human from bot with 96%+ confidence on calibrated test data.

---

# 4. System Overview

## 30,000-foot View

VAE is a backend service-oriented platform. It ingests streams of observation data from client SDKs, processes those observations into validated evidence, applies intelligence subsystems to form claims and assess confidence in the attention, detects fraud, decides whether to certify attention via Proof generation, and exposes analytics over the aggregate store.

## High-Level Architecture Diagram (textual description)

```
[Client SDK (Browser / Mobile / Desktop)]
    |     |
    |     Observation Streams (REST / WebSocket)
    v     v
 [Evidence Collection Gateway]
    |
     -- (validation) Processing pipeline (normalization → feature extract → dedup → contextualization)
    |
 [Evidence Store (Immutable append)]
    |
 [Attention Intelligence & Fraud Intelligence compute in a shared stream]
    |
 [Claims & Confidence Engine]
    |
 [Verification Decision Engine] (applying policy thresholds)
    |
 [Proof Generator & Signer]
    |
 [Public API / Consumer webhooks]
    |
 [Reward Recommendation Engine]
```

Core invariants:

- Observations are raw instrument, never stored beyond processing.
- Evidence is append-only. No overwrites. No deletes.
- Fraud intelligence is always run on every session.
- Claims are always evidence-linked.
- Verification only passes through policy arrays.
- Proofs are cryptographic; Verification only via signature understanding.

## Deployment Model

The reference deployment model uses cloud-native orchestration (Kubernetes-based) horizontally scaled with:

- Stateless API tier
- Message-queue evidence pipeline (Kafka or cloud queue provider)
- S3-style cold-evidence persistence
- GPU-backed model inference at head node
- Consumer-facing proof API
- UI dashboard for operations view

---

# 5. Verified Attention Lifecycle (Central Chapter)

This section forms the reference core of VAE's architecture — everything else maps to a stage of this lifecycle.

```
OBSERVATION (raw UX events)

   |
   v

EVIDENCE COLLECTION (SDK topic to stream module)

   |
   v

VALIDATION (format sanity & legal entry to system)

   |
   v

NORMALIZATION (agent event spacing, compatibility across screen sizes)

   |
   v

ANALYSIS & ENRICHMENT (feature engineering; AI modelling passes)

   |
   v

ATTENTION ANALYSIS (attention models — was there genuine human perception?) fraud concurrent)

   |
   v

CONFIDENCE ESTIMATION (probability that attention is valid)

   |
   v

+ FRAUD EVALUATION ( fraud confidence score computed)

   |
   v

POLICY EVALUATION (by content owner; verification checks threshold)

   |
   v

DECISION (PASS / INSUFFICIENT / FRAUD_DETECTED / ...)

   |
   v

PROOF GENERATION (sign & publish Proof of Attention object)

   |
   v

REWARD RECOMMEND (if verification passes, Reward Engine suggests payment model)

   |
   v

ANALYTICS (aggregation of proofs & trends)
```

No subsystem outside this framework acts on a session; everything must flow through this lifecycle appropriately for any session that enters the platform.

---

# 6. Evidence Collection

## Overview

Evidence enters VAE through SDKs: lightweight client-side libraries that capture observation data during an attention session and submit it efficiently to the engine.

## SDKs: Architecture Common Layer

Each SDK must:

- Handle consent capture
- Minimize data
- Queue observations locally if offline
- Validate schema before sending
- Anonymize device fingerprint-hash

## Browser SDK Details

- Small (< 50 KB bundled) lib that hooks visibility API, scroll timelines, key events
- Reads viewport geometry
- Tracks idle indicators

## Mobile SDK Details

- Native Android and iOS integration
- Sensor characteristics capture
- Sliding track detection for scroll
- Background determination states

## Desktop SDK

- EM-event with operating system events e.g. focus events to window

---

# 7. Evidence Processing Pipeline (EPP)

## Pipeline Stages

### Ingestion
HTTP endpoint receives evidence. Header verification. Rate limiting compatibility.

### Validation
Evidence expiry (timestamp within acceptable window), structure validation against evidence schema.

### Normalization
Data from different platforms mapped into uniform canonical representation.

### Deduplication
Identical evidence triggers no replay. Devices attack but system devs detection resolves.

### Feature Extraction
Behavior features computed: reading speed, meaningful scroll ratio, pause length distribution, engagement acceleration, etc.

### Persistence
All processed evidence is appended to the Evidence Store: only writes, no edits.

---

# 8. Attention Intelligence

## Overview
VAE maintains a suite of attention models to determine if interaction signals correspond to genuine human focus rather than distracted presence.

### Behavioral Modeling
Temporal web rhythm —Meaningful click-to-scroll pauses, reading paths, engagement decay.

### Feature Engineering
Combine scroll, pointer, viewport focus, ambient sensor fusion.

### Attention Prediction
AI models trained on supervised data labels. Output: confidence per session.

### Confidence Estimation
Confidence = ensemble estimate of `P(genuine_human|evidence_set)`.

Probabilistic confidence computed with calibrated model: logistic regression over learned features. The model accepts the processed evidence => yields a score.

### Context Awareness
Multiple windows: the degree of secondary activity — alt screen detection, blank state detection.

### Model Versioning
Each model version is retrievable offline for auditing; The engine provides cross-validation performance statistics.

### Continuous Learning
Model metrics evaluated => drift alarm => re-training triggered.

---

# 9. Fraud Intelligence

## Threat Model

Adversaries may burn through bots, emulators, plugin scripts, click farms, GPS spoofer variations, etc.

### Behavioral Biometrics
Mouse curvature features, keystroke dynamics, pressure patterns.

### Device Fingerprinting
Static browser and system attributes of identity hash.

### Automation Detection
Headless browser signatures, Puppeteer/Selenium fingerprint.

### Reputation & SCAM Detection
Coordinates network analysis, IP correlation scaling, velocity check.

### Risk Scoring
Automated score mapping risk to confidence penalty.

---

# 10. Verification Engine

After Analysis Module, all attention & fraud signals feed into here.

**Rules:**

- Is confidence above threshold?
- Does evidence minimum present?
- Is fraud score below threshold?
- Does session still represent valid — not expired?
- Does context match policy?

Outcome: `PASS` if all conditions true. `FAILED` if fraud detected. `INSUFFICIENT` if evidence insufficient. `INCONCLUSIVE` otherwise.

## Policy Engine

Policies stored as JSON config: defines per context minimal signal list, required confidence_threshold, maximum age of evidence, etc.

Administrators add/update/deploy policy to specific use-cases.

---

# 11. Proof Generation

## Proof Generation Workflow

When a `PASS` verdict is returned, verification triggers Proof of Attention generation:

1. Collect used evidence hashes
2. Assemble PoA structure (id, session_id content_id confidence threshold)
3. Sign with verifier's private key (Ed25519 / ECDSA)
4. Store proof in append-only proof store
5. Emit proof event on webhook channel

Proofs never expire. Questionable session? mark `revoked` = true with version increment

---

# 12. Reward Intelligence

This module applies after proof exists; it recommends reward value.

### Eligibility Check
Which policy did the session satisfy? Did advertiser pay-for?

### Pricing Strategy
Based on content category, expected value, campaign budget.

### Settlement Preparation
Produce a reward recommendation structure: assign cents of budget per verified count, direct-to-ledger.

Reward engine does not execute payment.

---

# 13. Analytics & Observability

Operational cosmos: metrics on latency (p99), throughput, number of sessions, fraud rate, verification pass ratio, AI inference accuracy, drift alert.

Dashboard for admin/consumer.

---

# 14. Public Interfaces

**Headless Verified Attention REST API:**
- POST /v1/sessions
- POST /v1/evidence
- GET  /v1/proofs/:id
- POST /v1/verifications

**Streaming API** (WebSocket protocol for continuous delivery).

**SDK protocols** – SDK poisons JSON into batch REST by batch.

**Webhooks** – proofs + event notifications.

---

# 15. Security Architecture

Auth handled via OAuth2 API key / JWT; encryption at rest/tls transit; HMAC validation at internal pipeline; Key rotation by dedicated secrets manager.

---

# 16. Privacy

Consent workflow before any evidence enters system. Data retained governed by time policy; account deleted = evidence scrubbed.

Data minimization: raw sensor data never stored in its original form. Only normalized evidence survives. PII never stored. All observation flows pass through integrity enforcement.

---

# 17. Scalability Design

Horizontal scale via node pools. Evidence ingestion sharded by session id. Streamed processors (split by session) get parallelism. The back-end model inference pool can auto-scale.

Target: 5 billion evidence events/day.

---

# 18. Quality Assurance

Unit tests for critical path; integration tests for session lifecycle; protocol conformance suite tests; load tests; fraud simulation with staging; A/B backend experiment framework.

---

# Appendix: Repository & Stacks

- VAE backend: Python3 (reference) or Go/performance
- MongoDB (immutable append), etc.
- JSONRPC as minimal rest

This requires rigorous local dev.

---

/ end of VAE architecture v1