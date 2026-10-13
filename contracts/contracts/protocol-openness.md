# Protocol Openness & Conformance Specification (S11 — Open VAP + Independent Conformance)

**Status**: Draft / Proposed  
**Sprint**: S11 (Moat: Genuinely open protocol + conformance suite)  
**Related**: `docs/specs/0001-verified-attention-protocol.md`, `contracts/contract-tests/provider-verify.js`

---

## Purpose

Ensure the Verified Attention Protocol (VAP) is **genuinely open** — anyone can implement a verifier, and the conformance suite runs independently of VAE internals. Per improvement feedback: "Make VAP define how attention evidence and proofs are represented, and anyone can implement a verifier."

---

## Openness Principles

| Principle | Implementation |
|-----------|----------------|
| **CC0 Specification** | `docs/specs/0001-verified-attention-protocol.md` released under CC0 (public domain) |
| **No Vendor Lock-in** | Protocol uses only open standards (JSON, JWS, ISO 8601, UUID, SHA-256) |
| **Independent Verification** | Consumer verifies proofs without VAE API access |
| **Conformance Suite** | Contract tests validate any implementation against VAP |

---

## VAP Specification Scope (CC0)

The normative specification defines:

### 1. Evidence Representation
```json
{
  "evidenceId": "uuid-v4",
  "sessionId": "uuid-v4",
  "sourceId": "string",
  "timestamp": "ISO 8601",
  "schemaVersion": "integer",
  "signals": { "/* standardized signal categories */" },
  "integrityHash": "sha256-hex",
  "validatorId": "string",
  "validatedAt": "ISO 8601"
}
```

### 2. Claim Representation
```json
{
  "claimId": "uuid-v4",
  "sessionId": "uuid-v4",
  "claimType": "human_attended_content",
  "confidence": "0.0-1.0",
  "evidenceClasses": ["E-INTERACTION", "E-VISIBLE"],
  "policyId": "string",
  "modelVersion": "string"
}
```

### 3. Proof of Attention (PoA) Representation
```json
{
  "proofId": "uuid-v4",
  "claimId": "uuid-v4",
  "verifierId": "string",
  "issuedAt": "ISO 8601",
  "expiresAt": "ISO 8601",
  "signature": "JWS detached signature",
  "payload": "{claim, confidence, evidenceClasses, policyId, modelVersion}",
  "publicKey": "JWK / X.509 reference"
}
```

### 4. Verification Algorithm (Normative)
1. Parse PoA payload
2. Verify JWS signature against verifier's public key
3. Check `expiresAt` > now
4. Verify `verifierId` matches certificate subject
5. Return `valid: boolean`

**Critical**: Consumer verification requires **zero VAE API calls** — only public keys and PoA.

---

## Conformance Test Suite (Independent)

Located at: `contracts/contract-tests/`

### Test Structure
```
contracts/contract-tests/
├── provider-verify.js        # Core VAP conformance (runs independently)
├── integration-cicd.js       # End-to-end integration
├── load-verify.js            # Load testing
├── load-reconcile.js         # Settlement reconciliation
└── contract-test.js          # Base contract validation
```

### provider-verify.js (Core Conformance)

**Runs independently** — no VAE imports, no internal APIs.

```javascript
// contracts/contract-tests/provider-verify.js
const VAP_SPEC_VERSION = '1.0';
const REQUIRED_EVIDENCE_FIELDS = [
  'evidenceId', 'sessionId', 'sourceId', 'timestamp',
  'schemaVersion', 'signals', 'integrityHash', 'validatorId', 'validatedAt'
];
const REQUIRED_POA_FIELDS = [
  'proofId', 'claimId', 'verifierId', 'issuedAt', 'expiresAt',
  'signature', 'payload', 'publicKey'
];

// Test: Evidence structure compliance
function testEvidenceStructure(evidence) { ... }

// Test: PoA structure compliance  
function testPoAStructure(poa) { ... }

// Test: Independent verification
function testIndependentVerification(poa, publicKey) { ... }

// Test: Schema version handling
function testSchemaVersioning(evidence) { ... }
```

