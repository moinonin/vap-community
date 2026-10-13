# Project Charter

## Verified Attention Engine (VAE)

### Reference Implementation of the Verified Attention Protocol

Version: 1.0

Status: Living Document

---

# 1. Introduction

## Purpose

The Venture Thesis argues that human attention is the scarcest resource on the Internet yet remains one of the few economically valuable resources that cannot be independently measured, verified, or exchanged. It proposes Verified Attention as a new layer of Internet infrastructure.

This Project Charter defines what the Verified Attention Engine (VAE) project intends to build. It does not repeat the Venture Thesis. It assumes the thesis as its foundation and defines the project scope, objectives, boundaries, and architecture for building the world's first reference implementation of the Verified Attention Protocol (VAP).

VAE exists to demonstrate that the Verified Attention Protocol can be implemented in production. It is the reference implementation, not the only implementation. Other implementations MAY follow the same protocol. VAE exists to prove feasibility, establish a quality baseline, and accelerate ecosystem adoption.

## Scope

This project builds:

- A reference implementation of the Verified Attention Protocol (VAP)
- Software development kits (SDKs) for browser, mobile, and desktop environments
- An evidence collection and processing pipeline
- An attention intelligence system incorporating AI-driven behavior modelling
- A fraud intelligence system for detecting automation, deception, and Sybil attacks
- A verification engine that produces Proofs of Attention
- A reward intelligence system for attention-based settlement
- Public APIs, dashboards, and operational infrastructure

This project intentionally does not build:

- Advertising platforms, ad networks, or ad exchanges
- Identity systems, authentication providers, or single sign-on
- Payment networks, payment processing, or financial settlement infrastructure
- Content management systems, content delivery networks, or publishing platforms
- Consumer applications for end users beyond reference SDKs and extensions
- Proprietary AI models for general-purpose use beyond attention verification

These are not products VAE should compete with. They are existing infrastructure layers that VAE should integrate with.

## Relationship to Other Documents


**0001 VAP** — Defines the normative protocol: evidence models, claims, confidence, verification, proof objects, messages, state machines, security, privacy, and conformance. The Charter defines the project that implements this protocol.

**0010 VAE** — Defines the reference implementation architecture. The Charter sets the scope and vision that VAE realises.

**Future specifications** — As the ecosystem matures, additional RFC-style specifications MAY address specific subsystems, extensions, or integration profiles. This Charter provides the framework within which those specifications live.

---

# 2. Project Vision

The long-term vision is an Internet where verified human attention is a first-class, trustable, and privacy-preserving infrastructure resource.

In this vision:

- Any digital interaction involving human attention can produce independently verifiable evidence
- Any application, platform, or protocol can consume verified attention through standard interfaces
- Any participant — individual, publisher, advertiser, educator, researcher — can trust attention claims without requiring a single platform to mediate that trust
- Privacy is not compromised in the process: verification requires only the minimum evidence necessary, and individuals retain control over their attention data
- The infrastructure is application-neutral: it serves education, compliance, research, healthcare, public communication, and AI data quality as readily as advertising

This vision is not a product roadmap. It is the architectural north star that governs every decision in this project.

---

# 3. Objectives

## Primary Objectives

1. **Publish the Verified Attention Protocol** — A formal, normative specification defining evidence, claims, confidence, verification, proofs, and conformance requirements. The protocol MUST be implementation-independent and suitable for Internet-standard adoption (analogous to RFCs or W3C Recommendations).

2. **Build a reference implementation** — The Verified Attention Engine MUST demonstrate that the protocol can operate at production scale, producing auditable Proofs of Attention from real user interactions while meeting privacy, latency, and accuracy requirements.

3. **Establish a reproducible verification methodology** — The system MUST produce confidence estimates that can be scientifically validated, independently audited, and compared across implementations.

## Secondary Objectives

4. **Develop cross-platform evidence collection SDKs** — Browser, mobile, and desktop SDKs that collect observation data consistently while preserving user privacy and minimising friction.

5. **Build fraud intelligence capabilities** — Detection of automated traffic, Sybil attacks, click farms, and other deception vectors that would undermine confidence in attention claims.

6. **Create a reward intelligence framework** — A system that translates verified attention into recommendations for reward distribution, enabling attention-based economic models without presuming a specific settlement mechanism.

## Long-Term Objectives

7. **Foster ecosystem adoption** — Enable third-party developers, researchers, and enterprises to build on the protocol.

8. **Establish a conformance certification programme** — Ensure that all implementations claiming VAP compliance meet normative requirements.

9. **Contribute to Internet standards bodies** — Work toward recognition of Verified Attention as a standard Internet infrastructure capability.

---

# 4. Success Criteria

## Technical Success

