# FranDev DB / Schema Workflow

Purpose: keep Supabase schema, migrations, generated types, and application code aligned.

## Source of truth

- Production Supabase schema is the runtime source of truth.
- `supabase/migrations/` is the repo source of truth for intentional schema changes.
- `types/supabase.ts` is generated output and should not be edited manually.

## Current state

`types/supabase.ts` says it was generated on `2026-04-30`. The app has continued changing since then, so type drift is likely.

The local Supabase CLI project is not linked in this clone. That means commands like:

```bash
npx supabase db query --linked -f supabase/migrations/file.sql
```

currently fail with `Cannot find project ref` until the project is linked/documented.

## Safe workflow for schema changes

1. Write a migration under `supabase/migrations/YYYYMMDDHHMMSS_name.sql`.
2. Apply it to the intended Supabase project via linked CLI or controlled service-role/admin path.
3. Regenerate types:

```bash
npx supabase gen types typescript --project-id <project-ref> > types/supabase.ts
```

4. Run:

```bash
npm run env:check
npm run type-check
npm run build:prod-env
npm run smoke:prod
```

5. Commit migration + regenerated types together.

## Drift tooling

`npm run db:drift` is a read-only drift reporter intended to compare production `information_schema` to `types/supabase.ts`.

It requires a SQL execution RPC (`exec_sql`) or a future replacement using Supabase CLI/project-ref. If the RPC is unavailable, the script exits with instructions instead of guessing.

## Cleanup TODO

- Link this repo to the correct Supabase project or document the exact project ref in a non-secret config.
- Regenerate `types/supabase.ts` from production.
- Capture and burn down type drift in small domain batches.
- Add DB smoke checks for contact search, journey lookup, call participant mapping, KB retrieval, and MasterSuite sync counts.
