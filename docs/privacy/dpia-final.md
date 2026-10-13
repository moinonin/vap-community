# Data Protection Impact Assessment (DPIA) — Verified Attention Engine

**Date:** 2026-09-17  
**Reviewer:** Privacy & Compliance Team  
**Auditor:** [External Auditor — to be assigned]  
**Scope:** VAP Protocol implementation including evidence collection, proof generation, fraud detection, and reward processing.

## 1. Introduction

The Verified Attention Engine (VAE) processes user attention data to generate cryptographically verifiable Proof of Attention records. This DPIA assesses privacy risks and documents mitigations.

## 2. Data Processing Overview

### 2.1 Data Collected

- **Observations:** Scroll, click, keypress, viewport visibility, focus, device motion, page resize
- **Evidence:** Aggregated interaction patterns, visibility duration, session duration, contextual data (platform, user agent, viewport, timezone, language, connection)
- **Proofs:** Cryptographically signed records containing confidence scores, evidence hashes, session/content/verifier references

### 2.2 Purpose

- Generate verifiable Proof of Attention for content publishers
- Enable reward distribution based on verified attention
- Detect fraudulent attention patterns
- Provide auditable provenance for attention claims

## 3. Legal Basis

- **Consent (GDPR Art. 6(1)(a)):** Users consent to attention tracking via explicit UI interaction
- **Contract (GDPR Art. 6(1)(b)):** Proof generation is necessary for reward fulfillment
- **Legitimate Interest (GDPR Art. 6(1)(f)):** Fraud detection serves legitimate security interest

## 4. Privacy by Design Measures

### 4.1 Data Minimisation

- Only observation data necessary for attention verification is collected
- PII fields (email, phone, address, IP) are stripped via `DataMinimiser` (Sprint 15)
- Evidence payloads contain no direct identifiers

### 4.2 Pseudonymisation

- Session IDs are pseudonymised via HMAC-SHA256 with server-side salt (`PseudonymisationService`, Sprint 15)
- User IDs are not stored in evidence; only session references
- Device fingerprints used for fraud detection are hashed

### 4.3 Retention

- **Evidence:** 90 days (anonymised after expiry)
- **Proofs:** 7 years (archived after expiry)
- **Sessions:** 90 days
- **Analytics:** Aggregated-only, indefinite retention
- **Consent records:** 5 years
- **Audit logs:** 7 years
- **Security logs:** 12 months

### 4.4 Access Control

- RBAC implemented: Admin, Operator, Reviewer, Publisher, Consumer
- API key + JWT authentication
- mTLS for internal services
- Proof retrieval requires authentication

### 4.5 Data Subject Rights

- **Access:** User can request all data associated with their identity
- **Rectification:** User can correct personal data
- **Erasure:** User can request deletion (subject to legal retention obligations)
- **Portability:** Data exportable in JSON/CSV format
- Implemented via `DataSubjectRightsHandler` (Sprint 15)

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Excessive data collection | Low | High | Data minimisation enforced at pipeline level |
| Unauthorised access to proofs | Medium | High | RBAC + authentication + encryption at rest |
| Proof linkage to individual | Low | High | Pseudonymisation of session IDs |
| Data breach | Low | Critical | Encryption at rest, TLS everywhere, legal hold controls |
| Inadequate consent | Medium | High | Consent management with withdrawal support |
| Retention violation | Low | Medium | Automated retention policies with legal hold override |

## 6. Conclusion

The Verified Attention Engine implements privacy-by-design with data minimisation, pseudonymisation, retention limits, and data subject rights. The system is designed to comply with GDPR, CCPA, and similar regulations.

**Recommendation:** Proceed with beta launch pending external auditor review.

**DPIA Status:** Draft — pending external auditor sign-off

**Next Review:** Before production launch