- The reference implementation produces Proofs of Attention with measurable, auditable confidence estimates
- Latency for verification decisions remains under defined thresholds (see VAE spec)
- Fraud detection accuracy meets or exceeds published baselines on available benchmark datasets
- System operates at production scale: millions of concurrent sessions, billions of evidence events per day
- All protocol conformance tests pass against the reference implementation

## Business Success

- At least two independent organisations adopt the protocol for production use
- At least one third-party implementation achieves conformance certification
- The project has measurable user engagement: a meaningful number of active attention sessions per month across all deployments
- Revenue-eligible applications demonstrate that verified attention commands a premium over unverified metrics

## Protocol Success

- VAP reaches a stable 1.0 specification with no breaking changes for at least 12 months after release
- At least three independent implementation teams (including VAE) have implemented the protocol
- Formal specification is published and referenced externally
- An open issues process exists for protocol evolution proposals

## Adoption Success

- Browser extension is available on major browser stores
- SDKs are documented and usable by third-party developers without direct project support
- At least one research group publishes independent validation of the methodology
- The concept of Verified Attention is referenced in at least one academic publication outside the project

## Research Success

- At least two research questions from the Research Agenda are substantially answered
- A publicly available benchmark dataset for attention verification exists
- The confidence model is validated on real user data across multiple content types

---

# 5. Guiding Principles

**Infrastructure before applications.** Build the enabling layer first. Applications are downstream.

**Protocol before implementation.** Define behaviour formally before building software. The protocol outlives any implementation.

**Privacy by design.** Privacy is not a feature added later. It is a structural constraint on the architecture.

**Trust through evidence.** Trust is not declared. It is derived from reproducible evidence. No evidence, no trust.

**Application neutrality.** The infrastructure serves all applications equally. It does not optimise for advertising over education, or research over commerce.

**Interoperability.** The protocol MUST be implementable by any organisation on any platform. Vendor lock-in is antithetical to the mission.

**Scientific validation.** Every architectural claim SHOULD be experimentally testable. Confidence estimates MUST be empirically calibrated.

**Open standards where possible.** Where existing open standards exist (W3C, IETF, ISO), the protocol SHOULD align with rather than duplicate them.

**Continuous improvement.** The protocol and implementation evolve as understanding improves. Versioning and migration paths are first-class concerns.

---

# 6. Core Concepts

**Verified Attention** — A representation of human engagement with digital content that has been independently assessed for authenticity through reproducible evidence. Verified Attention is not a raw metric; it is a claim supported by evidence and expressed with measurable confidence.

**Proof of Attention** — A digitally signed, auditable record that a specific human engaged with specific content during a specific time period, with an associated confidence score. A Proof of Attention is the output of successful verification.

**Attention Session** — A bounded interaction between a human participant and digital content, during which observation data is collected for verification. Sessions have defined start and end boundaries, participants, context, and state.

**Evidence** — Observable signals collected during an attention session. Evidence includes interaction data (clicks, scrolls, key presses), behavioural patterns (reading speed, pause distributions, engagement depth), environmental signals (viewport visibility, focus events, device motion), and derived features (attention heat maps, engagement curves). Evidence is the fundamental architectural primitive from which everything else is derived.

**Confidence** — A probabilistic assessment of how likely it is that observed attention is genuine human attention. Confidence is expressed as a calibrated probability between 0.0 and 1.0, not as a binary classification. Confidence evolves as more evidence accumulates.

**Verification** — The process of evaluating evidence against defined thresholds and policies to produce a verification decision. Verification is reproducible: given the same evidence and the same policy, the same decision MUST result.

**Trust** — The property that a Proof of Attention can be relied upon by consumers without needing to replicate the verification process. Trust is earned through protocol conformance, cryptographic integrity, auditability, and verifier reputation.

**Fraud** — Any attempt to produce a Proof of Attention without genuine human engagement. Fraud includes automated scripts, click farms, session hijacking, device emulation, and AI-generated interaction patterns designed to mimic human behaviour.

**Reward** — The economic or non-economic value assigned to verified attention. Reward is not part of verification; it is a downstream application. VAE provides a Reward Intelligence subsystem that recommends reward distributions, but does not execute settlement.

**Protocol** — The Verified Attention Protocol (VAP) defines normative rules for evidence formats, claim structures, verification procedures, proof objects, security, privacy, and conformance. VAP is implementation-independent.

**Engine** — The Verified Attention Engine (VAE) is the reference implementation of VAP. It implements every normative requirement and demonstrates production viability.

**Reference Implementation** — An implementation of a specification that serves as the definitive example. Other implementations MUST conform to the same specification but MAY differ in internal architecture, programming language, deployment topology, or optimisation strategy.

---

# 7. System Overview

The complete Verified Attention ecosystem consists of the following components:

