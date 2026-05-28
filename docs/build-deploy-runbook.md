# FranDev Build + Deploy Runbook

Purpose: make local validation and production deploys boring. This repo has several production-only integrations, so missing env used to fail late during `next build` with opaque errors like `supabaseUrl is required`.

## Standard production-safe validation

```bash
# 1) Pull production env when validating a production build locally
vercel pull --yes --environment=production

# 2) Fast checks: env, type-check, DB drift
npm run check

# 3) Full release check: fast checks + read-only DB smoke + production-env build + production smoke
npm run release:check
```

Equivalent manual breakdown:

```bash
npm run env:check
npm run type-check
npm run db:drift
npm run db:smoke
npm run build:prod-env
npm run smoke:prod
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

## DB safety checks

- `npm run db:drift` regenerates Supabase types from the linked project and compares them to `types/supabase.ts`.
- `npm run db:smoke` runs read-only Supabase checks for contact search, journey lookup, call participant mapping, active KB docs, and MasterSuite sync history.
- DB smoke fixture policy lives in `docs/db-smoke-fixtures.md`.

The local Supabase CLI is linked to project ref `llnrvophuvrqcqducgrr`.
