# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# STAI production image.
# Node pinned by digest-free but exact tag; Debian slim because
# better-sqlite3 is a native module and glibc must match between
# the stage that compiles it and the stage that loads it.
# ─────────────────────────────────────────────────────────────
ARG NODE_VERSION=22.14.0

# ---------- deps: install and compile native modules ----------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 builds from source when no prebuilt binary matches.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# npm ci installs exactly what the lockfile pins — reproducible builds.
RUN npm ci

# ---------- builder: compile the app ----------
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NODE_ENV=production here so the build matches runtime behaviour.
ENV NODE_ENV=production
RUN npm run build

# ---------- runner: minimal runtime ----------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Binds inside the container only. The port is never published to the
    # host; Caddy reaches it over the private compose network.
    HOSTNAME=0.0.0.0 \
    STAI_DATA_DIR=/data

# Run as a non-root user. node:*-slim ships uid/gid 1000 as `node`.
RUN mkdir -p /data && chown -R node:node /data

# Standalone output: server.js plus only the traced node_modules.
COPY --from=builder --chown=node:node /app/.next/standalone ./
# Neither of these is included by standalone output; both are required.
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Operational script only — no dev dependencies, no source, no secrets.
COPY --from=builder --chown=node:node /app/scripts/backup.mjs ./scripts/backup.mjs

USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# server.js is what `output: "standalone"` emits.
CMD ["node", "server.js"]
