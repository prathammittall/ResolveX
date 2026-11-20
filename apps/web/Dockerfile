# ResolveX web (Next.js) image. Build from the repository root:
#   docker build -f apps/web/Dockerfile -t resolvex-web .
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat dumb-init
WORKDIR /app

FROM base AS pruner
ARG TURBO_VERSION=2.11.10
RUN npm install -g turbo@${TURBO_VERSION}
COPY . .
RUN turbo prune web --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=web

FROM base AS production
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 webuser
COPY --from=builder --chown=webuser:nodejs /app /app
USER webuser
WORKDIR /app/apps/web
EXPOSE 3001
# BACKEND_URL (runtime) tells the /api proxy where the API lives, e.g. http://api:3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]
