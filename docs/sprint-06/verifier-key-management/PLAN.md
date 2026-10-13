# COMMAND_RUNWAY: Verifier Key Management

**Feature:** verifier-key-management
**Purpose:** Ed25519 verifier key generation, rotation, HSM interface stub, and audit logging
**Dependencies:** implement-proof-of-attention
**Global Goals:** G5 (Session lifecycle state machine), G13 (Public REST + Streaming APIs with OpenAPI 3.1)
**Target Environment:** TypeScript, Express, Prisma, Vitest

---

## Execution Stages

---

### Stage 1: Key Generation and Export

**Objective:** Implement Ed25519 key pair generation with base64url export in the verification package

**Preconditions:**
- [ ] packages/verification exists with tsdown and vitest configured
- [ ] Node.js crypto module available (built-in)

**Commands:**

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | — | ⏾ | `read_file packages/verification/src/index.ts` | Current exports understood | Search for file, log finding |
| C2 | — | ⏾ | `read_file packages/verification/package.json` | Dependencies known (check for @noble/ed25519 or crypto) | Search for file |
| C3 | C1,C2 | ⏾ | `search_files pattern="ed25519\|Ed25519\|keypair" path=packages/verification` | Existing key-related code found | Note if none |
| C4 | C3 | ✎ | `write_file packages/verification/src/keys.ts` with Ed25519 key generation (generateKeyPair), export (exportPublicKey base64url), and key types | Key management module created | Re-read, fix syntax |
| C5 | C4 | ✎ | `patch packages/verification/src/index.ts` to export key functions and types | Exports updated | Re-read index.ts, retry |
| C6 | C5 | ✓ | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 | Fix type errors |
| C7 | C5 | ✎ | `write_file packages/verification/tests/key-generation.test.ts` with Vitest tests: generates keypair, exports public key as base64url, private key remains internal | Key generation tests created | Re-read keys.ts, fix test assumptions |
| C8 | C4 | ✎ | `write_file packages/verification/tests/key-export.test.ts` with tests: public key length, format, determinism | Key export tests created | Re-read keys.ts, fix test assumptions |
| C9 | C7,C8 | ✓ | `pnpm test --filter=@verified-attention/verification` | All tests pass, exit 0 | See Failure Procedure |

**Expected Outputs:**
- **Files:** `packages/verification/src/keys.ts`, updated `packages/verification/src/index.ts`, `packages/verification/tests/key-generation.test.ts`, `packages/verification/tests/key-export.test.ts`

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L1: Key generation tests | `pnpm test --filter=@verified-attention/verification --testPathPattern=key-generation` | Exit 0, stdout contains "passing" |
| L2: Key export tests | `pnpm test --filter=@verified-attention/verification --testPathPattern=key-export` | Exit 0, stdout contains "passing" |

**Completion Condition:** C9 exits 0 AND L1 + L2 verification checks pass.

---

### Stage 2: Key Rotation

**Objective:** Implement key rotation that creates a new active key and marks the previous as superseded

**Preconditions:**
- [ ] Stage 1 complete (generateKeyPair and exportPublicKey exist)

**Commands:**

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | Stage1.C9 | ⏾ | `read_file packages/verification/src/keys.ts` | Key module understood | Stage 1 failed, retry |
| C2 | C1 | ✎ | `patch packages/verification/src/keys.ts` to add rotateKey() function: generates new keypair, marks old as superseded with supersededAt timestamp, returns new active key | Rotation logic added | Re-read keys.ts, retry |
| C3 | C2 | ✎ | `write_file packages/verification/tests/key-rotation.test.ts` with tests: rotation creates new key, old key is superseded, supersededAt set, old key still validatable but not signable | Rotation tests created | Re-read keys.ts, fix assumptions |
| C4 | C3 | ✓ | `pnpm test --filter=@verified-attention/verification --testPathPattern=key-rotation` | Exit 0, all pass | See Failure Procedure |

**Expected Outputs:**
- **Files:** Updated `packages/verification/src/keys.ts`, `packages/verification/tests/key-rotation.test.ts`

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L3: Key rotation tests | `pnpm test --filter=@verified-attention/verification --testPathPattern=key-rotation` | Exit 0, stdout contains "passing" |

