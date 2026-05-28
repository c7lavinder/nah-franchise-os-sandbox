# FranDev DB / Schema Workflow

Purpose: keep Supabase schema, migrations, generated types, and application code aligned.

## Source of truth

- Production Supabase schema is the runtime source of truth.
- `supabase/migrations/` is the repo source of truth for intentional schema changes.
- `types/supabase.ts` is generated output and should not be edited manually.

## Current state

The local Supabase CLI project is linked to project ref `llnrvophuvrqcqducgrr`.

`types/supabase.ts` was regenerated from production on `2026-05-28` and `npm run type-check` passes against the refreshed types.

Commands like this now have the required project link available:

```bash
npx supabase db query --linked -f supabase/migrations/file.sql
```

## Safe workflow for schema changes

1. Write a migration under `supabase/migrations/YYYYMMDDHHMMSS_name.sql`.
2. Apply it to the intended Supabase project via linked CLI or controlled service-role/admin path.
3. Regenerate types:

```bash
npx supabase gen types typescript --project-id llnrvophuvrqcqducgrr > types/supabase.ts
```

4. Run:

```bash
npm run check
npm run build:prod-env
npm run smoke:prod
```

5. Commit migration + regenerated types together.

## Drift tooling

`npm run db:drift` is now CLI-based and does not require an unsafe SQL execution RPC.

It regenerates Supabase types from project `llnrvophuvrqcqducgrr` into a temp file, normalizes the generated header away, and compares the result to checked-in `types/supabase.ts`.

Expected clean output:

```bash
DB drift check passed. types/supabase.ts matches project llnrvophuvrqcqducgrr.
```

If drift is detected, regenerate `types/supabase.ts`, run `npm run type-check`, and commit the type update with the migration/schema change.

## Remaining DB cleanup opportunities

- Add DB smoke checks for contact search, journey lookup, call participant mapping, KB retrieval, and MasterSuite sync counts.
- Capture and burn down future type drift in small domain batches whenever regenerated types surface issues.
