# Session Handoff — 2026-07-08 — Session 66

## Status

Phase: FranDev native rebuild INSIDE MasterSuite — Phase 2 read-only screens complete, PR open / Health: Green / Duration: full session

**Important:** this session's work lives in the **MasterSuite repo**, not this sandbox. Worktree: `/Users/coreylavinder/Mastersuite/mastersuite-frandev-wt`, branch `frandev-module`, **PR #103** → https://github.com/NewAgainHouses/mastersuite/pull/103. Local run: `dotnet run --no-build --no-launch-profile --urls http://localhost:28657` in `apps/analysis-api/MasterSuite/` (creds: `eval "$(grep '^export NAH_DB' ~/.zshrc)"` first — launchSettings.json has an empty password that overrides the shell, hence `--no-launch-profile`).

## What Was Built This Session

- **`MasterSuite.Modules.Frandev` project** — replaced the HelloWorld stub; mirrors Gunner's current module shape (partial `FrandevService` split by domain, `IFrandevService`, POCOs in `Entities/Frandev/`, Razor Pages inheriting shared `FrandevPageModel` auth base). Registered in DI + solution + ServiceEngine refs.
- **8 read-only screens**, all verified against live dev-DB data (fed by the nightly sync):
  1. `/frandev` — dashboard (contact/journey/call counts, journeys by stage)
  2. `/frandev/pipeline` — Path to Ownership (stage bar per pipeline w/ counts + click-filter, urgency pills Fresh/At Risk/Losing/Won computed in SQL, search/sort/paging, expandable quick panel via JSON handler)
  3. `/frandev/journey/{slug|uuid}` — journey detail (pipeline position tracks, AI journey brief w/ next actions, graded calls, tasks, stage history, EAV candidate profile w/ source badges, documents, members sidebar; tabs Overview/Profile/Documents)
  4. `/frandev/calls` — category panel board (slug→title-keyword categorization, week/month/all filter, bad-call + needs-review flags)
  5. `/frandev/call/{id}` — call detail (summary bullets + full-text toggle, rubric grade w/ per-criterion bars + rationale, speaker-turn transcript parser, action items, participants, journey links)
  6. `/frandev/workflows` + `/frandev/workflow/{id}` — catalog w/ status tabs + health grades; day-by-day execution blueprint w/ DRC badges (needs-approval vs auto-fires)
  7. **Revenue card** on journey Overview — FIRST live-native read: queries `PropertyInventory`/`PropertySummaries`/`PropertyRoyalty` in place (no ms\_ synced copies); pace badge ($460k/10yr), Fee/Paid/Due pills, $500k goal bar w/ network-median marker
- **Launch plumbing**: `MasterSuitePermissions.Frandev` + `/frandev` middleware gate in `Program.cs` (mirrors Gunner gate; local dev skips) + idempotent migration `2026-07-08 - FranDev permission + nav item.sql` (UserPermissionNames row + top-level nav `/v2/frandev` seeded `Enabled=0`) — **already applied to the dev DB**.
- **PR #103 opened** with full screen table + Ben's to-do list.

## What Is Confirmed Working

- All 8 screens return HTTP 200 with real data: 3,175 contacts / 3,136 active journeys on dashboard; 5 pipelines w/ correct stage counts; joanne-mccann journey (20 graded calls A–D, 27 profile fields, brief w/ actions); calls board 200 calls across 6 panels; call detail w/ grade B + 6 criteria + 106 transcript turns; 20 workflows, New Lead 30-Day = 18 steps/11 days; Revenue card $15,694 paid / Ahead of pace / median $27,500.
- Build clean (`0 Error(s)`), 5 commits pushed to `frandev-module`.
- Dev-DB migration applied + verified (permission row + disabled nav row).

## What Is Broken or Incomplete

