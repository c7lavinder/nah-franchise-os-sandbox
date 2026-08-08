# Session Handoff — 2026-08-08 — Session 96

## Status

Phase: **FranDev → MasterSuite fold-in. G1 closed and live. All three blocking questions answered and done. G2 started and shipped its biggest slice. Then a second thread: four nightly jobs turned out never to have run at all — now fixed, and deliberately held OFF until the move off Vercel.** / Health: Green / Duration: full session

Nothing is left half-finished. **Three PRs merged and deployed** (#682, #684, #686). Sandbox `main` at `f5f1e1e`.

---

## ⚠ WHAT IS STILL OUTSTANDING — read this first

### Nothing is blocked on Corey right now. Two things are parked by his decision:

1. **Four nightly jobs are fixed but switched OFF.** Their paths were removed from `vercel.json` and each route file opens with the reason. **Corey's call: nothing runs until FranDev is completely off Vercel and onto MasterSuite.** — `score-recalculate`, `generate-briefs`, `stale-leads`, `daily-brief`.
2. **The post-move brief backfill.** On the switch: backfill **all journeys** and **all territories**. **Contacts probably not** — and the code already agrees, only making a contact brief for someone with at least one call. ⚠ Journey briefs cost an LLM call each (~3,175 of them), so that wants to be one deliberate run, not a 25-a-night trickle. Territory briefs are free — pure data, 89 of them.

### The walkthrough list — what is genuinely left

**Done or closed:** G1, G4, J2, J5, J8, C2, C3, D1, D3, T1, T2, T3, T5, T6, T7, plus the profile half of G2 and J6.

| Item             | What is left                                                                                                                                                                                                        | Severity   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **G2 remainder** | territory Data tab, EOS add boxes (T8), Ecosystem add/remove stakeholder, Overview "Add contact"/"Add note", header Merge/Delete/Transfer/Retire. The generic editor and the pattern both exist now — mostly wiring | **High**   |
| **G3**           | the field audit. Two measured targets: 76 of 129 profile keys match no catalog field, and the lead-type near-duplicates                                                                                             | **Medium** |
| **J7**           | hide pipelines never entered — **cheapest of the big ones, recommended next**                                                                                                                                       | **Medium** |
| **P1**           | pipelines list journeys _and_ territories (⚠ a person can legitimately sit at two stages at once)                                                                                                                   | **Medium** |
| **P3**           | sub-stage slide-out visual work + advance-to-next-full-stage                                                                                                                                                        | **Medium** |
| **P4**           | territory labels match Vercel                                                                                                                                                                                       | **Medium** |
| **J1**           | open the next pipeline on completion                                                                                                                                                                                | **Medium** |
| **J3**           | Activity panel should be an internal team chat, not a history                                                                                                                                                       | **Medium** |
| **J4**           | sub-stages individually tickable, bigger font                                                                                                                                                                       | **Medium** |
| **C1**           | contacts panel on the contact (family/friends follow the person; workers stay with the territory)                                                                                                                   | **Medium** |
| **T4**           | last stage 4 / active / sold inventory, same UI _and_ wiring as Vercel                                                                                                                                              | **Medium** |
| **D5**           | 61 same-name contact groups; the merge mechanism exists and has run 28 times                                                                                                                                        | **Medium** |
| **D6**           | wire the email child table (already live: 2,765 rows, 84 people with more than one). Phones are five flat columns with no child table                                                                               | **Medium** |
| **D7**           | show the coach, derived from the territory (Q3 answered — `Territories.PrimaryCoach`, 72 of 89 covered)                                                                                                             | **Medium** |
| **P2**           | find out why nothing writes `frandev_task` — the table holds **1 row**. A writer problem, not a reader problem                                                                                                      | **Medium** |
| **D1**           | the last two real duplicate journeys: **Loretta Koonce** (a double space in the name) and **Jorge Villalta**                                                                                                        | **Medium** |
| **Q2**           | two truncated lines from the original notes — **lost, not recoverable**                                                                                                                                             | **Low**    |

**Q1 is now closed** — it was the nightly-writes question, answered and acted on this session.

---

## What Was Built This Session

**#682 merged — Day Hub + Inventory performance (G1 closed).**

- Rebased `s98-perf` onto `origin/main`, rebuilt, re-ran (5,167/5,167), merged. CI green, deploy green.
- ⚠ Then **queried production to confirm the migration actually applied**, rather than trusting a green deploy.

**#684 merged — territory layout + the lead-list donut (T1/T2/T3/T5).**

**#686 merged — the candidate profile is writable (G2's biggest slice, J6's profile half).**

- `MasterSuite.Modules.Frandev/FrandevService.WritesProfile.cs` — new. `UpdateProfileField` upserts one EAV row and journals `update_profile_field`.
- `MasterSuite/Pages/Gunner/ShellStyles/_RecordShell.cshtml` — one generic, delegated, `data-*`-driven inline editor. A new writable field is now markup plus a handler.
- `FrandevProfileFieldCatalog.cs` (`TryResolve`, `IsEditable`), `_TabProfile.cshtml`, `RecordSharedVm.cs`, `FrandevJourneyDetail.cs`, both page models, `_RecordPage.cshtml`.
- `MasterSuite.Platform.Tests/Frandev/FrandevProfileFieldWriteGuardTests.cs` — 11 tests. `MasterSuite.Platform.Tests` now references the FranDev module.

**Sandbox `42b434c` — the merge endpoint checks who is asking, and two journeys find their way home.**

- `app/api/contacts/[contactId]/merge/route.ts` — `requireAuth` was imported and never called, and there is no `middleware.ts`. The guard now sits above the body read and every write.
- `scripts/repair-orphaned-journey-primaries.ts` — `RULED_BY_HUMAN` authorises specific rows by slug **and** both names. The name-match guard stays.
- `tests/api/contacts-merge-route.test.ts` — 3 new auth tests.

**Sandbox `2ec82d4` / `ffe67bd` — the nightly jobs.**

- `app/api/cron/{score-recalculate,stale-leads,daily-brief,generate-briefs}/route.ts` — GET handlers added; `score-recalculate` rewritten bounded and write-light.
- `lib/intelligence/scoring.ts` — `scoreMomentum` flag-shape crash fixed.
- `lib/intelligence/flags.ts` — the live day counter removed from the stored PTO flag text.
- `tests/business-logic/candidate-intelligence-scoring.test.ts` — 8 tests.
- `vercel.json` — the four paths **removed** (27 crons → 24), per Corey.

---

## What Is Confirmed Working

**Every number below was measured, most against PRODUCTION read-only. None is predicted.**

- **Zero orphaned journeys.** 2 repaired; a re-run reports "nothing to do."
- **Migration 245 is live on production** — both indexes confirmed by querying `information_schema`, and the older index deliberately left in place is still there.
- **All 212 catalog profile fields exist in the app's 224-field registry** — diffed directly, so anything the Profile tab renders is safe to write.
- **`JSON_QUOTE` round-trips as the read expects**; `manual` is a real `LastUpdatedBy` (410 rows); `SourceHistory` is `[{value, updated_at, updated_by}]`.
- **The four nightly jobs had never run.** All 1,987 `candidate_intelligence` rows still carried a 2026-03-27 timestamp from one 28m 55s manual run.
- **`scoreMomentum` threw for ~94% of candidates** — 470 of 500 sampled rows store `active_flags` as objects; the code cast to `string[]`. Every caller catches, so it failed silently.
- **The new recalculation measured over the 1,000 oldest rows:** first run corrects 133 scores and rewrites flags once; **every run after that is 1,000 of 1,000 unchanged** — zero history rows.
- **Every test was verified to FAIL on the bug it claims to catch.** Sandbox merge auth: 3 of 7. Profile write guards: 3 of 11 for an unknown name, exactly 1 for the casing, exactly 1 for the stored shape. Intelligence: 6 of 8.
- `dotnet build` 0 errors; `dotnet test` **5,178 / 5,178**.
- Sandbox: `npx tsc --noEmit` 0 errors, `npx next build` clean, `npx vitest run` **275 / 275**.

---

## What Is Broken or Incomplete

- **⚠ 76 of the 129 distinct profile keys in production match no catalog field** and all render in "Other"; only 53 match. Two are near-miss spellings — `lookalike_score` vs catalog `Lookalike Score`, and `lead_source` vs `LeadSource`. Those catalog rows can never fill, so "n of m filled" is understated. **Reported, not fixed — G3** — **Medium**
- **G2 is started, not finished** — see the outstanding table above — **High**
- **⚠ The territory Data tab needs a real column allowlist**, unlike the profile. Profile fields are EAV _values_; territory fields are **columns**, and a column name goes straight into the UPDATE — **Medium**
- **Nothing from #686 has been clicked in a browser.** Local authed pages cannot render here (`CookieHelper` wants a `jwt` it cannot sign). Now deployed — worth checking: a pencil saves and flashes green; clearing a field drops the filled count; the "Other" group's pencils are inert with a tooltip — **Medium**
- **Three inline-edit implementations exist**, where there were two. The new generic helper is the one to keep; the header rename and the contact hero's phone/email edit still carry their own copies. Left alone rather than rewritten underneath a different task — **Low**
- **`updateCandidateScore` / `updateCandidateFlags` still write on every event call even when nothing changed**, and each re-fetches the same profile. Only the cron path was optimised — the event paths were deliberately untouched — **Low**
- **`GetAvgCycleDays` has no callers and measures 3,418 ms** — a landmine if anyone wires it up — **Low**
- **The lead-type taxonomy has near-duplicates**: `Obituary`/`Obituaries`, `ProspectNow`/`Prospect Now`, `PropStream`/`Propstream` — G3 — **Low**
- Carried from s92–s94, all Low: ungraded calls read "Group Call"; some AI titles run 87 chars and get cut off; the Overview left column ends early; casing is inconsistent in data-driven labels
- **`DataAccess.Tests` is an empty shell** — no test files, no MSTest packages — **Low**
- ⚠ `dotnet test --nologo` **fails** on this repo. Use bare `dotnet test`, run from `apps/analysis-api` — **Low**

---

## Decisions Made

- **Merge #682, #684 and #686** — Corey. All three deployed
- **Both different-name merges are correct** — Corey: "think those are correct." Their journeys are repointed
- **Authorise those by an explicit list, not a flag** — Claude. `RULED_BY_HUMAN` names each row; a `--force` flag would wave through whatever was orphaned that day
- **Contact merging stays open to any signed-in user, not admin-only** — Corey: "yes anyone can merge, everyone using frandev is admin"
- **Only catalog fields get a pencil, and never a structured value** — Claude. The app's replay throws on an unknown name, and a one-line box would flatten an object to its own text
- **`IsEditable` lives on the catalog, not the page's `RowVm`** — Claude, so the view and the write ask the same function, and so a test can execute the rule
- **Carry the JSON type as a STRING and decide in C#** — Claude. `JSON_TYPE(x) IN (…)` returns an integer, and the mapper is `GetRowParser`
- **Hold all four nightly jobs OFF until FranDev is off Vercel** — Corey
- **Backfill all journeys and territories post-move; contacts probably not** — Corey
- **Remove the stale day counter from the flag text rather than keep rewriting it nightly** — Claude. It was frozen at its March value on every record, so it was already a lie
- **Report the 76-key catalog mismatch rather than fix it** — Claude, per scope discipline

---

## Files Created

- `MasterSuite.Modules.Frandev/FrandevService.WritesProfile.cs`
- `MasterSuite.Platform.Tests/Frandev/FrandevProfileFieldWriteGuardTests.cs`
- Sandbox: `tests/business-logic/candidate-intelligence-scoring.test.ts`

## Files Modified

- `MasterSuite.Modules.Frandev/`: `FrandevProfileFieldCatalog.cs`, `FrandevService.Journey.cs`, `IFrandevService.WritesExtras.cs`
- `MasterSuite/Pages/Frandev/`: `ContactV2.cshtml.cs`, `JourneyV2.cshtml.cs`, `RecordSharedVm.cs`, `RecordPanels/_TabProfile.cshtml`
- `MasterSuite/Pages/Gunner/ShellStyles/`: `_RecordShell.cshtml`, `_RecordPage.cshtml`
- `Entities/Frandev/FrandevJourneyDetail.cs`, `MasterSuite.Platform.Tests/MasterSuite.Platform.Tests.csproj`
- Sandbox: `app/api/contacts/[contactId]/merge/route.ts`, `scripts/repair-orphaned-journey-primaries.ts`, `tests/api/contacts-merge-route.test.ts`, `app/api/cron/{score-recalculate,stale-leads,daily-brief,generate-briefs}/route.ts`, `lib/intelligence/scoring.ts`, `lib/intelligence/flags.ts`, `vercel.json`, `docs/mastersuite-walkthrough-findings.md`, `handoff.md`

## Files Deleted

- No files. Two removals inside files: the dead `.not("id","in",<subquery>)` in `generate-briefs` (Supabase cannot take a subquery there; it never filtered and its result was never read), and four cron paths from `vercel.json`.

---

## Open Issues Carried Forward

See **"WHAT IS STILL OUTSTANDING"** at the top — that is the live list. Plus the standing traps:

- **⚠ Measure before optimising. Three-for-three on rewrites measuring slower than the original**: migration 243's `GROUP BY` (19,159 vs 16,209 ms), the funnel's reversed join (1,627 vs 786 ms), the duplicate-address `EXISTS` (2,424 vs 3,186 ms best of four) — **High**
- **Merging to main deploys AND migrates production with no reviewer gate.** A green deploy is not proof a migration applied — query for the object afterwards — **High**
- **⚠ Vercel Cron invokes with GET.** A cron route exporting only POST answers 405 forever and looks scheduled. Four did — **High**
- **⚠ A write accepted by MasterSuite can still be rejected by the app on replay.** The journal is not a guarantee. For profile fields the app validates with `isValidFieldName`, which throws — **High**
- **⚠ `IsKnown` on the profile catalog is case-INSENSITIVE; the app compares with `===`.** Always resolve to the catalog's exact spelling before storing — **High**
- **Running SQL against dev is NOT verification.** Read-only production works: `.env.local` `MASTERSUITE_DB_*`, MariaDB 12.3, `mysql2` with `NODE_PATH` into the sandbox's `node_modules`. ⚠ `performance_schema` is **denied** — time queries by hand — **High**
- **⚠ COLLATIONS.** `frandev_*` ids are `CHAR(36) ascii_bin`; names and slugs are `utf8mb4` — **High**
- **FranDev is reached through the Gunner top header** — switch account to FranDev, then click Gunner. **Not** a sidebar link. Nav rows 76/77 are `Enabled=0` on production and that is **fine, not a blocker** (row 77's `/v2/frandev` is a dead route anyway) — **corrected by Corey this session**
- **Supabase scripts need three things** or they fail confusingly: `dotenv.config({ path: ".env.local" })`, the `ws` polyfill on Node 20, and to be run from inside the repo — **Medium**
- **The .NET solution is at `apps/analysis-api/MasterSuite.sln`, not the repo root** — from the root, `dotnet build` fails with MSB1003 and looks like a broken repo — **Low**
- **Local browser verification is impossible** — driving Corey's Chrome at production is the way — **Medium**
- **The FranDev data in MasterSuite is an Aug 1 snapshot.** Supabase is live; `frandev_*` is the mirror — **Medium**
- **Two large tables worth a later look:** `NewAgainHouses_Analytics_PageVisits` (8.2 M rows, indexed only on `Id`) and `ThirdPartyApiResponses` (11 GB) — **Low**
- **~40 stale worktrees** under `/Users/coreylavinder/Mastersuite/` — **Low**
- Carried: Jessica AdminPanel bypass + prod permission audit; API key rotation; `FRANDV` territory row absent from prod — **High/Medium**
- ✅ **PR #668 (SignWell e-sign) is MERGED** — an earlier handoff carried it as outstanding. That note was stale

---

## Exact Next Step

Start **J7 — hide pipelines a journey has never entered** — the cheapest of the remaining big items and immediately visible; then carry G2 into the territory Data tab, pointing it at the generic inline editor from #686. ⚠ That one needs a real column allowlist, since territory fields are columns rather than EAV values.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Start J7 — hide pipelines a journey has never entered — the cheapest of the remaining big items; then carry G2 into the territory Data tab using the generic inline editor from #686, with a column allowlist since territory fields are real columns and not EAV values. Do NOT switch any nightly cron back on — those stay off until FranDev is fully off Vercel.

---