**VAP (Verified Attention Protocol)** — The normative specification. Defines what compliance means. All other components implement the protocol.

**VAE (Verified Attention Engine)** — The reference implementation. A production-scale backend that receives evidence, runs verification, and produces Proofs of Attention.

**Browser SDK** — JavaScript library that collects observation data from web pages: viewport visibility, scroll behaviour, interaction events, focus state, timing data. Designed for minimal performance overhead and privacy-preserving defaults.

**Mobile SDK** — Native mobile library for Android and iOS that collects comparable observation data from mobile applications. Accounts for platform-specific interaction models (touch, swipe, orientation, background state).

**Desktop SDK** — Native desktop library for Windows, macOS, and Linux that collects observation data from desktop applications, browser extensions, and system-level interactions where authorised.

**API Layer** — REST and streaming APIs through which SDKs submit evidence, applications request verification, and consumers query Proofs of Attention. All API interactions conform to VAP message formats.

**AI Models** — Machine learning models for behavior modelling, attention prediction, anomaly detection, fraud classification, and confidence estimation. Models are versioned, auditable, and continuously improved through the research framework.

**Fraud Engine** — A subsystem dedicated to detecting and scoring fraudulent activity. Combines behavioural biometrics, device fingerprinting, network analysis, reputation scoring, and adaptive learning.

**Reward Engine** — A subsystem that translates verified attention into reward recommendations. Does not execute payments. Provides eligibility determination, campaign management, budget allocation, and settlement preparation.

**Marketplace** — A future component (out of scope for initial implementation) where attention buyers and sellers interact through verified attention claims. The marketplace is an application built on the protocol, not part of the infrastructure itself.

**Dashboards** — Operational dashboards for system operators and analytics dashboards for protocol consumers. Dashboards surface attention metrics, fraud metrics, confidence distributions, and business metrics.

**Analytics** — A framework for querying, aggregating, and visualising attention data. Supports both operational analysis (system health, pipeline throughput) and scientific analysis (confidence calibration, fraud rate trends, research experiments).

These components fit together through a layered architecture: SDKs collect evidence and submit it through APIs; VAE processes evidence through the pipeline; the Fraud Engine and AI Models inform the Verification Engine; the Verification Engine produces Proofs of Attention; the Reward Engine recommends rewards based on verified proofs; Dashboards and Analytics provide visibility into the entire system.

---

# 8. Project Boundaries

## In Scope

- VAP specification maintenance and evolution
- VAE reference implementation (backend services)
- Browser, mobile, and desktop SDK reference implementations
- Evidence collection, validation, normalisation, and storage
- AI/ML models for attention intelligence and fraud detection
- Public REST and streaming APIs
- Operational dashboards and monitoring
- Developer documentation and integration guides
- Research programme and academic publication
- Conformance testing framework

## Out of Scope

- Payment processing or financial settlement
- Identity provision or authentication
- Advertising optimisation or campaign management
- Content creation, curation, or distribution
- Consumer-facing social media or communication products
- General-purpose AI models (models are purpose-built for attention verification)
- Blockchain-based verification or distributed ledger technology (the protocol is blockchain-agnostic, but no specific blockchain implementation is part of the project)
- Data brokerage or sale of attention data to third parties
- Legal or regulatory compliance services (the project complies with regulations but does not offer compliance-as-a-service)

## Future Scope

- Decentralised verification networks (federated verification)
- On-device verification and edge processing
- Hardware-level attestation integration
- Smart contract-based reward settlement
- Protocol extensions for virtual reality, augmented reality, and immersive environments
- Cross-device attention attribution
- Long-form content verification (books, courses, research papers)
- Real-time bidding integration for verified attention markets

## Non-goals

- Replacing advertising platforms (VAE enables better advertising; it does not replace ad tech)
- Replacing analytics platforms (VAE provides attention verification, not general analytics)
- Building a social network or content platform
- Creating a cryptocurrency or token
- Solving general AI alignment or AGI safety
- Providing legal attestation or notarisation services
- Replacing cookies or alternative tracking mechanisms (VAE does not depend on tracking identifiers)

---

# 9. Stakeholders

**End User (Viewer)** — The human whose attention is being verified. End users gain privacy protection, control over their attention data, and potential reward for genuine engagement. They are not required to create accounts or share identity information.

**Developer** — The engineer integrating VAE SDKs or APIs into applications. Developers gain access to verified attention data through standard interfaces without needing to build verification infrastructure themselves.

**Researcher** — The scientist studying human attention, behaviour modelling, fraud detection, or human-computer interaction. Researchers gain access to anonymised, privacy-preserving attention datasets and a research framework for conducting experiments.

**Advertiser** — The entity paying for attention. Advertisers gain confidence that their expenditure produces genuine human engagement rather than automated traffic. Verified attention provides measurable return on investment that unverified metrics cannot.

