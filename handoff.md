# Session Handoff — 2026-08-09 — Session 98

## Status

Phase: **FranDev → MasterSuite fold-in. The browser pass that session 97 never got to —
which found a shipped feature that had never once worked — plus Notes, whose store now
exists on both sides.** / Health: Green / Duration: full session

Sandbox `main` at `96fcbad` (pushed). **Two MasterSuite PRs open and unmerged: #698 and
#700.** Nothing is half-finished; the two PRs are waiting on a merge decision, not on work.

---

## ⚠ WHAT IS STILL OUTSTANDING — read this first

### Needs Corey (2 items, both small)

| #   | Item                                                              | Why it is his                                                                                                                                                            |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Click "Retire journey"** on `loretta-koonce-2` (still `active`) | Claude cannot click it — Retire/Delete use native `prompt()`/`confirm()`, which freeze the browser extension. The ONLY item from session 97's five PRs still unverified. |
| 2   | **Merge #698 and #700**                                           | Merging deploys AND migrates production with no reviewer gate.                                                                                                           |

**#698 — the profile pencil fix. Until this merges, every profile-field edit on production
fails.** **#700 — the `frandev_note` mirror. Notes cannot sync to MasterSuite without it.**

### Blocked on Ben — unchanged

- **Production `frandev_%` GRANT.** All 116 tables exist in prod with 0 rows; code and
  dry-run (97,818 rows) have been ready for weeks.
- Jessica AdminPanel bypass + prod permission audit; API key rotation.

### Notes — what is left

The **store** is done both sides. The **UI is not**: the panel is still `Wired = false` on
all three record pages and nothing emits `create_note` / `update_note` / `delete_note`. Next
Notes session = wire the panel + the three buttons + the rollup read. The store shipped
first deliberately; the reverse order is what stranded three write types for a week.

### The walkthrough list — genuinely left

| Item               | What is left                                                                                                   | Severity   |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | ---------- |
| **Notes UI**       | Panel + buttons + rollup read. Store is done.                                                                  | **High**   |
| **Merge (×2)**     | Still disabled. An EXTRACTION of the app's 410-line merge, not a port — 3 of its 5 runs left orphaned journeys | **Medium** |
| **Delete contact** | 25 mirror tables, no FKs. Needs a GENERATED child list                                                         | **Medium** |
| **G3**             | 76 of 129 profile keys match no catalog field                                                                  | **Medium** |
| **P2**             | Nothing writes `frandev_task` — the table holds 1 row                                                          | **Medium** |
| **P1**             | Pipelines list journeys _and_ territories (a person can sit at two stages)                                     | **Medium** |
| **P3**             | Sub-stage slide-out + advance-to-next-full-stage                                                               | **Medium** |
| **J3**             | Activity panel should be an internal team chat, not a history                                                  | **Medium** |
| **C1**             | Contacts panel on the contact (family follows the person; workers stay)                                        | **Medium** |
| **T4**             | Last stage 4 / active / sold inventory, same UI _and_ wiring as Vercel                                         | **Medium** |
| **D5**             | 61 same-name contact groups; merge mechanism exists, has run 28 times                                          | **Medium** |
| **D6**             | Wire the email child table (2,765 rows, 84 people with >1)                                                     | **Medium** |
| **D1**             | Loretta Koonce + Jorge Villalta duplicates. Corey's Retire click starts this                                   | **Medium** |
| **Q2**             | Two truncated lines from the original notes — lost, not recoverable                                            | **Low**    |

---

## What Was Built This Session

**MasterSuite PR #698 — the profile pencil could never have saved; the server is MariaDB.**

- `FrandevService.WritesProfile.cs` — dropped `CAST(@history AS JSON)` from BOTH the INSERT
  and the UPDATE; corrected the stale "the column is JSON" comment (it is `longtext`).
- `MasterSuite.Platform.Tests/Frandev/MariaDbSqlDialectTests.cs` — new. Source scan for
  constructs MariaDB rejects, each entry carrying the production error that proves it.

**MasterSuite PR #700 — the FranDev mirror for notes.**

