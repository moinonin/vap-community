# Specification: Commercial Customer Console & Developer Portal
## Verified Attention Protocol (VAP) — Commercial Management Layer

**Document ID:** SPEC-0020  
**Version:** 1.0.0-draft  
**Status:** Approved for Implementation  
**Target Delivery:** Sprint 19 / 20 & Phase 5 Integration  
**Owner:** Karakana Labs  

---

## 1. Executive Summary & Purpose

The Verified Attention Protocol (VAP) specifies the open cryptographic rules for attention verification. However, commercial monetization requires a software interface where enterprise customers, publishers, compliance officers, and developers manage accounts, configure verification policies, query auditable proofs, and monitor metered billing.

This specification defines the **Commercial Customer Console (`apps/portal/console`)**, integrating into the portal application to convert the open protocol into a monetizable software-as-a-service (SaaS) and clearinghouse platform.

---

## 2. Core Modules & Technical Requirements

The console comprises four operational subsystems:

### Module 1: API Key & Organization Management
- **Purpose:** Secure identity provisioning and metered API consumption.
- **Features:**
  - Self-serve generation and revocation of scoped API Keys (`vae_live_...`, `vae_test_...`).
  - Webhook URL management for automated proof pushes (`proof.issued`, `proof.revoked`).
  - Metered usage counter: live volume of verified sessions, billable proofs, and rate-limit allocations.
- **Data Model:**
  ```typescript
  interface ApiKeyRecord {
    keyId: string;
    prefix: string;          // e.g. "vae_live_9f8a..."
    name: string;            // e.g. "Production Ads Gateway"
    createdAt: string;
    lastUsedAt?: string;
    scopes: Array<'sessions:write' | 'evidence:write' | 'proofs:read' | 'policies:manage'>;
    rateLimitPerMin: number;
    state: 'ACTIVE' | 'REVOKED';
  }
  ```

### Module 2: Policy Studio (Visual Policy Builder)
- **Purpose:** Zero-code creation and management of verification thresholds consumed by `/v1/policies`.
- **Features:**
  - Configure target parameters:
    - Minimum cognitive dwell time ($T_{\text{dwell}}$, e.g. $15\,\text{s}$ to $60\,\text{s}$).
    - Minimum calibrated confidence score threshold ($p_{\text{min}} \in [0.50, 0.99]$).
    - Required evidence checklist (`E-INTERACTION`, `E-VISIBLE`, `E-DURATION`, `E-CONTEXT`).
  - Interactive preview comparing against preset profiles:
    - **Ad Verification Profile:** High throughput, 10s dwell, fraud tolerance < 5%.
    - **Corporate Compliance Profile:** Zero window blur, 45s dwell, 90%+ confidence.
    - **Academic / E-Learning Profile:** Reading velocity curve validation.

### Module 3: Proof Audit Explorer & Compliance Export
- **Purpose:** Real-time query engine and legal evidence archive.
- **Features:**
  - Filter and inspect historical Proofs of Attention by `sessionId`, `contentId`, date range, or `state` (`PUBLISHED`, `REVOKED`, `EXPIRED`).
  - Raw cryptographic verification inspection: displaying canonical payload, SHA-256 evidence hash, and Ed25519 signature.
  - One-click export for regulatory audits: download verified session batch receipts with cryptographic verifier signatures in CSV/JSON format.

### Module 4: Settlement Ledger & Billing Overview
- **Purpose:** Commercial clearinghouse and usage-based invoice reporting.
- **Features:**
  - Metered billing tier calculator (e.g., $100 base + \$0.002 per verified proof).
  - Campaign budget reconciliation for advertisers and publishers:
    - Verified Impressions Delivered
    - Bot Traffic Filtered & Prevented Waste ($ Saved)
    - Net Payouts Cleared

---

## 3. UI/UX Architecture (`apps/portal`)

The console is accessible directly within `apps/portal` under the unified header navigation:
- Public Protocol / Whitepaper View: `http://localhost:4000/`
- Commercial Customer Console View: `http://localhost:4000/#console`

### Tab Hierarchy:
1. **Overview & Usage Metrics**
2. **API Keys & Webhooks**
3. **Policy Studio**
4. **Proof Audit Explorer**
5. **Billing & Settlement**

---

## 4. Acceptance Criteria & Verifications

1. **Self-Contained Deployment:** Console renders in `apps/portal` without requiring external database dependencies.
2. **Safe API Integration:** Consumes existing `/v1/policies` and `/v1/proofs` endpoints, maintaining fallback mock data when the Docker backend is offline.
3. **Auditability:** Proof records allow instant copy of the Ed25519 signature and verification payload.
4. **Codebase Cleanliness:** Zero alterations to Python primitives or active agent working files.
