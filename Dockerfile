# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Duel.uz production image
#
# Debian slim rather than Alpine: sharp ships glibc prebuilds, so this avoids
# musl-specific surprises for the dependency on the critical path of image
# upload.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=$PNPM_HOME:$PATH
RUN corepack enable && apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# --- dependencies ----------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# --- build -----------------------------------------------------------------
FROM base AS builder
# `.npmrc` sets node-linker=hoisted, so packages do not each get their own
# node_modules. Copying the whole installed tree keeps this correct whichever
# linker is configured.
COPY --from=deps /repo/ ./
COPY . .

# NEXT_PUBLIC_* values are inlined at build time, so the public origin has to
# be known here — it drives canonical URLs, OG image URLs, share links, the
# CSP and whether cookies carry the Secure flag.
ARG NEXT_PUBLIC_APP_URL=https://duel.hsbch.uz
ARG NEXT_PUBLIC_APP_NAME=Duel.uz
# The Telegram login widget is configured with the bot username in the browser,
# so it has to be present when the client bundle is compiled.
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME \
    NODE_ENV=production

# The env module validates at import time, and `next build` imports it while
# collecting page data. These are build-time placeholders only; the real
# secrets are supplied to the running container.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    SESSION_SECRET=build-time-placeholder-value-32-chars-min \
    ANON_SECRET=build-time-placeholder-value-32-chars-min \
    IP_SALT=build-time-placeholder-value-32-chars-minim

RUN pnpm --filter @dueluz/db exec prisma generate
RUN pnpm --filter @dueluz/web exec next build

# --- migrator --------------------------------------------------------------
# Keeps the Prisma CLI, schema and migrations so `migrate deploy` and the seed
# can run as one-off containers against the same image tag.
FROM base AS migrator
COPY --from=deps /repo/ ./
COPY package.json pnpm-workspace.yaml ./
COPY packages/db ./packages/db
# The seed imports the ranking formula so it cannot drift from the app's.
COPY apps/web/src/server/trending/score.ts ./apps/web/src/server/trending/score.ts
COPY --from=builder /repo/node_modules/.prisma ./node_modules/.prisma
WORKDIR /repo/packages/db
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# --- runtime ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

WORKDIR /app
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

# Uploads live on a volume; the directory must exist and be writable by the
# unprivileged runtime user.
RUN mkdir -p /app/apps/web/public/uploads && chown -R nextjs:nodejs /app/apps/web/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/categories').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `server.js` sits under apps/web because the trace root is the workspace root.
CMD ["node", "apps/web/server.js"]
