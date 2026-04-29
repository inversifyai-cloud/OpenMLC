# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps: install everything (incl. native better-sqlite3) for build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app

# Build tools + python3 for native module compile (better-sqlite3, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# Skip postinstall (prisma generate) — we'll run it explicitly in the build stage
# once the schema is on disk.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund --ignore-scripts

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — build: compile Next.js standalone bundle + generate Prisma client
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS build

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# DATABASE_URL needed at build for prisma generate; placeholder is fine
ENV DATABASE_URL="file:/tmp/build.db"

RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runtime: minimal image, only standalone bundle + native runtime deps
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /app

# python3 is required by the code-exec sandbox tool (subprocess execFile).
# openssl + ca-certificates for outbound HTTPS to providers.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/data/openmlc.db"

# Next.js standalone bundle includes a minimal node_modules tree
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public           ./public
# Prisma engines + schema (standalone doesn't pick these up automatically).
# Copy the whole @prisma/ namespace so transitive deps like @prisma/debug are included.
COPY --from=build --chown=nextjs:nodejs /app/prisma                       ./prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/.prisma         ./node_modules/.prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@prisma         ./node_modules/@prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/prisma          ./node_modules/prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/better-sqlite3  ./node_modules/better-sqlite3

# Persisted volume for SQLite + uploads
RUN mkdir -p /data /app/uploads && chown -R nextjs:nodejs /data /app/uploads
VOLUME ["/data", "/app/uploads"]

# Entrypoint runs prisma db push (idempotent) then starts the Next.js server
COPY --chown=nextjs:nodejs <<'EOF' /app/entrypoint.sh
#!/bin/sh
set -e
echo "[entrypoint] applying schema to ${DATABASE_URL}"
node node_modules/prisma/build/index.js db push \
  --schema=./prisma/schema.prisma \
  --skip-generate \
  --accept-data-loss
echo "[entrypoint] starting next.js"
exec node server.js
EOF
RUN chmod +x /app/entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
