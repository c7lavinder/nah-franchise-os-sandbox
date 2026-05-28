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
- File: `lib/calls/upload-validation.test.ts`
- Covers upload extension normalization and transcript/recording classification.

### Contact / Scout search planning

- File: `lib/contacts/search-planner.test.ts`
- Covers short query suppression.
- Covers normalized forward + reversed name matching, e.g. `Chintan Patel` and `Patel Chintan`.
- Covers multi-word last names.
- Covers deduped, limited ID merging.

### MasterSuite health, sync observability, and cron locks

- File: `lib/mastersuite/health.test.ts`
- Covers required MasterSuite DB env checks without running heavy sync.
- File: `lib/mastersuite/sync-health.test.ts`
- Covers healthy, stale, failed, recovered, and optional GHL-token-history sync states from `cron_job_log` rows.
- File: `lib/mastersuite/cron-lock.test.ts`
- Covers stale cutoff and active-running-job lock behavior.

### Route-level API tests

- File: `tests/api/contacts-search-route.test.ts`
- Covers empty-query behavior and enriched contact search response with mocked Supabase.
- File: `tests/api/call-upload-route.test.ts`
- Covers route-level no-file validation for call upload with mocked Supabase/auth.
- File: `tests/api/admin-sync-status-route.test.ts`
- Covers admin access guard and sync health response shape.

## Still worth adding later

- Route-level call upload success-path test with mocked transcript file and participant resolver.
- Scout tool-executor test for fuzzy RPC fallback preserving journey links.
