# Session Handoff — 2026-08-08 — Session 95

## Status

Phase: **FranDev → MasterSuite fold-in. G1 (slow pages) is finished being diagnosed and fixed; the territory-page batch is built; the orphaned-journey bug was root-caused to one missing line and repaired.** Two PRs open and unmerged, three decisions waiting on Corey. / Health: Green / Duration: full session

Branches `s98-perf` and `s98-territory`, both in the worktree `/Users/coreylavinder/Mastersuite/wt-s98-perf` (currently checked out on `s98-territory`). Sandbox work went straight to `main`.

⚠ `origin/main` moved to `d14680378` (#683) while this session was working. **Both PRs are behind by at least that commit** and may want a rebase before merge.

## What Was Built This Session

**PR #682 — the Day Hub and Inventory were never slow for the reason `/frandev` was.**

- `DatabaseMigrationRunner/Migrations/2026-08-08-245_PropertySummariesCoveringIndexes.sql` — two covering indexes: `PropertySummaries(ReferralPartnerName, LastModified)` and `PropertyStatusHistory(PropertyId, Inserted, NewStatus)`. The existing `(PropertyId, Inserted)` index is deliberately **left in place** rather than replaced, so no deploy window leaves the funnel with no index to use.
- `Pages/Gunner/Inventory.cshtml.cs` — `GetDataIssueBreakdown` (4,217 ms of a 5.7 s page) taken off page load into a new `OnGetDataIssues` handler with its own 30 s cache. `DataIssueCount`/`DataIssues` model properties **removed** rather than left holding permanent zeros.
- `Pages/Gunner/Inventory.cshtml` — the badge and eleven rows start as `–` and are filled after paint. Never `0`: a zero reads as "your data is clean", the one wrong answer to guess at.
- `MasterSuite.Platform.Tests/Frandev/InventoryDataIssueKeyContractTests.cs` — 4 tests pinning that the view's eleven facet keys and the handler's eleven match.

**PR #684 — the lead-list donut stops being one colour, and the performance tab reads in 3×3.**

- `MasterSuite.Platform/Helpers/CategoricalPalette.cs` — new. Eight validated hues plus a neutral fold bucket. Placed in Platform, **not** the page model, because no test project references `MasterSuite.csproj` — in a page model these rules could only be pinned by scanning source text.
- `Pages/Frandev/TerritoryV2.cshtml.cs` — the old `LeadTypeColor(string)` (eight hard-coded keywords, one pink for everything else) deleted; `LeadTypeColors` now delegates to the helper.
- `Pages/Frandev/RecordPanels/_TabPerformance.cshtml` — donut + legend drawn from the helper **in slot order**; T3 (Stage-4 offers moved below both pipeline panels) and T5 (funnel + comparison side by side).
- `Pages/Gunner/ShellStyles/_RecordPage.cshtml` — T1: `.kpi-grid` pinned to an exact 3×3 (was `auto-fit`, reflowing to 4+4+1 on a wide screen); new `.perf-2up` grid for T5.
- `MasterSuite.Platform.Tests/Helpers/CategoricalPaletteTests.cs` — 9 tests.

**Sandbox `main` — a merged contact no longer strands its journey (`4d07340`).**

- `app/api/contacts/[contactId]/merge/route.ts` — new **step 3b** repointing `journeys.primary_contact_id`, placed _before_ the duplicate is marked merged so a failed repoint cannot leave the state found in production.
- `scripts/repair-orphaned-journey-primaries.ts` — repairs existing orphans and **refuses the ambiguous ones on purpose**.
- `tests/api/contacts-merge-route.test.ts` — 4 tests.
- `docs/mastersuite-walkthrough-findings.md` — rewritten status board plus a "what measuring actually changed" section (`98d8fe8`, `2c16dd6`).

## What Is Confirmed Working

**Every number below was measured against PRODUCTION, read-only, one query at a time. None is predicted.**

- **The one root cause of both slow pages.** `PropertySummaries` is 977,886 rows / 481 MB and its indexes carry two non-key columns between them. On the same 20,374 scoped rows: `COUNT(*)` 143 ms · `COUNT(Status)` 148 ms · `COUNT(Inserted)` 131 ms · **`COUNT(LeadCategory)` 1,353 ms** · **`COUNT(Latitude)` 1,312 ms**. Only the column name changes.
- **Inventory 5.7 s = one read.** `GetDataIssueBreakdown` 4,217 ms; every other read on the page ≤ 1,315 ms.
- **Day Hub 4.9 s has no slow query.** Worst read is the funnel at 2,341 ms across three sequential queries; then 1,563 / 1,105 / 1,058 / 524 ms. ~40 reads fire at once.
- **`GetDayHubPulse` measured 2,665 ms and runs every ~12 seconds**, against a comment saying "must stay cheap." `MAX(LastModified)` alone is 1,303 ms of it.
- **Both index fixes proven by analogy on the identical query**, not predicted: `MAX(LastModified)` 1,364 ms vs `MAX(Status)` **129 ms**; funnel reading `psh.NewStatus` 786 ms vs not reading it **382 ms**.
- **Razor views ARE compiled by `dotnet build`** — verified by deliberately inserting a bad `Model.` reference, seeing the build fail, and reverting. So a clean build really does check the `.cshtml` edits.
- **`@@media` is the correct Razor escape here** — 40 files under `Pages/` use it, zero use bare `@media`.
- **The palette was validated with the dataviz validator, not eyeballed.** Adjacent pairlist PASSES (worst CVD ΔE 9.1, worst normal-vision 19.6). All-pairs **FAILS** (red↔orange ΔE 7.1 normal vision against a floor of 15; green↔orange ΔE 3.2 protan) — which is _why_ the ring is drawn in slot order.
- **Every test was verified to fail on the bug it claims to catch**, not merely to pass: 3 breakages for the data-issue keys (dropped / typo'd / duplicated key), 3 for the palette (old shared-colour behaviour, size-ordered draw, bucket named "Other"), and 3 of 4 for the merge route (the 4th correctly still passes, being the separate memberships concern).
- **The repair script is idempotent** — 3 orphans → 2 after applying; a re-run reports 0 to repair.
- `dotnet build` 0 errors on both branches. `dotnet test`: **5,166 / 5,166** on `s98-perf`, **5,172 / 5,172** on `s98-territory` (the +1 over arithmetic is #683 landing on `main` mid-session).
- Sandbox: `npx tsc --noEmit` 0 errors, `npx next build` clean, `npx vitest run` **264 / 264**.

## What Is Broken or Incomplete

- **`POST /api/contacts/[contactId]/merge` imports `requireAuth` and never calls it.** There is no `middleware.ts`, so nothing else gates it — a destructive endpoint that reassigns 20+ tables and marks contacts merged is **unauthenticated**. Found while editing that file; deliberately NOT changed (scope discipline). Two-line fix following `docs/security.md` — **High**
- **Two contact merges look wrong and are untouched.** `Courtney McDonald` → **Michael Scott** (different people, both with active journeys) and `Vince Vitale` → **jo Vitale** (different people, archived journey). Their journeys are still orphaned on purpose: if the merge is wrong the fix is to undo it, not to hand one person's journey to another — **High**
- **Nothing from this session has been clicked in a browser.** Local authed pages cannot render on this machine (`CookieHelper` wants a `jwt` it cannot sign). Worth checking after deploy: the Inventory Data Issues badge filling in after paint; the KPI cards sitting 3×3 on a wide screen; the funnel and comparison side by side; a many-lead-type territory showing a gray "Smaller types (N)" wedge — **Medium**
- **PR #682 and #684 are both unmerged and both behind `origin/main`** (#683 landed mid-session) — **Medium**
- **P2: nothing writes `frandev_task`.** The table holds **1 row**. Corey was right that there are no tasks; the earlier note in the findings doc guessing at a read-path scoping bug was wrong. The open question is the writer, not the reader — **Medium**
- **`GetAvgCycleDays` has no callers and measures 3,418 ms.** A landmine if anyone wires it up (`PropertyCalculations` is 4.2 GB). Left alone deliberately — **Low**
- **The lead-type taxonomy has near-duplicate values**: `Obituary` AND `Obituaries`, `ProspectNow` AND `Prospect Now`, `PropStream` AND `Propstream`. This is what blocks cross-page colour stability for the donut, and it belongs to G3 — **Low**
- Carried from s92–s94, all still true and all Low: ungraded calls read "Group Call"; some AI titles run 87 chars and get cut off; the Overview left column ends early; casing is inconsistent in data-driven labels
- No `MasterSuite.Modules.Frandev.Tests` — **Medium**
- **`DataAccess.Tests` is an empty shell** — no test files and no MSTest packages, so it silently cannot host a test — **Low**
- ⚠ `dotnet test --nologo` **fails** on this repo ("Unknown option '--nologo'", 22 errors, zero tests run, exit 5). MSTest 4.x / Microsoft.Testing.Platform. Use bare `dotnet test`. This looks like a broken suite and is not — **Low**

## Decisions Made

- **G4 is closed** — Corey: the FontAwesome icons removed from the three record pages' tabs in #676 were the thing he meant. No emoji tab names exist anywhere
- **The coach derives from the person's territory** (`Territories.PrimaryCoach`, 72 of 89 covered) — Corey, choosing from three options. `frandev_coach_assignment` was confirmed **empty**, which is why option (b) was the wrong bet. This decides D7
- **The Vercel site is live and is the reference for T1/T4/P4** — Corey. ⚠ And better than a screenshot: **its source is the sandbox repo**, so parity is read off the real components and queries
- **Take Inventory's data-issue breakdown off the critical path rather than optimise it** — Claude, after measuring four shapes of the duplicate-address `EXISTS`: 3,186 / 2,521 / 2,424 / 2,748 ms. The shape was never the fault, and the panel it fills is hidden until clicked
- **Do NOT reverse the funnel's join order** — measured 1,627 ms against the 786 ms the optimizer already picks. Third rewrite on this codebase to measure slower than the original
- **Draw the donut ring in palette-slot order, never biggest-first** — derived from the validator, not chosen. All-pairs fails; adjacent passes
- **Per-chart colour slots, not a fixed global type→colour map** — Claude, after the data rejected the global map: no eight lead types cover the book, and the best eight by breadth leave territory `CLTW` at **0% coverage**
- **The fold bucket is called "Smaller types", not "Other"** — Claude. "Other" is itself a real lead type (2,006 rows, Nashville's second-biggest slice), so a bucket by that name would read as the category and overstate it
- **Put `CategoricalPalette` in `MasterSuite.Platform`** — Claude, so the rules can be executed by a test rather than pinned by scanning source text
- **Repair only the unambiguous orphan; refuse the different-people merges** — Claude. Repointing assumes the merge was right, and burying a bad merge under a second change is worse than leaving it visible
- **Report the unauthenticated merge endpoint rather than fix it** — Claude, per CLAUDE.md scope discipline. Changing auth behaviour could break an internal caller and is Corey's call

## Files Created

- `DatabaseMigrationRunner/Migrations/2026-08-08-245_PropertySummariesCoveringIndexes.sql`
- `MasterSuite.Platform/Helpers/CategoricalPalette.cs`
- `MasterSuite.Platform.Tests/Frandev/InventoryDataIssueKeyContractTests.cs`
- `MasterSuite.Platform.Tests/Helpers/CategoricalPaletteTests.cs`
- Sandbox: `scripts/repair-orphaned-journey-primaries.ts`, `tests/api/contacts-merge-route.test.ts`

## Files Modified

- `MasterSuite/Pages/Gunner/Inventory.cshtml`, `Inventory.cshtml.cs`
- `MasterSuite/Pages/Gunner/ShellStyles/_RecordPage.cshtml`
- `MasterSuite/Pages/Frandev/TerritoryV2.cshtml.cs`
- `MasterSuite/Pages/Frandev/RecordPanels/_TabPerformance.cshtml`
- Sandbox: `app/api/contacts/[contactId]/merge/route.ts`, `docs/mastersuite-walkthrough-findings.md`, `handoff.md`

## Files Deleted

- No files. Two pieces of code were removed: `TerritoryV2Model.LeadTypeColor(string)` (replaced by `CategoricalPalette`) and the `DataIssueCount` / `DataIssues` model properties on `InventoryModel` (they would have been permanently zero once the read moved off page load).

## Open Issues Carried Forward

### Waiting on Corey — three things block work

1. **Merge #682?** It applies migration 245 to **production immediately**, no reviewer gate (`deploy.yml`). Two ~1 M-row tables, so expect minutes. Both additions are secondary indexes — INPLACE and non-blocking on MariaDB 12.3, the same operation migration 243 already ran here — **High**
2. **The two bad-looking merges** — Courtney McDonald → Michael Scott, Vince Vitale → jo Vitale. Undo the merge, or accept it and let the journeys be repointed? — **High**
3. **The unauthenticated merge endpoint** — fix now, or log it as its own task? — **High**

### The walkthrough list — 16 of 33 items still not started

`docs/mastersuite-walkthrough-findings.md` is the tracker. Done or closed: G1, G4, J2, J5, J8, C2, C3, D3, T1, T2, T3, T5, T6, T7, plus D1's orphan half. Still open:

- **G2 — everything on the page writable.** The **biggest single unlock left**: it clears J6, T8 and much of J4 at once, and #678 already built the pattern to copy — **High**
- **G3 — audit the MasterSuite fields that already exist** before inventing new ones. Now has a concrete first target: the lead-type near-duplicates above — **Medium**
- **P1** pipelines list journeys _and_ territories (⚠ a person can legitimately sit at two stages at once) · **P3** sub-stage slide-out visual work + advance-to-next-full-stage · **P4** territory labels match Vercel — **Medium**
- **J1** open the next pipeline on completion · **J3** the Activity panel should be an internal team chat, not a history · **J4** sub-stages individually tickable, bigger font · **J6** profile tabs editable · **J7** hide pipelines never entered (**cheapest of the big ones — worth pulling forward**) — **Medium**
- **C1** contacts panel on the contact (family/friends follow the person; workers stay with the territory) — **Medium**
- **T4** last stage 4 / active / sold inventory, same UI _and_ wiring as Vercel · **T8** EOS editable in a tab — **Medium**
- **D1** the two real duplicate journeys: **Loretta Koonce** (a double space in the name caused it) and **Jorge Villalta**. ⚠ Never key a merge on "one contact = one journey" — NAH System holds four territory journeys and Jason Semper two, legitimately — **Medium**
- **D5** 61 same-name contact groups remain; the merge mechanism already exists and has run 28 times — **Medium**
- **D6** wire up the email child table (**already live: 2,765 rows, 84 people with more than one**); phones are five flat columns with no child table — **Medium**
- **D7** show the coach, deriving from the territory (Q3 answered) — **Medium**
- **P2** find out why nothing writes `frandev_task` — **Medium**
- **Q1** the nightly journey write per contact — Corey wants to talk it through · **Q2** two truncated lines in the original notes, lost — **Low**

### Standing traps

- **⚠ Measure before optimising. This codebase is now three-for-three on rewrites measuring slower than the original**: migration 243's `GROUP BY` (19,159 ms vs 16,209 ms), the funnel's reversed join (1,627 ms vs 786 ms), and the duplicate-address `EXISTS` (best of four shapes still 2,424 ms vs 3,186 ms) — **High**
- **Merging to main deploys AND migrates production with no reviewer gate** — treat every merged migration as immediately live — **High**
- **Running SQL against dev is NOT verification.** Read-only production works: `.env.local` `MASTERSUITE_DB_*`, MariaDB 12.3, `mysql2` with `NODE_PATH` into the sandbox's `node_modules`. ⚠ `performance_schema` is **denied** to this user, so slow queries must be timed by hand — **High**
- **Supabase scripts need three things** or they fail confusingly: `dotenv.config({ path: ".env.local" })` (plain `dotenv/config` reads `.env` and silently finds no keys), the `ws` polyfill on Node 20, and to be run from inside the repo so module resolution works — **Medium**
- **⚠ COLLATIONS.** `frandev_*` ids are `CHAR(36) ascii_bin`; names and slugs are `utf8mb4` — **High**
- **Local browser verification is impossible** — driving Corey's Chrome at production is the way — **Medium**
- **The FranDev data in MasterSuite is an Aug 1 snapshot.** Supabase is live and is where merges happen; MasterSuite's `frandev_*` is the mirror. That is why the orphan counts differed (3 live vs 2 in the mirror) — **Medium**
- **Two large tables worth a later look:** `NewAgainHouses_Analytics_PageVisits` (8.2 M rows, 1.6 GB, indexed only on `Id`) and `ThirdPartyApiResponses` (11 GB) — **Low**
- **PR #668 (SignWell e-sign) is another window's work** — needs a prod migration, an API key, and Corey's answer on COE/inspection business days — **Low**
- **~40 stale worktrees** under `/Users/coreylavinder/Mastersuite/` — **Low**
- Carried: Jessica AdminPanel bypass + prod permission audit; API key rotation; nav rows 76/77 still `Enabled=0` so **FranDev still has no sidebar link**; `FRANDV` territory row absent from prod — **High/Medium**

## Exact Next Step

Get Corey's three answers — merge #682 (it migrates production on merge), what to do about the two different-people merges, and whether to close the unauthenticated `/api/contacts/[id]/merge` hole now — then rebase both PRs onto `origin/main` and start G2, the write layer, copying the pattern #678 established.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Get my three answers — merge #682 (it migrates production on merge), what to do about the two different-people merges (Courtney McDonald → Michael Scott, Vince Vitale → jo Vitale), and whether to close the unauthenticated /api/contacts/[id]/merge hole now — then rebase both PRs onto origin/main and start G2, the write layer, copying the pattern #678 established.

---
