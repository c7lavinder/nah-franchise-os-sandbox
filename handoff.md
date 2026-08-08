# Session Handoff — 2026-08-08 — Session 96

## Status

Phase: **FranDev → MasterSuite fold-in. G1 is closed and live on production. All three questions that were blocking work got answered and all three are done. G2 — the write layer — is started and its biggest slice is up as a PR.** / Health: Green / Duration: short session

Branch `s98-g2-profile` in the worktree `/Users/coreylavinder/Mastersuite/wt-s98-perf`. Sandbox work went straight to `main` (`42b434c`).

## Corey's three answers, and what each one produced

1. **"Merge it"** → **#682 is merged and deployed.** Migration 245 ran on production.
2. **"Think those are correct"** (the two different-name merges) → both journeys **repointed**. Zero orphans remain.
3. **"Fix it now"** (the unauthenticated merge endpoint) → **closed**, with tests.

## What Was Built This Session

**#682 merged — and the indexes were checked, not assumed.**

- Rebased `s98-perf` onto `origin/main` (it was 1 behind, #683), rebuilt, re-ran: 5,167 / 5,167. Merged, CI green, deploy green.
- ⚠ A green deploy is not proof a migration applied. Queried production afterwards: `ix_PropertySummaries_ReferralPartner_LastModified` and `ix_PropertyStatusHistory_Prop_Inserted_NewStatus` are **both present**, and the older `ix_PropertyStatusHistory_Prop_Inserted` is **still there**, which is what the migration intended.

**Sandbox `main` (`42b434c`) — the merge endpoint checks who is asking.**

- `app/api/contacts/[contactId]/merge/route.ts` — `requireAuth` was imported and never called, and there is no `middleware.ts`, so an unauthenticated POST could reassign 20+ tables and mark a contact merged. The guard now sits **above the body read and every write**: a rejected caller must not reach the database, because a half-applied merge is worse than a refused one.
- **Deliberately not admin-only.** The sibling `journeys/[journeyId]/merge` requires admin, so consistency argued for it — but the Merge button in `LeadDetailView` is rendered for **every** signed-in role, unlike Delete which is gated to admin/operator. An admin check would have silently broken a button people use today. That is Corey's call, and it is now question 3 on the waiting list.
- **Checked before changing:** the only caller is `MergeContactModal`, which already goes through `apiFetch` and already sends the JWT. The three merge scripts write to Supabase directly and never touch the endpoint. Nothing breaks.
- `scripts/repair-orphaned-journey-primaries.ts` — the name-match guard **stays**. The only way past it is `RULED_BY_HUMAN`, which authorises rows one at a time by slug **and** both names. A `--force` flag was rejected on purpose: it would wave through whatever happened to be orphaned on the day someone ran it.

**PR #686 — the candidate profile is writable (G2's biggest slice).**

- `MasterSuite.Modules.Frandev/FrandevService.WritesProfile.cs` — new. `UpdateProfileField` upserts one row of the EAV table and journals `update_profile_field`.
- `MasterSuite/Pages/Gunner/ShellStyles/_RecordShell.cshtml` — one generic, delegated, `data-*`-driven inline editor. A new writable field is now markup plus a handler.
- `_TabProfile.cshtml`, `RecordSharedVm.cs`, `FrandevProfileFieldCatalog.cs`, both page models, `_RecordPage.cshtml`, `FrandevJourneyDetail.cs`.
- `MasterSuite.Platform.Tests/Frandev/FrandevProfileFieldWriteGuardTests.cs` — 11 tests.

## What Is Confirmed Working

**Every number below was measured, most against PRODUCTION read-only. None is predicted.**

- **Zero orphaned journeys.** 2 repaired, and a re-run reports "nothing to do."
- **Migration 245 is live on production** — both indexes confirmed by querying `information_schema`, not by reading the deploy log.
- **All 212 catalog profile fields exist in the app's 224-field registry** — diffed directly. So anything the Profile tab renders from the catalog is safe to write; the app's replay will not throw on the name.
- **`JSON_QUOTE` round-trips exactly as the read expects**: `"Self-employed"` → `JSON_UNQUOTE` → `Self-employed`, type STRING.
- **`manual` is a real `LastUpdatedBy` value already in use** — 410 rows. `SourceHistory`'s real shape is `[{value, updated_at, updated_by}]`, and `[]` where there is no prior.
- **2,990 of 5,085 profile rows hold a JSON OBJECT** — which is why editability is judged on the catalog **and** the stored shape.
- **Every test was verified to FAIL on the bug it claims to catch.** Removing the auth guard breaks 3 of 7 in the sandbox; accepting an unknown field name breaks 3 of 11 in MasterSuite; returning the submitted casing breaks exactly 1; ignoring the stored shape breaks exactly 1.
- `dotnet build` 0 errors; `dotnet test` **5,178 / 5,178** on `s98-g2-profile`.
- Sandbox: `npx tsc --noEmit` 0 errors, `npx next build` clean, `npx vitest run` **267 / 267**.

## What Is Broken or Incomplete

- **⚠ 76 of the 129 distinct profile keys in production match no catalog field** and all render in the "Other" bucket; only 53 match. Two are near-miss spellings — the data holds `lookalike_score` (2,990 rows) while the catalog lists `Lookalike Score`, and `lead_source` against `LeadSource`. Each mismatched catalog row sits in its group's denominator permanently empty while its real data shows elsewhere on the page, so "n of m filled" is understated. **Reported, not fixed** — this is G3 — **Medium**
- **G2 is started, not finished.** Still disabled: the territory **Data** tab's native fields, the Personal EOS add boxes (T8), Ecosystem add/remove stakeholder, "Add contact" and "Add note" on the shared Overview, and the header Merge / Delete / Transfer / Retire actions — **Medium**
- **⚠ The territory Data tab needs a real column allowlist**, unlike this one. Profile fields are EAV, so the field name is a _value_ in a row; territory fields are **columns**, and a column name goes straight into the UPDATE statement — **Medium**
- **Nothing in #686 has been clicked in a browser.** Local authed pages cannot render on this machine (`CookieHelper` wants a `jwt` it cannot sign). Worth checking after deploy: a pencil saves and the value flashes green; clearing a field drops the group's filled count by one; the "Other" group's pencils are inert with a tooltip — **Medium**
- **#684 and #686 are both open and unmerged.** Neither carries a migration — **Medium**
- **Three inline-edit implementations now exist**, where there were two. The new generic helper is the one to keep; the header rename (`.g-h1-pencil`) and the contact hero's phone/email edit still carry their own copies. They work and are shipped, so they were left alone rather than rewritten underneath a different task — **Low**
- **P2: nothing writes `frandev_task`.** The table holds **1 row**. The open question is the writer, not the reader — **Medium**
- **`GetAvgCycleDays` has no callers and measures 3,418 ms.** A landmine if anyone wires it up — **Low**
- **The lead-type taxonomy has near-duplicate values**: `Obituary`/`Obituaries`, `ProspectNow`/`Prospect Now`, `PropStream`/`Propstream`. G3 — **Low**
- Carried from s92–s94, all still Low: ungraded calls read "Group Call"; some AI titles run 87 chars and get cut off; the Overview left column ends early; casing is inconsistent in data-driven labels
- No `MasterSuite.Modules.Frandev.Tests` — but `MasterSuite.Platform.Tests` now **references** the FranDev module, so its pure pieces can at least be tested — **Low**
- **`DataAccess.Tests` is an empty shell** — no test files and no MSTest packages — **Low**
- ⚠ `dotnet test --nologo` **fails** on this repo. Use bare `dotnet test`, run from `apps/analysis-api` — **Low**

## Decisions Made

- **Repoint both different-name merges** — Corey, asked directly: "think those are correct." Both journeys now point at their keeper
- **Authorise them by an explicit list, not a flag** — Claude. `RULED_BY_HUMAN` names each row by slug and both names; a `--force` flag would have applied to whatever was orphaned that day
- **Close the auth hole but do NOT make it admin-only** — Claude. Admin would match the sibling route and silently break a button every role can see today. Raised as a question instead
- **Only catalog fields get a pencil** — Claude. The app's replay throws on an unknown field name, so accepting one means a write that looks saved and fails forever with nothing on screen saying so
- **Editability is judged on the catalog AND the stored JSON shape** — Claude, after measuring that 2,990 of 5,085 rows are objects. A one-line box would store an object's text and lose the object
- **`IsEditable` lives on the catalog, not the page's `RowVm`** — Claude, so the view and the service ask the same function and cannot drift, and so a test can execute the rule. Same reasoning that put `CategoricalPalette` in Platform in #684
- **Carry the JSON type as a STRING, decide in C#** — Claude. The mapper is MySqlConnector's `GetRowParser`, and `JSON_TYPE(x) IN (…)` returns an integer, not a boolean. Not worth betting the flag on
- **Build one generic inline editor; leave the two existing ones alone** — Claude. Rewriting shipped, working code underneath a different task is how regressions get in
- **Report the 76-key catalog mismatch rather than fix it** — Claude, per scope discipline. It is G3's work and it is now written down with numbers

## Files Created

- `MasterSuite.Modules.Frandev/FrandevService.WritesProfile.cs`
- `MasterSuite.Platform.Tests/Frandev/FrandevProfileFieldWriteGuardTests.cs`

## Files Modified

- `MasterSuite.Modules.Frandev/`: `FrandevProfileFieldCatalog.cs`, `FrandevService.Journey.cs`, `IFrandevService.WritesExtras.cs`
- `MasterSuite/Pages/Frandev/`: `ContactV2.cshtml.cs`, `JourneyV2.cshtml.cs`, `RecordSharedVm.cs`, `RecordPanels/_TabProfile.cshtml`
- `MasterSuite/Pages/Gunner/ShellStyles/`: `_RecordShell.cshtml`, `_RecordPage.cshtml`
- `Entities/Frandev/FrandevJourneyDetail.cs`, `MasterSuite.Platform.Tests/MasterSuite.Platform.Tests.csproj`
- Sandbox: `app/api/contacts/[contactId]/merge/route.ts`, `scripts/repair-orphaned-journey-primaries.ts`, `tests/api/contacts-merge-route.test.ts`, `docs/mastersuite-walkthrough-findings.md`, `handoff.md`

## Files Deleted

- None.

## Open Issues Carried Forward

### Waiting on Corey

1. **Merge #684?** (territory layout + donut colours). No migration — **Medium**
2. **Merge #686?** (the profile write layer). No migration — **Medium**
3. **Should merging a contact be admin-only?** It is now authenticated but open to any signed-in role, matching the button. Its sibling journey route requires admin. One line either way — and admin would take the button from the 9 `member` users who can use it today — **Medium**

### The walkthrough list

`docs/mastersuite-walkthrough-findings.md` is the tracker. Done or closed: G1, G4, J2, J5, J8, C2, C3, D1, D3, T1, T2, T3, T5, T6, T7, plus G2's profile slice and J6's profile half. Still open:

- **G2's remainder** — territory Data tab (needs a column allowlist), T8, Ecosystem, the Overview add affordances, the header actions. The generic editor and the pattern both exist now — **High**
- **G3** — now has two concrete targets: the 76-key profile mismatch and the lead-type near-duplicates — **Medium**
- **P1** pipelines list journeys _and_ territories (⚠ a person can legitimately sit at two stages at once) · **P3** sub-stage slide-out + advance-to-next-full-stage · **P4** territory labels match Vercel — **Medium**
- **J1** open the next pipeline on completion · **J3** the Activity panel should be an internal team chat · **J4** sub-stages individually tickable, bigger font · **J7** hide pipelines never entered (**cheapest of the big ones**) — **Medium**
- **C1** contacts panel on the contact · **T4** last stage 4 / active / sold inventory · **D5** 61 same-name contact groups · **D6** wire the email child table (2,765 rows live) · **D7** show the coach from the territory · **P2** why nothing writes `frandev_task` — **Medium**
- **D1's remaining two**: Loretta Koonce (a double space in the name) and Jorge Villalta. ⚠ Never key a merge on "one contact = one journey" — NAH System holds four territory journeys and Jason Semper two, legitimately — **Medium**
- **Q1** the nightly journey write per contact — Corey wants to talk it through · **Q2** two truncated lines, lost — **Low**

### Standing traps

- **⚠ Measure before optimising. Three-for-three on rewrites measuring slower than the original**: migration 243's `GROUP BY` (19,159 vs 16,209 ms), the funnel's reversed join (1,627 vs 786 ms), the duplicate-address `EXISTS` (2,424 vs 3,186 ms best-of-four) — **High**
- **Merging to main deploys AND migrates production with no reviewer gate.** And a green deploy is not proof a migration applied — query for the object afterwards — **High**
- **Running SQL against dev is NOT verification.** Read-only production works: `.env.local` `MASTERSUITE_DB_*`, MariaDB 12.3, `mysql2` with `NODE_PATH` into the sandbox's `node_modules`. ⚠ `performance_schema` is **denied**, so slow queries must be timed by hand — **High**
- **⚠ A write accepted by MasterSuite can still be rejected by the app on replay.** The journal is not a guarantee. When adding a write, check what the app's replay validates — for profile fields that is `isValidFieldName`, which throws — **High**
- **⚠ `IsKnown` on the profile catalog is case-INSENSITIVE; the app compares with `===`.** Always resolve to the catalog's exact spelling before storing — **High**
- **Supabase scripts need three things** or they fail confusingly: `dotenv.config({ path: ".env.local" })`, the `ws` polyfill on Node 20, and to be run from inside the repo — **Medium**
- **⚠ COLLATIONS.** `frandev_*` ids are `CHAR(36) ascii_bin`; names and slugs are `utf8mb4` — **High**
- **The .NET solution is at `apps/analysis-api/MasterSuite.sln`, not the repo root.** `dotnet build`/`dotnet test` from the root fails with MSB1003 and looks like a broken repo — **Low**
- **Local browser verification is impossible** — driving Corey's Chrome at production is the way — **Medium**
- **The FranDev data in MasterSuite is an Aug 1 snapshot.** Supabase is live; MasterSuite's `frandev_*` is the mirror — **Medium**
- **Two large tables worth a later look:** `NewAgainHouses_Analytics_PageVisits` (8.2 M rows, indexed only on `Id`) and `ThirdPartyApiResponses` (11 GB) — **Low**
- **PR #668 (SignWell e-sign) is another window's work** — **Low**
- **~40 stale worktrees** under `/Users/coreylavinder/Mastersuite/` — **Low**
- Carried: Jessica AdminPanel bypass + prod permission audit; API key rotation; nav rows 76/77 still `Enabled=0` so **FranDev still has no sidebar link**; `FRANDV` territory row absent from prod — **High/Medium**

## Exact Next Step

Get Corey's answer on #684 and #686 (merge or hold — neither has a migration), then carry G2 forward into the **territory Data tab**, pointing it at the generic inline editor already in `_RecordShell.cshtml`. ⚠ That one needs a real column allowlist: profile fields are EAV values, but territory fields are columns, and a column name goes straight into the UPDATE.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Tell me whether to merge #684 and #686, then continue G2 into the territory Data tab using the generic inline editor from #686 — with a column allowlist, since territory fields are real columns and not EAV values.

---