**Creator** — The individual or organisation producing content. Creators gain verifiable proof that their content received genuine attention, enabling fair compensation models that do not depend on platform benevolence.

**Enterprise** — The organisation deploying VAE for internal use cases: employee training compliance, documentation effectiveness, meeting engagement, or knowledge validation. Enterprises gain operational metrics grounded in verified human attention.

**Educator** — The teacher, institution, or platform delivering educational content. Educators gain verifiable evidence that students genuinely engaged with learning materials, enabling competency-based progression rather than time-based metrics.

**Platform** — The digital platform (social media, streaming, publishing, analytics) integrating VAE. Platforms gain a competitive differentiator by offering verified attention to their customers while maintaining user privacy.

**Regulator** — The government or industry body concerned with advertising transparency, data privacy, consumer protection, or platform accountability. Regulators gain an independently auditable mechanism for verifying attention claims.

**Partner** — The organisation building complementary infrastructure or applications on the protocol. Partners gain access to a growing ecosystem and the opportunity to contribute to protocol evolution.

---

# 10. High-Level Architecture

The architecture is organised around evidence flow. Evidence enters through SDKs, flows through the pipeline for validation and enrichment, passes through intelligence subsystems for analysis, reaches the verification engine for decision, and produces Proofs of Attention as output.

```
  SDKs (Browser / Mobile / Desktop)
         |
         | Evidence Submission
         v
  ┌─────────────────────────────────────┐
  │        Evidence Collection API       │
  │  (REST / WebSocket / Batch Ingestion)│
  └──────────────┬──────────────────────┘
                 | Evidence Stream
                 v
  ┌─────────────────────────────────────┐
  │     Evidence Processing Pipeline     │
  │  Validation → Normalization →       │
  │  Dedup → Feature Extraction → Store │
  └──────┬──────────────────────────────┘
         | Normalised Evidence
         v
  ┌──────────────────┐   ┌───────────────────┐
  │ Attention Intel   │   │  Fraud Intel      │
  │ Behaviour Models  │   │  Threat Detection │
  │ Confidence Estim. │   │  Risk Scoring     │
  └────────┬─────────┘   └────────┬──────────┘
           | Attention Signals    | Fraud Signals
           v                      v
  ┌────────────────────────────────────────────────┐
  │           Verification Engine                   │
  │  Evidence Evaluation → Policy Check → Decision │
  └────────────────────┬───────────────────────────┘
                       | Verification Decision
                       v
  ┌────────────────────────────────────────────────┐
  │            Proof Generator                      │
  │  Bundle → Sign → Store → Index                 │
  └──────┬─────────────────────────────────────────┘
         | Proof of Attention
         v
  ┌────────────────────────────────────────────────┐
  │  APIs / Webhooks / Consumers / Reward Engine   │
  └────────────────────────────────────────────────┘
```

Core architectural properties:

- **Evidence is the primitive.** Every subsystem either produces, consumes, transforms, or stores evidence. No subsystem makes decisions without evidence.
- **Pipelines are asynchronous.** Evidence collection is decoupled from verification. The pipeline absorbs traffic spikes through buffering and stream processing.
- **AI is embedded.** Intelligence subsystems are not external services. They are integrated components that consume and enrich evidence streams.
- **Fraud is treated as a first-class problem.** Fraud intelligence is not an add-on. It is a core subsystem with equal architectural standing to the verification engine.
- **Privacy is structural.** Data minimisation, pseudonymisation, and selective disclosure are enforced at the architecture level, not added as policy after implementation.
- **Protocol conformance is testable.** Every component that produces or consumes protocol objects MUST pass conformance tests that verify correctness independent of implementation.

---

# 11. Major Subsystems

## Verified Attention Protocol

The normative specification that defines evidence formats, claim structures, verification procedures, proof objects, security requirements, privacy constraints, and conformance criteria. The protocol subsystem includes the specification itself, reference test suites, and conformance testing tools.

## Attention Engine

The core subsystem responsible for processing evidence submissions, managing attention sessions, and coordinating the verification lifecycle. Includes session management, evidence ingestion, pipeline orchestration, and state management.

## Fraud Intelligence

A dedicated subsystem for detecting fraudulent attention. Combines behavioural biometrics (mouse movement patterns, typing dynamics, scroll rhythms), device fingerprinting (browser attributes, hardware characteristics, network properties), automation detection (headless browser detection, Selenium/Puppeteer fingerprints, CAPTCHA bypass patterns), Sybil detection (reputation graphs, device correlation, IP clustering), and adaptive learning (models that evolve as fraud patterns change).

## Evidence Collection

The subsystem responsible for gathering observation data at the client. Includes the browser, mobile, and desktop SDKs, as well as server-side evidence collection APIs for partner integrations and offline event ingestion. Defines evidence schemas, collection policies, reliability guarantees, and quality thresholds.

