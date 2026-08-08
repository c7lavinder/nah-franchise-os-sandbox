# Session Handoff — 2026-08-08 — Session 97

## Status

Phase: **FranDev → MasterSuite fold-in. Five PRs merged and deployed. G2's write layer is
essentially complete — profile, territory record, EOS, stakeholders and the header actions
all write. Along the way, two instances of the same class of bug: a write journaled on one
side that the other side cannot apply.** / Health: Green / Duration: full session

Nothing is left half-finished. **Five MasterSuite PRs merged and deployed** (#688, #689,
#692, #693, #696) and **three sandbox commits pushed** (`d2a0604`, `b14dcfc`, `9bc6e55`).
Sandbox `main` at `90a49a2`.

---

## ⚠ WHAT IS STILL OUTSTANDING — read this first

### Nothing is blocked on Corey. Everything he was asked has been answered.

Settled this session, and already recorded in `docs/mastersuite-walkthrough-findings.md`:

| Question           | Corey's answer                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Retiring a journey | Goes **inactive, not deleted** ⇒ `archived`                                                               |
| Deleting           | **Real delete**, "just like properties. This is one app" — and only for a duplicate or one already merged |
| Territory transfer | Old owner **kept, end-dated**                                                                             |
| Notes              | Journey / territory / contact **triangle, journey holds everything**; anyone can edit or delete           |
| Multiple journeys  | "People should not be in multiple journeys" — **true: one per TERRITORY**                                 |

### The three things that need BUILDING, in the order I would do them

1. **Notes — the biggest remaining piece, and fully specified.**
   The Notes panel already exists on all three record pages with `Wired = false`, so there is
   no UI to design. What is missing is the store: a Supabase table, a `frandev_` mirror, an
   entry in push-frandev's table list, and a replay handler.
   ⚠ **There is no human notes table today.** `contact_journals` is the AI's daily summary,
   not this.
   The rollup: a territory or contact note also appears in that person's ACTIVE journeys — one
   journey for 3,151 of 3,155 people.

2. **Merge — extract before porting.**
   Both Merge buttons are still disabled. The app's contact merge is **410 lines** across
   calls, emails, journey memberships, primary-contact pointers and GHL, and its own comments
   record that **3 of its 5 runs left orphaned journeys**. The right move is to pull it into
   `lib/contacts/merge.ts` so the route AND the replay call one implementation — then
   MasterSuite's button journals `merge_contacts` and the app does the real work. Do **not**
   write a second copy in C#.

3. **Delete contact — needs a generated child list.**
   A contact is referenced by **25 mirror tables**, and the mirror has **no foreign keys**, so
   nothing cascades and nothing complains. Hand-enumerating 25 tables where a miss is a silent
   orphan is the shape of the bug this module has already produced twice. A journey was safe
   because its guards cut it to five tables; a contact has no equivalent narrowing.

### The walkthrough list — what is genuinely left

**Done or closed:** G1, G4, J1, J2, J4, J5, J6, J7, J8, C2, C3, D1 (orphans), D3, D7, P4, T1,
T2, T3, T5, T6, T7, T8, plus G2's profile, territory-record, EOS, stakeholder and header
halves.

| Item             | What is left                                                                                   | Severity   |
| ---------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| **Notes**        | New table both sides; the panel is already on the page                                         | **High**   |
| **G2 remainder** | Merge (×2), Delete contact, "Add contact" on Overview                                          | **Medium** |
| **G3**           | The field audit — 76 of 129 profile keys match no catalog field; lead-type near-duplicates     | **Medium** |
| **P1**           | Pipelines list journeys _and_ territories (⚠ a person can sit at two stages at once)           | **Medium** |
| **P3**           | Sub-stage slide-out visual work + advance-to-next-full-stage                                   | **Medium** |
| **J3**           | Activity panel should be an internal team chat, not a history                                  | **Medium** |
| **C1**           | Contacts panel on the contact (family follows the person; workers stay with the territory)     | **Medium** |
| **T4**           | Last stage 4 / active / sold inventory, same UI _and_ wiring as Vercel                         | **Medium** |
| **D5**           | 61 same-name contact groups; the merge mechanism exists and has run 28 times                   | **Medium** |
| **D6**           | Wire the email child table (2,765 rows, 84 people with >1). Phones are five flat columns       | **Medium** |
| **P2**           | Find out why nothing writes `frandev_task` — the table holds **1 row**. A writer problem       | **Medium** |
| **D1**           | The last two real duplicate journeys: **Loretta Koonce** (double space) and **Jorge Villalta** | **Medium** |
| **Q2**           | Two truncated lines from the original notes — **lost, not recoverable**                        | **Low**    |

---

## What Was Built This Session

**#688 — a journey stops advertising three pipelines it has never been on (J7).**

- `MasterSuite.Platform/Helpers/EnteredOnlyFilter.cs` — new. `JourneyV2.cshtml.cs`,
  `_JourneyHero.cshtml`, `MasterSuite.Platform.Tests/Helpers/EnteredOnlyFilterTests.cs`.

**#689 — the territory record becomes writable, behind a real column allowlist (G2).**

- `FrandevTerritoryFieldCatalog.cs` and `FrandevService.WritesTerritory.cs` — new. 26 fields.
- `_TabData.cshtml`, `TerritoryV2.cshtml.cs`, `FrandevPageModel.cs` (`ResolveWriteUser`),
  `IFrandevService.WritesExtras.cs`, `FrandevTerritoryFieldCatalogTests.cs` (21 tests).

**#692 — the EOS boxes and the stakeholder list stop being decoration (T8 + G2).**

- `FrandevService.WritesEos.cs`, `FrandevService.WritesStakeholder.cs` — new.
- `_TabPersonalEos.cshtml`, `_TabEcosystem.cshtml`, `_RecordPage.cshtml`, `RecordSharedVm.cs`,
  `ContactV2.cshtml.cs`, `JourneyV2.cshtml.cs`, `FrandevTerritory.cs`,
  `FrandevService.Territories.cs`, `FrandevEosAndStakeholderWriteTests.cs`.

**#693 — J1 · J4 · D7 · P4.**

- `EnteredOnlyFilter.FirstUnfinished`, `JourneyV2.cshtml.cs`, `ContactV2.cshtml.cs`,
  `_JourneyHero.cshtml`, `_RecordPage.cshtml`, `FrandevService.PipelinePage.cs`,
  `FrandevService.RecordPages.cs`, `FrandevService.Territories.cs`, `FrandevTerritory.cs`,
  `FrandevRecordPages.cs`, `EnteredOnlyFilterTests.cs`.

**#696 — retire, delete and transfer stop being tooltips (G2's header actions).**

- `FrandevService.WritesLifecycle.cs` — new. Retire journey (new button), delete journey,
  retire territory, transfer territory, plus `SearchContactsForPicker`.
- `JourneyV2.cshtml`/`.cs`, `TerritoryV2.cshtml`/`.cs`, `FrandevWriteExtras.cs`,
  `IFrandevService.WritesExtras.cs`, `FrandevLifecycleStatusTests.cs`.

**Sandbox `d2a0604` — three writes MasterSuite had been journaling with nowhere to land.**

- `lib/mastersuite/apply-native-writes.ts` — handlers for `update_profile_field`,
  `rename_journey`, `set_call_type`; `HANDLED_WRITE_TYPES` exported; `unhandledTypes` on
  `ApplyResult`; dispatch-coverage test.

**Sandbox `b14dcfc` / `9bc6e55` — eight more replay handlers,** written in the same change as
the MasterSuite side that emits them: `create_eos_item`, `create_eos_habit`,
`create_stakeholder`, `remove_stakeholder`, `archive_journey`, `delete_journey`,
`retire_territory`, `transfer_territory`. The fake Supabase in the tests grew a `delete()`.

---

## What Is Confirmed Working

**Every number below was measured, most against PRODUCTION read-only. None is predicted.**

- **`dotnet build` 0 errors; `dotnet test` 5,263 / 5,263.** Sandbox: `npx tsc --noEmit` 0
  errors, `npx next build` clean, `npx vitest run` **299 / 299**.
- **All five MasterSuite PRs merged AND their deploys confirmed green** — checked after the
  merge, not assumed from it.
- **3,053 of 3,164 journeys sit in exactly one pipeline** (42 on two, 1 on three, 68 on four).
- **3,151 of 3,155 people have exactly one active journey.** The four exceptions are named:
  NAH System (a system account), **Jason Semper — legitimate, two territories**, and Loretta
  Koonce and Jorge Villalta, the two known duplicates.
- **Corey's J1 example verified on production**: Dreyer's `sales` is at "Closed" (6 of 6) and
  `onboarding` at "Training" (1 of 3).
- **All 89 territories carry a nickname**; exactly one equals its slug.
- **72 of 89 territories carry a `PrimaryCoach`**, across 3 distinct people.
- **`frandev_native_write` on production holds 0 rows**, and the mirror's newest row is Aug 1
  — which is why the replay gap had cost nothing yet.
- **Territory column types and lengths read from `information_schema`**: `PersonalPhoneNumber`
  is `varchar(15)`; `IsFranchise`/`IsFullTime` are `NOT NULL`.
- **Every new test was run against a deliberate break** and failed exactly the tests that
  claim it — across `EnteredOnlyFilter` (3 mutants), the territory catalog (4), the replay
  handlers (3 + 3), and the lifecycle handlers (3).

---

## What Is Broken or Incomplete

- **⚠ NOTHING SHIPPED THIS SESSION HAS BEEN CLICKED IN A BROWSER.** Eleven items across five
  PRs, all verified by test and build only — local authed pages cannot render here
  (`CookieHelper` wants a `jwt` it cannot sign). **This is now the single biggest gap.**
  Worth a pass: a pencil saves and flashes green; an EOS box appends a row and the count goes
  up; a stakeholder adds and removes; a sub-stage ticks WITHOUT advancing the whole stage;
  Retire appears on a live journey and Delete only on a retired one — **High**
- **Merge is still disabled on both pages** — see the outstanding list for why it is an
  extraction, not a port — **Medium**
- **Contact delete is not built** — 25 mirror tables, no foreign keys — **Medium**
- **⚠ 76 of the 129 distinct profile keys in production match no catalog field** — G3 —
  **Medium**
- **Three inline-edit implementations still exist.** The generic `data-edit` helper is the one
  to keep; the header rename and the contact hero's phone/email edit still carry their own —
  **Low**
- **`ResolveUser` / `ResolveUsername` still duplicated** on ContactV2 and JourneyV2.
  `FrandevPageModel.ResolveWriteUser` is the replacement and serves the new handlers; the two
  old copies were left alone rather than rewritten underneath another task — **Low**
- **`updateCandidateScore` / `updateCandidateFlags` still write on every event call even when
  nothing changed** — only the cron path was optimised — **Low**
- **`GetAvgCycleDays` has no callers and measures 3,418 ms** — **Low**
- Carried, all Low: ungraded calls read "Group Call"; some AI titles run 87 chars; the
  Overview left column ends early; casing inconsistent in data-driven labels;
  `DataAccess.Tests` is an empty shell; ⚠ `dotnet test --nologo` fails — use bare `dotnet test`
  from `apps/analysis-api`

---

## Decisions Made

- **Retire ≠ delete. A retired journey goes inactive** — Corey. Maps to `archived`
- **Delete is real, "just like properties. This is one app"** — Corey. Matches
  `DataAccessLayer.DeleteProperty`: no soft flag, no undo
- **Only delete a journey that is a duplicate or already merged** — Corey. Enforced by
  refusing an ACTIVE journey and any journey holding calls
- **Transfer keeps the outgoing owner, end-dated** — Corey
- **Notes are a triangle with the journey holding everything; anyone can edit or delete** — Corey
- **Show Retire OR Delete, never both** — Claude. Offering the irreversible action beside a
  live candidate is the mis-click to design out
- **Territory writes do NOT journal** — Claude. `Territories` is MasterSuite's own table and
  syncs outward; a journal row would be unreplayable
- **Every replay handler ships in the same change as the write that emits it** — Claude, after
  finding three that had not
- **Merge is an extraction, not a port** — Claude. One implementation for the route and the
  replay, rather than a second copy in C#
- **Contact delete waits for a generated child list** — Claude. 25 tables by hand is the bug
  we spent the day fixing
- **`EnteredOnlyFilter` falls back rather than returning empty** — Claude. A bare filter blanks
  the journey hero for a journey on no pipeline

---

## Files Created

- `MasterSuite.Platform/Helpers/EnteredOnlyFilter.cs`
- `MasterSuite.Modules.Frandev/`: `FrandevTerritoryFieldCatalog.cs`,
  `FrandevService.WritesTerritory.cs`, `FrandevService.WritesEos.cs`,
  `FrandevService.WritesStakeholder.cs`, `FrandevService.WritesLifecycle.cs`
- `MasterSuite.Platform.Tests/`: `Helpers/EnteredOnlyFilterTests.cs`,
  `Frandev/FrandevTerritoryFieldCatalogTests.cs`,
  `Frandev/FrandevEosAndStakeholderWriteTests.cs`, `Frandev/FrandevLifecycleStatusTests.cs`

## Files Modified

- `MasterSuite/Pages/Frandev/`: `JourneyV2.cshtml` + `.cs`, `ContactV2.cshtml.cs`,
  `TerritoryV2.cshtml` + `.cs`, `FrandevPageModel.cs`, `RecordSharedVm.cs`,
  `RecordPanels/_JourneyHero.cshtml`, `_TabData.cshtml`, `_TabPersonalEos.cshtml`,
  `_TabEcosystem.cshtml`
- `MasterSuite/Pages/Gunner/ShellStyles/_RecordPage.cshtml`
- `MasterSuite.Modules.Frandev/`: `IFrandevService.WritesExtras.cs`,
  `FrandevService.Territories.cs`, `FrandevService.RecordPages.cs`,
  `FrandevService.PipelinePage.cs`
- `Entities/Frandev/`: `FrandevTerritory.cs`, `FrandevRecordPages.cs`, `FrandevWriteExtras.cs`
- Sandbox: `lib/mastersuite/apply-native-writes.ts`,
  `tests/business-logic/apply-native-writes.test.ts`,
  `docs/mastersuite-walkthrough-findings.md`, `handoff.md`

## Files Deleted

- No files.

---

## Open Issues Carried Forward

See **"WHAT IS STILL OUTSTANDING"** at the top — that is the live list. Plus the standing traps:

- **⚠ THE RECURRING BUG OF THIS PROJECT: two halves of a contract in two repos, with nothing
  forcing them to agree.** It appeared TWICE today. (1) Three write types MasterSuite had
  journaled since #678 had no replay handler — they would have been marked failed and then
  overwritten by the nightly push. (2) Migration `20260509000000` renamed `ms_slug` →
  `"TerritorySlug"` across **seventeen** tables, and `applyCreateStakeholder` — shipped hours
  earlier in #692 — was written against the old name. Both type-checked and passed review.
  **Before writing any cross-repo handler, read the migration and the live queries** — **High**
  To re-derive MasterSuite's emitters, from its repo root:
  `grep -rhon 'JournalNativeWrite(conn, tx, "[a-z_]*"' MasterSuite.Modules.Frandev/ | sed 's/.*"\(.*\)"/\1/' | sort -u`
- **⚠ A write accepted by MasterSuite can still be rejected by the app on replay.** The mirror
  columns are loose; the Supabase columns carry CHECK constraints. `habits.cadence` is the
  live example — the dropdown says "Bi-weekly" and the CHECK takes `biweekly` — **High**
- **⚠ The mirror has NO foreign keys.** Supabase cascades; the mirror does not. Every child row
  must be deleted by hand, and a table left off the list is a silent orphan — **High**
- **⚠ Measure before optimising. Three-for-three on rewrites measuring slower** — **High**
- **Merging to main deploys AND migrates production with no reviewer gate.** A green deploy is
  not proof a migration applied — query for the object afterwards — **High**
- **⚠ Vercel Cron invokes with GET.** A route exporting only POST answers 405 forever — **High**
- **⚠ `IsKnown` on the profile catalog is case-INSENSITIVE; the app compares with `===`** — **High**
- **Running SQL against dev is NOT verification.** Read-only production works: `.env.local`
  `MASTERSUITE_DB_*`, `mysql2` with `NODE_PATH` into the sandbox's `node_modules`.
  ⚠ `performance_schema` is **denied** — **High**
- **⚠ COLLATIONS.** `frandev_*` ids are `CHAR(36) ascii_bin`; names and slugs are `utf8mb4` —
  **High**
- **The repo enforces its own `data-wire` vocabulary** — `Table.Column`, `calc:`, `config:`,
  `sql:`, `none:`, `const:`. A contract test catches anything else — **Low**
- **FranDev is reached through the Gunner top header** — switch account to FranDev, then click
  Gunner. Nav rows 76/77 disabled on production is **fine** — **Medium**
- **Local browser verification is impossible** — driving Corey's Chrome at production is the
  way — **Medium**
- **The FranDev data in MasterSuite is an Aug 1 snapshot** — **Medium**
- **The .NET solution is at `apps/analysis-api/MasterSuite.sln`, not the repo root** — **Low**
- **~40 stale worktrees** under `/Users/coreylavinder/Mastersuite/` — **Low**
- Carried: Jessica AdminPanel bypass + prod permission audit; API key rotation; `FRANDV`
  territory row absent from prod — **High/Medium**

### Held until FranDev is off Vercel (Corey, s96) — unchanged

Four nightly jobs are fixed but deliberately unscheduled: `score-recalculate`,
`generate-briefs`, `stale-leads`, `daily-brief`. Post-move backfill: **all journeys and all
territories**, contacts probably not. ⚠ Journey briefs are ~3,175 LLM calls — one deliberate
run, not a nightly trickle.

---

## Exact Next Step

Click through the five deployed PRs on production — the journey page first (Retire on a live
journey, a sub-stage tick that does NOT advance the stage), then a Profile pencil and an EOS
add box — because eleven items shipped today with zero browser verification; then start
**notes**, whose panel already exists on all three record pages and needs only a Supabase
table, a `frandev_` mirror, a push-list entry and a replay handler.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: First have me click through the five PRs deployed in session 97 on production — the journey page first (Retire on a live journey, and a sub-stage tick that does NOT advance the whole stage), then a Profile pencil and an EOS add box — because eleven items shipped with zero browser verification. Then build NOTES: the panel already exists on all three record pages with Wired=false, so it needs a Supabase table, a frandev\_ mirror, a push-frandev list entry and a replay handler, all in one change. The model is a triangle with the journey holding everything — a territory or contact note also shows in that person's active journeys; a journey note stays put; anyone can edit or delete. Do NOT switch any nightly cron back on.

---
