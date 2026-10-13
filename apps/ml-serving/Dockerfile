# Multi-stage build for @verified-attention/ml-serving
FROM node:22-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install dependencies (cached layer)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY apps/ml-serving/package.json apps/ml-serving/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @verified-attention/ml-serving...

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/ml-serving/node_modules ./apps/ml-serving/node_modules
COPY apps/ml-serving/ ./apps/ml-serving/
WORKDIR /app/apps/ml-serving
RUN pnpm run build

# Runtime stage
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8085

# Create non-root user
RUN groupadd -r nodejs && useradd -m -r -g nodejs nodejs

# Copy root workspace dependencies and internal packages
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/packages ./packages
COPY --from=deps --chown=nodejs:nodejs /app/package.json ./package.json

# Copy built application under its monorepo path
COPY --from=deps --chown=nodejs:nodejs /app/apps/ml-serving/node_modules ./apps/ml-serving/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/apps/ml-serving/dist ./apps/ml-serving/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/ml-serving/package.json ./apps/ml-serving/package.json

WORKDIR /app/apps/ml-serving
USER nodejs
EXPOSE 8085

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8085/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["node", "dist/index.mjs"]
