# MasterSuite Sync Boundaries

This map keeps MasterSuite sync ownership explicit so future cleanup can move route-only orchestration out of API handlers and keep transformation/mapping inside `lib/mastersuite`.

## Boundary rules

- `app/api/cron/sync-ms-*` and `app/api/mastersuite/sync/*` should authenticate, choose a sync window, call one `lib/mastersuite` function, record job metadata, and return a small result.
- `lib/mastersuite/sync-*.ts` owns MasterSuite queries, row filtering, source-to-destination mapping, batching, and Supabase writes.
- Shared connection helpers stay in `lib/mastersuite/client.ts` and `lib/mastersuite/supabase.ts`.
- Health and non-heavy env checks stay in `lib/mastersuite/health.ts`.
- New syncs should add their source tables, destination tables, trigger route/script, and expected idempotency key to this document before implementation.

## Sync inventory

| Sync | Entry points | MasterSuite source | Supabase destination | Idempotency / conflict key | Notes |
| --- | --- | --- | --- | --- | --- |
| Territories | `syncTerritories()` via `app/api/cron/sync-ms-territories/route.ts`, `app/api/mastersuite/sync/territories/route.ts`, `scripts/sync-mastersuite.ts`, `scripts/run-ms-sync.ts` | `Territories` | `territories` | `TerritorySlug` | Cron route also marks territory briefs stale after successful changes. |
| Properties | `syncProperties(since?)` via `app/api/cron/sync-ms-properties/route.ts`, `app/api/mastersuite/sync/properties/route.ts`, scripts | `PropertySummaries` joined to `PropertyDataEntry`; follow-up reads from `PropertyCalculations`, `PropertyInventory`, `PropertyStatusHistory`, royalty-related source rows | `ms_properties`, `ms_property_calculations`, `ms_property_inventory`, `ms_property_status_history`, `ms_property_royalty` | Mostly `PropertyId`; status history is replaced for synced property batches | Filters invalid territory slugs before writes to avoid FK failures. Incremental sync uses `PropertySummaries.LastModified`. |
| Lead-list counts | `syncLeadListCounts()` via `app/api/cron/sync-ms-lead-list/route.ts`, properties route with `type: "lead-list"`, scripts | Lead-list rows/counts from property summary data | `ms_lead_list_counts` | Full replace before insert | Stored in `sync-properties.ts` because it shares property source shape, but route ownership is separate. |
| Prospects | `syncProspects(since?)` via `app/api/cron/sync-ms-prospects/route.ts`, `scripts/run-ms-sync.ts` | Path-to-ownership and franchise prospect source queries in MasterSuite | `contacts`, `journeys`, `journey_contacts`, `journey_pipeline_state` | Existing contact dedupe by normalized email and deterministic `ghl_contact_id`; journey slug generated uniquely | This is the active cron-backed prospect import. Keep contact/journey construction in `lib/mastersuite`, not in routes. |
| PTO prospects | `syncPTOProspects(since?)` from `lib/mastersuite/sync-pto-prospects.ts` | PTO prospect source query | `contacts`, `journeys`, `journey_contacts`, `journey_pipeline_state` | Deterministic `ghl_contact_id` plus normalized email dedupe | Legacy/specialized path split from broader `syncProspects`; avoid adding new route logic until source ownership is clarified. |
| Franchise requests | `syncFranchiseRequests(since?)` from `lib/mastersuite/sync-franchise-requests.ts` | `NewAgainHouses_FormSubmissions` where `FormType = 'FRANCHISE_REQUEST'` and `FormStatus = 'COMPLETE'` | `contacts`, `journeys`, `journey_contacts`, `journey_pipeline_state` | `franchise_req_<FormSubmissionId>` plus normalized email/phone dedupe | Includes local spam filtering and Sales pipeline wiring for existing contacts. |
| EOS | `syncAllEos()` via `app/api/cron/sync-ms-eos/route.ts` | `Eos_Rocks`, `Eos_Todos`, `Eos_Issues`, `Eos_Budgets`, `Eos_Goals`, `Eos_Habits`, `Eos_MarketingChannels`, construction EOS tables, project-management task tables | `eos_territory_*`, `ms_eos_construction_*`, `ms_project_management_*` | Mostly source `Id`/`ms_id`; task notes are replaced before insert | Largest sync surface. Keep additions isolated into small helpers inside `sync-eos.ts` or a new `lib/mastersuite/eos/` folder. |

## Current cleanup seams

- Prospect-style syncs duplicate contact dedupe, journey slugging, and pipeline-state creation. Safest next refactor: extract these into a small `lib/mastersuite/prospect-import.ts` helper with tests before changing route behavior.
- `sync_watermarks` exists as the incremental-sync foundation for `sync-ms-prospects`; the current route still uses the 7-day lookback until the next pass wires cursor reads/writes.
- Property sync contains several independent destination upserts in one file. Safest next refactor: extract pure row mappers first, then add tests around mapper output.
- EOS sync has the broadest table surface. Avoid broad rewrites; split only by destination family when touching a specific failing or changing area.
- Routes already delegate most transformation. Keep that boundary; do not move mapping back into API handlers.

## Validation checklist for MasterSuite cleanup PRs

1. `npm run type-check`
2. `npm run test:cleanup`
3. If sync behavior changed, run the smallest relevant script/route against a safe window or mocked fixture. Do not run heavy live syncs just for doc-only or pure mapper changes.
4. Update this map when a source table, destination table, conflict key, or trigger route changes.