- FranDev migrations NOT run on **production** MariaDB (Ben's step; dev has them) — High (blocks any prod deploy)
- `contacts.franchise_fee` has NO MySQL home (not in frandev_contact, not in MS tables — deliberate dedup left it orphaned); Revenue pill shows "—" — Medium (Ben decides ownership)
- Nav item seeded disabled + no per-user permission grants yet (by design until launch) — Low
- All write actions (stage advance/revert/drop, call upload, workflow editing, GHL pushes, Scout) not built — by design; **writes require the source-of-truth conversation with Ben first** (nightly sync would overwrite MySQL edits today)
- Messaging Hub skipped: only 9 SMS rows synced (messages still live in GHL) — Low
- Sandbox repo untracked leftovers (docs/core-workflows.md, docs/workflows-catalog.md, docs/design_handoff_messaging_hub/, modified .claude/settings.json) still need cleanup — Low

## Decisions Made

- FranDev = its own module (`MasterSuite.Modules.Frandev`) at route `/frandev` — Corey
- Build as `MasterSuite.Modules.*` project, NOT by growing the old ServiceEngine stub (Gunner outgrew that pattern) — Corey approved via "keep going"
- Read-only Phase 2 slices before any writes — implicit in phased plan Corey approved
- Scout will extend Chiron (MasterSuite's existing Claude integration) instead of greenfield — reaffirmed
- uuid PKs typed as `Guid` in entities (MySqlConnector returns CHAR(36) as Guid); browser ids validated with `Guid.TryParse` before SQL interpolation — Claude, pattern-level

## Files Created

(all in MasterSuite repo, `apps/analysis-api/` unless noted)

- `MasterSuite.Modules.Frandev/` — `MasterSuite.Modules.Frandev.csproj`, `FrandevService.cs`, `IFrandevService.cs`, `FrandevService.{Dashboard,Pipeline,Journey,Calls,Workflows,Revenue}.cs`
- `Entities/Frandev/` — `FrandevDashboardSummary.cs`, `FrandevStageCount.cs`, `FrandevStageBarItem.cs`, `FrandevLeadRow.cs`, `FrandevQuickPanel.cs`, `FrandevJourneyDetail.cs`, `FrandevCallDetail.cs`, `FrandevWorkflow.cs`, `FrandevRevenueInfo.cs`
- `MasterSuite/Pages/Frandev/` — `FrandevPageModel.cs`, `Pipeline.cshtml(.cs)`, `Journey.cshtml(.cs)`, `Calls.cshtml(.cs)`, `Call.cshtml(.cs)`, `Workflows.cshtml(.cs)`, `Workflow.cshtml(.cs)`
- `database/migrations/2026-07-08 - FranDev permission + nav item.sql`

## Files Modified

- `MasterSuite/Pages/Frandev/FrandevIndex.cshtml(.cs)` — stub → dashboard
- `MasterSuite.sln`, `ServiceEngine/ServiceEngine.csproj`, `ServiceEngine/CrossProjectConfigurationHelpers/DependencyInjectionConfig.cs`
- `MasterSuite/Program.cs` — /frandev permission gate
- `Entities/Constants/MasterSuitePermissions.cs` — Frandev const

## Files Deleted

- `ServiceEngine/Services/FrandevService.cs` (HelloWorld stub)
- `DataAccess/DataAccess.Frandev.cs` (empty stub)

## Open Issues Carried Forward

- Ben: run 9 FranDev migrations + the new permission/nav migration on production MariaDB — High
- Ben: decide franchise-fee ownership (no MySQL home) + LegalEntity / frandev_franchise_owner items flagged in migrations — Medium
- Source-of-truth flip plan (per-domain) needed before any write features — High (gates Phase 3)
- Scout-on-Chiron design (incl. RAG without pgvector) — Medium
- Sandbox repo untracked docs cleanup — Low

## Exact Next Step

Check PR #103 for Ben's feedback; if none yet, build the FranDev home page into a proper landing screen with navigation tiles (worktree `/Users/coreylavinder/Mastersuite/mastersuite-frandev-wt`, branch `frandev-module`).

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Check PR #103 for Ben's feedback; if none yet, build the FranDev home page into a proper landing screen with navigation tiles (worktree /Users/coreylavinder/Mastersuite/mastersuite-frandev-wt, branch frandev-module).

---