## Reward Engine

A downstream subsystem that translates verified attention into reward recommendations. Includes eligibility determination (did this session qualify?), campaign policy enforcement (what rules govern this content?), dynamic pricing (what is attention worth for this context?), budget allocation (how is the campaign budget distributed?), and settlement preparation (what data does the settlement system need?). The Reward Engine does NOT execute payment transactions.

## Marketplace

A future subsystem enabling attention buyers and sellers to discover each other and transact based on verified attention claims. The Marketplace is an application-layer component built on the protocol. It is not part of the core infrastructure.

## SDKs

Cross-platform software development kits that implement evidence collection according to VAP specifications. Each SDK handles platform-specific interaction models while producing standardised evidence output. SDKs are open-source and independently auditable.

## Browser Extension

A reference implementation of a browser-based attention verification interface. The extension provides users with visibility into which sites are requesting attention verification, what evidence is being collected, and what Proofs of Attention have been generated.

## Public APIs

RESTful and streaming APIs through which external systems interact with VAE. Includes evidence submission endpoints, verification request endpoints, proof retrieval endpoints, administration endpoints, and analytics query endpoints.

## Dashboards

Web-based dashboards for system operators (infrastructure health, pipeline throughput, error rates, latency) and protocol consumers (attention metrics, verification statistics, fraud rates, confidence distributions).

## Operations

Infrastructure components for deployment, monitoring, alerting, logging, tracing, configuration management, feature flags, and disaster recovery.

---

# 12. Project Phases

## Phase 0: Research

Establish the theoretical foundations. Publish the Venture Thesis. Define the Evidence-Centric Architecture. Conduct initial research into attention measurement, behaviour modelling, fraud detection, and privacy-preserving verification. Identify open research questions. Publish the Research Agenda.

Deliverables: Venture Thesis, Research Agenda, initial literature review.

## Phase 1: Protocol

Draft, review, and publish the Verified Attention Protocol specification. Define evidence models, claim structures, confidence model, verification procedures, proof objects, security requirements, privacy constraints, and conformance criteria. Publish reference test suites.

Deliverables: VAP specification, conformance test suite, formal state machine definitions.

## Phase 2: Reference Engine

Build the Verified Attention Engine reference implementation. Implement the evidence processing pipeline, session management, attention intelligence, fraud intelligence, verification engine, proof generation, and APIs. Deploy at production scale. Validate against conformance test suite.

Deliverables: VAE reference implementation, deployment documentation, performance benchmarks.

## Phase 3: Browser Extension

Develop and publish the reference browser extension. Implement privacy-preserving evidence collection, user controls, and Proof of Attention display. Publish on major browser extension stores.

Deliverables: Browser extension source code, extension store listings, user documentation.

## Phase 4: Developer APIs

Stabilise and document all public APIs. Publish SDK documentation, integration guides, quickstart tutorials, and API reference. Support third-party integration efforts.

Deliverables: SDK releases, API documentation, integration guides, reference applications.

## Phase 5: Marketplace

Develop the attention marketplace as an application-layer component. Enable attention buyers and sellers to interact through verified attention claims. Implement discovery, pricing, and settlement preparation.

Deliverables: Marketplace specification, reference implementation, integration examples.

## Phase 6: Ecosystem

Support third-party protocol implementations, publish conformance certification programme, contribute to standards bodies, foster community development, publish research findings.

Deliverables: Certification programme, third-party implementation support, standards contributions, academic publications.

---

# 13. Research Programme

The project maintains an active research programme addressing the following questions:

## Behaviour Modelling

How accurately can human attention be inferred from observable behaviour? Which signals are most predictive? How do attention patterns vary across content types, platforms, and user populations? What are the limits of behaviour-based attention inference?

## Attention Estimation

Can attention be measured objectively, or is it inherently subjective? How should uncertainty in attention estimation be represented? What confidence thresholds are appropriate for different use cases? Can attention estimation be validated against ground truth, and what constitutes valid ground truth?

## Fraud Detection

What fraud vectors exist against attention verification systems? How effective are existing automation detection techniques against modern AI-driven fraud? Can fraud become economically unprofitable through sufficient detection accuracy? How should fraud detection evolve as fraud techniques evolve?

## Privacy

What is the minimum evidence required for a given confidence level? How can evidence be collected and processed without enabling surveillance? What zero-knowledge proof techniques are applicable to attention verification? Can verification be performed without revealing which content was viewed?

## Human Factors

How does the awareness of being monitored affect attention behaviour? Do verification mechanisms alter the user experience? What is the acceptable latency for verification to feel instantaneous? How should verification failures be communicated to users without creating perverse incentives?

## Economics