**Execution**: `node contracts/contract-tests/provider-verify.js` — zero dependencies on VAE packages.

### Conformance Levels

| Level | Requirements |
|-------|--------------|
| **VAP-Core** | Evidence + Claim + PoA structure + independent verification |
| **VAP-Extended** | Core + policy evaluation + confidence calibration |
| **VAP-Full** | Extended + fraud detection + reward intelligence |

---

## Reference Implementation (VAE) vs. Protocol

| Component | VAP (Protocol) | VAE (Reference) |
|-----------|----------------|-----------------|
| Evidence schema | ✅ Normative | ✅ Implements |
| Claim schema | ✅ Normative | ✅ Implements |
| PoA schema | ✅ Normative | ✅ Implements |
| Verification algorithm | ✅ Normative | ✅ Implements |
| Confidence calibration | 📋 Advisory | ✅ Implements |
| Fraud detection | 📋 Advisory | ✅ Implements |
| Reward settlement | 📋 Advisory | ✅ Implements |
| Policy engine | 📋 Advisory | ✅ Implements |

**Key distinction**: VAP defines **what** (schemas, algorithms); VAE provides **how** (implementation, calibration, ML models).

---

## Running Conformance Tests

```bash
# Core conformance (independent - no VAE needed)
node contracts/contract-tests/provider-verify.js

# Full contract suite (requires VAE running)
make test

# CI integration
npm run test:conformance  # alias for provider-verify.js
```

**Independence verified**: `provider-verify.js` imports only Node.js built-ins (`crypto`, `fs`, `path`). No `packages/*`, no `apps/*`.

---

## Interoperability Requirements

For a third-party verifier to be VAP-compliant:

1. **Evidence Ingestion**: Accept VAP-standard evidence format
2. **Claim Generation**: Produce VAP-standard claims with calibrated confidence
3. **PoA Issuance**: Issue JWS-signed PoAs with required fields
3. **Public Key Publication**: Publish verification keys at well-known endpoint
4. **Conformance Pass**: All `provider-verify.js` tests pass

---

## Contract Test: Protocol Openness

```typescript
// contracts/contracts/protocol-openness.ts
export const protocolOpennessContract = {
  // Specification
  specLicense: 'CC0',
  specLocation: 'docs/specs/0001-verified-attention-protocol.md',
  specVersion: '1.0',

  // Open standards only
  allowedStandards: [
    'JSON (RFC 8259)',
    'JWS (RFC 7515)',
    'JWK (RFC 7517)',
    'ISO 8601',
    'UUID (RFC 4122)',
    'SHA-256 (FIPS 180-4)',
    'X.509 (RFC 5280)'
  ],
  prohibitedDependencies: [
    'proprietary VAE packages',
    'internal APIs',
    'vendor-specific extensions'
  ],

  // Conformance suite
  conformanceSuite: {
    location: 'contracts/contract-tests/',
    entryPoint: 'provider-verify.js',
    independentExecution: true,
    zeroVAEDependencies: true
  },

  // Verification independence
  verification: {
    consumerSide: true,
    requiresVAEAPI: false,
    requiredInputs: ['PoA', 'verifierPublicKey'],
    algorithm: 'JWS verification + expiry + key match'
  }
};
```

---

## Deliverables (S11)

1. `docs/specs/0001-verified-attention-protocol.md` — CC0 normative spec (updated)
2. `contracts/contracts/protocol-openness.md` — This specification
3. `contracts/contracts/protocol-openness.ts` — Machine-readable contract
4. `contracts/contract-tests/provider-verify.js` — Independent conformance (verified)
5. Documentation update: `README.md` references protocol openness

---

## Success Criteria

- [ ] `docs/specs/0001-verified-attention-protocol.md` released under CC0
- [ ] Protocol uses only open standards (verified: no proprietary deps)
- [ ] `provider-verify.js` runs with zero VAE imports (verified)
- [ ] Any third-party can implement verifier from spec alone
- [ ] Consumer verification requires only PoA + public key (no VAE API)
- [ ] Conformance suite documents VAP-Core / VAP-Extended / VAP-Full levels
- [ ] Documentation updated in `README.md` and `docs/specs/`