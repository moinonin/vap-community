# Multi-stage build for @verified-attention/reward-settlement worker
FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install dependencies (cached layer)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY packages/reward/settlement/package.json packages/reward/settlement/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @verified-attention/reward-settlement...

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY packages/reward/settlement/ ./packages/reward/settlement/
WORKDIR /app/packages/reward/settlement
RUN pnpm run build

# Runtime stage
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs

# Copy root workspace dependencies and internal packages
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/packages ./packages
COPY --from=deps --chown=nodejs:nodejs /app/package.json ./package.json

# Copy built application under its monorepo path
COPY --from=deps --chown=nodejs:nodejs /app/packages/reward/settlement/node_modules ./packages/reward/settlement/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages/reward/settlement/dist ./packages/reward/settlement/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/reward/settlement/package.json ./packages/reward/settlement/package.json

WORKDIR /app/packages/reward/settlement
USER nodejs

# No exposed port - worker runs as background process
ENTRYPOINT ["node", "dist/worker.mjs"]
CMD ["run"]