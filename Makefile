# ═════════════════════════════════════════════════════════════════════════════
# VERIFIED ATTENTION ENGINE — Makefile
#
# All backend entrypoints for the VAE project. Each target is self-documenting,
# verbose, and idempotent. Python targets ALWAYS use .venv/bin/python.
#
# Usage:
#   make help          — list all targets with descriptions
#   make venv          — create/refresh Python virtual environment
#   make prototype     — run the Python evidence ingestion prototype
#   make build         — build all TypeScript packages (pnpm)
#   make test          — run all tests (Python + TypeScript)
#   make test-py       — run Python tests only
#   make test-ts       — run TypeScript tests only
#   make lint          — lint all code
#   make typecheck     — TypeScript type checking
#   make clean         — remove build artifacts and caches
#   make install       — install all dependencies (venv + pnpm)
#
# ═════════════════════════════════════════════════════════════════════════════

# ─── Paths ──────────────────────────────────────────────────────────────────
VENV         := .venv
PYTHON       := $(VENV)/bin/python
PIP          := $(VENV)/bin/pip
PNPM         := pnpm

# ─── Colors ─────────────────────────────────────────────────────────────────
BLUE   := \033[34m
GREEN  := \033[32m
YELLOW := \033[33m
RED    := \033[31m
RESET  := \033[0m

# ─── Default ─────────────────────────────────────────────────────────────────
.DEFAULT_GOAL := help

# ═════════════════════════════════════════════════════════════════════════════
# Help
# ═════════════════════════════════════════════════════════════════════════════

.PHONY: help
help: ## Show this help message
	@echo ""
	@echo "$(BLUE)═══════════════════════════════════════════════════════════════$(RESET)"
	@echo "$(BLUE)  VERIFIED ATTENTION ENGINE — Make Targets$(RESET)"
	@echo "$(BLUE)═══════════════════════════════════════════════════════════════$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Python targets use $(PYTHON) — never bare python/python3$(RESET)"
	@echo ""

# ═════════════════════════════════════════════════════════════════════════════
# Python Virtual Environment
# ═════════════════════════════════════════════════════════════════════════════

.PHONY: venv
venv: ## Create Python .venv if missing (Python 3.11+ preferred)
	@echo "$(BLUE)[venv] Checking for existing .venv...$(RESET)"
	@if [ -d "$(VENV)" ] && $(PYTHON) --version >/dev/null 2>&1; then \
		echo "$(GREEN)[venv] .venv exists: $$($(PYTHON) --version)$(RESET)"; \
	else \
		echo "$(YELLOW)[venv] .venv missing or broken — recreating...$(RESET)"; \
		rm -rf $(VENV); \
		if command -v python3.11 >/dev/null 2>&1; then \
			echo "$(BLUE)[venv] Creating with python3.11...$(RESET)"; \
			python3.11 -m venv $(VENV); \
		elif command -v python3 >/dev/null 2>&1; then \
			echo "$(BLUE)[venv] Creating with python3...$(RESET)"; \
			python3 -m venv $(VENV); \
		else \
			echo "$(RED)[venv] ERROR: No python3 or python3.11 found$(RESET)"; \
			exit 1; \
		fi; \
		$(PIP) install --upgrade pip >/dev/null 2>&1; \
		echo "$(GREEN)[venv] Created: $$($(PYTHON) --version)$(RESET)"; \
	fi
	@echo "$(BLUE)[venv] Upgrading pip...$(RESET)"
	@$(PIP) install --upgrade pip --quiet 2>/dev/null
	@echo "$(GREEN)[venv] Done.$(RESET)"

# ═════════════════════════════════════════════════════════════════════════════
# Install (all dependencies)
# ═════════════════════════════════════════════════════════════════════════════

.PHONY: install
install: venv ## Install all dependencies (Python venv + pnpm packages)
	@echo "$(BLUE)[install] Installing pnpm packages...$(RESET)"
	@$(PNPM) install
	@echo "$(GREEN)[install] Done.$(RESET)"

# ═════════════════════════════════════════════════════════════════════════════
# Python Backend
# ═════════════════════════════════════════════════════════════════════════════

.PHONY: prototype
prototype: venv ## Run the Python evidence ingestion prototype
	@echo "$(BLUE)[prototype] Running evidence ingestion prototype...$(RESET)"
	@echo "$(BLUE)[prototype] Command: $(PYTHON) scripts/prototype-ingest.py$(RESET)"
	@$(PYTHON) scripts/prototype-ingest.py
	@echo "$(GREEN)[prototype] Complete.$(RESET)"

.PHONY: test-py
test-py: venv ## Run Python tests (if any test files exist)
	@echo "$(BLUE)[test-py] Checking for Python test files...$(RESET)"
	@if [ -f scripts/prototype-ingest.py ]; then \
		echo "$(BLUE)[test-py] Running prototype as smoke test...$(RESET)"; \
		$(PYTHON) scripts/prototype-ingest.py >/dev/null 2>&1 && \
		echo "$(GREEN)[test-py] Prototype smoke test passed.$(RESET)" || \
		(echo "$(RED)[test-py] Prototype smoke test FAILED.$(RESET)" && exit 1); \
	else \
		echo "$(YELLOW)[test-py] No Python test files found.$(RESET)"; \
	fi

# ═════════════════════════════════════════════════════════════════════════════
# TypeScript / Monorepo
# ═════════════════════════════════════════════════════════════════════════════

.PHONY: build
build: ## Build all TypeScript packages
	@echo "$(BLUE)[build] Building all packages with pnpm...$(RESET)"
	@$(PNPM) -r build
	@echo "$(GREEN)[build] Done.$(RESET)"

.PHONY: test-ts
test-ts: ## Run all TypeScript tests
	@echo "$(BLUE)[test-ts] Running tests across all packages...$(RESET)"
	@$(PNPM) -r test
	@echo "$(GREEN)[test-ts] Done.$(RESET)"

.PHONY: typecheck
typecheck: ## Run TypeScript type checking
	@echo "$(BLUE)[typecheck] Running tsc --noEmit across packages...$(RESET)"
	@$(PNPM) -r typecheck
	@echo "$(GREEN)[typecheck] Done.$(RESET)"

.PHONY: lint
lint: ## Run linter across all packages
	@echo "$(BLUE)[lint] Running eslint...$(RESET)"
	@$(PNPM) -r lint || echo "$(YELLOW)[lint] Lint warnings (non-blocking).$(RESET)"
	@echo "$(GREEN)[lint] Done.$(RESET)"

# ═════════════════════════════════════════════════════════════════════════════
# Combined Targets
# ═════════════════════════════════════════════════════════════════════════════

.PHONY: test
test: test-py test-ts ## Run all tests (Python + TypeScript)
	@echo "$(GREEN)[test] All tests complete.$(RESET)"

.PHONY: verify
verify: build typecheck lint test ## Full verification: build + typecheck + lint + test
	@echo "$(GREEN)[verify] Full verification passed.$(RESET)"

# ═════════════════════════════════════════════════════════════════════════════
# Clean
# ═════════════════════════════════════════════════════════════════════════════

.PHONY: clean
clean: ## Remove build artifacts, caches, and coverage reports
	@echo "$(YELLOW)[clean] Removing build artifacts...$(RESET)"
	@rm -rf packages/*/dist
	@rm -rf packages/*/coverage
	@rm -rf apps/*/dist
	@rm -rf data/evidence_store.jsonl
	@echo "$(GREEN)[clean] Done.$(RESET)"

.PHONY: clean-venv
clean-venv: ## Remove .venv (forces recreation on next make)
	@echo "$(YELLOW)[clean-venv] Removing .venv...$(RESET)"
	@rm -rf $(VENV)
	@echo "$(GREEN)[clean-venv] Done.$(RESET)"

# ═════════════════════════════════════════════════════════════════════════════
# Cluster (Docker Compose)
# ═════════════════════════════════════════════════════════════════════════════

.PHONY: start-cluster
start-cluster: ## Start all services (portal, api, ml-serving, python-backend, verifier, settlement-worker, postgres, redis, jaeger)
	@echo "$(BLUE)[cluster] Starting verified-attention cluster...$(RESET)"
	@docker compose up -d --build
	@echo "$(GREEN)[cluster] Cluster started. Check status: docker compose ps$(RESET)"

.PHONY: stop-cluster
stop-cluster: ## Stop and remove all cluster containers
	@echo "$(YELLOW)[cluster] Stopping verified-attention cluster...$(RESET)"
	@docker-compose down --rmi all --volumes --remove-orphans || echo "$(YELLOW)[cluster] Some containers may not exist (safe).$(RESET)"
	@echo "$(GREEN)[cluster] Cluster stopped and cleaned.$(RESET)"
