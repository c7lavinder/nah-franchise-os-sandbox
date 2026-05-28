# FranDev Test Coverage Map

Captured: 2026-05-28

## Current cleanup-critical tests

Run targeted cleanup tests:

```bash
npm run test:cleanup
```

Run repo safety checks:

```bash
npm run check
```

## Covered

### Call upload mapping

- File: `lib/calls/upload-mapping.test.ts`
- Covers selected prospect fallback when transcript speaker matching does not find a contact.
- Ensures selected prospect does not overwrite an existing resolver match.
- Ensures participant inserts dedupe by contact id and skip existing participants.

### Contact / Scout search planning

- File: `lib/contacts/search-planner.test.ts`
- Covers short query suppression.
- Covers normalized forward + reversed name matching, e.g. `Chintan Patel` and `Patel Chintan`.
- Covers multi-word last names.
- Covers deduped, limited ID merging.

### MasterSuite health and sync observability

- File: `lib/mastersuite/health.test.ts`
- Covers required MasterSuite DB env checks without running heavy sync.
- File: `lib/mastersuite/sync-health.test.ts`
- Covers healthy, stale, and failed MasterSuite/GHL sync states from `cron_job_log` rows.

## Still worth adding later

- API-level `/api/contacts/search` test with mocked Supabase query builder.
- Route-level call upload test with mocked Supabase + transcript file.
- Scout tool-executor test for fuzzy RPC fallback preserving journey links.
