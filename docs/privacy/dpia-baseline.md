# Data Protection Impact Assessment (DPIA) — Baseline

**Date:** 2026 audit round · **Status:** Baseline (pre-deployment approximation) · **Scope:** VAE reference implementation as it exists in this repository.

This document is the **baseline DPIA** required by Sprint 1. It assesses the privacy posture of the code as it exists today, against the capabilities of the `packages/privacy` modules. It is a *pre-deployment approximation*: risks are scored from the architecture and existing controls, not from a production deployment.

**Relationship to `docs/privacy/dpia-final.md`.** `dpia-final.md` is the pre-launch assessment in the "final DPIA" narrative of a future deployment (it includes a reviewer, future auditor, and beta-launch recommendation). This baseline DPIA supplements it: it grounds the assessment in concrete package capabilities and records residual risk honestly. This document does **not** modify `dpia-final.md`; on production launch the final DPIA should be re-issued and supersede this baseline.

---

## 1. Data Categories Processed

| Category | Examples | Identifiability | Collected by |
|---|---|---|---|
| **Behavioural observations** | scroll, click, keypress, viewport visibility, focus, device motion | Indirect (behavioural pattern may be identifying at scale; treated as pseudonymous) | Client SDK → `POST /v1/evidence` (`apps/api/src/evidence`) |
| **Contextual device data** | user agent, viewport size, timezone, language, connection type | Indirect (fingerprinting risk) | Enrichment stage (`packages/pipeline/enrichment`) — geo is pluggable and returns UNKNOWN for unresolvable IPs; device fingerprint is HMAC-SHA-256 over normalized UA/IP/headers, salted via `VAP_FINGERPRINT_SALT` |
| **Session identifiers** | session ID, content ID, publisher ID | Pseudonymous | Session service |
| **Derived claims & confidence** | calibrated probability of a claim | Pseudonymous | Verification core |
| **Proofs of Attention** | signed record: session/content/verifier refs, evidence hash, confidence, timestamp | Pseudonymous (no direct IDs by design) | `packages/crypto/hsm` signing |
| **Consent records** | consent granted/withdrawn events, timestamps, policy version | Linked to subject at grant time; pseudonymised thereafter | `packages/privacy/consent` |
| **Audit & security logs** | verification decisions, RBAC authz events, correlation IDs | Operational (may include admin/operator identities) | `packages/store/verification-audit`, `apps/api` |

**No direct identifiers in evidence.** Email/phone/address/IP fields are stripped or hashed by `packages/privacy/minimisation` before persistence.

## 2. Lawful Basis (GDPR Art. 6)

| Processing | Basis | Notes |
|---|---|---|
| Attention observation & evidence collection | **Consent — Art. 6(1)(a)** | Opt-in, session-scoped, purpose-limited; withdrawal supported by `packages/privacy/consent` |
| Proof generation tied to reward fulfilment | **Contract — Art. 6(1)(b)** | Only where a reward program exists |
| Fraud detection (ratelimits, replay cache, fingerprint salt) | **Legitimate interest — Art. 6(1)(f)** | Security interest; balanced by minimisation (hashing, no raw IP retention in evidence) |
| Audit-log retention for accountability | **Legal obligation / legitimate interest** | Retention limited (see §5) |

## 3. Controls Mapped to Packages

