# COMMAND_RUNWAY: Proof Verification

**Feature:** proof-verification
**Purpose:** Independently verify a Proof of Attention's Ed25519 signature and hash without the verifier's private key
**Dependencies:** proof-signing-service, implement-proof-of-attention
**Global Goals:** G5, G13
**Target Environment:** TypeScript, Express, Prisma, Vitest

---

## Execution Stages

### Stage 1: Verification Module

**Objective:** Implement verifyProofSignature(), verifyProofHash(), and verifyProof() in packages/verification/src/verify.ts

**Preconditions:**
- [ ] proof-signing-service complete (signing.ts exists with signProof)
- [ ] Core proof.ts has computeProofHash, serializeProof, ProofState

**Commands:**

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | — | ⏾ | `read_file packages/verification/src/signing.ts` | Signing logic understood | signing not done |
| C2 | — | ⏾ | `read_file packages/core/src/proof.ts` | computeProofHash, ProofState understood | Search |
| C3 | — | ⏾ | `read_file packages/verification/src/index.ts` | Current exports known | Search |
| C4 | C1-C3 | ✎ | `write_file packages/verification/src/verify.ts` with verifyProofSignature(proof, publicKey): boolean, verifyProofHash(proof): boolean, verifyProof(proof): ProofValidationResult | verify.ts created | Re-read, fix |
| C5 | C4 | ✎ | `patch packages/verification/src/index.ts` export verifyProof, verifyProofSignature, verifyProofHash | Exports updated | Re-read, retry |
| C6 | C5 | ✓ | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 | Fix types |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L6 | `grep 'export function verifyProof' packages/verification/src/verify.ts` | Match |
| L7 | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 |

**Completion:** C6 exits 0 AND L6 + L7 pass.

---

### Stage 2: Verification Tests

**Objective:** Tests for valid signature, invalid signature, hash verification, full proof verification, invalid state

**Preconditions:**
- [ ] Stage 1 complete (verify.ts exists)

**Commands:**

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | Stage1.C6 | ⏾ | `read_file packages/verification/src/verify.ts` | Verification logic understood | Retry Stage 1 |
| C2 | C1 | ✎ | `write_file packages/verification/tests/verify-signature-valid.test.ts` | Valid signature test | Re-read |
| C3 | C1 | ✎ | `write_file packages/verification/tests/verify-signature-invalid.test.ts` | Tampered proof / mismatched key test | Re-read |
| C4 | C1 | ✎ | `write_file packages/verification/tests/verify-hash.test.ts` | Hash recompute test | Re-read |
| C5 | C1 | ✎ | `write_file packages/verification/tests/verify-proof-full.test.ts` | Full proof verification (SIGNED + PUBLISHED) test | Re-read |
| C6 | C1 | ✎ | `write_file packages/verification/tests/verify-proof-invalid-state.test.ts` | Revoked/expired proof → valid=false test | Re-read |
| C7 | C2-C6 | ✓ | `pnpm test --filter=@verified-attention/verification` | All pass, Exit 0 | See Failure Procedure |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L1 | (covered by C7) | Exit 0, "passing" |
| L2 | (covered by C7) | Exit 0, "passing" |
| L3 | (covered by C7) | Exit 0, "passing" |
| L4 | (covered by C7) | Exit 0, "passing" |
| L5 | (covered by C7) | Exit 0, "passing" |

**Completion:** C7 exits 0 AND L1-L5 pass.

---

### Stage 3: Global Verification Gate

| Cmd# | Deps | Type | Command | Expected | Fallback |
|------|------|------|---------|----------|----------|
| C1 | Stage2.C7 | ✓ | `pnpm build` | Exit 0 | Fix build |
| C2 | C1 | ✓ | `pnpm typecheck` | Exit 0 | Fix types |
| C3 | C2 | ✓ | `pnpm test` | Exit 0 | Fix tests |

**Completion:** All exit 0. Feature complete.