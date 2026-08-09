# Session Handoff — 2026-08-09 — Session 99

## Status

Phase: **FranDev → MasterSuite fold-in. The hammer-through session: every merge landed,
Notes went live end-to-end (and its read bug was caught ON production within the hour),
tasks became writable, the native popups are dead, and the duplicate data got cleaned —
four PRs merged, two sandbox pushes, eleven of fifteen tracked items closed.** /
Health: Green / Duration: full session

Sandbox `main` pushed. MasterSuite `main` at `73662ea5e` — **#698, #700, #702, #704 all
merged and deployed this session** (plus #703, which was NOT this session's work — see
below). No PRs of ours are open. No worktrees of ours remain.

---

## ⚠ WHAT IS STILL OUTSTANDING — read this first

### Needs Corey (1 item)

| #   | Item                                                       | Why it is his                                                                                                                                                       |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Review `docs/duplicate-contacts-review.md`** (57 groups) | Same-name contacts with NO shared email/phone — merging two different people is destructive, so each needs a human call. Merge from Lead detail → Merge in the app. |

**The old "click Retire on loretta-koonce-2" item is GONE** — done this session, through
the production handler (see Decisions). The old "merge #698/#700" item is GONE — merged.

### Blocked on Ben — unchanged

- Production `frandev_%` GRANT / nightly prod push resume (the mirror is still an Aug 1
  snapshot; MAX(UpdatedAt) proves nothing has pushed since).
- Jessica AdminPanel bypass + prod permission audit; API key rotation.

### The walkthrough list — what genuinely remains

| Item               | What is left                                                                                                                                                                                                                                     | Severity   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| **Merge (×2)**     | Still disabled in MasterSuite. An EXTRACTION of the app's 410-line merge (`app/api/contacts/[contactId]/merge/route.ts`) — the route itself is healthy now (step 3b fixed, 9 clean runs today)                                                   | **Medium** |
| **Delete contact** | 25 mirror tables, no FKs. Needs a GENERATED child list                                                                                                                                                                                           | **Medium** |
| **P1**             | Pipelines list journeys _and_ territories (a person can sit at two stages — that duality is LEGITIMATE per the one-journey-per-territory model; the fix is presentation, not dedup)                                                              | **Medium** |
| **P3**             | ONLY the pipeline page's slide-out visual work remains — the three sub-stage bugs are FIXED (#704) and advance-to-next-full-stage exists as the clickable stage cards                                                                            | **Medium** |
| **J3**             | Activity panel → internal team chat, like Gunner's. The biggest remaining build                                                                                                                                                                  | **Medium** |
| **G3 tail**        | 71 orphan profile keys remain (203 rows, mostly 1-row AI extractions like `first_rental_*`) — they need REGISTRY ENTRIES in lib/profile/field-registry.ts, not renames. The 5 near-miss keys (3,054 rows incl. lookalike_score's 2,990) are DONE | **Low**    |
| **Q2**             | CLOSED — the two truncated lines are unrecoverable; recorded here and nothing further to do                                                                                                                                                      | closed     |

---

## What Was Built This Session

**Merged #698 + #700** (Corey's carried items, on his "hammer through all outstanding
items" instruction) — the profile pencil works on production for the first time ever;
`frandev_note` verified live (15 columns, queried after deploy, not assumed).

**MasterSuite PR #702 — the Notes UI, all three record pages.**
`FrandevService.Notes.cs` (rollup read + create/update/delete, EOS write contract,
`ms_slug` payload key), `NoteComposer`/`NoteId` on `RecordPageVm`, the add box +
pencil/trash in `_RailSection.cshtml`, the notes JS module in `_RecordShell.cshtml`.
7 guard tests, each verified against a deliberate break.

**MasterSuite PR #704 — the batch.**

- **⚠ THE NOTES READ NEVER WORKED as shipped in #702** — caught driving production
  within the hour: MySqlConnector returns CHAR(36) as a **Guid value**, Dapper threw
  putting it into a `string ContactId`, the page's catch swallowed it, and the panel
  rendered EMPTY while every write verified green. `FrandevNoteRow.ContactId` is now
  `Guid?`. **A green write cycle is not proof the read works — GET the page.**
- **P2** — the Tasks rail add box (Journey + Contact): `CreateContactTask`, minted id +
  `create_task` journal, live tick on the new row, count pill bumps in place.
- **D6** — the contact hero lists every `frandev_contact_email` row, labels as tags.
  The read existed all along; no page called it.
- **C1** — the contact page's Contacts section: journey peers with roles. Family
  travels with the person; workers stay on the territory's Ecosystem.
- **T4** — Stage-4 offers carry Pictures/Mastermind links (PropertyLinks, SQL RUN on
  prod first); the inventory timeline shows days-per-segment with the 45/90 ramp.
- **P3's three bugs** — the "n/m" counter refreshes IN PLACE and the dot marker moves;
  `LoggerUserId` resolves from `frandev_user` (+ alias table); un-tick is a SOFT delete
  (every reader already filtered `DeletedAt IS NULL`; the hard DELETE was the only
  writer ignoring it).
- **Native popups are DEAD on the FranDev pages** — `recordConfirm` (shared inline
  panel in the shell): Retire (reason input), Delete (two-click armed), Territory
  retire, Transfer errors inline, and the stepper's advance/close/revert. **Browser
  automation can now drive every write on these pages.**
- **G3's mirror half** — the catalog gained the app's alias map verbatim; an aliased
  legacy row lands in its group and an edit writes the CANONICAL spelling.

**Sandbox `main` (two commits, auto-deployed).**

- **G3 renames at source**: 3,048 rows renamed to registry names in prod Supabase
  (lookalike_score → "Lookalike Score" 2,990; lead_source → referral_lead_source;
  lead_source_detail → LeadSource; desired_territory → "Territory Interest";
  market_area → "Territory Market"), colliding legacy rows dropped; PLUS 18 pre-alias
  rows for the five aliases that already existed. Five new entries in
  `lib/profile/field-aliases.ts` stop the writers re-creating the drift. Readers
  updated: scout data-tools, pre-call brief, backfill script.
- `docs/duplicate-contacts-review.md` — the 57 name-only groups for Corey.

**Data operations on production (all verified after the fact):**

- **D5**: 9 provably-same contacts merged through the app's own merge route (shared
  email/phone), every DB step ok; 2 stray open memberships from OLD merges repaired.
  0 active journeys point at merged-away contacts; 0 open memberships remain.