What is the economic value of verified versus unverified attention? How should attention-based reward systems be designed to avoid perverse incentives? What market structures emerge when attention is independently verifiable? How does verified attention affect advertising effectiveness and return on investment?

## AI

How can large language models and other AI systems contribute to attention verification? What are the failure modes of AI-based verification? How should AI confidence be calibrated against human judgment? What is the role of AI-generated content in the attention verification ecosystem?

---

# 14. Risks

## Technical

Risk that attention verification cannot achieve sufficient accuracy for real-world deployment. Mitigated through rigorous research programme, confidence calibration against ground truth, and transparent reporting of accuracy limitations.

Risk that the system cannot scale to production traffic volumes. Mitigated through asynchronous pipeline architecture, horizontal scaling design, and load testing as part of development.

Risk that AI models degrade over time due to concept drift. Mitigated through continuous learning, automated model retraining pipelines, and drift detection monitoring.

## Behavioural

Risk that users alter their behaviour when they know attention is being measured (observer effect). Mitigated through research into observer effect magnitude, transparent disclosure, and design choices that minimise perceived surveillance.

Risk that verification creates perverse incentives, such as users optimising for verifiable signals rather than genuine engagement. Mitigated through multi-signal verification that resists gaming.

## Privacy

Risk that evidence collection enables surveillance or user profiling beyond the scope of attention verification. Mitigated through data minimisation, strict collection policies, pseudonymisation, and independent privacy audits.

Risk that anonymised attention data can be re-identified. Mitigated through state-of-the-art de-identification techniques, data retention limits, and privacy-preserving analytics.

## Regulatory

Risk that attention verification is classified as tracking under data protection regulations (GDPR, CCPA, etc.). Mitigated through privacy-by-design architecture, consent-based collection, and proactive regulatory engagement.

Risk that Proofs of Attention are given legal standing (e.g., as evidence in court) without appropriate limitations. Mitigated through clear documentation of what Proofs of Attention represent and what they do not certify.

## Economic

Risk that the market does not value verified attention at a premium sufficient to sustain the infrastructure. Mitigated through focus on applications where verification has clear economic value (advertising fraud prevention, compliance, certification).

Risk that existing ad tech platforms resist adoption due to disruptive implications. Mitigated through integration rather than replacement strategy: VAE works with existing platforms rather than competing.

## Platform Dependence

Risk that browser vendors or operating system platforms restrict evidence collection capabilities. Mitigated through platform-appropriate collection strategies, fallback mechanisms, and advocacy for standards that support privacy-preserving attention verification.

## AI

Risk that AI-generated content mimics human attention patterns, defeating verification systems. Mitigated through continuous fraud intelligence evolution, research into AI-vs-human behavioural differences, and adaptive detection.

Risk that AI-based verification introduces systematic bias against certain user populations. Mitigated through fairness evaluation, diverse training data, and transparent reporting of model performance across demographics.

## Fraud

Risk that fraud techniques outpace detection capabilities. Mitigated through assumption that fraud is an ongoing arms race; fraud intelligence is a continuous investment, not a one-time implementation.

## Adoption

Risk that the protocol is not adopted by sufficient participants to create network effects. Mitigated through open standards approach, low-friction SDKs, reference implementations, and focus on immediate value in specific use cases (fraud reduction, compliance) before network effects are required.

---

# 15. Governance

## Protocol Ownership

The Verified Attention Protocol (VAP) is owned by the project. As the ecosystem matures, governance SHOULD transition to a neutral foundation or standards body. The protocol specification is the property of the community, not a single organisation.

## Change Approval

Protocol changes follow an RFC-style process:

1. **Proposal** — Anyone may submit a protocol extension proposal.
2. **Review** — Proposals are reviewed by the technical steering committee for technical merit, backward compatibility impact, and alignment with the Venture Thesis and Design Principles.
3. **Discussion** — Proposals are discussed openly. Feedback is solicited from implementers, researchers, and stakeholders.
4. **Decision** — The technical steering committee approves, rejects, or requests modifications to proposals.
5. **Implementation** — Approved changes are implemented in VAE and the conformance test suite.
6. **Publication** — Changes are published in a new version of the specification.

## Versioning Philosophy

- Major version changes MAY include breaking changes to the protocol. Breaking changes MUST be justified by significant improvement and MUST include a migration path.
- Minor version changes MUST be backward compatible. New features, evidence types, or extension points MAY be added in minor versions.
- Patch version changes address clarifications, corrections, and non-normative updates.

## Backward Compatibility

- Implementations conforming to VAP N.x MUST continue to produce valid outputs when communicating with VAP N.y implementations (where y > x).
- Old Proofs of Attention MUST remain verifiable after protocol updates, even if new verification policies apply different confidence thresholds.
- Evidence collected under old protocol versions SHOULD remain valid for new versions, subject to compatibility transformations.