- `DatabaseMigrationRunner/Migrations/2026-08-09-246_FrandevNotes.sql` — new. `frandev_note`.
- `FrandevService.WritesLifecycle.cs` — `frandev_note` added to `DeleteJourney`'s child list
  in the same change that creates the table.

**Sandbox `96fcbad` — the notes store, applied to production.**

- `supabase/migrations/20260809000000_create_notes.sql` — new, **APPLIED to prod Supabase**.
- `lib/mastersuite/apply-native-writes.ts` — `create_note` / `update_note` / `delete_note`.
- `lib/mastersuite/push-frandev.ts` — `notes` added to `SUPABASE_TABLES`.
- `tests/business-logic/apply-native-writes.test.ts` — 14 new tests.
- `tests/business-logic/push-frandev-naming.test.ts` — new; push had NO test coverage at all.

---

## What Is Confirmed Working

**Measured, most against PRODUCTION. None predicted.**

- **⚠ THE BROWSER PASS FINALLY HAPPENED**, driving Corey's Chrome at production.
- **Sub-stage tick does NOT advance the stage** — ticked Outreach on `jorge-villalta-2`
  (Engagement, 3 sub-stages): stage stayed Engagement, days-in-stage stayed 47, Qualification
  untouched, `EnteredCurrentStageAt` unchanged in the DB. Counter went 0/3 → 1/3 and the
  current marker moved to the next sub-stage. **Unticked afterward — that journey is exactly
  as it was.**
- **EOS add box works** — issue appended on MaxTest Bot, count 0 → 1 with no reload; mirror
  row AND `create_eos_item` journal row both verified, payload matches the handler interface.
- **Retire/Delete are mutually exclusive on screen** — a live journey offers Retire only.
- **28 emitters in MasterSuite, 28 handlers in the app — exact match.** No gap today.
- **`notes` is live on production Supabase**: 15 columns, 10 CHECKs, 0 rows.
- **All 10 notes constraint cases exercised against real rows** in a rolled-back transaction:
  3 valid scopes accepted; scope/target mismatch, two targets, no target, blank body, unknown
  scope, missing author and a bad FK all rejected.
- **Every new test run against a deliberate break.** #698: 2 tests fail on a reintroduced
  cast (89 files scanned, 1 offence). Notes: 5 mutants — `TerritorySlug`→snake_case (2 fail),
  soft delete→hard delete (1), update→upsert (2), two-target guard removed (1), `notes`
  removed from the push list (2). All restored green.
- **⚠ The `frandev_note` DDL was RUN, not just read** — sent to production as a temporary
  table; it parses and reaches the privilege check. Given #698, "it compiles" is not enough.
- Sandbox: `npx tsc --noEmit` 0, `npx next build` clean, `npx vitest run` **318/318**.
  MasterSuite: `dotnet build` 0 errors, `dotnet test` **5,273/5,273**.

---

## What Is Broken or Incomplete

- **⚠ THE PROFILE PENCIL HAS NEVER SAVED ON PRODUCTION.** Every field, every save, since the
  file shipped. `CAST(@history AS JSON)` is MySQL-only; production is **MariaDB 12.3.2**,
  which has no JSON type to cast to. Fix is #698 — **not merged, so still broken today** —
  **Critical until merged**
- **Notes has no UI.** Panel `Wired = false`; nothing emits the three write types — **High**
- **Sub-stage counter does not refresh without a page reload** — it ticks the box and leaves
  "0/3". Tick three in a row and it reads 0/3 throughout — **Medium**
- **No attribution on a sub-stage tick** — `LoggerUserId` is NULL in the mirror. The email
  DOES reach the journal, so the data exists; the mirror column is simply never written — **Low**
- **Retire/Delete use native `prompt()`/`confirm()`/`alert()`** — the only writes on these
  pages that do. Cannot be automated or browser-tested, and they look nothing like the rest of
  the UI. Every other panel uses inline editors — **Medium**
- **A sub-stage untick HARD-deletes the log row** even though `frandev_contact_sub_task_log`
  carries a `DeletedAt` column that is never used — **Low**
