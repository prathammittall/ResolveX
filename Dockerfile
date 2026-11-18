# Multi-stage Dockerfile for ResolveX Express Server (Turborepo)

# -----------------------------------------------------------------------------
# Base stage: Node.js runtime with common Alpine utilities
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base

# Install libc6-compat for compatibility, openssl for TLS/crypto, and dumb-init for PID 1 signal handling
RUN apk add --no-cache libc6-compat openssl dumb-init
WORKDIR /app

# -----------------------------------------------------------------------------
# Pruner stage: Generate isolated monorepo slice for the server app
# -----------------------------------------------------------------------------
FROM base AS pruner

ARG TURBO_VERSION=2.11.10
RUN npm install -g turbo@${TURBO_VERSION}

# Copy the monorepo source files to prepare the pruned build context
COPY . .

# Generate minimal pruned slice in /app/out for the 'server' workspace
RUN turbo prune server --docker

# -----------------------------------------------------------------------------
# Installer stage: Install pruned dependencies
# -----------------------------------------------------------------------------
FROM base AS installer

# Copy workspace package definitions & pruned lockfile to leverage Docker layer caching
COPY --from=pruner /app/out/json/ .

# Install dependencies using --legacy-peer-deps to ignore peer dependency mismatches from pruned monorepo slices
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy full pruned source files and configs
COPY --from=pruner /app/out/full/ .

# -----------------------------------------------------------------------------
# Production stage: Minimal, secure production runtime (targeted by Dokploy / PaaS)
# -----------------------------------------------------------------------------
FROM base AS production

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Create a non-root group and user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 serveruser

WORKDIR /app

# Copy the prepared monorepo workspace & node_modules
COPY --from=installer --chown=serveruser:nodejs /app /app

# Switch to non-root user
USER serveruser

# Set working directory to the server application
WORKDIR /app/apps/server

# Expose default HTTP port
EXPOSE 3000

# Health check using the Express server's /health route
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

# dumb-init ensures SIGTERM / SIGINT signals are cleanly propagated for graceful shutdown
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]

# Alias for platforms/tools targeting 'runner'
FROM production AS runner