**Completion Condition:** C4 exits 0 AND L3 verification check passes.

---

### Stage 3: HSM Interface Stub and Audit Logging

**Objective:** Define HSM interface stub and implement audit logging for all key operations

**Preconditions:**
- [ ] Stage 1 complete (key types defined)

**Commands:**

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | Stage1.C6 | ⏾ | `read_file packages/verification/src/keys.ts` | Key types understood | Stage 1 failed, retry |
| C2 | C1 | ✎ | `write_file packages/verification/src/hsm.ts` with HSM interface stub (sign, verify, getPublicKey) that throws NOT_IMPLEMENTED | HSM stub created | Re-read, fix syntax |
| C3 | C1 | ✎ | `write_file packages/verification/src/audit.ts` with audit log function logKeyOperation(operation, keyId, metadata) that records actor, timestamp, action type, affected resource | Audit logging created | Re-read, fix syntax |
| C4 | C2,C3 | ✎ | `patch packages/verification/src/index.ts` to export HSM interface and audit functions | Exports updated | Re-read index.ts, retry |
| C5 | C2 | ✎ | `write_file packages/verification/tests/hsm-stub.test.ts` with tests: sign() throws NOT_IMPLEMENTED, verify() throws NOT_IMPLEMENTED, getPublicKey() throws NOT_IMPLEMENTED | HSM stub tests created | Re-read hsm.ts, fix assumptions |
| C6 | C3 | ✎ | `write_file packages/verification/tests/audit.test.ts` with tests: logKeyOperation creates entry with correct fields, entries are immutable, entries are searchable | Audit tests created | Re-read audit.ts, fix assumptions |
| C7 | C4,C5,C6 | ✓ | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 | Fix type errors |
| C8 | C5,C6 | ✓ | `pnpm test --filter=@verified-attention/verification` | All tests pass, exit 0 | See Failure Procedure |

**Expected Outputs:**
- **Files:** `packages/verification/src/hsm.ts`, `packages/verification/src/audit.ts`, `packages/verification/tests/hsm-stub.test.ts`, `packages/verification/tests/audit.test.ts`, updated `packages/verification/src/index.ts`

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| L4: HSM stub tests | `pnpm test --filter=@verified-attention/verification --testPathPattern=hsm-stub` | Exit 0, stdout contains "passing" |
| L5: Audit log function exists | `grep 'logKeyOperation' packages/verification/src/audit.ts` | At least one match |
| L6: Typecheck passes | `pnpm typecheck --filter=@verified-attention/verification` | Exit 0 |

**Completion Condition:** C8 exits 0 AND L4 + L5 + L6 verification checks pass.

---

### Stage 4: Global Verification Gate

**Objective:** Full project verification

**Preconditions:**
- [ ] Stages 1-3 complete

**Commands:**

| Cmd# | Deps | Type | Command / Tool Invocation | Expected Artifact / Δ | Fallback if Fail |
|------|------|------|---------------------------|------------------------|------------------|
| C1 | Stage1.C9, Stage2.C4, Stage3.C8 | ✓ | `pnpm build` | All packages build, Exit 0 | Fix build errors per package |
| C2 | C1 | ✓ | `pnpm typecheck` | No TypeScript errors, Exit 0 | Fix type errors |
| C3 | C2 | ✓ | `pnpm lint` | No lint errors (warnings OK), Exit 0 | Fix lint errors |
| C4 | C3 | ✓ | `pnpm test` | All tests pass, Exit 0 | Fix failing tests |
| C5 | C4 | ✓ | `pnpm test:conformance` | All conformance suites pass, Exit 0 | Fix conformance failures |

**Local Verification:**

| Check | Command | Expected |
|-------|---------|----------|
| Build | `pnpm build` | Exit 0 |
| Typecheck | `pnpm typecheck` | Exit 0 |
| Lint | `pnpm lint` | Exit 0 |
| Test | `pnpm test` | Exit 0 |
| Conformance | `pnpm test:conformance` | Exit 0 |

**Completion Condition:** All C1-C5 exit 0. Feature complete.