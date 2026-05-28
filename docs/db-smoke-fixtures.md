# FranDev DB Smoke Fixtures

Purpose: keep release validation meaningful without exposing sensitive data or relying on brittle private records.

`npm run db:smoke` is intentionally read-only. It currently validates table contracts and minimum data presence for the highest-risk paths:

1. Contact search base table: `contacts`
2. Journey lookup: `journey_pipeline_state`
3. Call participant mapping: `call_participants`
4. Knowledge retrieval: active `knowledge_documents`
5. MasterSuite sync health: `cron_job_log` rows for MasterSuite sync jobs

## Stable fixture policy

Use non-sensitive, structural expectations first:

- table has at least one row where the product path expects production data
- selected columns can be read with the same names used by app routes
- sync logs contain rows for the scheduled jobs
- latest MasterSuite sync status is summarized by `lib/mastersuite/sync-health.ts`

Only add named record fixtures when they are intentionally created for testing and safe to document. Avoid documenting real prospect/franchisee names, phone numbers, emails, or MasterSuite credentials.

## Future fixture candidates

When we create safe synthetic rows, add checks for:

- a synthetic contact that appears in `/api/contacts/search`
- a synthetic journey with active pipeline state
- a synthetic call with one mapped participant
- a synthetic active KB doc tagged `smoke-test`
- one known-success MasterSuite sync log per scheduled job

## Command

```bash
npm run db:smoke
```

This command is part of `npm run release:check`.
