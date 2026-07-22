# Session Handoff — 2026-07-22 — Session 85

## Status

Phase: **Phase 2 sprint 2 — Corey's three design handoffs BUILT AND WIRED in one session.** (1) The Day Hub FranDev workspace now runs Corey's FINAL card designs: 13 new registry cards (CONVERT: Today's Target · Q3 Goal · New Journeys · Weekly Scorecard / LAUNCH: Onboarding · Runway · Time to Launch / GROW: System Scorecard T30 · Inventory Watch · Territory Grades · Calls) plus a new Ready to Dial top-row card and the 5-cell internal KPI strip w/ pipeline health — all over 4 new gated donor reads, migration -164 seeds them beta-corey@ and retires the v1 interim cards (Enabled=0, data-only rollback). (2) The UNIFIED CALLS PAGE (`/Gunner/CallsV2`, mock 1a) — frandev type-panels + upcoming rail + drop zone, workspace-scoped exactly like the Day Hub: Gunner side = the 7 locked acquisition call types over gunner*call, FranDev side = sales/onboarding/coaching/team/group over frandev_call; drag-retype PERSISTS on both sides (new journaled SetCallType for frandev, existing ReclassifyCall for gunner — id shape picks the table); old calls pages untouched pending promotion. (3) CRM V2 remaining passes: Journey EOS tab (personal + per-territory), Territory Data tab (11 sections, market fields keyed to the app's real field registry) + EOS tab (+Construction EOS) + Performance period chips + Stage-4 offers, rail content wired with real counts on all three pages, and FIRST WRITES — clickable stage bar (advance/revert/close/drop via the journaled donor writes), task toggles, phone/email inline edit, Scout ctx links. Post-wrap 4th commit (72fc6083c): **lean Ready-to-Dial read** (Day Hub no longer triggers the ~3.4k-row GetBoard at all — the Chad/promotion prerequisite is CLEARED) + card targets moved to SystemConfig (`Frandev_Goal*\*`, migration -165 applied). All on new branch `frandev-dayhub-calls-crm` (4 commits, pushed) stacked on the #289→#303 chain. Review-brief Artifact published, Corey approved → **PR #306 OPENED** (base gunner-frandev-workspace; chain now #289→#293→#294→#298→#303→#306, all on Ben). / Health: Green / Duration: full overnight session

## What Was Built This Session

- **Day Hub card set v2** (commit 376074d8a): `FrandevService.DayHubCards.cs` (+interface/entities) — GetConvertCards/GetLaunchCards/GetGrowCards/GetDayHubKpis; 13 partials in `DayHubPanels/`; tinted Convert/Launch/Grow column header cards; migration `2026-07-22-164` applied to dev. Fetch failures now log to stderr (caught a bad appointment join during the build).
- **Unified Calls** (commit c2c706e1a): `Pages/Gunner/CallsV2.cshtml(.cs)`, `GunnerService.CallsV2.cs` (stats, upcoming appointments, RequeueCallGrading), `FrandevService.CallsV2.cs` (GetCallGrades, GetScheduledCalls, SetCallType journaled to frandev_native_write). Status chips w/ live counts, Failed/Bad-audio trays, upload+paste ingest (frandev), 290px upcoming rail.
- **CRM V2 pass 2** (commit 4c81f281f): JourneyV2 + TerritoryV2 + ContactV2 — EOS/Data tabs, rail content, writes as above. Rail sections without donor reads (Offers/Team/Notes, territory calls/tasks/docs) render honest empty states.
- Sandbox: committed `docs/dayhub-handoff/` + `docs/calls-handoff/` (f6bd532); mocks also copied into MasterSuite `docs/frandev-design/`.

## What Is Confirmed Working (dev 7128, Corey's authenticated browser)

- FranDev Day Hub: all 13 v2 cards render real mirror/native data (47 active journeys, 59 territories, 14 houses T30, bottleneck bars w/ worst-step red, graded calls w/ CT times); Ready to Dial heat-ranked w/ contact links; KPI strip + health gauge; tinted column headers; Gunner workspace byte-identical.
- CallsV2 both workspaces: gunner all-range board shows outcome pills + grade chips + reps; retype round-tripped live on BOTH tables (gunner 218582, a frandev intro call) — changed and reverted, ok:true.
- JourneyV2 (jarrod-turner): stage bar w/ done-checks + clickable tiles, EOS tab, rail counts. TerritoryV2 (ATHENS): Data tab w/ real owner/address/business fields + "n filled" counters, EOS tab w/ real goals/scorecard/$945 spend/channel bars/habit grades/rocks-issues-todos, owner journey link. ContactV2: 200 w/ Personal EOS + ToggleTask/ContactEdit handlers.
- `dotnet build` 0 errors after every stage; migration runner: 164 + 165 applied clean.
- Lean GetReadyDial read live (8 heat-ranked prospects render from the dedicated query; GetBoard no longer runs on the Day Hub); config-backed targets render from the seeded `Frandev_Goal_*` rows.

