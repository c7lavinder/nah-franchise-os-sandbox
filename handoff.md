# Session Handoff — 2026-08-08 — Session 92

## Status

Phase: **FranDev → MasterSuite fold-in. An audit session, not a build session — the three record pages and the pipeline page were read, clicked on production, and checked against the live database. Four fixes found, fixed, shipped and verified.** PR #667 merged and deployed. / Health: Green / Duration: full session

Worktree: **none — cleaned up.** `wt-s138-audit` and branch `s138-record-audit-fixes` were removed after the merge; the remote branch is still on GitHub, matching the house pattern. Nothing uncommitted, nothing unpushed.

## What Was Built This Session

**First: the backfill question, answered with a query rather than a memory.**

- **Production holds 99,711 FranDev rows across 92 of its 116 `frandev_` tables, loaded 2026-08-01** (commit `350f4bd`). Verified live this session — the count still matches exactly. The other 24 tables are empty _in Supabase too_, so they are honest, not failed.
- The Aug 1 load matched source exactly after three quiet bugs were fixed that day: the prod guard was blocking the very account Ben's GRANT had just enabled, `insertBatch` was swallowing driver errors, and MariaDB's `json_valid()` CHECK was rejecting bare scalars.
- **The data is a snapshot.** Newest contact/journey is Jul 30; it does not move until someone re-runs the push. Corey's call this session: no refresh yet — the territory/property half of every page is live MasterSuite anyway.

**Then the audit — read the code, clicked production, ran the reads against the live DB.**

- Every panel on all three record pages traced registry → catalog → partial → read. Dev mode's own scorecards agree: journey **18/18 cards, 21 values wired**; contact **18/18, 18 wired**; territory **20/20, 32 wired**; _all reads ok_ on each, and 0 JavaScript console errors anywhere.
- 23 empty cards were checked and are honest — each states in plain English why it is empty, and the source table really is empty.

**PR #667 — four fixes** (`FrandevService.Activity.cs`, `RecordFormat.cs`, the three V2 page models, `_RecordPage.cshtml`, plus a 28-file rename sweep)

- **Activity was wrong, not empty.** All three pages called `GetActivityFeed("all", 50)` — the newest fifty events _system-wide_ — then filtered to the record. A global LIMIT before the filter, so contacts with real history read `Activity (0)`. New `GetActivityFeedForRecord` scopes the union in SQL. **Both filters sit inside the union branches on base columns, never on the merged alias** — that is the collation rule from s91 applied on purpose.
- **The assistant is Chiron everywhere** (Corey). FranDev said Scout, Gunner said Chiron, one click apart. Only the _name_ moved: `/frandev/scout`, `_ScoutDock.cshtml`, `ScoutModel`, `#scout-dock`, `frandev_scout_action_log` and the `"scout-chat"` agent scope all keep the old word, and the code now says why.
- **The docks stopped trapping the last card.** The Chiron capsule and the DEV MODE pill are both viewport-fixed; the rail's Workflow agent card sat under one of them with nothing left to scroll. `.gn-person` reserves the band — `!important` because of an inline `padding`, 96px because that padding is inside the `zoom:.82` wrapper while the docks are outside it.
- **Call titles were guest lists.** 40 of 465 calls carry a raw run of email addresses from the calendar invite. `RecordFormat.CallTitle` falls back to the call type on an `@` or a `Group Call w/` prefix.

## What Is Confirmed Working

- **Verified on production after the deploy, by clicking it.** James Choromanski's contact page read `ACTIVITY (0)` before and reads **`ACTIVITY (50)`** after, with real alert rows and a populated "last contact" tile. Every FranDev dock says **Ask Chiron**. The Workflow agent card sits clear of the capsule at the bottom of the page. Joanne McCann's journey lists `Group Call · 73m · Jul 28` where four cut-off email lists used to be.
- **The new SQL was run against the PRODUCTION database before it shipped** — three contacts that returned nothing now return their fifty newest, with no `Illegal mix of collations`. Dev would have proven neither half.
- **The CSS number was measured on the live page, not derived** — the card cleared the capsule by 2px at maximum scroll before, and by 69px after.
- **The title rule was run against all 465 real rows** — 57 replaced, 408 kept exactly as written.
- Build 0 errors; `MasterSuite.Platform.Tests` 74/74; CI "build and test" green in 4m14s; deploy `31255130451` succeeded.
- **Dev mode works on production on a journey page** — the overlay draws its panel boxes, per-card PRODUCTION badges and the status bar. That is the render half of an item carried five sessions.

## What Is Broken or Incomplete