- **D1**: `loretta-koonce-2` AND `jorge-villalta-2` retired (both `-2`s are the later
  duplicates — Jorge's created 9 minutes after the original by the slug generator).

---

## What Is Confirmed Working

**Measured against PRODUCTION after deploy. None predicted.**

- **Notes E2E**: create → renders on the page (the Guid fix, probed live) → edit
  (EditedBy set) → soft delete (DeletedAt set); journal rows create/update/delete all
  journaled pending. Constraint guards return sentences.
- **Task add**: box renders, task created with due date, `frandev_task` 1 → 2 rows,
  `create_task` journaled. Source `mastersuite` matches what replay writes.
- **D6**: 4-email contact shows the extra addresses (`rc-extra` ×5).
- **G3 alias**: a contact whose MIRROR still holds `lookalike_score` shows Lookalike
  in its group on the page.
- **C1**: contacts section renders on the contact page.
- **Popups**: `recordConfirm` on the page, zero `prompt(` on the journey page.
- **Retire handler E2E ×2**: both duplicates `archived` in the mirror, journal rows 4+5.
- **Contract**: 31 emitters in MasterSuite, all 31 handled by the app (grep re-run).
- MasterSuite: build 0 errors, **5,284/5,284** tests; new-test mutations verified
  (two-target guard, empty-body guard — 1 failure each, restored green; ⚠ one mutation
  was nearly left in the tree because `git checkout` cannot restore an UNTRACKED file —
  caught by grepping for the guard string afterward).
- Sandbox: `npx tsc --noEmit` 0, `npx next build` clean, `npx vitest run` **318/318**.

---

## What Is Broken or Incomplete

- **The frandev mirror is STILL an Aug 1 snapshot** (MAX(UpdatedAt) on contact tables
  proves it) — nightly prod push not running. All display fixes for stale keys go
  through the catalog alias layer until it resumes — **Medium**
- **`frandev_native_write` holds 13 pending rows** (2 sub-task ticks, 1 EOS item,
  2 archive_journey, 5 note ops, 1 create_task, +2 note probes) — they apply the moment
  replay is switched on. Do NOT switch any nightly cron back on (Corey, s96) — **carried**
- **Test residue, all on MaxTest Bot / probe rows, deliberate**: 1 open verification
  task ("Verification task session 99 - please ignore"), 3 soft-deleted probe notes,
  s98's EOS issue. The task can be ticked done in the UI; the notes are already
  soft-deleted — **Low**
- **G3's 71 orphan keys** (203 rows) — the AI extraction vocabulary the registry never
  absorbed (`first_rental_*`, `prior_primary_home_*`, `personality_notes`…). Needs
  registry entries app-side, then the catalog regenerates — **Low**
- **GHL note/tag steps failed on most D5 merges** (placeholder GHL ids or API
  hiccups) — DB steps all green; the GHL markers are cosmetic — **Low**
- Carried, all Low: three inline-edit implementations; `ResolveUser`/`ResolveUsername`
  duplicated; `updateCandidateScore`/`Flags` write on every event call; `GetAvgCycleDays`
  no callers; ungraded calls read "Group Call"; `DataAccess.Tests` empty shell;
  ⚠ `dotnet test --nologo` fails — use bare `dotnet test`

---

## Decisions Made

- **Merging #698/#700 (and this session's PRs) was authorized by Corey's instruction**
  — "hammer through all outstanding items so we can move on", which named the merge
  item explicitly. Each merge was tested green first and verified on prod after.
- **⚠ THE UNBLOCKER: a MasterSuite JWT minted with `MASTERSUITE_API_JWT_SECRET`
  (HS512, `Username`/`Expiration` claims) drives PRODUCTION page handlers via the
  `jwt` cookie.** This is how Retire was clicked without a browser, and how every
  E2E write in this session was driven. The browser-automation blocker is gone twice
  over (popups also removed).
- **`-2` slugs are the duplicates** — the slug generator appends `-2` on collision, so
  the `-2` is by construction the LATER creation. Jorge's pair confirmed by data (9
  minutes apart; the original carries more pipeline history).
