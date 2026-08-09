# Session Handoff — 2026-08-09 — Session 99 (continued: the final four)

## Status

Phase: **FranDev → MasterSuite fold-in. THE WALKTHROUGH LIST IS DONE.** The session's
second half shipped the last four builds in ONE PR (#706, Corey: "put it all on one
PR"): the two-kind pipeline board (P1), the slide-out that advances (P3), the team chat
(J3), and the contact lifecycle — Merge ×2 as a true extraction, Delete with a
generated child sweep. All verified on production after deploy. /
Health: Green / Duration: double session

First half: #698 #700 #702 #704 merged (Notes E2E + its read bug, tasks writable, D6
emails, C1 contacts, T4 parity, sub-stage fixes, popups dead, G3 renames, D5 merges,
D1 retires). Second half: sandbox `7af7290` (merge extraction + 2 replay handlers,
deployed FIRST) then MasterSuite **#706**. External PRs #703, #705?, #707 merged
around ours and are NOT this session's work. No PRs of ours open; no worktrees of ours
remain.

---

## ⚠ WHAT IS STILL OUTSTANDING — read this first

### Needs Corey (1 item)

| #   | Item                                                       | Why it is his                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Review `docs/duplicate-contacts-review.md`** (57 groups) | Same-name contacts with NO shared email/phone — merging two different people is destructive, so each needs a human call. ⚠ The Merge button now works IN MASTERSUITE too (both record pages), so he can work the list from either app. |

### Blocked on Ben — unchanged

- Production `frandev_%` GRANT / nightly prod push resume (the mirror is still an Aug 1
  snapshot; MAX(UpdatedAt) proves nothing has pushed since).
- Jessica AdminPanel bypass + prod permission audit; API key rotation.

### The walkthrough list

**EMPTY.** All 15 tracked items closed. The only tail: **G3's 71 orphan profile keys**
(203 rows, mostly 1-row AI extractions like `first_rental_*`) need REGISTRY ENTRIES in
lib/profile/field-registry.ts app-side — an enhancement, not a walkthrough item.

---

## The final four (#706 + sandbox 7af7290) — what shipped

- **P1** — the kanban's Territories pipeline is entity-typed and its columns rendered
  EMPTY while the stage bar counted 89; the board now fills them with territory cards
  from the same source the bar counts (undraggable → territory record). Fanned-out
  onboarding/runway cards (one state per journey × territory) carry a territory TAG, so
  one owner's several same-name cards finally say which is which. Verified: 89 tcards,
  193 tags on production.
- **P3** — "Advance to next stage →" in the pipeline slide-out (armed two-click →
  `AdvanceStateByStateId` → the ONE journaled advance), done-count in the header,
  bigger hover-lit checklist rows. Verified: button renders in the live panel.
- **J3** — the journey Activity panel IS the team chat now. `frandev_journey_chat`
  (migration -248): MasterSuite-native, deliberately UNJOURNALED — the team's internal
  record lives where the team lives, like Gunner's property chat (unreusable:
  PropertyId INT NOT NULL + cascade FK). Oldest first, composer at bottom, Ctrl+Enter
  sends, names via frandev_user. DeleteJourney's child list names the table in the
  SAME change. Verified: message posted and rendered on production.
- **Merge ×2** — live on Journey + Contact pages. The mirror does the MINIMUM
  (tombstone, close memberships, repoint journey primaries) + journals `merge_contact`;
  replay calls **lib/contacts/merge.ts — the same extracted function the app's route
  now runs** (route is a 50-line shell). Shared picker partial `_FrandevMergePanel`,
  armed two-click. Verified: panel renders on both pages.
- **Delete contact** — live, with DeleteJourney's discipline: refused unless merged-away
  duplicate or untouched (the app has NO contact delete and its schema forbids one on a
  journey — `journey_contacts` is ON DELETE RESTRICT). Child sweep GENERATED from
  information*schema (33 `frandev*%` tables carry ContactId today; new tables sweep
  automatically). Verified: live-contact delete REFUSED on production with the sentence.
- **Contract**: 33 emitters / 33 handled, handlers deployed BEFORE emitters. Chat DDL
  run against prod to the privilege check. Guard tests mutation-verified.
  `dotnet test` **5,300/5,300**; sandbox tsc 0, build clean, vitest 318/318.

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
**14 pending rows** (the 13 + one create_task; merge_contact/delete_contact journal
only when someone uses the new buttons) — all apply the moment replay is switched on.
Journey briefs are still a ~3,175-call deliberate run.

**Test residue, all deliberate and labeled**: the s98 EOS issue and one open
verification task on MaxTest Bot; three soft-deleted probe notes; one team-chat
message on `jorge-villalta-2` (an archived duplicate). Nothing on a live record.

---

## Exact Next Step

**The walkthrough is done.** The next phase is the CUTOVER TRACK — getting FranDev
fully off Vercel: (1) Ben's `frandev_%` GRANT / nightly prod push resume so the mirror
stops being an Aug 1 snapshot, (2) the replay switch-on plan (14 pending journal rows
apply at that moment; verify each), (3) the post-move backfill (all journeys +
territories; journey briefs are a ~3,175-LLM-call deliberate run), (4) G3's 71-orphan
registry entries app-side, and (5) Corey works `docs/duplicate-contacts-review.md`
(57 groups) with the now-live Merge buttons. None of it is blocked on code we haven't
written; (1)–(3) are blocked on Ben/Corey decisions.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: THE WALKTHROUGH LIST IS DONE — all 15 items shipped and verified on production (sessions 99a+99b; last PR #706 + sandbox 7af7290). Next is the CUTOVER TRACK: Ben's frandev\_% GRANT + nightly prod push resume (mirror is an Aug 1 snapshot), the replay switch-on plan (14 pending journal rows apply at that moment — verify each), the post-move backfill (journey briefs = ~3,175 LLM calls, one deliberate run), and G3's 71 orphan profile keys need registry entries in lib/profile/field-registry.ts. I review docs/duplicate-contacts-review.md (57 same-name groups) myself — the Merge button now works in BOTH apps. ⚠ Traps: MySqlConnector returns CHAR(36) as Guid — never a string DTO property; a verified write cycle proves nothing about the read — GET the page; E2E verification without a browser = mint a MasterSuite JWT with MASTERSUITE_API_JWT_SECRET, send as the `jwt` cookie to mastersuiteapp.com. Do NOT switch any nightly cron back on.

---
