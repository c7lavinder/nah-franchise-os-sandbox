# Session Handoff — 2026-07-29 — Session 86

## Status

Phase: **FranDev → MasterSuite fold-in. Two workstreams: (1) unblock the production data load, (2) a wiring pass over the consolidated pages.** The headline discovery is that production ALREADY has all 116 `frandev_` tables and all 18 FranDev migrations — they are simply **empty**. So the prod job is a data load, not a schema job, and it is blocked on exactly one thing: a database GRANT only Ben can issue. While that waits, roughly **half the Day Hub already returns real numbers on production**, because those cards read MasterSuite's own tables (`Territories`, `PropertyInventory`, `PropertySummaries`, `PropertyStatusHistory`) rather than the FranDev mirror — Corey's insight, and the lever for aligning most things without Ben. Two PRs opened: **#409** (the grant) and **#412** (the wiring pass). / Health: Green / Duration: full session

## What Was Built This Session

- **Prod-target capability for the outbound push** (sandbox): `lib/mastersuite/write-client.ts` gained `MASTERSUITE_WRITE_TARGET` = `dev` (default) | `prod`. Prod resolves `MASTERSUITE_PROD_DB_*` with **no fallback chain** on purpose (a typo must fail loudly, never silently fire 97,818 rows at dev), plus `assertNotReadOnlyUser` which refuses the SELECT-only reporting account _before_ connecting. Dev keeps the original `/prod/i` host refusal. Cron + script report which database they wrote to.
- **The grant script for Ben** (MasterSuite PR #409): `database/2026-07-29_grant_frandev_sync_write.sql` — 116 explicit GRANT lines generated from production's own `information_schema`, deliberately NOT a migration (one-time permission change; the runner would try it on dev where the account does not exist).
- **Inventory Watch fix** (`FrandevService.DayHubCards.cs`, `_FrandevInventoryWatch.cshtml`): new `Frandev_AbandonedFlipDays` (default 1095) filters the LIST only; the three counts keep the unfiltered definition so the Day Hub and Territory page never disagree.
- **Pipeline count fix** (`FrandevService.Pipeline.cs`): `GetLeadRowCount` now mirrors `GetLeadRows`' own rule — states when a stage filter is active, distinct journeys when not.
- **Territory rows** (`FrandevService.Pipeline.cs`, `IFrandevService.cs`, `Inventory.cshtml(.cs)`): `GetTerritoryRows`/`GetTerritoryRowCount` + `FdRowKind` + a territory row block. Sourced from **native `Territories`**, not the mirror. Stage dot moved to the same source. Page counts now say what they count (properties / journeys / territories).
- **Permission gate** (`Program.cs`, `DayHub.cshtml.cs`, migration `2026-07-29-184`): `Frandev` admitted to `/Gunner/{DayHub,CallsV2,Inventory}` only; `dayhub-frandev` rows moved onto the `Frandev` permission; Day Hub picks the frandev lens when that is the only world granted.
- **Test-runner migration** (4 `.csproj`): `CommonWebUtilitiesTests`, `DataAccess.Tests`, `FormatHelpersTests`, `ServiceEngineTests` moved to Microsoft.Testing.Platform; duplicate MSTest PackageReferences dropped.
- **Docs landed** (sandbox): `docs/workflows-catalog.md` (1,324 lines), `docs/core-workflows.md`, `docs/design_handoff_messaging_hub/`.

## What Is Confirmed Working

- **Production reality, queried directly:** 116 `frandev_` tables + `frandev_native_write` present, all 18 FranDev migrations recorded, **every table 0 rows**. Nav rows 76/77 `Enabled=0`. No `FRANDV` Territories row (migration -168 never merged to main).
- **The prod account is read-only, proven empirically** — `SHOW GRANTS` says `GRANT SELECT ON mastersuite.*` and nothing else, and INSERT/UPDATE/DELETE against `frandev_` tables all return `ER_TABLEACCESS_DENIED_ERROR` inside a rolled-back transaction.
- **Full dry-run against PRODUCTION schema: 115 tables planned, 92 with rows, 97,818 rows, 0 skipped, 0 errors.** Engine is upsert-only (`INSERT … ON DUPLICATE KEY UPDATE`), no row-removal statements anywhere.
- **All three write-client guards tested:** dev dry-run works, prod-without-credentials refuses, prod-pointed-at-the-read-only-account refuses before connecting.
- **Day Hub structural wiring:** all 15 enabled FranDev cards have a catalog entry, a partial on disk, and reads that are genuinely fetched. All 15 degrade cleanly with no data.
- **Half the Day Hub live on production today:** System Scorecard (13 houses/30d, 43 contracts, $21,210 avg profit), Inventory Watch (174 active flips, 103 past 120d), Time to Launch (55 launches, PIELLA 74d), Quarter Goal (10 territories YTD).
- **All 5 FranDev pipelines present and rendering** — sales (67 active), onboarding (53), runway (48), territories (85), followup (3,021). All 5 registry strips match a real pipeline slug; no orphans either direction.
- **All 17 journey stages report dot = header = rows**, with the six multi-territory rows correctly counted twice.
- **Territory rows verified on BOTH databases:** dot equals row count for active/inactive/available on production (59/30/0, mirror empty) and dev (same, mirror full). Production renders TRI at 32 in inventory / 29 bought in 12 months; dev adds owner names.
- **`dotnet test MasterSuite.sln` — 3,808 tests, 0 failures.** `dotnet build` 0 errors after every commit.
- Migration -184 applied to dev; all 20 `dayhub-frandev` rows confirmed on `perm=Frandev`.

## What Is Broken or Incomplete

- **Production `frandev_` tables are still empty** — blocked on PR #409 — High
- **Nothing in this session was verified in a browser.** Every claim is from SQL and builds. The territory rows are new markup nobody has seen rendered — Medium
- `Program.cs` permission-gate widening needs Ben's explicit sign-off, not a silent merge — Medium
- No `MasterSuite.Modules.Frandev.Tests` exists — FranDev code has zero unit coverage — Medium
- Pages not yet audited: Contacts, Inbox, Tasks, Calendar, Activity, Knowledge, unified call detail — Medium
- `FRANDV` territory-selector row absent from prod; migration -168 never merged to main — Medium
- Territories strip stage `available` maps to nothing (no native equivalent; 0 rows either side today) — Low
- Owner/Region read blank on production territory rows until the mirror fills — Low, by design

## Decisions Made

- **Production is loaded BY HAND, never on a schedule** — "no one is using the frandev in mastersuite so it does not have to be perfect, just need to ensure everything looks good and wired up." Load once, build against it, refresh on demand, final load at cutover. The Vercel cron stays pointed at dev — Corey
- **Territory rows source native `Territories`, not the `frandev_` mirror** — makes the strip work on production before any load, and guarantees dot and list cannot drift — Claude, on Corey's "align the majority without Ben" steer
- Inventory Watch counts keep the unfiltered definition while the list filters — page-to-page consistency beats internal tidiness — Claude
- The grant ships as a one-time script, not a migration — it is a DBA action and the runner would attempt it on dev — Claude
- Ready to Dial staying off the top row and `frandev_scorecard` staying parked are **Corey's existing decisions**, re-confirmed, not bugs — Corey (2026-07-25, via migration -176)

## Files Created

- MasterSuite: `database/2026-07-29_grant_frandev_sync_write.sql`, `DatabaseMigrationRunner/Migrations/2026-07-29-184_FrandevDayHubCardsOnFrandevPermission.sql`
- Sandbox: `docs/core-workflows.md`, `docs/workflows-catalog.md`, `docs/design_handoff_messaging_hub/` (2 files)

## Files Modified

- Sandbox: `lib/mastersuite/write-client.ts`, `app/api/cron/push-frandev/route.ts`, `scripts/push-frandev-to-mastersuite.ts`, `.claude/settings.json`
- MasterSuite: `MasterSuite.Modules.Frandev/FrandevService.DayHubCards.cs`, `FrandevService.Pipeline.cs`, `IFrandevService.cs`, `MasterSuite/Pages/Gunner/DayHubPanels/_FrandevInventoryWatch.cshtml`, `Inventory.cshtml`, `Inventory.cshtml.cs`, `DayHub.cshtml.cs`, `Program.cs`, and 4 test `.csproj` files
- Dev DB: `MasterSuiteUI_PagePanels` — 20 `dayhub-frandev` rows moved to `Permission='Frandev'`

## Files Deleted

- None. **Six `journey_pipeline_state` rows were deleted and then fully restored** — see Open Issues.

## Open Issues Carried Forward

- **PR #409 (the grant) — everything about the production load waits on Ben.** One file, run once — High
- **PR #412 (wiring pass) — needs Ben, and the `Program.cs` commit specifically** — Medium
- **Mistake worth remembering: six pipeline states were deleted as "duplicates" and were not.** Onboarding/runway are `entity_type='territory'` and fan out one state per (journey, territory) — Phil Dunbar owns BUCKMT+DELACO, Eric Wilkening FREDVA+CLTW, Erik Spersrud SASOTA+INDYNW. Grouping on (journey, stage) without checking `TerritorySlug` is what caused it. All six restored to Supabase and the mirror, verified byte-identical against the pre-delete backup. **There are no duplicate states to clean** — Resolved, but do not repeat
- Corey to eyeball the Day Hub and pipeline page, especially the new territory rows — Medium
- Carried from prior sessions: Jessica AdminPanel bypass + prod permission audit; API key rotation; prod rollout data flips (nav row 76, Chad/Corey grants); Retry FAILED→PENDING worker-repick confirmation — High/Medium

## Exact Next Step

Ask Ben to run `database/2026-07-29_grant_frandev_sync_write.sql` against production (PR #409) — then set `MASTERSUITE_WRITE_TARGET=prod` plus `MASTERSUITE_PROD_DB_*` and run `npx tsx scripts/push-frandev-to-mastersuite.ts` once to load all 97,818 rows.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Ask Ben to run `database/2026-07-29_grant_frandev_sync_write.sql` against production (PR #409) — then set `MASTERSUITE_WRITE_TARGET=prod` plus `MASTERSUITE_PROD_DB_*` and run `npx tsx scripts/push-frandev-to-mastersuite.ts` once to load all 97,818 rows.

---