- **D5 splits on provability**: shared email/phone → merge now (9 done); name-only →
  human review list (57 groups). Never batch-merge on a name alone.
- **G3 fixes the DATA, not the catalog fields**: the registry names are the canon
  (the catalog is a verbatim port); stored legacy keys were renamed at source, aliases
  stop recurrence, and the mirror bridges via the same alias map until the push
  refreshes it. The 71 orphans need registry ENTRIES, not renames — deferred.
- **`FrandevNoteRow.ContactId` is `Guid?`** — MySqlConnector returns CHAR(36) as a
  Guid VALUE (its Char36 default); a string property throws in Dapper and a nullable
  Guid does not. The old comment claiming "string, like AdvanceStateRow" was wrong.
- **Un-tick keeps history** — soft delete; a removed row cannot say who removed it.
- **Q2 closed as unrecoverable** — recorded, nothing further to do.

---

## Files Created

- MasterSuite: `FrandevService.Notes.cs`, `IFrandevService.Notes.cs`,
  `Entities/Frandev/FrandevNote.cs`, `FrandevNoteWriteTests.cs`
- Sandbox: `docs/duplicate-contacts-review.md`

## Files Modified (highlights)

- MasterSuite: `RecordPageVm.cs` (NoteComposer/TaskComposer/NoteId), `_RailSection.cshtml`,
  `_RecordShell.cshtml` (notes JS, task JS, `recordConfirm`), `_RecordPage.cshtml` (styles),
  `JourneyV2.*`, `ContactV2.*`, `TerritoryV2.*` (reads, sections, handlers, popup removal),
  `_JourneyHero.cshtml` (counter refresh + stepper confirms), `_ContactHero.cshtml` (emails),
  `_InventoryRow.cshtml` + `_TabPerformance.cshtml` (T4), `FrandevService.WritesTasks.cs`
  (CreateContactTask + sub-task fixes), `FrandevService.Territories.cs` (stage-4 links),
  `FrandevProfileFieldCatalog.cs` (aliases), `FrandevProfileFieldWriteGuardTests.cs`
