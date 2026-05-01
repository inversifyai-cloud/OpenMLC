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

# Copy schema first so the postinstall (prisma generate) succeeds and
# better-sqlite3 native binary is also built (--ignore-scripts would skip both).
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

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
# Build the host agent binary (single bundled JS, served as download)
RUN cd packages/openmlc-agent && npm ci --no-audit --no-fund && npm run build

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

# Ship the built app + full production node_modules. The Next.js standalone
# output traces ESM-only versions of some packages (e.g. @prisma/debug only
# gets index.mjs), which then collide with prisma's CJS resolver at runtime.
# Copying the unminified built app + node_modules avoids the trace problem.
COPY --from=build --chown=nextjs:nodejs /app/.next         ./.next
COPY --from=build --chown=nextjs:nodejs /app/public        ./public
COPY --from=build --chown=nextjs:nodejs /app/package.json  ./package.json
COPY --from=build --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=build --chown=nextjs:nodejs /app/prisma            ./prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma.config.ts  ./prisma.config.ts
COPY --from=build --chown=nextjs:nodejs /app/node_modules  ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/packages/openmlc-agent/dist/index.js ./agent/openmlc-agent.js

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
  --url="${DATABASE_URL}" \
  --accept-data-loss
echo "[entrypoint] starting next.js"
exec node node_modules/next/dist/bin/next start -H "${HOSTNAME}" -p "${PORT}"
EOF
RUN chmod +x /app/entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
