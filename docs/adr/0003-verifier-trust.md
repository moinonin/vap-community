# ADR-003: Verifier Identity & Trust Model

**Status:** Accepted
**Date:** 2026-07-23
**Deciders:** VAE Architecture Team, Security Engineering
**Tags:** security, identity, trust, federation, cryptography

---

## Context

The Verified Attention Protocol (VAP) requires a trust model for **Verifiers** — the entities that sign Proofs of Attention. A Proof of Attention (VAP §10) is only as trustworthy as the Verifier that signed it. The architecture must answer:

1. **Who can be a Verifier?** (Identity, authorization, onboarding)
2. **How do consumers verify a Proof?** (Signature validation, trust anchor resolution)
3. **What happens when a Verifier is compromised or rogue?** (Revocation, rotation, audit)
4. **Centralized vs. Federated?** (Single trust anchor vs. multiple independent roots)

These choices cascade into: key management (ADR-003 scope), proof verification logic, SDK trust configuration, marketplace reputation, and regulatory posture.

---

## Decision

We adopt a **hierarchical, centrally-rooted trust model with federation-ready extensions**.

### Trust Anchor

- **Root of Trust**: A single **Root CA** operated by the VAE Foundation (or designated governance body).
- **Root Key**: Ed25519, offline, HSM-backed, split custody (Shamir Secret Sharing, threshold 3-of-5).
- **Root Certificate**: Self-signed, 10-year validity, distributed via:
  - Embedded in SDKs at build time (pinned)
  - Published at `https://trust.vae.dev/root.pem` (HTTPS + HPKP)
  - Included in conformance test fixtures

### Verifier Identity

- **Verifier ID**: `urn:vap:verifier:<uuid>` (stable, opaque)
- **Verifier Certificate**: X.509 v3 (minimal profile) issued by Root CA or Intermediate CA
  - Subject: `CN=<Verifier ID>`
  - Extensions: `keyUsage=digitalSignature`, `extendedKeyUsage=1.3.6.1.4.1.XXXXX.1` (VAE Proof Signing)
  - Validity: 90 days (short-lived, forces rotation)
  - CT Log: All certificates logged to public CT (transparency)

### Key Hierarchy

```
Root CA (offline, Ed25519)
    │
    ├── Intermediate CA: "VAE Production" (online, Ed25519, 1-year validity)
    │   │
    │   ├── Verifier: "vae-mainnet-001" (90-day cert)
    │   ├── Verifier: "vae-mainnet-002" (90-day cert)
    │   └── ...
    │
    ├── Intermediate CA: "VAE Staging" (online, Ed25519, 1-year validity)
    │   └── Verifier: "vae-staging-001" ...
    │
    └── Intermediate CA: "Partner: <Org>" (online, Ed25519, 1-year validity)
        └── Verifier: "partner-org-verifier-001" ...
```

### Verifier Onboarding

1. **Application**: Entity submits legal identity, operational plan, security posture.
2. **Review**: VAE Foundation Security Committee evaluates (KYC, infra audit, key management).
3. **Approval**: Signed attestation → Intermediate CA issues Verifier certificate.
4. **Deployment**: Verifier receives cert + private key (HSM-generated, never exported).
5. **Monitoring**: Continuous attestation (SPIFFE/SPIRE), audit log to transparency log.

### Proof Verification (Consumer Side)

1. **SDK/App** has Root CA certificate pinned (or fetches from trust store with pinning).
2. **Verify Proof**:
   - Parse Proof → extract `verifierId`, `signature`, 7 mandatory fields.
   - Build trust chain: `Verifier Cert → Intermediate CA → Root CA`.
   - Validate chain: signatures, validity periods, key usage, name constraints.
   - Verify `signature` over canonical Proof hash using Verifier public key.
   - Check Proof state = `PUBLISHED`, not expired, not revoked.
3. **Result**: `valid: true` only if all checks pass.

### Revocation & Rotation

| Event | Action |
|-------|--------|
| Key rotation (90-day expiry) | Automatic: Intermediate CA issues new cert; old cert expires naturally |
| Verifier compromise | Emergency: Root CA publishes CRL/OCSP entry; SDKs fetch within 5 min (cached) |
| Verifier misbehavior | Governance: Foundation revokes cert, adds to CRL, notifies consumers |
| Root CA compromise | Catastrophic: Emergency ceremony, new Root, migration plan (see below) |

