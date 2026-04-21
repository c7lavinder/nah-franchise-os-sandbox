# Session Handoff — 2026-04-20 — Call Classification Consolidation

## Status
Phase: Sprint "Call type classification — consolidate 5 paths into 1" / Health: Green / **Shipped end-to-end. Merged to main, pushed, deployed.**

- 6 commits on `main` (fast-forward merge from the feature branch).
- GitHub: pushed to `origin/main`.
- Vercel production deploy `dpl_D7AKVfuhoi7UcJNRvt5iRJaHTBpu` at commit `ea0adda` — state READY, region iad1.

## What Shipped

All behavior preserved from the per-file logic documented in `docs/call-classification-audit.md`. No classification rules invented — pure consolidation.

- **Phase 1** `36a539e` — migration inserts the `unclassified` call_type row.
- **Phase 2** `94701ff` — installed Vitest (+ `vitest.config.ts`, `npm test`, `npm run test:watch`), built `lib/calls/classify-type.ts` with top-down first-match-wins logic (team → coaching → matt_final → matt → sam → mark → intro → ghl title regex → unclassified). 17 tests, all green.
- **Phase 3** `1d883bb` — migration adds `calls.classification_reason text NULL`. All 5 entry points rewired through `classifyCallType`:
  - `lib/calls/processors/prospect-processor.ts`
  - `lib/calls/processors/coaching-processor.ts`
  - `lib/calls/processors/group-processor.ts`
  - `app/api/cron/sync-ghl-calendar/route.ts`
  - `app/api/calls/create/route.ts` (user dropdown wins when provided; classifier fills in when blank)
  
  Centralized slug→id lookup in `lib/calls/resolve-call-type.ts`. Old per-file classification code deleted.
- **Phase 4** `3c44276` — cron update path now checks `existing.source`. Read.ai / manual / NULL source → `call_type_id` preserved. `console.info` log fires on skip; a `callTypePreserved` counter is returned in the response JSON so we can verify it's working in real-world runs.
- **Phase 5** `d920cb8` — `scripts/backfill-call-types.ts` with dry-run default and `--live` flag.
- **Phase 6** `ea0adda` — migration enforces `call_type_id NOT NULL`.

`npx tsc --noEmit` clean after every phase. All 17 Vitest tests pass on final commit.

## Production DB State

All three migrations applied to remote (`llnrvophuvrqcqducgrr`):
- `20260420000000_add_unclassified_call_type.sql`
- `20260420000100_add_classification_reason.sql`
- `20260420000200_enforce_call_type_not_null.sql`

Live backfill ran. 8 rows updated:
- 5 → `coaching_call` (participant is a territory owner)
- 3 → `unclassified` (no signals matched)

Verified post-backfill: 0 NULL `call_type_id` rows (including soft-deleted). NOT NULL constraint now holds.

## Three Rows Flagged for Human Review

These rows classified as `unclassified` during backfill — should be eyeballed and reassigned manually in the UI:

- `ad4d2fd7-1380-4e7e-bf36-e03f18b8451a` — "Group Call w/ Abe Dunaway - AC Inc., admin@fieldcoachexperts.com +15"
- `48367299-3fb6-4e88-b2cc-5c300f66bd7a` — "Group Call w/ Arvie C., Bever Parba +15"
- `7b0a8c2c-24a2-41d8-b2e6-f1808e379e51` — "Group Call w/ Arvie C., Bever Parba +15"

All three are legacy group calls with no stored NAH-team participants and no territory owner — no signals for the classifier. Easy to filter by the `unclassified` call type.

## Surprises / Notes

- **Only 8 NULL rows existed.** The audit predicted more. Reality: most traffic ran through Read.ai processors that already set a type; nulls were concentrated in legacy group calls.
- **`isNAHTeamEmail` + cached-emails logic in `lib/calls/classifier.ts`** was NOT consolidated — out of scope this sprint. The shared classifier accepts pre-computed `nah_emails[]`. Future cleanup candidate.
- **Cron insert path now sets `source: "ghl_calendar"`** explicitly. The old code never set `source` on insert, which is why Phase 4's guard treats pre-existing cron rows (NULL source) as "don't touch." New inserts will have the correct source going forward.

## Next Step

Triage the 3 `unclassified` legacy calls in the UI — assign correct types manually.
