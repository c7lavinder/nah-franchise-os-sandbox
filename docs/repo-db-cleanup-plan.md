# FranDev Repo + DB Cleanup Plan

Goal: make FranDev faster and safer to change, closer to the Company Mind edit/build/deploy loop.

## Why this matters

Recent fixes were small at the product level but slow operationally because code paths are tightly coupled across base path, auth, Scout, calls, Supabase, MasterSuite, Vercel env, and production-only cron routes. The cleanup should reduce hidden coupling and make failures obvious earlier.

## Operating principles

- Keep FranDev build/deploy owned in this repo. No Ben dependency for normal FranDev work.
- Preserve current production behavior while cleaning; prefer wrappers/docs/tests before risky rewrites.
- Separate product domains: auth, Scout, calls, pipeline/journeys, MasterSuite sync, GHL, workflows.
- Supabase migrations are the schema source of truth; generated types should match production.
- Every cleanup batch must pass `npm run check` and `npm run build:prod-env`; release candidates also pass `npm run smoke:prod`.

## Quick wins already started

- Added `npm run env:check` to fail fast on missing required environment variables.
- Added `npm run build:prod-env` to reproduce Vercel builds locally using `.vercel/.env.production.local`.
- Added `docs/build-deploy-runbook.md` for the current validation/deploy path.

## Priority cleanup tasks

### 1. Environment/build reliability

1. Link or document Supabase project ref for this repo so migrations can be applied consistently.
2. Convert scattered env expectations into a typed env module instead of reading `process.env` everywhere.
3. Add CI step: `npm run env:check` with safe dummy/preview env plus `npm run type-check`.
4. Decide Node version and pin it (`.nvmrc` / `engines`) to avoid Node 20 vs 22/WebSocket surprises.
5. Add a no-secret `.env.local.example` aligned with `scripts/check-env.ts` groups.

### 2. DB/schema hygiene

6. Regenerate `types/supabase.ts` from production and track current type errors separately from feature work. — done
7. Create a schema ownership map: contacts, journeys, calls, call participants, knowledge docs, MasterSuite mirrors. — done in `docs/domain-map.md` and `docs/mastersuite-sync-boundaries.md`
8. Add a read-only drift checker that compares generated Supabase types to checked-in `types/supabase.ts`. — done via `npm run db:drift`
9. Add DB smoke scripts for: contact search, journey lookup, call participant mapping, KB retrieval, MasterSuite sync counts. — remaining enhancement

### 3. Domain boundaries

10. Move call upload/participant resolution/generation docs into one module guide; keep `lib/calls/*` as the canonical call intelligence domain.
11. Split Scout into clear layers: prompt/context loading, tool definitions, tool execution, LLM client, UI routes.
12. Document pipeline/journey source of truth and how call uploads should resolve prospect → journey → pipeline state.
13. Keep MasterSuite sync under one domain boundary (`lib/mastersuite`, `scripts/run-ms-sync.ts`, cron routes) and avoid leaking DB details elsewhere.

### 4. Smoke tests and release safety

14. Add lightweight smoke commands for `/frandev/login`, `/frandev/pipeline`, `/frandev/calls`, Scout chat route auth behavior, and contacts search auth behavior. — done via `npm run smoke:prod`
15. Add one call-upload fixture test for transcript + selected prospect mapping/deduping. — done
16. Add one Scout/contact search fixture test for fuzzy/reordered names. — done
17. Burn down lint warnings and keep lint clean. — done

### 5. Backburnered URL/proxy clarity

18. Document how `mastersuiteapp.com/frandev` is routed when we choose to revisit it. This is not a blocker while the original login path works.

## Suggested first cleanup sprint

1. Pin Node + env example + env checker docs.
2. Link Supabase and verify migration apply path.
3. Regenerate Supabase types and capture type drift report.
4. Add 5 smoke scripts for build/login/pipeline/calls/cron health.
5. Create domain map docs for calls, Scout, MasterSuite sync.

That sprint should make the next feature batch much faster without needing a risky full refactor.
