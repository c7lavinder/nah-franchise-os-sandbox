# Session Handoff — 2026-08-08 — Session 94

## Status

Phase: **FranDev → MasterSuite fold-in. Corey walked the five pages and returned ~33 findings; this session measured the slow-page complaint to a single missing index, shipped the small cleanups, and built the first new write.** Seven PRs merged and deployed. / Health: Green / Duration: full session

Branch prefixes `s94`–`s97` were all used inside this one session. Everything is merged; no worktree is left holding work.

## What Was Built This Session

**Seven PRs, all merged AND deployed to production.**

- **#669** — the five old FranDev pages deleted (carried in from s93, merged at the top of this session).
- **#670 — the workspace picker stops forgetting which account you chose.** `SetGunnerScope` wrote `new CookieOptions { Path = "/" }` and no `Expires`, while the doc comment two lines above claimed it "rides the JWT's own expiry". Omitting `Expires` makes a SESSION cookie: the browser drops it on quit, `GetGunnerScope` returns empty, and empty reads as `territory` — so a user who picked FranDev yesterday is silently in Gunner today. Now matches `SetJwtCookie`/`SetCurrentTerritory`. Pinned by `GunnerScopeCookieContractTests`, which **was confirmed to fail on the old code before being trusted**.
- **#673 — `Inv_PurchaseDate` indexed.** See the measurement below; this is the session's biggest result.
- **#674 — J8/C3/T7/C2.** Removed "Open contact" (journey), "Open journey" (contact; territory header **and** owner card), and the "owner since" tail from the contact header. All four were single buttons standing for something there can be several of.
- **#675 → #676 — D3 phone formatting**, in two moves. #675 gave FranDev its own `FormatUsPhoneNumber` to avoid restyling the whole app unasked; Corey then said _"format the same as all mastersuite is already"_, so #676 **deleted that variant** and moved FranDev onto `PhoneNumberHelper.FormatPhoneNumber`. Seven raw render sites on the record pages, plus two hand-rolled duplicate formatters in `FrandevService` and `MlsDealAlertJobs`, now all go through one function.
- **#676 — G4 tab icons.** Corey clarified: _"i mean no icons on the tab names. look at property page, they do not exist."_ All 11 tab icons removed from the three record pages. `RecordTab.Icon` itself stays — the shell is generic.
- **#678 — J2 journey rename.** New `RenameJourney` service write + `NameCustom` column (migration 244) + opt-in `RecordPageVm.TitleEdit` + inline pencil/Save/Cancel in the shared shell, JSON not redirect (item J5, no banner).

**Also: `docs/mastersuite-walkthrough-findings.md`** — Corey's ~33 walkthrough findings, deduped ("owner since" was listed twice), grouped, ID'd (P/J/C/T/D/G), with a status board and four open questions.

## What Is Confirmed Working

**All measured against PRODUCTION, not dev, not predicted.**

- **`/frandev` went 13–16 s → 0.3–0.9 s.** The cause was one query: `HighPerformerTerritories` at **16,209 ms** while every other query on the page ran ~115–132 ms. It filters `PropertyInventory` on `Inv_PurchaseDate`, which had no index — 983,166 rows read to find the 229 that can match (only 1,351 rows in the table have a purchase date at all). After the index: **225 ms**, same answer (7).
- **Migration 244 applied:** `frandev_journey.NameCustom tinyint(1)` confirmed present in production after deploy.
- `dotnet build` 0 errors and `dotnet test` green on every PR — final count **5,157 / 5,157**.
- **`FrandevJourneyHeader.DisplayName` precedence** pinned by 6 new tests; **`SetGunnerScope`'s `Expires`** pinned by 2 contract tests that were verified to fail on the old code.
- `frandev_journey.UpdatedAt` exists and `Name` is `varchar(255)` — read from production's schema before shipping the rename, rather than assuming the UPDATE would land.
- Production serving HTTP 200 throughout.

## What Is Broken or Incomplete

- **`/Gunner/DayHub` (4.9 s) and `/Gunner/Inventory` (5.7 s) are still slow.** The index did **not** help them — measured after deploy, was 4.6 s / 6.6 s before. A different cause, not yet investigated. **This is the single best next perf lead** — High
- **Nothing from this session has been clicked in a browser.** Local authed pages cannot render on this machine. Two checks settle it: rename a journey and confirm Contacts keeps the legal name; pick FranDev, quit Chrome, reopen — Medium
- **G4 may not be finished.** Icons are off the three record pages' tabs. If Corey meant other pages too, they are untouched — Low
- **Most of the walkthrough is not started:** P1, P3, J1, J3, J4, J6, J7, C1, T1–T5, T8, D1, D5, D6, D7, G2, G3 — Medium
- Carried from s92/s93, all still true and all Low: ungraded calls read "Group Call"; some AI titles run 87 chars and get cut off; the Overview left column ends early; casing is inconsistent in data-driven labels
- No `MasterSuite.Modules.Frandev.Tests` — Medium
- **`DataAccess.Tests` is an empty shell** — no test files and no MSTest packages, so it silently cannot host a test. Cost one build failure this session — Low

## Decisions Made

