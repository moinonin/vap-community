# COMMAND_RUNWAY -- sprint-7-pipeline-production-hardening

**Target**: Harden evidence processing pipeline for production throughput, reliability, observability
**Specification**: `docs/specs/0001-verified-attention-protocol.md` (VAP), `docs/specs/0000-project-charter.md` (Charter), `docs/specs/0010-verified-attention-engine.md` (VAE)
**Sprint Plan**: `SPRINTS.md` (21 sprints across 5 phases to VAE 1.0)
**Monorepo**: TypeScript/Node.js (pnpm + Turborepo), packages: `core`, `pipeline`, `store`, `verification`, `crypto`, `ml/attention`, `ml/fraud`, `sdk/browser`, `sdk/mobile`, `sdk/desktop`, `extension`, `api`, `verifier`, `reward`, `analytics`, `cli`

---

# Feature

Name: sprint-7-pipeline-production-hardening
Purpose: Harden evidence processing pipeline for production throughput, reliability, observability
Reference Specification: `docs/specs/0001-verified-attention-protocol.md`, `docs/specs/0000-project-charter.md`, `docs/specs/0010-verified-attention-engine.md`
Expected Deliverables: CREATE: Deduplication pipeline stage (content-hash, CREATE: Feature extraction pipeline stage in packa, CREATE: Evidence enrichment (context, device trust, CREATE: Pipeline observability metrics (latency, t, CREATE: Pipeline distributed tracing (OpenTelemetr, CREATE: Dead letter queue for failed evidence with, VERIFY: Load test - 10K evidence/sec sustained 1 h, VERIFY: Chaos test - Kill pipeline nodes, verify n
Dependencies: sprint-6-proof-generation-cryptographic-signing
Assumptions: Node.js >= 20, pnpm >= 9, Turborepo configured, Prisma ORM, Vitest test framework

---

# Global Success Criteria
- **G3**: Evidence pipeline: ingestion -> validation -> normalization -> dedup -> feature extraction -> store -- `pnpm test:integration --filter=@verified-attention/pipeline` passes
- **G16**: Observability: Prometheus metrics, Grafana dashboards, OpenTelemetry tracing, alerting -- Dashboards render, alerts fire
- **G17**: Load test: 10K evidence/sec sustained 1hr (p99 < 500ms), 10K proofs/min (p99 < 1s) -- `tests/load/` pass
- **G18**: Chaos test: pipeline node kill -> recovery < 30s, zero evidence loss -- `tests/chaos/` pass


---

# Target Environment

Language: TypeScript
Framework: Node.js
ORM: Prisma
Test Framework: Vitest

---

# Execution Stages

## Stage 1: Deduplication pipeline stage (content-hash + session) in packages/pipeline/dedup/

### Objective
CREATE: Deduplication pipeline stage (content-hash + session) in packages/pipeline/dedup/

### Inputs
- VAP Spec Sections (see per-sprint SPRINTS.md)
- SPRINTS.md Sprint hardening tasks
- Dependencies: sprint-6-proof-generation-cryptographic-signing

### Preconditions
- Stage 1 verified complete (if 1 > 1)
- Node.js >= 20, pnpm >= 9 installed
- Git repo initialized

### Discovery Tasks
- [ ] Inspect project structure
- [ ] Inspect existing APIs
- [ ] Inspect interfaces
- [ ] Inspect tests
- [ ] Inspect configuration
- [ ] Inspect dependencies

### Execution Tasks
1. **CREATE**: CREATE: Deduplication pipeline stage (content-hash + session) in packages/pipeline/dedup/
   - Write implementation
   - Write tests
   - Export from index


### Suggested Commands
```bash
# 1. Inspect existing structure
cat packages/core/src/index.ts

# 2. Create/Modify implementation
cat > packages/core/src/L1.ts << 'EOF'
// Implementation here
EOF

# 3. Run verification
pnpm build --filter=@verified-attention/core && pnpm test --filter=@verified-attention/core
```

### Expected Outputs
- Implementation file(s)
- Test file(s) (>=80% coverage)
- Exports added to index.ts
- Documentation updated

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| L1 | `L1` | exit 0 |
## Stage 2: Feature extraction pipeline stage in packages/pipeline/features/

### Objective
CREATE: Feature extraction pipeline stage in packages/pipeline/features/

### Inputs
- VAP Spec Sections (see per-sprint SPRINTS.md)
- SPRINTS.md Sprint hardening tasks
- Dependencies: sprint-6-proof-generation-cryptographic-signing

### Preconditions
- Stage 2 verified complete (if 2 > 1)
- Node.js >= 20, pnpm >= 9 installed
- Git repo initialized

### Discovery Tasks
- [ ] Inspect project structure
- [ ] Inspect existing APIs
- [ ] Inspect interfaces
- [ ] Inspect tests
- [ ] Inspect configuration
- [ ] Inspect dependencies

### Execution Tasks
1. **CREATE**: CREATE: Feature extraction pipeline stage in packages/pipeline/features/
   - Write implementation
   - Write tests
   - Export from index


### Suggested Commands
```bash
# 1. Inspect existing structure
cat packages/core/src/index.ts

# 2. Create/Modify implementation
cat > packages/core/src/L2.ts << 'EOF'
// Implementation here
EOF

# 3. Run verification
pnpm build --filter=@verified-attention/core && pnpm test --filter=@verified-attention/core
```

### Expected Outputs
- Implementation file(s)
- Test file(s) (>=80% coverage)
- Exports added to index.ts
- Documentation updated

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| L2 | `L2` | exit 0 |
## Stage 3: Evidence enrichment (context, device trust, source reliability) in packages/pipeline/enrichment/

### Objective
CREATE: Evidence enrichment (context, device trust, source reliability) in packages/pipeline/enrichment/

### Inputs
- VAP Spec Sections (see per-sprint SPRINTS.md)
- SPRINTS.md Sprint hardening tasks
- Dependencies: sprint-6-proof-generation-cryptographic-signing

### Preconditions
- Stage 3 verified complete (if 3 > 1)
- Node.js >= 20, pnpm >= 9 installed
- Git repo initialized

### Discovery Tasks
- [ ] Inspect project structure
- [ ] Inspect existing APIs
- [ ] Inspect interfaces
- [ ] Inspect tests
- [ ] Inspect configuration
- [ ] Inspect dependencies

### Execution Tasks
1. **CREATE**: CREATE: Evidence enrichment (context, device trust, source reliability) in packages/pipeline/enrichment/
   - Write implementation
   - Write tests
   - Export from index


### Suggested Commands
```bash
# 1. Inspect existing structure
cat packages/core/src/index.ts

# 2. Create/Modify implementation
cat > packages/core/src/L3.ts << 'EOF'
// Implementation here
EOF

# 3. Run verification
pnpm build --filter=@verified-attention/core && pnpm test --filter=@verified-attention/core
```

### Expected Outputs
- Implementation file(s)
- Test file(s) (>=80% coverage)
- Exports added to index.ts
- Documentation updated

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| L3 | `L3` | exit 0 |
## Stage 4: Pipeline observability metrics (latency, throughput, error rates, backlog) in packages/observability/pipeline-metrics/

### Objective
CREATE: Pipeline observability metrics (latency, throughput, error rates, backlog) in packages/observability/pipeline-metrics/

### Inputs
- VAP Spec Sections (see per-sprint SPRINTS.md)
- SPRINTS.md Sprint hardening tasks
- Dependencies: sprint-6-proof-generation-cryptographic-signing

### Preconditions
- Stage 4 verified complete (if 4 > 1)
- Node.js >= 20, pnpm >= 9 installed
- Git repo initialized

### Discovery Tasks
- [ ] Inspect project structure
- [ ] Inspect existing APIs
- [ ] Inspect interfaces
- [ ] Inspect tests
- [ ] Inspect configuration
- [ ] Inspect dependencies

### Execution Tasks
1. **CREATE**: CREATE: Pipeline observability metrics (latency, throughput, error rates, backlog) in packages/observability/pipeline-metrics/
   - Write implementation
   - Write tests
   - Export from index


### Suggested Commands
```bash
# 1. Inspect existing structure
cat packages/core/src/index.ts

# 2. Create/Modify implementation
cat > packages/core/src/L4.ts << 'EOF'
// Implementation here
EOF

# 3. Run verification
pnpm build --filter=@verified-attention/core && pnpm test --filter=@verified-attention/core
```

### Expected Outputs
- Implementation file(s)
- Test file(s) (>=80% coverage)
- Exports added to index.ts
- Documentation updated

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| L4 | `L4` | exit 0 |
## Stage 5: Pipeline distributed tracing (OpenTelemetry) in packages/observability/tracing/

### Objective
CREATE: Pipeline distributed tracing (OpenTelemetry) in packages/observability/tracing/

### Inputs
- VAP Spec Sections (see per-sprint SPRINTS.md)
- SPRINTS.md Sprint hardening tasks
- Dependencies: sprint-6-proof-generation-cryptographic-signing

### Preconditions
- Stage 5 verified complete (if 5 > 1)
- Node.js >= 20, pnpm >= 9 installed
- Git repo initialized

### Discovery Tasks
- [ ] Inspect project structure
- [ ] Inspect existing APIs
- [ ] Inspect interfaces
- [ ] Inspect tests
- [ ] Inspect configuration
- [ ] Inspect dependencies

### Execution Tasks
1. **CREATE**: CREATE: Pipeline distributed tracing (OpenTelemetry) in packages/observability/tracing/
   - Write implementation
   - Write tests
   - Export from index


### Suggested Commands
```bash
# 1. Inspect existing structure
cat packages/core/src/index.ts

# 2. Create/Modify implementation
cat > packages/core/src/L5.ts << 'EOF'
// Implementation here
EOF

# 3. Run verification
pnpm build --filter=@verified-attention/core && pnpm test --filter=@verified-attention/core
```

### Expected Outputs
- Implementation file(s)
- Test file(s) (>=80% coverage)
- Exports added to index.ts
- Documentation updated

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| L5 | `L5` | exit 0 |
## Stage 6: Dead letter queue for failed evidence with retry logic in packages/pipeline/dlq/

### Objective
CREATE: Dead letter queue for failed evidence with retry logic in packages/pipeline/dlq/

### Inputs
- VAP Spec Sections (see per-sprint SPRINTS.md)
- SPRINTS.md Sprint hardening tasks
- Dependencies: sprint-6-proof-generation-cryptographic-signing

### Preconditions
- Stage 6 verified complete (if 6 > 1)
- Node.js >= 20, pnpm >= 9 installed
- Git repo initialized

### Discovery Tasks
- [ ] Inspect project structure
- [ ] Inspect existing APIs
- [ ] Inspect interfaces
- [ ] Inspect tests
- [ ] Inspect configuration
- [ ] Inspect dependencies

### Execution Tasks
1. **CREATE**: CREATE: Dead letter queue for failed evidence with retry logic in packages/pipeline/dlq/
   - Write implementation
   - Write tests
   - Export from index


### Suggested Commands
```bash
# 1. Inspect existing structure
cat packages/core/src/index.ts

# 2. Create/Modify implementation
cat > packages/core/src/L6.ts << 'EOF'
// Implementation here
EOF

# 3. Run verification
pnpm build --filter=@verified-attention/core && pnpm test --filter=@verified-attention/core
```

### Expected Outputs
- Implementation file(s)
- Test file(s) (>=80% coverage)
- Exports added to index.ts
- Documentation updated

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| L6 | `L6` | exit 0 |
## Stage 7: Load test - 10K evidence/sec sustained 1 hour (p99 < 500ms, 0% data loss)

### Objective
VERIFY: Load test - 10K evidence/sec sustained 1 hour (p99 < 500ms, 0% data loss)

### Inputs
- VAP Spec Sections (see per-sprint SPRINTS.md)
- SPRINTS.md Sprint hardening tasks
- Dependencies: sprint-6-proof-generation-cryptographic-signing

### Preconditions
- Stage 7 verified complete (if 7 > 1)
- Node.js >= 20, pnpm >= 9 installed
- Git repo initialized

### Discovery Tasks
- [ ] Inspect project structure
- [ ] Inspect existing APIs
- [ ] Inspect interfaces
- [ ] Inspect tests
- [ ] Inspect configuration
- [ ] Inspect dependencies

### Execution Tasks
1. **VERIFY**: VERIFY: Load test - 10K evidence/sec sustained 1 hour (p99 < 500ms, 0% data loss)
   - Run verification command
   - Confirm expected output


### Suggested Commands
```bash
# 1. Inspect existing structure
cat packages/core/src/index.ts

# 2. Create/Modify implementation
cat > packages/core/src/L7.ts << 'EOF'
// Implementation here
EOF

# 3. Run verification
pnpm build --filter=@verified-attention/core && pnpm test --filter=@verified-attention/core
```

### Expected Outputs
- Implementation file(s)
- Test file(s) (>=80% coverage)
- Exports added to index.ts
- Documentation updated

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| L7 | `L7` | exit 0 |
## Stage 8: Chaos test - Kill pipeline nodes, verify no data loss (recovery < 30s)

### Objective
VERIFY: Chaos test - Kill pipeline nodes, verify no data loss (recovery < 30s)

### Inputs
- VAP Spec Sections (see per-sprint SPRINTS.md)
- SPRINTS.md Sprint hardening tasks
- Dependencies: sprint-6-proof-generation-cryptographic-signing

### Preconditions
- Stage 8 verified complete (if 8 > 1)
- Node.js >= 20, pnpm >= 9 installed
- Git repo initialized

### Discovery Tasks
- [ ] Inspect project structure
- [ ] Inspect existing APIs
- [ ] Inspect interfaces
- [ ] Inspect tests
- [ ] Inspect configuration
- [ ] Inspect dependencies

### Execution Tasks
1. **VERIFY**: VERIFY: Chaos test - Kill pipeline nodes, verify no data loss (recovery < 30s)
   - Run verification command
   - Confirm expected output


### Suggested Commands
```bash
# 1. Inspect existing structure
cat packages/core/src/index.ts

# 2. Create/Modify implementation
cat > packages/core/src/L8.ts << 'EOF'
// Implementation here
EOF

# 3. Run verification
pnpm build --filter=@verified-attention/core && pnpm test --filter=@verified-attention/core
```

### Expected Outputs
- Implementation file(s)
- Test file(s) (>=80% coverage)
- Exports added to index.ts
- Documentation updated

### Local Verification
| Check | Command | Expected |
|-------|---------|----------|
| L8 | `L8` | exit 0 |


---

# Global Verification (Post-Stage {0})

After all stages complete, perform complete project validation:

| Verification | Command / Action | Pass Criteria |
|--------------|------------------|---------------|
| Full Build | `pnpm build` | All packages build |
| Full Test Suite | `pnpm test` | All unit + integration + conformance pass |
| Typecheck | `pnpm typecheck` | Zero errors |
| Lint | `pnpm lint` | Zero errors |
| Format | `pnpm format --check` | No changes needed |
| Conformance | `pnpm test:conformance` | 100% VAP coverage |
| Load Tests | `pnpm test:load` | All thresholds met |
| Chaos Tests | `pnpm test:chaos` | Recovery < 30s, zero data loss |
| Security | Pen test report, SBOM | Critical/High = 0, SBOM current |
| Privacy | DPIA sign-off, conformance | Auditor approved, tests pass |
| Observability | Dashboards, alerts, tracing | All operational |
| Documentation | `docs/` complete | API, SDK, quickstart, architecture |
| VAP Spec | `docs/specs/0001-verified-attention-protocol.md` | v1.0 published |
| Release | GitHub Release `vae-1.0` | Tagged, artifacts published |

**Only after every global verification succeeds may the COMMAND_RUNWAY declare the feature complete.**

---

# Execution Rules (Mandatory)

1. **Never skip stages** -- Each stage builds on verified outputs of previous stages
2. **Never skip verification** -- Local verification must pass before proceeding
3. **Never continue after failed verification** -- Diagnose, produce corrective plan, repeat stage
4. **Never modify uninspected files** -- Read before write, always
5. **Prefer incremental implementation** -- Small commits, isolated changes
6. **Minimize edits** -- Touch only what the stage requires
7. **Preserve backwards compatibility** -- API changes only in Stage 19 with versioning
8. **Do not duplicate functionality** -- Reuse existing packages, check before creating
9. **Keep commits small and isolated** -- One logical change per commit
10. **Treat every stage as a complete iteration** -- Understand -> Inspect -> Plan -> Execute -> Verify

---

# Failure Procedure Template (Per Stage)

When any local verification fails:

```markdown
## Failure: [Stage N] - [Check Name]
**Command**: `pnpm test --filter=...`
**Exit Code**: N
**Output**: (last 50 lines)

### Root Cause Analysis
- [ ] Incorrect assumption about [spec/interface/dependency]
- [ ] Missing dependency: [package/service]
- [ ] Incorrect implementation: [file:function]
- [ ] Environment problem: [Node version, missing service, etc.]
- [ ] Test failure: [flaky, incorrect assertion, spec mismatch]
- [ ] Unexpected architecture: [discovered during inspection]

### Corrective Plan
1. [Specific fix action]
2. [Verification step]
3. [Re-run failed check]

### Repeat Stage
Re-execute failed stage tasks after fix. Do not proceed to next stage.
```
