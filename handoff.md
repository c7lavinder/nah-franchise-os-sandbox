# Session Handoff — 2026-08-08 — Session 91

## Status

Phase: **FranDev → MasterSuite fold-in. The FranDev pipeline page is the Gunner pipeline page with journeys in it — built, shipped to production, and verified in a browser.** Three PRs merged and deployed (#661, #663, #664). / Health: Green / Duration: full session

Worktree: `/Users/coreylavinder/Mastersuite/wt-s135-rowlinks`, now parked on branch `s136-done` at `origin/main` (`524a9ece4`). **Clean — nothing uncommitted, nothing unpushed.** The three session branches were merged and deleted on the remote.

## What Was Built This Session

**#661 — the page reaches parity** (`Inventory.cshtml`, `Inventory.cshtml.cs`, new `FrandevService.PipelinePage.cs` + `IFrandevService.PipelinePage.cs` + `Entities/Frandev/FrandevPipelinePage.cs`)

- **Strips align.** The Gunner lens never showed the problem because both its steppers hold six stages, so `flex:1` gave them the same six positions by coincidence. FranDev's hold 6/4/4/3/3, and each spread itself across the full width alone. `.fd-stepper` is one grid `--fd-cols` wide (the longest pipeline on the page), so stage 1 sits under stage 1 and a short pipeline stops early instead of re-centring.
- **The control bar** — sorting, download, quick filters, in the property lens's idiom. Facets are urgency / pipeline / source / territory, every chip read from the journeys in scope (`GetPipelineFacetOptions`) so none can be clicked into an empty list. A Territories stage gets a deliberately shorter bar: those rows have no urgency, no source, no days-in-stage.
- **Hide closed** in the same slot beside Pipeline | Kanban, **different default on purpose** — a terminal property is a finished deal, a terminal journey is an owner who signed. Off unless asked for, own localStorage key. The quick-filter pin store is per-lens too (a shared key had each lens purging the other's pins as "stale").
- **The row** wears the property row's anatomy: two time chips, stage chip, name over contact, source / territory / pipeline / urgency, plus the next-open-task pill from ONE batched read (`GetPipelineNextTasks`).
- **The pull-down** is the property pull-down's own `.pxd` skeleton, no new CSS: people + sub-stages left, conversation middle (shared `_GunnerConversation`), workflow right. Territory rows got the panel too.

**#663 — the row opens it, and a dead read stops hiding** (`Inventory.cshtml`, `_FrandevLeadPanel.cshtml`, `FrandevService.PipelinePage.cs`)

- **Whole row opens the pull-down**, like the property row. Reverses s135's row-navigates behaviour — the journey page is still cmd-click and the panel's **Open journey →** link.
- Each panel read is `Guarded()` on its own; the reason lands on `FrandevPanelExtras.ReadError` and **the panel prints it**. Primary contact always gets a tile; people falls back to `GetQuickPanel`'s members.
- **Urgency and Name sorts deleted** (Corey: "not needed").

**#664 — the collation fix** (`FrandevService.PipelinePage.cs`)

- `COALESCE(j.Slug, CAST(j.Id AS CHAR))` mixed `utf8mb4` with a CAST result. **Passed on dev, failed on every production row**, and because the throw was in the HEAD read it took the whole panel with it. Slug and Id now come back as separate columns and C# picks. Same treatment for the territory head's `Nickname`.

## What Is Confirmed Working

- **Verified in a browser on production, by clicking it** — click any journey row → the three-column pull-down opens with the contact tile (name · primary · phone), **Open journey →** resolving to `/frandev/journey-v2/jarrien-jones`, the stage's sub-stage checklist, a live conversation composer, and an honest empty Workflow card. Handler probed directly: `contactResolved` is a real uuid, `readError` empty.
- **Strips align on screen** — Path to Ownership 6 / Onboarding 4 / Path to Inventory 4 / Territories 3 / Follow-up 3, all on the same six columns.
- **Sort bar is P and S only**, with Download / Quick filters / Customize.
- **CI green on all three PRs**; six gating suites run locally each time (Valuation 852, Coaching 255, Gunner 1633, Training 37, Chiron 194, Platform 74 = 3,045, 0 failures). Full `dotnet test MasterSuite.sln`: **5,083/5,083**.
- **All three deploys succeeded** (build-test ✅, deploy ✅); prod responds 200.
- Every new query was run against the dev database read-only — which caught the territory-owner collation bug before it shipped.

## What Is Broken or Incomplete

- **The pull-down is mostly empty space on a quiet journey** — the shared `.pxd-cols` height is `clamp(540px, 88vh, 1100px)`, right for a busy property and tall for a journey with no messages and no workflow. Cosmetic, not yet raised by Corey — Low
- **Workflow column is empty for nearly everyone** — every FranDev workflow is paused to DRAFT pending content. Honest, not broken — Low
- **The next-task pill will show on ~one row** — `frandev_task` holds exactly ONE open task platform-wide. Wiring verified; data is simply thin — Low
- **FranDev strip counts do not narrow with the quick filters** — pre-existing; the strip is how you navigate to a stage, and the `data-wire` note now says so out loud — Low
- **The Gunner search box still drops quick filters and Hide closed on submit.** Fixed on the FranDev side only, deliberately, because Corey said not to touch Gunner. Real bug, reported not fixed — Medium
- Writes not wired on the FranDev record pages — profile fields, notes, team, stakeholders still render honest empty states — Medium
- No `MasterSuite.Modules.Frandev.Tests` — this session's whole service layer has no unit coverage — Medium

## Decisions Made

- **Hide closed defaults OFF under the FranDev lens** (Gunner's defaults ON). A terminal journey is an owner who signed — Onboarded, Running, Closed are the franchise base, and defaulting them off-screen would hide the business — Claude, flagged to Corey
- **Row click opens the pull-down, reversing s135** — Corey ("it does not have the inline pull down on rows" + "the pages should be almost identical"). Journey page kept via cmd-click and the panel's own link
- **Urgency and Name sorts removed** — Corey ("not needed")
- **New service methods rather than widening `GetLeadRows`** — that read is also the Contacts page's and wants none of this; the SELECT is shared so rows cannot drift — Claude
- **Merging = deploying to production**, and Corey asked for it explicitly after being told the page was unverified — Corey
- **A duplicate `const:` wire-prefix fix was dropped, not merged** — PR #657 landed the same fix mid-session, plus a `sql:` branch and Platform.Tests joining CI — Claude

## Files Created

- `apps/analysis-api/Entities/Frandev/FrandevPipelinePage.cs`
- `apps/analysis-api/MasterSuite.Modules.Frandev/FrandevService.PipelinePage.cs`
- `apps/analysis-api/MasterSuite.Modules.Frandev/IFrandevService.PipelinePage.cs`

## Files Modified

- `apps/analysis-api/MasterSuite/Pages/Gunner/Inventory.cshtml`
- `apps/analysis-api/MasterSuite/Pages/Gunner/Inventory.cshtml.cs`
- `apps/analysis-api/MasterSuite/Pages/Gunner/_FrandevLeadPanel.cshtml`
- `apps/analysis-api/Entities/Frandev/FrandevLeadRow.cs`
- `apps/analysis-api/MasterSuite.Modules.Frandev/FrandevService.Pipeline.cs`
- Sandbox: `handoff.md`

## Files Deleted

- None

## Open Issues Carried Forward

- **⚠️ COLLATIONS — three bugs in one feature, all the same shape.** `frandev_*` ids are `CHAR(36) ascii_bin`; names and slugs are `utf8mb4`. Any `CAST`/`COALESCE`/`CONCAT`/`GROUP_CONCAT` mixing the two can throw `Illegal mix of collations` — **and MariaDB does not decide it the same way on dev and prod.** Never let two collations meet in one expression when C# can do the job — High
- **Running SQL against the dev database is NOT full verification.** It proves the queries parse and run _there_; it does not prove they run on prod, and it never exercises the C# mapper. Both gaps hid bugs this session — High
- **Local browser verification is still impossible** (`CookieHelper.RedirectIfNotAuthenticated` wants a `jwt`; the signing secret is not on the machine) — **but driving Corey's Chrome at production works and is now the way to check UI.** That is how the panel bug was found — Medium
- **Corey to flip the dev pill on a journey in prod** — retire a tab, reload, put it back. Carried a fifth session — High
- **Ben still blocking the production `frandev_%` GRANT** for the outbound sync — High
- **The two URL families still coexist** — `/frandev/journey/{key}` (v1) beside `/frandev/journey-v2/{key}`. Most FranDev-native pages still point at v1; the older board at `/frandev/pipeline` and list at `/frandev/territories` were left alone per Corey — Medium
- Carried: Jessica AdminPanel bypass + prod permission audit; API key rotation; prod rollout data flips (nav row 76, Chad/Corey grants); `FRANDV` territory row absent from prod — High/Medium

## Exact Next Step

Open `/Gunner/Inventory` on a FranDev stage, click a Territories dot and then a territory row, and confirm the territory pull-down resolves an owner the way the journey one now does — it is the one path in this feature that was built and deployed but never clicked.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Open /Gunner/Inventory on a FranDev stage, click a Territories dot and then a territory row, and confirm the territory pull-down resolves an owner the way the journey one now does — it is the one path in this feature that was built and deployed but never clicked.

---