- **Ungraded calls now all read "Group Call".** Honest and short, but not informative — those calls never got an AI title, so the type is all there is. Re-titling is a separate job — Low
- **Some genuine AI titles run to 87 characters** and still get cut off in the rail. That is the titling prompt, not the page; trimming a real title on the way out would be the same mistake inverted — Low
- **The Overview left column runs out early**, leaving a tall gap beside a long middle column. Most visible on a thin contact record — Low
- **Casing is inconsistent in data-driven labels** — `Owner` beside `owner`, `PROSPECT` beside `Paid Ad`, names stored as `erick valeriano` — Low
- **Writes still not wired on the record pages** — profile fields, notes, team, stakeholders, EOS goals. All are _deliberately_ disabled with tooltips and dev-mode annotations, so nothing pretends to work — Medium
- No `MasterSuite.Modules.Frandev.Tests` — this session's service change has no unit coverage either — Medium

## Decisions Made

- **The assistant is Chiron on every page of MasterSuite** — Corey ("the assistant everywhere should be chiron now that we are in mastersuite")
- **Rename the NAME only, never the plumbing** — route, file, model type and agent scope keep `scout`, because renaming a live route breaks saved links and renaming the agent scope orphans stored conversations — Claude
- **No data refresh yet** — Corey ("most of it is coming from mastersuite live fields so that is good anyway"). Stale rows prove the wiring as well as fresh ones
- **Deploy on green CI** — Corey, explicitly
- **The call-title tell stays narrow** (`@` or `Group Call w/`) so a long _real_ title is still shown in full — Claude
- **Fix the page, not the data, for call titles** — a backfill would fix it everywhere but is a titling job, raised not done — Claude

## Files Created

- `apps/analysis-api/MasterSuite.Modules.Frandev/FrandevService.Activity.cs` → `GetActivityFeedForRecord` (+95 lines in an existing file)
- Memory: `reference_mastersuite_urls.md`, `decision_assistant_named_chiron.md`

## Files Modified

- `MasterSuite.Modules.Frandev/`: `FrandevService.Activity.cs`, `IFrandevService.cs`
- `Pages/Frandev/`: `JourneyV2.cshtml.cs`, `ContactV2.cshtml.cs`, `TerritoryV2.cshtml.cs`, `RecordFormat.cs`, `RecordPageVm.cs`, `_ScoutDock.cshtml`, `Scout.cshtml`, `Scout.cshtml.cs`, plus the rename sweep across `Activity`, `Call`, `Contact(s)`, `FrandevIndex`, `Journey`, `Knowledge`, `Messages`, `Territory`, `Workflow`
- `Pages/Gunner/`: `ShellStyles/_RecordPage.cshtml`, `ShellStyles/_RecordShell.cshtml`, `GunnerSlotCatalog.cs`, `Activity.cshtml(.cs)`, `Inbox.cshtml.cs`
- Sandbox: `handoff.md`, `MEMORY.md`

29 files, +233 / −77.

## Files Deleted

- None (worktree `wt-s138-audit` and local branch `s138-record-audit-fixes` removed after merge)

## Open Issues Carried Forward

- **⚠️ COLLATIONS.** `frandev_*` ids are `CHAR(36) ascii_bin`; names and slugs are `utf8mb4`. Never let two collations meet in one expression when C# can do the job. Applied deliberately in this session's new query — High
- **Running SQL against dev is NOT verification.** This session ran every new query against the PRODUCTION database read-only before shipping, and measured the CSS on the live page. Keep doing both — High
- **Local browser verification is still impossible** (`CookieHelper` wants a `jwt` the machine cannot sign) — **driving Corey's Chrome at production is the way to check UI**, and it is how all four of this session's findings were made — Medium
- **Corey to flip the dev pill on a journey in prod** — the overlay is now _confirmed rendering_ on production; what is still unproven is the write half: retire a tab, reload, put it back — Medium (was High)
- **The two URL families still coexist** — `/frandev/journey/{key}` (v1) beside `/frandev/journey-v2/{key}` — Medium
- **The FranDev data in MasterSuite is an Aug 1 snapshot.** Refresh before anyone reads a count as today's truth; the push is one script run — Medium
- **Another window is on `wt-s137-contacts`** (branch `s137-contact-pages`) rebuilding the Gunner Buyer/Seller/Partner detail pages onto this same shell. Anything touching `_RecordShell` or `_RecordPage` will meet it — Medium
- Carried: Jessica AdminPanel bypass + prod permission audit; API key rotation; prod rollout data flips (nav rows 76/77 still `Enabled=0`); `FRANDV` territory row absent from prod — High/Medium
- **RESOLVED this session: "Ben still blocking the production `frandev_%` GRANT."** It was carried through three session wraps after it stopped being true — the grant landed before Aug 1, which is how prod got its 99,711 rows. Re-check a blocker before carrying it again — was High

## Exact Next Step

Open `/Gunner/Inventory` on a FranDev stage, click a Territories dot and then a territory row, and confirm the territory pull-down resolves an owner the way the journey one does — carried from session 91, still the one path in that feature that was built and deployed but never clicked.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Open /Gunner/Inventory on a FranDev stage, click a Territories dot and then a territory row, and confirm the territory pull-down resolves an owner the way the journey one does — carried from session 91, still the one path in that feature that was built and deployed but never clicked.

---