## What Is Broken or Incomplete

- JourneyV2 stage-advance not exercised live (would move a real dev journey; handlers are verbatim ports of the E2E-tested donor) — Corey should click one through — Medium
- Gunner Retry assumes the grading worker re-picks PENDING (FAILED→PENDING flip) — confirm w/ Ben before promoting — Medium
- Time to Launch measures sign→first HOUSE (labeled honestly); "first marketing live" isn't tracked anywhere — Low
- Territory Grades = compliance buckets (dev data skews all-F); no quarterly grade-drop history — Low
- Deferred by design: recording↔scheduled matcher, + Schedule flow, gunner ingest, Merge/Delete/Transfer writes, EOS write-back, profile-field editing beyond phone/email, rail reads for Offers/Team/Notes — see review brief
- Carried: Jessica AdminPanel bypass + prod permission audit (High); API key rotation (Corey). ~~GetBoard over-fetch~~ CLEARED — 4th commit 72fc6083c: lean GetReadyDial read (Day Hub no longer triggers GetBoard at all) + card targets → SystemConfig `Frandev_Goal_*` (migration -165, applied)

## Decisions Made

- v1 interim FranDev cards retired by data (Enabled=0), code kept for rollback.
- CallsV2 ships as a NEW page; legacy pages untouched until Corey/Ben approve promotion.
- FranDev retype writes the mirror + journals to frandev_native_write (replay contract), matching the write-phase pattern.
- Empty-state honesty rule carried through: no fake zeros, no "Needs Review"/"Graded" pill labels.

## Files Created

- MasterSuite: `Entities/Frandev/FrandevDayHubCards.cs`, `Entities/Frandev/FrandevCallsV2.cs`, `Entities/Gunner/GunnerCallsV2Stats.cs`, `MasterSuite.Modules.Frandev/{FrandevService,IFrandevService}.DayHubCards.cs` + `.CallsV2.cs` (incl. GetReadyDial), `MasterSuite.Modules.Gunner/GunnerService.CallsV2.cs`, `Pages/Gunner/CallsV2.cshtml(.cs)`, 13 `DayHubPanels/_Frandev*.cshtml`, migrations `2026-07-22-164` + `-165`, `docs/frandev-design/{dayhub,calls}/`
- Sandbox: `docs/dayhub-handoff/`, `docs/calls-handoff/` (committed)

## Files Modified

- MasterSuite: `GunnerPanelCatalog.cs` (+13 entries), `DayHub.cshtml(.cs)` (4 reads, tinted headers, fetch logging, stray tag fix), `IGunnerService.cs`, `Pages/Frandev/{JourneyV2,TerritoryV2,ContactV2}.cshtml(.cs)`
- Sandbox: `handoff.md`, memories

## Files Deleted

- None

## Open Issues Carried Forward

- Ben: merge the chain #289→#293→#294→#298→#303→**#306** (retarget each to main as predecessors merge); confirm the Retry FAILED→PENDING worker-repick assumption — High
- Jessica AdminPanel bypass + production permission rows — High
- Corey: eyeball all three surfaces + click a stage advance through; API keys — Medium

## Post-Wrap Addendum — merge preview

Local branch `integration-preview-all-merges` (NOT pushed) = chain tip + origin/main (main already contains merged #287 + 12 more commits). **Merge is CLEAN — zero conflicts**; build 0 errors; dev DB 0 pending; FranDev hub / CallsV2 / CRM pages / legacy pages all verified rendering on the merged build. Dev 7128 now SERVES this post-merge build (wt-panels checkout = the preview branch; PR branch untouched). Notes for Ben: duplicate migration number 156 (main's GunnerPushClaim vs chain's PagePanels — cosmetic, runner tracks filenames); one transient registry-read miss on first request after restart fell back to the Gunner lineup as designed, self-healed.

## Exact Next Step

Corey eyeballs the three new surfaces on dev 7128 (Day Hub → FranDev; /Gunner/CallsV2 in both workspaces; the three CRM pages incl. a real stage-bar click), PR #306 is open — chain on Ben. Next build candidates: calls-page promotion (replace the two legacy pages), the deferred write set (Merge/Delete/Transfer, EOS write-back), recording↔scheduled matcher.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: I've eyeballed (or will eyeball) the Day Hub FranDev v2 cards, /Gunner/CallsV2 (both workspaces), and the three CRM V2 pages on localhost:7128. PR #306 is open (chain #289→…→#306 on Ben). Pick up: calls promotion / deferred writes / recording↔scheduled matcher (lean board read DONE). Chain #289→#303 still on Ben — blocks promotion only.

---