### Migration Path to Federation

The hierarchy is **designed for future federation**:

- **Partner Intermediate CAs** can be operated by external organizations (news consortium, ad-tech alliance, regulatory body).
- **Cross-signing**: Partner Intermediate CA can be cross-signed by VAE Root *and* Partner's own Root.
- **Trust Store Evolution**: SDKs will support multiple Root CAs (configurable trust anchors) with policy: `require 1-of-N` or `require all-of-N`.
- **W3C VC Alignment**: Verifier certificates map to W3C Verifiable Credential issuers; future ZK-disclosure uses same identity layer.

---

## Consequences

### Positive

- **Clear accountability**: Every Proof traces to a known, audited Verifier.
- **Operational simplicity**: Single root for MVP; 90-day certs force hygiene.
- **Regulatory readiness**: CT logs, short-lived certs, HSM keys satisfy eIDAS, WebTrust.
- **Federation-ready**: Hierarchy explicitly accommodates partner CAs without redesign.
- **SDK trust**: Pinning Root CA at build time prevents supply-chain attacks.

### Negative

- **Centralization risk**: Root CA is single point of failure (mitigated by HSM, split custody, 10-year validity).
- **Operational burden**: Certificate issuance pipeline needed (automation via ACME-like protocol).
- **Revocation latency**: CRL/OCSP adds network dependency (mitigated by short cert lifetime + staple).

### Mitigations

- Root CA key ceremony documented, rehearsed quarterly.
- Automated issuance via `cert-manager` + custom ACME server.
- OCSP stapling on Verifier TLS endpoints; SDKs cache CRL for 1 hour.
- Runbook for Root CA compromise (Appendix A).

---

## Alternatives Considered

| Option | Rejected Because |
|--------|------------------|
| **Pure centralized (single Verifier)** | No redundancy, no partner adoption blocked, regulatory concern |
| **Pure decentralized (Web of Trust / blockchain)** | No accountability, Sybil resistance hard, UX complexity, regulatory grey zone |
| **Self-signed Verifier keys + TOFU** | No revocation, no audit trail, first-use attack surface |
| **DID-based (did:web, did:key)** | DID resolution adds latency/dependency; overkill for MVP; align later |

---

## Related Decisions

- ADR-001: Language & Framework Selection (TS/Python hybrid)
- ADR-002: Model Serving Architecture
- **Sprint 6**: Proof Generation & Cryptographic Signing (implements this ADR)

---

## Appendix A: Root CA Compromise Runbook

1. **Detect**: Anomalous certificates in CT logs, HSM audit alert, external report.
2. **Contain**: Revoke Intermediate CA certs via CRL; rotate all Verifier keys.
3. **Assess**: Determine scope (which Verifiers, time window).
4. **Ceremony**: Convene 3-of-5 key holders; generate new Root keypair in HSM.
5. **Publish**: New Root cert to `https://trust.vae.dev/root-v2.pem`; pin in next SDK release.
6. **Migrate**: Issue new Intermediate CA certs from new Root; re-issue all Verifier certs.
7. **Communicate**: Security advisory, migration timeline (30 days), support channel.
8. **Verify**: Conformance tests updated; all Proofs from old Root rejected after cutoff.

---

## Appendix B: Certificate Profile (Minimal)

```
Version: 3
Serial Number: <random 16 bytes>
Signature Algorithm: ed25519
Issuer: CN=VAE Root CA
Validity: Not Before: <now>; Not After: <now + 90 days>
Subject: CN=urn:vap:verifier:550e8400-e29b-41d4-a716-446655440000
Subject Public Key Info: Ed25519
Extensions:
  - Authority Key Identifier: <Root CA SKI>
  - Subject Key Identifier: <Verifier SKI>
  - Key Usage: Digital Signature (critical)
  - Extended Key Usage: 1.3.6.1.4.1.XXXXX.1 (VAE Proof Signing)
  - Basic Constraints: CA:FALSE (critical)
  - Certificate Policies: 2.23.140.1.2.1 (EV equivalent)
  - CRL Distribution Points: https://crl.vae.dev/vae-root.crl
  - Authority Information Access: OCSP: https://ocsp.vae.dev
```