- **Fix the picker cookie first** — Corey, chosen from four options for "the frandev account"
- **Merge #673 knowing it applies a production schema change** — Corey ("yes get it all done"). Merging to main auto-runs migrations against prod with **no reviewer gate** (`deploy.yml`)
- **One phone format across MasterSuite, and it is the existing one** — Corey ("format the same as all mastersuite is already"), reversing #675's call
- **No icons on tab names, matching the property page** — Corey
- **Option A for the journey name: a renamed journey wins, everything else untouched** — Corey, with the reason that matters: _"sometimes someone might go by Jon Dreyer and want to make sure to keep legit name in contacts"_. That is why `RenameJourney` never writes `frandev_contact` and never rewrites `Slug`
- **Do not guess at G4** — Claude. No emoji tab names exist; a repo scan found 194 glyphs across 83 files that are arrows in comments and UI marks. Asked instead of shipping an 83-file diff
- **Delete `FormatUsPhoneNumber` rather than leave it** — Claude. A second formatter in a shared helper is one someone picks by accident

## Files Created

- `docs/mastersuite-walkthrough-findings.md` (sandbox)
- `DatabaseMigrationRunner/Migrations/2026-08-08-243_PropertyInventoryPurchaseDateIndex.sql`
- `DatabaseMigrationRunner/Migrations/2026-08-08-244_FrandevJourneyNameCustom.sql`
- `MasterSuite.Platform.Tests/Helpers/GunnerScopeCookieContractTests.cs`
- `MasterSuite.Platform.Tests/Frandev/FrandevJourneyDisplayNameTests.cs`

## Files Modified

- `MasterSuite/Helpers/CookieHelper.cs`, `Pages/Territory-Selector.cshtml.cs`
- `Pages/Frandev/`: `JourneyV2.cshtml.cs`, `ContactV2.cshtml.cs`, `TerritoryV2.cshtml.cs`, `RecordPanels/_TerritoryHero.cshtml`
- `Pages/Records/RecordPageVm.cs`; `Pages/Gunner/ShellStyles/_RecordShell.cshtml`, `_RecordPage.cshtml`
- `MasterSuite.Modules.Frandev/`: `FrandevService.Messaging.cs`, `FrandevService.WritesContact.cs`, `FrandevService.Journey.cs`, `IFrandevService.WritesExtras.cs`, `.csproj`
- `MasterSuite.Modules.Gunner/`: `Jobs/MlsDealAlertJobs.cs`, `.csproj`
- `FormatHelpers/PhoneNumberHelper.cs`, `FormatHelpersTests/PhoneNumberHelperTests.cs`
- `Entities/Frandev/FrandevJourneyDetail.cs`
- Sandbox: `handoff.md`, `docs/mastersuite-walkthrough-findings.md`

## Files Deleted

- None this session. (#669's ten page deletions were built in s93 and merged here.)

## Open Issues Carried Forward

- **⚠️ Measure before optimising — this session proved it twice.** The slow query was rewritten as a `GROUP BY` + `JOIN` on the assumption its correlated-subquery shape was the fault: the rewrite measured **19,159 ms, slower than the 16,209 ms original**. The index was the answer. Separately, the index was predicted to help Day Hub and Inventory; measured afterwards, **it did not** — High
- **⚠️ COLLATIONS.** `frandev_*` ids are `CHAR(36) ascii_bin`; names and slugs are `utf8mb4`. (Checked this session on `frandev_territory.TerritorySlug` — it is deliberately collation-matched to MasterSuite, so it was **not** the cause of the slow query) — High
- **Running SQL against dev is NOT verification.** Read-only production access works: `.env.local` `MASTERSUITE_DB_*`, MariaDB 12.3, via `mysql2` with `NODE_PATH` set to the sandbox's `node_modules` — High
- **Merging to main deploys AND migrates production with no reviewer gate** — treat every merged migration as immediately live — High
- **Local browser verification is impossible** (`CookieHelper` wants a `jwt` this machine cannot sign) — driving Corey's Chrome at production is the way — Medium
- **Two large tables worth a later look, deliberately untouched:** `NewAgainHouses_Analytics_PageVisits` (8.2 M rows, 1.6 GB, indexed only on `Id`) and `ThirdPartyApiResponses` (11 GB) — Low
- **The FranDev data in MasterSuite is an Aug 1 snapshot** — newest contact/journey is Jul 30; the territory/property half is live — Medium
- **PR #668 (SignWell e-sign) is another window's work** — needs a prod migration, an API key, and Corey's answer on COE/inspection business days — Low
- **~40 stale worktrees** under `/Users/coreylavinder/Mastersuite/` — Low
- Carried: Jessica AdminPanel bypass + prod permission audit; API key rotation; nav rows 76/77 still `Enabled=0` so **FranDev still has no sidebar link**; `FRANDV` territory row absent from prod — High/Medium

## Exact Next Step

Time the individual queries behind `/Gunner/DayHub` (4.9 s) and `/Gunner/Inventory` (5.7 s) against production the same way `/frandev` was measured — one query at a time, read-only — and find their real cause before changing any code.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Time the individual queries behind /Gunner/DayHub (4.9s) and /Gunner/Inventory (5.7s) against production the same way /frandev was measured — one query at a time, read-only — and find their real cause before changing any code.

---