| Principle | Control | Package / module |
|---|---|---|
| **Consent** | Grant/withdraw, per-purpose records, consent stats, singleton-with-injection factory (fresh instances per tenant/test) | `packages/privacy/consent` (`ConsentManagerImpl`, `getConsentManager`, `setConsentManager`) |
| **Minimisation** | Policy-driven field handling: STRIP / HASH actions on PII fields; default GDPR policy; first-loaded-policy semantics documented after audit fix 0a | `packages/privacy/minimisation` (`DataMinimiserImpl`) |
| **Pseudonymisation** | HMAC-SHA-256 pseudonyms with server-side salt; session IDs unlinkable to viewer identity | `packages/privacy/pseudonymisation` (`PseudonymisationServiceImpl`) |
| **Retention** | Classification-driven retention engine, legal-hold override, expiry anonymisation/archival | `packages/privacy/retention` (`RetentionPolicyEngineImpl`) |
| **Access control** | RBAC roles (Admin, Operator, Reviewer, Publisher, Consumer); API key + JWT | `packages/auth`, `apps/api/src/security` |
| **Confidentiality at rest** | Encryption-at-rest engine | `packages/security/encryption-at-rest` |
| **Transport** | TLS manager | `packages/security/tls` — ⚠ certificates are self-signed placeholders |
| **Secrets** | Secrets manager | `packages/security/secrets` — ⚠ encrypt/decrypt are currently no-ops (gap from AUDIT §4) |
| **Evidence integrity** | Sign/verify via ECDSA P-256 | `packages/crypto/hsm` (`SoftwareHSM`) |
| **Replay resistance** | Duplicate-evidence rejection | `packages/pipeline` replay cache (in-memory) |

## 4. Risk Assessment (Baseline)

| Risk | Likelihood | Impact | Mitigations | Residual risk |
|---|---|---|---|---|
| Behavioural re-identification from evidence patterns | Medium | High | Minimisation (strip/hash), pseudonymised session IDs, retention limits | **Medium** — behavioural biometrics remain identifying in principle; linkage across sessions is limited but not eliminated pending selective-disclosure/ZK work |
| Fingerprinting via device context | Medium | Medium | HMAC-salted device fingerprint, geo returns UNKNOWN when unresolvable, truncated context in evidence | **Low–Medium** |
| Unauthorised access to evidence/proofs | Medium | High | RBAC, API key/JWT, encryption at rest | **Low** |
| Consent defects (grant without understanding, withdrawal not honored) | Medium | High | Consent manager with withdrawal and audit trail | **Low–Medium** — UX clarity is untested (research assumption A2) |
| Secrets/keys exposure (host compromise) | Low–Medium | Critical | SoftwareHSM present; production KMS/HSM required | **Medium** — software-backed keys extractable; TLS/secrets stubs still open |
| Retention violations | Low | Medium | Automated retention engine with legal hold | **Low** |
| Insider abuse of stores/logs | Low | High | Append-only stores, audit log, RBAC | **Medium** — audit log lacks hash chaining/anchoring |
| Regulatory misclassification ("tracking") | Medium | High | Consent-first architecture, purpose limitation, no cross-site identifiers | **Low–Medium** |
| Function creep (evidence reused beyond verification) | Medium | High | Purpose-bound policies in code; gateway/consumer contracts | **Medium** — enforcement is contractual, not technical, for downstream consumers |

## 5. Residual Risk Summary

| # | Residual risk | Level | Owner / next step |
|---|---|---|---|
| 1 | Behavioural re-identification at scale | Medium | Research agenda (selective disclosure, on-device feature extraction) |
| 2 | Extractable software signing keys | Medium | Deploy cloud-KMS/HSM adapters against real service (S6 follow-up) |
| 3 | TLS cert & secrets stubs | Medium | Replace placeholders before any real deployment (audit item 0b residual) |
| 4 | Audit log mutable by store admin | Medium | Hash-chain / transparency anchoring (post-1.0) |
| 5 | SDK absent → consent UX untested | Medium | S16–S18 SDK work; consent-flow UX research |

## 6. Conclusion

The baseline architecture satisfies the substantive GDPR by-design obligations *at the code level*: consent, minimisation, pseudonymisation, and retention are implemented packages with tests, and evidence payloads carry no direct identifiers. The principal residual risks are not architectural but operational: placeholder TLS/secrets, software-backed signing keys, an unanchored audit log, and the absence of the client SDK that would exercise the consent UX in practice.

**Recommendation:** Accept as the S1 baseline. Do not deploy to production on this posture; resolve residual risks 2–4 and re-issue the final DPIA before launch. `dpia-final.md` remains the target format for that re-issue and is untouched by this document.

**Next review:** Before production launch, and after S16 SDK and S19 gateway land.
