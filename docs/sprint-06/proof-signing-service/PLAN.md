# COMMAND_RUNWAY: Proof Signing Service

**Feature:** proof-signing-service
**Purpose:** Sign an unsigned Proof of Attention with Ed25519 private key, emit proof event, store signed proof
**Dependencies:** verifier-key-management, implement-proof-of-attention
**Global Goals:** G5, G13
**Target Environment:** TypeScript, Express, Prisma, Vitest

---

## Execution Stages

### Stage 1: Signing Module

**Objective:** Implement signProof() that signs an UnsignedProof with Ed25519 and transitions to SIGNED state

**Preconditions:**
- [ ] `packages/verification/src/keys.ts` exists (verifier key management complete)
- [ ] `packages/core/src/proof.ts` has serializeProof, computeProofHash, signProof (core)

**Commands:**

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | — | ⏾ | `read_file packages/verification/src/index.ts` | Current exports known | Search |
| C2 | — | ⏾ | `read_file packages/core/src/proof.ts` | Core signProof + UnsignedProof understood | Search |
| C3 | C1,C2 | ✎ | `write_file packages/verification/src/signing.ts` with signProof(unsigned, privateKey): Proof, Ed25519 sign over serializeProof output, state UNSIGNED→SIGNED, issuedAt set | signing.ts created | Re-read, fix |
| C4 | C3 | ✎ | `patch packages/verification/src/index.ts` export signProof | Exports updated | Re-read, retry |
| C5 | C4 | ✓ | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 | Fix types |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L5 | `grep 'export function signProof' packages/verification/src/signing.ts` | Match found |
| L6 | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 |

**Completion:** C5 exits 0 AND L5 + L6 pass.

---

### Stage 2: Signing Tests

**Objective:** Tests for valid signing, signature format, superseded key rejection, event emission

**Preconditions:**
- [ ] Stage 1 complete (signing.ts exists)

**Commands:**

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | Stage1.C5 | ⏾ | `read_file packages/verification/src/signing.ts` | Signing logic understood | Retry Stage 1 |
| C2 | C1 | ✎ | `write_file packages/verification/tests/sign-proof.test.ts` — generates keypair, signs unsigned proof, verifies SIGNED state + non-empty signature | Tests created | Re-read signing.ts |
| C3 | C1 | ✎ | `write_file packages/verification/tests/signature-format.test.ts` — asserts signature is base64url, non-empty, correct length for Ed25519 (64 bytes) | Tests created | Re-read signing.ts |
| C4 | C1 | ✎ | `write_file packages/verification/tests/sign-event.test.ts` — asserts proof event emitted with proofId, verifierId, timestamp | Tests created | Re-read signing.ts |
| C5 | C1 | ✎ | `write_file packages/verification/tests/sign-superseded.test.ts` — asserts signing with superseded key throws KEY_SUPERSEDED | Tests created | Re-read signing.ts |
| C6 | C2-C5 | ✓ | `pnpm test --filter=@verified-attention/verification` | All pass, Exit 0 | See Failure Procedure |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L1 | `pnpm test --filter=@verified-attention/verification -- test/sign-proof` | Exit 0, "passing" |
| L2 | `pnpm test --filter=@verified-attention/verification -- test/signature-format` | Exit 0, "passing" |
| L3 | `pnpm test --filter=@verified-attention/verification -- test/sign-event` | Exit 0, "passing" |
| L4 | `pnpm test --filter=@verified-attention/verification -- test/sign-superseded` | Exit 0, "passing" |

**Completion:** C6 exits 0 AND L1-L4 pass.

---

### Stage 3: Global Verification Gate

| Cmd# | Deps | Type | Command | Expected | Fallback |
|------|------|------|---------|----------|----------|
| C1 | Stage2.C6 | ✓ | `pnpm build` | Exit 0 | Fix build |
| C2 | C1 | ✓ | `pnpm typecheck` | Exit 0 | Fix types |
| C3 | C2 | ✓ | `pnpm test` | Exit 0 | Fix tests |

**Completion:** All exit 0. Feature complete.