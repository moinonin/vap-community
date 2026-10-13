# Verified Attention Protocol (VAP)

## Protocol Specification

Version: 1.0

Status: Draft

Normative: This document defines normative requirements for all implementations of the Verified Attention Protocol. Implementations MUST conform to the requirements expressed with RFC 2119 terminology.

---

# 1. Introduction

## Purpose

This document defines the Verified Attention Protocol (VAP). VAP is a formal specification that enables independent verification of human attention in digital environments. It defines evidence formats, claim structures, confidence models, verification procedures, proof objects, and conformance requirements.

The protocol is designed as Internet infrastructure. It is application-neutral, implementation-independent, and privacy-preserving. Any implementation that conforms to this specification MAY participate in the Verified Attention ecosystem.

## Scope

This specification defines:

- An Evidence Model for representing the observable signals of human attention
- An Observation Model for collecting and normalising raw interaction data
- A Session Model for managing bounded attention interactions
- A Claim Model for expressing derived assertions about attention sessions
- A Confidence Model for quantifying uncertainty in attention verification
- A Verification Model defining the formal decision process
- A Proof of Attention object
- Protocol messages
- State machines for evidence, sessions, claims, and verifications
- Security and privacy requirements
- Extension, versioning, and conformance frameworks

This specification does NOT define implementation architecture, programming language, deployment model, application-level reward mechanisms, pricing models, settlement infrastructure, business models, or market structures.

## Audience

This document is intended for protocol implementers, platform developers integrating Verified Attention, researchers studying attention verification, standards organisations evaluating adoption, and auditors assessing protocol conformance.

## Relationship to the Venture Thesis

The Venture Thesis establishes the justification for Verified Attention infrastructure. VAP inherits that justification and defines the mechanism that realises the infrastructure. It assumes the thesis conclusions and does not re-argue them.

## Relationship to the Project Charter

The Project Charter defines the scope and vision of the Verified Attention Engine project. VAP is implementation-independent; VAE is one of possibly many conforming implementations.

## Relationship to VAE

The Verified Attention Engine is the reference implementation. VAP's requirements are normative; VAE's are informative.

## Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" are to be interpreted as described in RFC 2119.

## Terminology

### Observation

A raw signal collected from the interaction environment between a human and digital content. The atomic unit from which verification begins. Observations are uninterpreted — they do not carry semantic meaning.

### Observation Source

