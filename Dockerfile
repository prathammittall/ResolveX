# Multi-stage Dockerfile for ResolveX Express Server (Turborepo)

# -----------------------------------------------------------------------------
# Base stage: Minimal Node.js Alpine runtime with tsx and utilities
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base

# Install libc6-compat for compatibility, openssl for TLS/crypto, and dumb-init for PID 1 signal handling
RUN apk add --no-cache libc6-compat openssl dumb-init && \
    npm install -g tsx@^4.23.15 && \
    npm cache clean --force

WORKDIR /app

# -----------------------------------------------------------------------------
# Pruner stage: Generate isolated monorepo slice for the server app
# -----------------------------------------------------------------------------
FROM base AS pruner

ARG TURBO_VERSION=2.11.10
RUN npm install -g turbo@${TURBO_VERSION} && \
    npm cache clean --force

# Copy the monorepo source files to prepare the pruned build context
COPY . .

# Generate minimal pruned slice in /app/out for the 'server' workspace
RUN turbo prune server --docker

# -----------------------------------------------------------------------------
# Installer stage: Install production dependencies only
# -----------------------------------------------------------------------------
FROM base AS installer

# Copy workspace package definitions & pruned lockfile
COPY --from=pruner /app/out/json/ .

# Install ONLY production dependencies to keep layer size minimal, then strip source maps and cache
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund && \
    npm cache clean --force && \
    find node_modules -type f -name "*.map" -delete

# Copy pruned source files and configs
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

# Copy only the pruned node_modules, root package.json, and apps/server
COPY --from=installer --chown=serveruser:nodejs /app/node_modules /app/node_modules
COPY --from=installer --chown=serveruser:nodejs /app/package.json /app/package.json
COPY --from=installer --chown=serveruser:nodejs /app/apps/server /app/apps/server

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