## Deprecation Policy

- Deprecated features MUST be announced at least one major version cycle before removal.
- Deprecation announcements MUST include the replacement or migration path.
- Critical security fixes MAY be applied to deprecated versions for a reasonable period.

---

# 16. Documentation Strategy

The documentation strategy follows the document hierarchy defined in the AI Authoring Guide.


**PROJECT_CHARTER** — Explains what the project intends to build. Defines scope, objectives, boundaries, architecture, governance, and roadmap. Intended audience: engineers, contributors, partners, and anyone asking "what and how?"

**VAP** — Defines normative protocol behaviour. Formal specification with RFC 2119 language, object definitions, state machines, conformance requirements. Intended audience: protocol implementers, conformance testers, standards bodies, and anyone asking "what is correct?"

**VAE** — Defines the reference implementation architecture. Design decisions, subsystem interactions, technology choices, deployment model. Intended audience: VAE developers, operators, integrators, and anyone asking "how is this implemented?"

**Future RFCs** — Additional specifications for extensions, application profiles, integration standards, or protocol amendments. Each follows the same formal style.

**Developer Guides** — Tutorials, quickstarts, integration examples, SDK documentation. Practical guidance for developers building on the protocol.

**Research Papers** — Academic publications documenting the research programme: attention measurement methodology, fraud detection techniques, confidence calibration, privacy-preserving verification, experimental results.

Appendices and reference material (glossaries, ADRs, schemas, diagrams) are maintained alongside each document.

---

# 17. Roadmap

## Near-Term

- Publish complete Venture Thesis
- Complete and publish initial VAP specification (v0.9 draft for community review)
- Implement core VAE reference implementation (evidence pipeline, verification engine, proof generation)
- Develop browser SDK reference implementation
- Establish conformance test suite
- Publish initial Research Agenda
- Deploy alpha infrastructure for internal testing

## Mid-Term

- Publish VAP v1.0 (stable specification)
- Stabilise VAE for production deployment
- Publish mobile and desktop SDK references
- Deploy browser extension on major stores
- Publish developer documentation, integration guides, and API references
- Begin external partner onboarding
- Achieve first independent protocol implementation
- Publish first research papers
- Conduct independent privacy audit

## Long-Term

- Transition VAP governance to neutral foundation or standards body
- Establish conformance certification programme
- Develop marketplace subsystem
- Support federated verification and decentralised verifier networks
- Contribute to W3C, IETF, or equivalent standards processes
- Publish comprehensive benchmark datasets
- Enable AI agent integration for autonomous attention verification
- Extend protocol to immersive environments (VR, AR)
- Achieve regulatory recognition as an attention measurement standard

Dates are deliberately absent. Capability milestones govern the roadmap. Each phase begins when prerequisites are met, not when a calendar date arrives.

---

# 18. Design Philosophy

**Protocol-driven.** Architecture is derived from protocol requirements, not the reverse. The protocol defines what is correct; the implementation follows.

**Evidence-based.** Every subsystem that makes a decision does so on the basis of evidence. No decision is made without supporting evidence. No evidence is discarded without justification.

**Privacy-first.** Privacy constraints are not bolted on. The architecture enforces data minimisation at every stage: collect only what is needed, retain only as long as necessary, share only what is consented to.

**Modular.** Subsystems have well-defined interfaces and responsibilities. Any subsystem can be replaced, upgraded, or improved independently as long as it respects its interface contracts.

**Observable.** Every subsystem produces metrics, logs, and traces. The system's internal state is inspectable in production without compromising security or privacy.

**AI-assisted.** AI is not the product. AI is a tool employed where it adds measurable value: behaviour modelling, fraud detection, confidence estimation, anomaly detection. Every AI component has a non-AI fallback or explicit failure mode.

**API-first.** All system capabilities are accessible through well-documented APIs. User interfaces are consumers of APIs, not the primary interface.

**Cloud-native.** The reference implementation is designed for cloud deployment: horizontal scaling, stateless components where possible, managed infrastructure, automatic recovery.

**Extensible.** The protocol and architecture accommodate future capabilities without breaking changes. Extension points are explicit and documented.

---

# 19. Open Questions

This section maintains a running list of questions that are not fully resolved. Updated continuously as understanding evolves.

