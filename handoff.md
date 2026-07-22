# Session Handoff — 2026-07-22 — Session 84

## Status

Phase: **Phase 2 (FranDev into the consolidated pages) OPENED AND SPRINTED.** In one overnight run after the session-83 wrap: Panel 1 registered (the ENTIRE property page is now registry-driven — header · main · tab · rail); the **Gunner⇄FranDev workspace switch** built on the Day Hub; the **FranDev hub fully populated** (native top-row clones + Path to Ownership KPI strip + CONVERT/LAUNCH/GROW columns, 100% FranDev-mirror data); the "custom CRM internal pages" design handoff committed and **three internal FranDev detail pages BUILT in the property page's exact skin** (Journey / Territory / Contact V2, cross-linked, core tabs live); **Chiron workspace scoping** shipped (FranDev answers only in the FranDev workspace); team FranDev-access audit run (one gap: Jessica via AdminPanel). PR #303 carries all of it, stacked on the chain #289 → #293 → #294 → #298 → #303 (all on Ben — blocks promotion only). Franchisee-facing Seller/Buyer/Partner pages DEFERRED by Corey. / Health: Green / Duration: full overnight session

## What Was Built This Session

- **Panel 1 registered (property page):** `MainPanels/_MainEconomicsGrid.cshtml` (verbatim sed-move of maps + stage bar + economics grid; JS engine stays on the shell), catalog `PropertyMain`, `main` slot in the resolver, migration `2026-07-22-161` (beta corey@, applied dev). Every region of Corey's annotated image is now a registry panel.
- **Workspace switch (POV model):** Gunner|FranDev toggle beside Mine/Everyone on the Day Hub; `gunner_workspace` cookie; `PageKey='dayhub-frandev'` lineup resolved separately (never falls back to gunner defaults); the switch renders ONLY for users granted frandev rows — the registry is the beta gate. DayHubModel got `IFrandevService`, `ResolveGrantedPanels(pageKey)`, workspace-gated reads.
- **FranDev hub cards** (`DayHubPanels/`): `_FrandevAppointments` / `_FrandevTasks` / `_FrandevInbox` — EXACT Gunner card clones (same .ch/.psearch/.cscroll/.cfoot anatomy + row classes, fixed height regardless of data) over the FranDev GHL mirror (frandev_ghl_appointment / frandev_task + work queue / frandev_sms_message); `_FrandevPipelineKpi` (Path to Ownership stages in the KPI strip — Corey's Panel 2); `_FrandevProspects` (urgency-colored board, GetBoard), `_FrandevLaunch` (Onboarding + Path to Inventory funnels), `_FrandevAlerts` (accountability). CONVERT/LAUNCH/GROW workspace-aware column labels; empty column headers suppressed. `_FrandevScorecard` built then PARKED (catalog kept, row unseeded). Migrations `-162` (edited in place, dev hand-aligned) + `-163`.
- **Design handoff committed:** `docs/custom crm internal pages.` (Journey/Territory/Contact + Seller/Buyer/Partner `.dc.html` mockups + CLAUDE-CODE-PROMPT.md spec).
- **Three CRM detail pages** (all read-only, donor `IFrandevService` reads, no new fields, PROPERTY-PAGE SKIN — Corey's side-by-side correction locked as a standing ruling): `Pages/Frandev/JourneyV2` (`/frandev/journey-v2/{key}`: .ghead Row 0 w/ blank 0B + Merge/Delete stubs, #gunner-stagebar pipeline, brief, tabs Overview·Profile·Territories·EOS — Messages/Documents tabs DROPPED (rail owns those), Profile = six design sections over GetProfileFields, Territories = accordion per linked territory w/ OPERATIONS-YTD + owner + stakeholders, revenue rail card w/ $500k goal bar, .grr-acc rail, Ask Scout capsule); `TerritoryV2` (`/frandev/territory-v2/{slug}`: ownership hero + map placeholder, Ecosystem stakeholder table, Performance = 3x3 KPIs + funnel bars, OPERATIONS-YTD rail card); `ContactV2` (`/frandev/contact-v2/{uuid|ghl-id}`: info grid, Contacts tab w/ journey links, Profile, Personal EOS = goals/issues/todos/habits, snapshot card). Cross-links work: Contact→Journey→Territory.
- **Chiron workspace scoping:** `/Chiron/Panel` principal downgrades `Frandev`→false unless `gunner_workspace` == 'frandev' — on the Gunner side NOBODY (Corey included) can ask about or get FranDev answers; FranDev pages' own Scout endpoint unaffected (commit 42c79316e).
- **FranDev access audit (dev DB):** Frandev permission granted only to matt@; Daniel/Kyle no rows (default deny), christian@/zchrisman@ AdminPanel=0 — all blocked ✓. **Jessica holds AdminPanel=1 → the admin-all shortcut passes her through the FranDev PAGE gate.** Chiron-side she's blocked (ChironPrincipal has no admin shortcut).

## What Is Confirmed Working

- Workspace switch round trip on dev (Corey's browser): FranDev lineup w/ real data (23 prospects 30d · 47 in play · pipeline 41/1/2/3/15 · 12 critical alerts · Denzel SMS threads w/ 1 unread) ⇄ Gunner hub byte-identical; cookie survives reload; top-row cards pixel-match the Gunner cards incl. fixed heights + honest empty states.
- All three CRM pages 200 on dev with real data (jarrod-turner / ATHENS / Jarrod's contact uuid); property-page skin verified against Corey's screenshots; tab switching, accordion rail, Profile sections with real call-extracted intel, journey↔territory↔contact cross-links.
- Panel 1 registry path: grid/stage/maps render; `gunnerRefreshRegions` swaps the carved region in place.
- `dotnet build` 0 errors after every step; Gunner tests 1,213/1,213 (start of run); migrations 161-163 applied to dev.

## What Is Broken or Incomplete

- **JESSICA can reach /frandev pages via AdminPanel=1** (admin-all shortcut in CookieHelper.HasPermission). Corey/Ben decision: remove her AdminPanel or carve Frandev out of the shortcut (Ben's platform code). Verify PRODUCTION permission rows too — audit was dev — High
- Rotate the two exposed API keys (`ApiKey_Anthropic`, `BOLDSIGN_API_KEY` in `~/.zshrc`) — Corey, 5 min, outstanding since session 80 — Medium
- `GetBoard` over-fetches (~3.4k rows incl. nurture pool) for the Active Prospects card — lean Path-to-Ownership read REQUIRED before adding Chad or promoting — Medium
- All CRM-page writes stubbed: stage clicks, ✎ edits, Merge/Delete/Transfer, add-contact chips, Ask Scout capsule unwired on V2 pages — Medium
- Journey EOS tab (the biggest unbuilt design piece: personal + territory EOS, scorecards, lead-gen channel bars, habit grades, rocks/issues/todos grid); Territory Data tab (11 sections) + EOS tab — Medium
- Rail accordions on all three pages are skeletons ("lands in the next pass") — Medium
- Profile "n/m" denominators need the FranDev app's field-catalog port (shows "n filled" today) — Low
- Chiron workspace-scope v1 edge: the cookie is the mode (switch left on FranDev keeps the dock in FranDev on property pages) — Low
- Dev server on 7128 w/ full build (relaunch: `dotnet run --no-build --no-launch-profile` + `ASPNETCORE_URLS`, shell NAH*DB*\*) — Low
- Wave-4 leftovers: prod spot-checks (SMS/booking/dispo/Media-Dropzone), dispo-JS dead-code audit, Overview default-tab wall-clock check — Low

## Decisions Made

- **Chiron ruling:** floating dock = persistent cross-page assistant, NEVER replaced by a header panel; header Panel 0 B = future what-to-do-next window — Corey.
- **All 10 property tabs detached** ("detached garages") — Corey.
- **Day Hub panel numbering:** 1 = top row, 2 = KPI strip (keeps the 'kpi' name), 3 = columns; FranDev columns = **CONVERT / LAUNCH / GROW** — Corey.
- **FranDev top row = same card DESIGN as Gunner, FranDev DATA** (its own GHL sub-account mirror) — Corey.
- **CRM pages use the PROPERTY PAGE's exact visual language** (its stylesheets + .ghead/.gt/.grr/#gunner-stagebar classes) — mockups govern layout/content only — Corey, via side-by-side screenshots.
- **No Messages/Documents tabs on detail pages** — the rail's Activity/Documents own those — Corey.
- **Seller/Buyer/Partner pages DEFERRED** — FranDev-internal first — Corey.
- **Team (Daniel/Kyle/Jessica/Chris) stays off FranDev; Chiron answers FranDev only in the FranDev workspace** — Corey; implemented via the Frandev permission + workspace cookie downgrade.
- Feedback flows EARLY — show Corey each page as soon as it renders — Corey.

## Files Created

- MasterSuite: `Pages/Property/Analysis/MainPanels/_MainEconomicsGrid.cshtml`, `Pages/Gunner/DayHubPanels/_Frandev{Scorecard,PipelineKpi,Prospects,Launch,Alerts,Appointments,Tasks,Inbox}.cshtml`, `Pages/Frandev/{JourneyV2,TerritoryV2,ContactV2}.cshtml(+.cs)`, migrations `2026-07-22-161/-162/-163`
- Sandbox: `docs/custom crm internal pages./` (committed)
- Scratchpad: `v2flip.mjs`, `headerflip.mjs`, `headerfix.mjs` (dev row-flip pattern)

## Files Modified

- MasterSuite: `GunnerPropertyAnalysis.cshtml(+.cs)` (main-slot fork, RegistryMain), `GunnerPanelCatalog.cs` (PropertyMain + 8 FranDev entries), `DayHub.cshtml(+.cs)` (switch, workspace resolve, FranDev reads, column labels, empty-header suppression), `Pages/Chiron/Panel.cshtml.cs` (workspace scoping)
- Sandbox: `handoff.md`, `docs/property-page-panel-registry-phase1b.md`; memories `project_pov_scoping.md` (new), `project_design_rebuild_workflow.md`, `project_panel_consolidation.md`, `MEMORY.md`

## Files Deleted

- None this session (`_HeaderChiron.cshtml` deleted in session 83's Chiron rework)

## Open Issues Carried Forward

- **Ben: merge the chain #289 → #293 → #294 → #298 → #303** (retarget each to main + flip ready as predecessors merge) — blocks promotion only — High
- **Jessica's AdminPanel bypass of the FranDev gate** (+ verify production permission rows) — Corey/Ben — High
- After merges: production verify → promote all registry rows live → delete legacy fallbacks — Medium
- Corey designing Day Hub FranDev cards in background — slot in as `_v2` versions when they arrive — Medium
- Rotate the two API keys — Corey — Medium
- Supabase port plan §7 decisions; GHL appointment-webhook manual toggle — Medium
- Location scoping (territory selector per card) → Kitty Hawk beta; Chad Arnold onto FranDev after Corey verifies (needs the lean board read first) — Medium

## Exact Next Step

Corey eyeballs the FranDev hub (`localhost:7128/Gunner/DayHub` → FranDev) and the three CRM pages (`/frandev/journey-v2/jarrod-turner`, `/frandev/territory-v2/ATHENS`, contact via journey links) and decides the Jessica-AdminPanel question; then build the **Journey EOS tab** (the biggest remaining design piece) followed by rail content + write wiring across the three pages, folding in Corey's new card designs as they arrive.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: I've eyeballed (or will eyeball) the FranDev hub + the three CRM V2 pages on localhost:7128. Build the Journey EOS tab next, then rail content + write wiring on the three FranDev pages (property-page skin, donor reads, no new fields — see memory project_pov_scoping + project_design_rebuild_workflow). Don't wait on Ben (chain #289→#293→#294→#298→#303 blocks promotion only). If I've dropped new Day Hub card designs, slot those in first.

---