The entity that produces observations (typically the user's device via SDKs). Each source has an associated reliability profile.

### Evidence

A discrete piece of verified, immutable information derived from observations and tagged with session identifier, timestamp, and source, serving as the architectural primitive from which all downstream decisions are derived. Evidence MUST be validated before satisfaction by the pipeline.

### Claim

A semantic assertion about an attention session derived from evidence. A claim is a proposition that something is true about the attention event. Claims reference the evidence from which they were derived cryptographically. Claims are derived: they are not declared. Each claim has a confidence rating.

### Confidence

A calibrated probability between 0.0 and 1.0 that a claim is correct. Confidence MUST be calculated according to the rules in the Confidence Model — subjective assessment is not permitted. The same input evidence plus the same rules yields the same confidence score.

### Viewer (Session Participant)

The human whose attention is being verified within an attention session.

### Verifier

An entity that evaluates evidence, forms claims, assesses confidence, and issues Proofs of Attention. Verifiers operate on evidence and policies. Verifiers MUST execute the logic of this specification deterministically.

### Proof of Attention (PoA)

A digitally signed, auditable record confirming a session's attention with a confidence exceeding a verifiable threshold. Includes session identifier, content identifier, confidence score, and a verifier signature. The PoA is immutable once produced. A verifier MAY issue a supplementary PoA reflecting further evidence, but earlier PoAs must remain auditable.

### Consumer

An external actor that receives Proofs of Attention and trusts them according to the verifier's signature.

### Publisher

An entity making content available for attention verification: a website, app, document host, or other digital destination content publisher.

### Advertiser

Downstream Application: an entity compensating attention — always a role of consuming verified attention not producing.

## Protocol

The normative set of rules, message formats, and behaviors that all VAP implementations must adhere to.

## Evidence Graph

The directed set of relationships by which evidence is linked to derived claims and to proofs, establishing audit traceability.

## Evidence Identifier (EVID)

A universally unique identifier assigned to each evidence item at the moment of its creation.

## Claim Identifier (CLID)

A unique identifier assigned to each claim formed from evidence.

## Proof Identifier (PID)

A unique identifier assigned to each Proof of Attention.

## Event

A raw observation with no validation applied yet.

## Evidence Policy

A rule set defining what evidence types are required or optional for verification in a given context.

---

# 2. Protocol Philosophy

## Why This Protocol Exists

The Internet lacks a standard mechanism for representing verified human attention as a trusted, interoperable, and application-independent resource. VAP fills that gap by defining attention verification as first-class infrastructure, not as an application-specific feature.

## Design Objectives

- **Evidence-Centric Architecture (ECA)**: Every architectural decision flows from Evidence. No decision without evidence. No evidence without provenance.
- **Protocol before implementation**: Define the behavior formally before constructing software.
- **Scientific reproducibility**: Verification is reproducible. Confidence is calibrated. Trust is auditable.
- **Privacy by design**: Verify attention, not identify people. Minimizing data retention.
- **Interoperability**: Designed to be platform-agnostic, vendor-agnostic, and language agnostic.
- **Application neutrality**: No preferential treatment for advertising, education, or any other domain.

---

# 3. Evidence-Centric Architecture (ECA)

## Formal Introduction

ECA represents Verified Attention's fundamental architecture pattern. Evidence is the primary primitive. All other constructs — observations, claims, confidence, proofs, rewards — derive from evidence.

Evidence is primary. Evidence is always generated from observations, validated, stored, and cataloged. Claims then serve as interpretation functions. Confidence serves as the quantitative judgement of claim strength. Proofs combine claims into incontrovertible certificates.

Applications are built on top: verification engines are built around evidence; reward pipelines consume proofs, and analytics consume aggregated evidence.

## Architectural Roles

### Evidence Producers

Clients, SDKs, server-side monitors, and partner APIs that collect observation signals and submit normalized evidence to the protocol network.

### Evidence Consumers

Entities that use evidence for verification — verifiers, fraud detectors, reward calculators, and evidence resellers.

### Evidence Stores

Persisted, append-only storage of evidence items. Evidence stores MUST present evidence in immutable form. Stores are designed for long-term persistence.

### Evidence Evaluators

System modules that score evidence quality, check conformance, and assign metadata.

### Evidence Graph

A directed graph linking evidence items to claims, claims to proofs, evidence to upstream observations, and observations to downstream applications. The Evidence Graph enables auditing.

### Evidence Lifecycle

Evidence passes through the following states: Proposed → Validated → Indexed → Archived. See the Evidence State Machine for details.

---

# 4. Observation Model

## Definition of Observation

Observations are raw signals captured from a client interaction with content, serving as the raw input to verification. Observations are extensible — any signal potentially indicative of attention MAY be collected; however, implementers must accept that uncalibrated signals may not produce sufficient confidence for verification.

## Observation Types

### Static Observation
- Scroll events (delta, position)
- Click events (element, coordinates)
- Key press events (character, timing)
- Viewport visibility events
- Focus events (element focus)
- Device motion
- Page resize, etc.

It is RECOMMENDED that observation metadata include `observer_id_hash`, `session_id`, `content_id`, `timestamp`, `signal_name`, and `payload`. The payload contains the raw value (e.g. scroll delta (x: 120, y: 0)).

## Observation Attributes

The recording of any observation MUST capture:

- `observation_id` — a unique ID that's session-scoped to prevent replay
- `source` — which source produced it
- `timestamp` — to microsecond precision
- `signal_type` — the operator event category
- `payload` — the raw data
Optional fields MAY include:

- `reliability_weight` — assigned by the source based on user knowledge
- `device_trust` — if h/w attestation is available

### Observation Lifecycle

Observations pass through the following states:

- `captured`: raw capture
- `verified`: reasonableness checks (not obviously fake)
- `attributed`: assigned to a session
- `embeddable`: ready for evidence construction

A conformant implementation MUST implement all four states.

## Observation Normalization

Observations from diverse platforms require normalization. For instance, the same `scroll delta` distribution on a phone vs (corresponding clicked on a laptop should exit to similar normalized evidence for downstream. Implementations MUST define a mapping from native event to the VAP `Signal` schema.

## Observation Uncertainty
Each source observation CAN annotate its reliability level with an optional confidence label based on historical performance. The protocol does not require this but admits it as guidance for evidence production.

---

# 5. Evidence Model

## What Evidence Is

Evidence is immutable, auditable, and verified survey information derived from observations, intended to provide objective support for claims.

## Evidence Requirements

An Evidence object MUST contain:
- `evidence_id` (EID): unique identifier, e.g. `urn:vap:evidence@<hash>`.
- `session_id`: reference to the session
- `source_id`: identifier of the Evidence Producer
- `timestamp`: when the evidence was created
- `evidence_type`: enum of the verified interaction types
- `confidence`: 0-1 score of evidence itself (before higher-level claim)
- `payload`: evidence content (the result of analysis above the raw observations)
- `provenance`: references to the underlying observations
- `signature`: digital signature of the producer over above fields (prevent tampering in transit)

## Evidence Types

- `E-INTERACTION`: records an interaction event or an interaction pattern (arch sample: avg scroll speed for last 5s)
- `E-VISIBLE`: establishes content visibility
- `E-DURATION`: obvious event happened for X minutes
- `E-CONTEXT`: environment data (browser, etc.)
- `E-CUSTOM`: extension point for implementers

Evidence MAY be enriched over time as more observations arrive, but the original form that produced it must be retained.

## Evidence Metadata

Evidence metadata is OPTIONAL. Whenever present, metadata must include `policy_id` so the evaluator can determine the evidentiary requirements satisfied.

## Evidence Integrity

Evidence hash is: `sha256(id + session_id + timestamp + evidence_type + payload_hash + signature)`. Evidence integrity ensures the evidence is the same the verifier later presents.

---

# 6. Session Model

## Session Introduction

A session represents a bounded, authenticated attention interaction between a viewer and content. A session may span minutes, hours, or days.

## Session Identifiers

Session ID MUST be dynamically created at session start, and MUST be globally unique. Session ID provides no leaks about the viewer or content beyond what is consented.

Session ID format: `urn:vap:session:<fragment_uuid>`.

## Session Context

Context associated with a session includes the session participant (the viewer), the content, the set of policies expected to be satisfied, and whether observations have been gathered.

## Session Lifecycle

Sessions are created by the viewer's client after consent. The client (from an SDK) begins recording observations into the session, then evidence is delivered gradually. As evidence accumulates a verification request may be scheduled.

A session may be in the following states:

- `Created`: created but no evidence yet
- `Active`: evidence being collected; currently considered "attention in progress"
- `Expired`: time limit reached without enough evidence
- `Verified`: evidence sufficient and verification attempted
- `Certified`: Proof + issued and final

## Session Boundaries

To mark an end, a final observation is submitted and a `session-close` signal is sent (or expires after timeout).

---

# 7. Claims

## Definition

A claim asserts semantic True/False about an attention session. A claim is a function of Evidence — it MUST reference evidence with unique ID and hash and its lifecycle must be cryptographically auditable.

## Claim characteristics
Claims relate to one and only one session. A claim expresses a Boolean estimate (with certainty): "human presence", "non-fraudulent", "duration>N", etc.

## Claim Lifecycle
"Proposed → Evaluated → Issued → Revoked"

Examples: claim "attention genuine" has confidence of 0.92.

## Claim Metadata
- `claim_id`
- `session_id`
- `evidence_ids` (list of EIDs used)
- `policy_id`
- `timestamp`
- `expiration` (date when considered stale)

---

# 8. Confidence Model

## Probability calibration

Confidence scoring numbers MUST be calibrated. The protocol requires evidence sufficiency more than arbitrary judgment.

Confidence concerning a claim is initially computed via:

C = f(E_quality, E_completeness, E_count, reliability, contradiction_penalty)

Implementations MUST provide a deterministic way to then to calibrate to anyone verifying.

The precise numeric formula is not prescribed — the protocol requires that reassessment yields the same confidence under the same evidence and rules.

---

# 9. Verification Process

## Overview

Verification is the process of accepting raw evidence, evaluating claims, and publishing a proof. Verifiers execute logic as defined in policy, compute confidence, and then if threshold is passed, sign the Proof of Attention.

## Verification Lifecycle
1. Receive evidence collections
2. Ground evidence to claims
3. Calculate confidence
4. Evaluate against policy (latitude, what is required,
   confidence threshold)
5. Decision: verified, inconclusive, rejected
6. If Verified: sign proof

## Verification outcome codes

- `PASS` : confidence >= threshold & all required signals present
- `FAIL`  : fraud detected or confidence way below threshold
- `INSUFF` : incomplete evidence yielded no decision
- `PENDING` : awaiting more evidence

---

# 10. Proof Object

Proof of Attention cryptographic container includes:

- `proof_id` — unique
- `session_id` — referenced
- `content_id` — content referenced
- `confidence` — aggregated confidence
- `evidence_hash` — of all considered evidence
- `verifier_id` — identity of verifier
- `signature` — DSS signature over above fields

Proof formats are serializable (JSON is recommended).

---

# 11. Protocol Messages

Implementations must support the following message types. Conformance to serialization format is OPTIONAL; conformance to the fields that these messages represent is MANDATORY.

```
SubmitEvidence {
   session_id
   evidence_item
   producer_signature (optional)}
```

```
ClaimRequest {
  session_id
  policy_id
  requester_id
}
```

```
VerificationCreate {
  session_id, policy, threshold
}
```

Verification Response: result + proof (optionally grouped)

When validation fails, an error response containing `cause` and `reason` must be returned.

---

# 12. Privacy Rules

The protocol REQUIRES utilization Privacy minimization — verifiers must not store raw sensor data beyond required.
Consent is required from participant before evidence collection.
Selective Disclosure is implemented by Protocol: `Proof` object can be designed to reveal only confidence score, not full underlying defensive data.

The Particle scheme must allow future zero-knowledge proofs.

---

# 13. Extensions

New evidence types, claims types, evaluators may be defined by public extension. Extensions must be registered with governance tracking.

---

# 14. Versioning Policy

Backward compatibility for evidence types mandatory for minor versions.
Deprecated notice must be given 1 version ahead.

---

# 15. Conformance

An implementation is VAP-compatible if it passes all validation tests. Certification test-harness publishes test result by verification at /cert.status.

Formal conformance requires:
- Evidence Model conforms
- Sessions consistent
- Proof format  valid by reference implementation

---

# Appendix A – Formal Definitions

### Evidence Object
E = { id, session, type, confidence, payload_hash, sign }

### Claim Object
C = { id, session, evidence_ids, claim_type, confidence, verifier_sign }

### Proof
P = { id, session, content, confidence, verifier_sig, timestamp }

### Session Object
S = { id, participant_hash, content_hash, created, status, state, evidence_ids }

---

# Appendix B – State Machine Diagrams

Evidence State Machine:
```
PROPOSED → REFINED → APPROVED (or DISCARDED)
```

Session State Machine:
```
CREATED → ACTIVE → EXPIRED|VERIFIED|CANCELLED
                   VERIFIED → CERTIFIED|EXPIRED
```

Proof State Machine:
```
UNSIGNED → SIGNED → EXPIRED
```

---

# Appendix C – Example Sequences

```
# Verified attention scenario:
Observer opens page → SDK (OBS recorded as OBS123→ submitted_to verifier)
Verifier acknowledges → session starts → evidence stream sent →
evidence analysis completes → verification pass → proof created
→ proof signed → delivered to consumer
```

---

# Appendix D – Security Considerations

- Replay Attacks: Must be mitigated using timestamps and nonce tracking.
- Sybil Attacks: Sources MUST be rated for reliability.
- Tampering: Evidence MUST be digitally signed at the source.

---

# Appendix E – Glossary & References

See the definitions section established earlier.

---

This protocol specification, combined with the VAE reference implementation, enables trust-distributed verification of human attention across the Internet.