- At what confidence threshold should a Proof of Attention be considered valid for general use? Does this threshold differ by application domain?
- How should confidence be calibrated when ground truth cannot be reliably established? What serves as ground truth for attention?
- What is the minimum evidence set required to achieve a given confidence level? Can this be determined dynamically?
- How should the system handle attention sessions that cross multiple devices or platforms?
- Should Proofs of Attention expire? If so, what determines the expiration period?
- How should the reward engine handle disputes about verification decisions? What is the appeals process?
- Can attention verification be performed without any client-side JavaScript execution (e.g., for email clients, e-book readers, RSS readers)?
- What is the appropriate level of transparency for users regarding the evidence being collected? Does full transparency enable fraud?
- How should the system handle attention by users who have disabilities that affect interaction patterns? How does this interact with fraud detection?
- At what scale does the system require dedicated AI infrastructure (GPUs, TPUs) versus running on general-purpose compute?
- Should the protocol support negative evidence (evidence that attention did NOT occur)? What would that look like?
- How do cultural differences in reading and interaction behaviour affect confidence estimation across global user populations?

---

# 20. Conclusion

The Verified Attention Engine (VAE) project exists to provide the world's first reference implementation of Verified Attention infrastructure.

It implements the Verified Attention Protocol as a production-scale system that collects observation evidence, applies AI-driven intelligence and fraud detection, produces auditable Proofs of Attention, and enables attention-based reward recommendations — all while preserving privacy, interoperability, and scientific rigor.

The project is not building products. It is building infrastructure.

It is not replacing existing platforms. It is enabling them to operate with verified trust in human attention.

It is not claiming to have solved the problem of attention measurement. It is establishing the framework within which that problem can be rigorously studied, validated, and improved.

VAE exists because the Internet needs a standard mechanism for representing verified human attention as a trusted, interoperable, and application-independent resource. This project builds that mechanism.

---

# Appendix A: Glossary

| Term | Definition |
|------|-----------|
| Attention Session | A bounded interaction between a human participant and digital content during which observation data is collected |
| Claim | A statement derived from evidence, asserting that something is true about an attention session |
| Confidence | A calibrated probability that observed attention is genuine human attention |
| Consumer | An entity that uses verified attention data (e.g., advertiser, educator, researcher) |
| Engine | Reference: Verified Attention Engine (VAE) |
| Evidence | Observable signals collected during an attention session; the fundamental architectural primitive |
| Evidence Graph | A directed graph representing the relationships between evidence, claims, and proofs |
| Fraud | Any attempt to produce a Proof of Attention without genuine human engagement |
| Observation | A raw signal collected from the environment (mouse movement, scroll event, key press) |
| Policy | A set of rules governing verification, data retention, collection scope, or reward distribution |
| Producer | An entity that generates evidence (e.g., a human viewer interacting with content) |
| Proof of Attention | A digitally signed, auditable record confirming verified human attention |
| Protocol | Reference: Verified Attention Protocol (VAP) |
| Reference Implementation | A definitive implementation of a specification against which other implementations are measured |
| Reward | Economic or non-economic value assigned to verified attention |
| Verification | The process of evaluating evidence to determine whether observed attention is genuine |
| Verifier | An entity that performs verification and issues Proofs of Attention |

---

# Appendix B: Document Relationships

```
        |
        v
  PROJECT_CHARTER                   What VAE intends to build
        |
        v
  VAP (0001)                        Normative protocol specification
        |
        v
  VAE (0010)                        Reference implementation architecture
        |
        v
  Future RFCs                       Extensions, profiles, amendments
```

Each document references but does not redefine higher-level concepts. Lower-level documents are concrete implementations of higher-level principles.

---

# Appendix C: Repository Structure

```
docs/
  AI_AUTHORING_GUIDE.md             Writing standards for all documents
  specs/
    0000-project-charter.md         This document
    0001-verified-attention-protocol.md  VAP specification
    0010-verified-attention-engine.md    VAE implementation spec
    (future RFCs)
```

As the project grows, additional directories will be added for the reference implementation, SDKs, tools, and tests. The document hierarchy remains stable.

---

# Appendix D: Naming Conventions

- Spec documents follow the convention `NNNN-short-description.md` where NNNN is a sequential number.
- Higher numbers do not indicate greater importance. The numbering establishes document ordering.
- The Venture Thesis and AI Authoring Guide sit outside the numbered sequence as they are reference documents rather than specifications.
- Terminology is consistent across all documents. Definitions in the Venture Thesis are authoritative. VAP provides formal definitions. VAE uses those definitions without modification.

---

# Appendix E: Future Specifications

This living list tracks planned RFCs that extend the core protocol or reference implementation.

- Attention Verification API Profile (REST specification)
- Browser SDK Integration Standard
- Mobile SDK Integration Standard (Android)
- Mobile SDK Integration Standard (iOS)
- Proof of Attention Content Format (canonical serialisation)
- Evidence Collection Privacy Policy Framework
- Confidence Reporting Standard
- Fraud Intelligence Exchange Format
- Reward Intelligence API Profile
- Conformance Testing Protocol
- Federated Verification Extension
- Cross-Device Attention Attribution Extension
- Immersive Environment Attention Verification Extension