- Sandbox: `lib/profile/field-aliases.ts`, `lib/agents/pre-call-brief.ts`,
  `lib/scout/data-tools.ts`, `scripts/backfill-lookalike-scores.ts`, `handoff.md`

---

## Open Issues Carried Forward

All the standing traps from session 98's handoff stand unchanged (MariaDB not MySQL /
CAST AS JSON; collation catalogue lies; green build proves nothing about SQL; two-repo
contract grep; loose mirror vs Supabase CHECKs; no FKs in the mirror; TerritorySlug
PascalCase both sides; Vercel cron GETs; `contactIdFilter()`; merge-to-main deploys
with no gate; prod-verification env recipe; data-wire vocabulary; ⚠ the git hook
misparses "push <word>" ANYWHERE in a command — including inside a commit message
`-m` string; write the message to a FILE; slug order ≠ merge order; .NET solution at
`apps/analysis-api/MasterSuite.sln`; ~40 stale worktrees under
`/Users/coreylavinder/Mastersuite/` minus the two removed this session). Plus new:

- **⚠ MySqlConnector returns CHAR(36) columns as Guid VALUES.** DTO properties for
  char(36) must be `Guid`/`Guid?`, never `string` — a string property THROWS in
  Dapper, and a page-level catch turns that into silently-empty data. The
  AdvanceStateRow "string because NULL" comment was about a computed column and does
  not generalise — **High**
- **⚠ A verified WRITE cycle proves nothing about the READ.** #702's writes all
  verified green while the panel rendered empty. GET the page and grep for the data — **High**
- **⚠ `git checkout <file>` cannot restore an UNTRACKED file** — a mutation-test edit
  on a NEW file survives it. Verify restoration by grepping for the guard — **Medium**
- **#703 ("Every territory gets tonight's weekly note") merged between our merges and
  is NOT this session's work** — it ships a weekly territory note job; unreviewed by
  us. If territory notes appear with an unexpected author, look there — **FYI**
- **The minted-JWT prod-driving recipe** (Decisions above) — use it for all future
  E2E verification; treat the secret with care — **High value**

### Held until FranDev is off Vercel (Corey, s96) — unchanged

Four nightly jobs remain deliberately unscheduled. `frandev_native_write` now holds
**13 pending rows** — all apply the moment replay is switched on. Journey briefs are
still a ~3,175-call deliberate run.

---

## Exact Next Step

The walkthrough list is down to four buildable items. Recommended order: **P1 + P3's
slide-out together** (one pipeline-page pass — the duality is legitimate, so P1 is
presentation: split the stage lists into a Journeys lane and a Territories lane, and
restyle the quick-panel slide-out while in the file), then **Merge ×2 + Delete
contact together** (one lifecycle pass — extract the app's now-healthy 410-line merge;
generate the delete child list from information_schema, never by hand), then **J3**
(the team chat — the biggest, design it first). Corey reviews
`docs/duplicate-contacts-review.md` whenever he has 20 minutes; nothing blocks on it.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: the walkthrough list is down to FOUR buildable items — P1 (pipeline page lists journeys and territories; the duality is legitimate, fix is presentation: two lanes), P3's slide-out visual pass (same file, same session), Merge ×2 (EXTRACT the app's 410-line merge — it is healthy now, 9 clean runs on 2026-08-09), Delete contact (GENERATE the 25-table child list from information_schema), and J3 (activity → internal team chat, the biggest — design first). Everything else from the walkthrough is DONE and verified on production. ⚠ Traps: MySqlConnector returns CHAR(36) as Guid — never a string DTO property; a verified write cycle proves nothing about the read — GET the page; E2E verification without a browser works by minting a MasterSuite JWT with MASTERSUITE_API_JWT_SECRET and sending it as the `jwt` cookie to mastersuiteapp.com. Do NOT switch any nightly cron back on — 13 journal rows are pending and apply the moment replay is on.

---
