# FranDev Build + Deploy Runbook

Purpose: make local validation and production deploys boring. This repo has several production-only integrations, so missing env used to fail late during `next build` with opaque errors like `supabaseUrl is required`.

## Standard production-safe validation

```bash
# 1) Pull production env when validating a production build locally
vercel pull --yes --environment=production

# 2) Check required env without printing secret values
npm run env:check

# 3) Type-check first: fast signal for code errors
npm run type-check

# 4) Build with pulled Vercel env loaded explicitly
npm run build:prod-env
```

`npm run build` is still the normal Next build. Use `npm run build:prod-env` when reproducing Vercel behavior locally.

## Deploy

```bash
vercel --prod --yes
```

After deploy, smoke test the app base path:

```bash
npm run smoke:prod
# or manually:
curl -I -L https://nah-franchise-os-sandbox.vercel.app/frandev/pipeline
```

Expected for the manual check: `HTTP/2 200` and `x-matched-path: /pipeline`.

## Current production ownership

- FranDev build/deploy is owned here; do not treat Ben as a build dependency.
- Vercel production URL: `https://nah-franchise-os-sandbox.vercel.app/frandev`
- `mastersuiteapp.com/frandev` / proxy behavior is intentionally backburnered while the original login path works.
- MasterSuite DB sync runs from Vercel cron, not Corey's local machine.

## Required env groups

Run `npm run env:check` for the canonical list. The groups are:

1. Core app / Supabase
2. Auth / cron
3. Scout / AI
4. MasterSuite sync
5. GHL / Read.ai integrations

The checker prints missing keys only and never prints secret values.

## Known rough edge

Supabase CLI is not currently linked for this local clone, so `npx supabase db query --linked ...` fails with `Cannot find project ref`. Until the repo cleanup closes that gap, apply one-off KB/data changes through a controlled service-role script or link the project explicitly.