- **One test EOS issue left on MaxTest Bot** ("Verification check session 98 - please
  ignore"). There is no delete path for EOS items in the UI — **Low**
- Merge still disabled ×2; contact delete not built; 76 of 129 profile keys unmatched —
  **Medium**
- Carried, all Low: three inline-edit implementations; `ResolveUser`/`ResolveUsername`
  duplicated; `updateCandidateScore`/`Flags` write on every event call; `GetAvgCycleDays` has
  no callers and measures 3,418 ms; ungraded calls read "Group Call"; `DataAccess.Tests` is an
  empty shell; ⚠ `dotnet test --nologo` fails — use bare `dotnet test`

---

## Decisions Made

- **Fix the profile pencil before building Notes** — Corey, asked and answered
- **Notes is ONE table, not three** — Claude. Scope + exactly one target id, enforced by a
  CHECK. Three tables would need three of every read, handler and delete path
- **The rollup is a READ, not a row** — Claude. A copy per journey means every edit and delete
  must find every copy; deriving also self-heals when a contact moves
- **Notes delete is SOFT** — Claude, forced by the mechanism. The nightly push is
  upsert-by-PK and cannot express a removal; a hard delete would strand the row in the mirror
- **`applyUpdateNote` is an update, NOT an upsert** — Claude. An upsert against a missing note
  inserts a scopeless row the CHECK then rejects
- **Only JOURNEY-scoped notes die with a deleted journey** — Claude. Territory and contact
  notes only APPEAR there via the rollup
- **The store ships before the UI** — Claude. The reverse order stranded three write types
- **Retired the duplicate, not a healthy journey, for the Retire test** — Claude. `loretta-koonce-2`
  needed retiring anyway, so the test is real cleanup rather than a change to undo
- **A source scan cannot prove SQL runs, and its doc comment says so** — Claude. It prevents
  THIS regression returning, which is the failure that actually happened

---

## Files Created

- `MasterSuite.Platform.Tests/Frandev/MariaDbSqlDialectTests.cs`
- `DatabaseMigrationRunner/Migrations/2026-08-09-246_FrandevNotes.sql`
- `supabase/migrations/20260809000000_create_notes.sql`
- `tests/business-logic/push-frandev-naming.test.ts`

## Files Modified

- `MasterSuite.Modules.Frandev/FrandevService.WritesProfile.cs` (#698)
- `MasterSuite.Modules.Frandev/FrandevService.WritesLifecycle.cs` (#700)
- `lib/mastersuite/apply-native-writes.ts`, `lib/mastersuite/push-frandev.ts`
- `tests/business-logic/apply-native-writes.test.ts`, `handoff.md`

## Files Deleted

- No files.

---

## Open Issues Carried Forward

See **"WHAT IS STILL OUTSTANDING"** at the top. Plus the standing traps:

- **⚠ NEW AND THE BIGGEST ONE: MasterSuite production is MariaDB 12.3.2, NOT MySQL** — and
  every C# type name says MySQL (`MySqlConnection`, `MySqlCommand`) because it connects
  through `MySqlConnector`. `CAST(x AS JSON)` is a **syntax error**; MariaDB's JSON is an
  alias for `LONGTEXT` + `JSON_VALID`. The JSON _functions_ all work — only the _type_ is
  missing. `JSON_TABLE` and `JSON_OVERLAPS` are also absent. **MySQL-only SQL builds green,
  reviews green, and fails only when executed** — **High**
- **⚠ Collation catalogue lies.** `utf8mb4_uca1400_ai_ci` is live on `frandev_*` and resolves
  fine, but is NOT listed under that name in `information_schema.COLLATIONS` (MariaDB 11.4+
  lists them as `uca1400_ai_ci`). Its absence is not evidence — test with
  `SELECT 'x' COLLATE utf8mb4_uca1400_ai_ci = 'X'` — **Medium**
- **⚠ A GREEN BUILD AND GREEN TESTS PROVE NOTHING ABOUT SQL.** #698 shipped with 5,263 tests
  passing and had never once worked. **Run the statement** — **High**
- **⚠ THE RECURRING BUG: two halves of a contract in two repos with nothing forcing them to
  agree.** Clean today (28 = 28). Re-derive from MasterSuite's root:
  `grep -rhon 'JournalNativeWrite(conn, tx, "[a-z_]*"' MasterSuite.Modules.Frandev/ | sed 's/.*"\(.*\)"/\1/' | sort -u`
  — **High**
- **⚠ A write accepted by MasterSuite can still be rejected on replay.** Mirror columns are
  loose; Supabase carries CHECKs. `habits.cadence` is the live example — **High**
- **⚠ The mirror has NO foreign keys.** Every child row is deleted by hand; a table left off
  a list is a silent orphan — **High**
- **⚠ `TerritorySlug` is PascalCase on BOTH sides** (migration 20260509000000). Only the
  payload KEY says `ms_slug`. Read the LIVE schema — the migration that created
  `territory_stakeholders` still says `ms_slug` and is three months stale — **High**
- **⚠ Vercel Cron invokes with GET.** A POST-only route answers 405 forever — **High**
- **⚠ `IsKnown` on the profile catalog is case-INSENSITIVE; the app compares with `===`** — **High**
- **⚠ Never compare GHL ids against UUID columns in `.or()`** — use `contactIdFilter()` — **High**
- **Merging to main deploys AND migrates production with no reviewer gate** — **High**
- **Running SQL against dev is NOT verification.** Read-only prod: `.env.local`
  `MASTERSUITE_DB_*`, `mysql2` with `NODE_PATH` into the sandbox's `node_modules`.
  ⚠ `performance_schema` is denied. Supabase DDL: `psql "$DATABASE_URL"`. ⚠ Node 20 needs
  `globalThis.WebSocket = require("ws")` before `createClient` — **High**
- **The repo enforces its own `data-wire` vocabulary** — `Table.Column`, `calc:`, `config:`,
  `sql:`, `none:`, `const:`. A contract test catches anything else — **Low**
- **⚠ The git hook blocks a commit message containing the words "push list"** — it misparses
  it as `git push <remote>`. Write the message to a file and commit/push separately — **Low**
- **FranDev is reached through the Gunner top header** — switch account to FranDev, then click
  Gunner. Nav rows 76/77 disabled on production is fine — **Medium**
- **Local browser verification is impossible** — driving Corey's Chrome at production is the
  way. `CookieHelper` wants a `jwt` it cannot sign locally — **Medium**
- **The FranDev data in MasterSuite is an Aug 1 snapshot** — **Medium**
- **PR numbers are NOT merge order** — #681 merged after #697. Never infer a rollback from a
  low number at the tip; check `git merge-base --is-ancestor` — **Low**
- **The .NET solution is at `apps/analysis-api/MasterSuite.sln`, not the repo root** — **Low**
- **~42 stale worktrees** under `/Users/coreylavinder/Mastersuite/`, now including
  `wt-mariadb-json` (#698) and `wt-notes` (#700) — remove both once merged — **Low**

### Held until FranDev is off Vercel (Corey, s96) — unchanged

Four nightly jobs are fixed but deliberately unscheduled: `score-recalculate`,
`generate-briefs`, `stale-leads`, `daily-brief`. ⚠ `frandev_native_write` now holds **3 rows**
(2 sub-task ticks + 1 EOS issue, all `pending`) — they apply the moment replay is switched on.
Post-move backfill: all journeys and all territories. ⚠ Journey briefs are ~3,175 LLM calls —
one deliberate run, not a nightly trickle.

---

## Exact Next Step

Merge #698 (the profile pencil has never saved on production) and #700 (the notes mirror),
confirm both deploys green and query for the `frandev_note` table afterwards, then wire the
Notes UI — the panel is `Wired = false` on all three record pages and the store is already
live on both sides.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Merge #698 (the profile pencil has never saved on production — MariaDB rejects `CAST(x AS JSON)`) and #700 (the `frandev_note` mirror), confirm both deploys are green and query production for the `frandev_note` table afterwards — a green deploy is not proof a migration applied. Then wire the NOTES UI: the panel is `Wired = false` on journey, territory and contact, and the store is already live on both sides (Supabase `notes` applied to production, `frandev_note` in #700, push-list entry and the create/update/delete replay handlers in sandbox `96fcbad`). The model is a triangle with the journey holding everything — the rollup is a READ, not a row, and deletes are SOFT. Also still open: I need to click "Retire journey" on `loretta-koonce-2` myself, because those buttons use native browser popups. Do NOT switch any nightly cron back on.

---
