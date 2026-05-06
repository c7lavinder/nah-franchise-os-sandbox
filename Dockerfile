# syntax=docker/dockerfile:1.7
# ------------------------------------------------------------------------------
# NAH Franchise OS — production image
# Multi-stage build for a minimal Next.js 14 (standalone) runtime.
# Final image is ~150MB and runs as a non-root user.
# ------------------------------------------------------------------------------

ARG NODE_VERSION=22-alpine

# --- Stage 1: install dependencies (cached layer) -----------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# libc6-compat: needed by some Node native modules on Alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci


# --- Stage 2: build the Next.js app -------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time — these
# must be REAL values. Pass them via `docker build --build-arg ...`.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Runtime secrets that are referenced at module-import time during `next build`
# (e.g. createServerClient()'s presence check). Dummy values are acceptable here
# because pages that touch Supabase are `dynamic = 'force-dynamic'` and don't
# run during the build. These are NOT copied into the runner stage, so they
# do not end up in the final image's environment.
ARG SUPABASE_SERVICE_KEY=build-placeholder
ARG ANTHROPIC_API_KEY=build-placeholder
ARG OPENAI_API_KEY=build-placeholder
ARG GHL_API_KEY=build-placeholder
ARG GHL_CLIENT_ID=build-placeholder
ARG GHL_CLIENT_SECRET=build-placeholder
ARG GHL_LOCATION_ID=build-placeholder
ENV SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
ENV ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV GHL_API_KEY=$GHL_API_KEY
ENV GHL_CLIENT_ID=$GHL_CLIENT_ID
ENV GHL_CLIENT_SECRET=$GHL_CLIENT_SECRET
ENV GHL_LOCATION_ID=$GHL_LOCATION_ID

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build


# --- Stage 3: minimal runtime image -------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy the standalone server output + static assets.
# `output: 'standalone'` in next.config.js puts a trimmed server.js and
# only the node_modules it actually needs into .next/standalone.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Runtime-only secrets (ANTHROPIC_API_KEY, SUPABASE_SERVICE_KEY, GHL_*, etc.)
# should be passed in via `docker run -e ...` or an orchestrator, NOT baked in.
CMD ["node", "server.js"]
