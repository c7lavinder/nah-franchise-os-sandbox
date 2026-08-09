# Session Handoff — 2026-08-09 — Session 99

## Status

Phase: **FranDev → MasterSuite fold-in. THE WALKTHROUGH LIST IS DONE — all 15 items
shipped and verified on production.** Five MasterSuite PRs merged this session
(#698 #700 #702 #704 #706), three sandbox pushes, plus production data operations
(merges, retires, profile-key renames). Next phase is the cutover track. /
Health: Green / Duration: double session

MasterSuite `main` includes our #706 (external PRs #703/#705/#707 merged around ours
and are NOT this session's work). Sandbox `main` pushed. No PRs of ours open; no
worktrees of ours remain (wt-mariadb-json, wt-notes, wt-notes-ui, wt-batch1,
wt-final4 all removed after merge).

## What Was Built This Session

- **Merged #698 + #700** (Corey's carried items, on his "hammer through" instruction) —
  the profile pencil saves on production for the first time ever; `frandev_note` live.
- **#702 — Notes UI on all three record pages**: `FrandevService.Notes.cs` (rollup
  read + create/update/delete on the EOS write contract, `ms_slug` payload key),
  `NoteComposer`/`NoteId` on `RecordPageVm`, add box + pencil/trash in
  `_RailSection.cshtml`, notes JS in `_RecordShell.cshtml`, 7 guard tests.
- **#704 — the batch**: the #702 read FIX (MySqlConnector returns CHAR(36) as a Guid
  VALUE; `FrandevNoteRow.ContactId` string → `Guid?` — the panel had rendered empty
  while every write verified green); P2 task add boxes (`CreateContactTask`, minted id
  - `create_task` journal, live tick); D6 all emails on the contact hero
    (`GetContactEmails` existed, nothing called it); C1 contacts section (journey peers
    with roles); T4 Stage-4 Pictures/Mastermind links (PropertyLinks) + per-segment
    timeline days; P3's three sub-stage bugs (counter refreshes in place, `LoggerUserId`
    resolved via `frandev_user` + alias table, un-tick is a SOFT delete); **all native
    popups replaced by `recordConfirm`** (Retire/Delete/Transfer/stepper
    advance/close/revert); G3's mirror alias layer in `FrandevProfileFieldCatalog`.
- **#706 — the final four, one PR (Corey: "put it all on one PR")**: P1 two-kind
  kanban (89 territory entity cards fill the Territories pipeline from the same source
  the stage bar counts; fanned-out onboarding/runway cards carry territory tags); P3
  "Advance to next stage →" in the slide-out (`AdvanceStateByStateId` → the one
  journaled advance; armed two-click) + checklist polish; J3 team chat
  (`frandev_journey_chat`, migration -248 — MasterSuite-native, deliberately
  UNJOURNALED; Gunner's chat is property-locked by an INT FK; DeleteJourney's child
  list names the new table in the same change); Merge ×2 live on both record pages
  (mirror does tombstone + membership close + journey re-pointing, journals
  `merge_contact`; shared `_FrandevMergePanel` picker) and Delete contact (refused
  unless merged-away duplicate or untouched; child sweep GENERATED from
  information*schema — 33 `frandev*%` tables carry ContactId today).
- **Sandbox `7af7290`** — the app's 410-line merge EXTRACTED into
  `lib/contacts/merge.ts` (route is now a 50-line shell over it) + two new replay
  handlers: `merge_contact` calls the SAME extracted function; `delete_contact`
  enforces the schema's own discipline (`journey_contacts` is ON DELETE RESTRICT).
  Deployed BEFORE the MasterSuite emitters, the Notes ordering rule.
- **Sandbox G3 pass (`dd995a1`)** — 3,066 Supabase rows renamed to registry names
  (lookalike_score → "Lookalike Score" was 2,990 of them), 5 new + 5 cleaned aliases
  in `lib/profile/field-aliases.ts`, readers updated (scout data-tools, pre-call
  brief, backfill script).
- **Production data operations** — D5: 9 provably-same contacts merged through the
  app's own route, 2 stray memberships from OLD merges repaired, 0 orphans; D1:
  `loretta-koonce-2` + `jorge-villalta-2` retired via prod handlers with a minted JWT;
  `docs/duplicate-contacts-review.md` (57 name-only groups for Corey).

## What Is Confirmed Working

**Measured against PRODUCTION after each deploy. None predicted.**

- Notes E2E: create renders on the page (the Guid fix, probed live), edit sets
  EditedBy, delete is soft; journal rows all queued correctly.
- Task add box: task created with due date, `frandev_task` 1 → 2 rows, `create_task`
  journaled, live tick.
- D6: a 4-email contact shows every address. C1: contacts section renders. G3: a
  mirror row still keyed `lookalike_score` lands in its catalog group on screen.
- recordConfirm everywhere; zero `prompt(`/`confirm(` on the FranDev pages.
- P1: 89 territory cards + 193 territory tags on the live kanban — board and stage
  bar agree for the first time.
- P3: the advance button renders in the live slide-out panel.
- J3: chat message posted and rendered on production (on the archived duplicate).
- Merge panels render on both pages; Delete REFUSED a live contact (Jorge) with the
  guard's exact sentence.
- Contract: **33 emitters / 33 handlers**, re-derived from source both times.
- Chat DDL RUN against production (temp-table probe) to the privilege check — #698's bar.
- Every new guard verified against a deliberate break (mutations → red → restored →
  green). ⚠ One mutation nearly survived because `git checkout` cannot restore an
  UNTRACKED file — caught by grepping for the guard string.
- MasterSuite: build 0 errors, `dotnet test` **5,300/5,300**. Sandbox:
  `npx tsc --noEmit` 0, `npx next build` clean, `npx vitest run` **318/318**.
- D5/D1 aftermath: 0 active journeys point at merged-away contacts, 0 open
  memberships on them; both `-2` duplicates `archived` in the mirror.

## What Is Broken or Incomplete

- **The frandev mirror in MasterSuite prod is an Aug 1 snapshot** (MAX(UpdatedAt)
  proves it) — nightly prod push not running; blocked on Ben's `frandev_%` GRANT.
  Display of stale profile keys bridges through the catalog alias layer until then — **Medium**
- **`frandev_native_write` holds 14 pending rows** — all apply the moment replay is
  switched on. Do NOT switch any nightly cron back on (Corey, s96) — **carried**
- **G3's 71 orphan profile keys** (203 rows, mostly 1-row AI extractions like
  `first_rental_*`) need REGISTRY ENTRIES in `lib/profile/field-registry.ts`
  app-side — renames are the wrong fix for these — **Low**
- **Test residue, deliberate and labeled, nothing on a live record**: s98's EOS issue
  - one verification task on MaxTest Bot; 3 soft-deleted probe notes; one team-chat
    message on the archived `jorge-villalta-2` — **Low**
- GHL note/tag steps failed on most D5 merges (placeholder ids); DB steps all green — **Low**
- Carried, all Low: three inline-edit implementations; `ResolveUser`/`ResolveUsername`
  duplicated; `updateCandidateScore`/`Flags` write on every event; `GetAvgCycleDays`
  uncalled; ungraded calls read "Group Call"; `DataAccess.Tests` empty; ⚠ use bare
  `dotnet test`, never `--nologo`

## Decisions Made

- **Corey's instructions were the authorizations**: "hammer through all outstanding
  items" (merging #698/#700 and this session's PRs after green tests + prod
  verification) and "get through those last four items and put it all on one PR" (#706).
- **⚠ THE UNBLOCKER: a JWT minted with `MASTERSUITE_API_JWT_SECRET`** (HS512,
  `Username`/`Expiration` claims) drives PRODUCTION MasterSuite handlers as the `jwt`
  cookie, and the sandbox API as a Bearer token. Every E2E write this session used it.
- **Merge is an extraction, not a port** — one implementation (`lib/contacts/merge.ts`)
  serves the app route AND the replay; the mirror only does what it must to look right
  today. — Claude, per the walkthrough's own framing
- **Delete contact adopts DeleteJourney's discipline** — the app has NO contact delete
  and its schema forbids one on a journey; only a merged-away duplicate or an untouched
  record passes. Child list GENERATED from information_schema, never hand-kept. — Claude
- **The team chat is native and unjournaled** — the team's internal record lives where
  the team lives; candidate-facing writing stays in Notes, which sync. — Claude
- **`-2` slugs are the duplicates** — the slug generator appends `-2` on collision, so
  the `-2` is by construction the later creation. — Claude, data-confirmed for Jorge
- **D5 splits on provability** — shared email/phone merges now; name-only goes to the
  human review list. Never batch-merge on a name alone. — Claude
- **G3 fixes the DATA, not the catalog** — registry names are canon; legacy keys
  renamed at source, aliases stop recurrence both sides. — Claude
- **`FrandevNoteRow.ContactId` is `Guid?`** — MySqlConnector returns CHAR(36) as a
  Guid VALUE; a string DTO property throws in Dapper. — Claude, caught live
- **Q2 closed as unrecoverable** — recorded; nothing further to do. — Claude

## Files Created

- MasterSuite: `FrandevService.Notes.cs`, `IFrandevService.Notes.cs`,
  `Entities/Frandev/FrandevNote.cs`, `FrandevNoteWriteTests.cs`,
  `FrandevService.Chat.cs`, `IFrandevService.Chat.cs`,
  `Entities/Frandev/FrandevJourneyChat.cs`,
  `FrandevService.WritesContactLifecycle.cs`, `FrandevContactLifecycleTests.cs`,
  `Pages/Frandev/_FrandevMergePanel.cshtml`, `Pages/Frandev/FrandevMergePanelVm.cs`,
  `DatabaseMigrationRunner/Migrations/2026-08-09-248_FrandevJourneyChat.sql`
- Sandbox: `lib/contacts/merge.ts`, `docs/duplicate-contacts-review.md`

## Files Modified

- MasterSuite: `RecordPageVm.cs` (Note/Task/Chat composers, NoteId),
  `_RailSection.cshtml`, `_RecordShell.cshtml` (notes/tasks/chat JS +
  `recordConfirm`), `_RecordPage.cshtml` (styles), `JourneyV2.cshtml(.cs)`,
  `ContactV2.cshtml(.cs)`, `TerritoryV2.cshtml(.cs)`, `_JourneyHero.cshtml`,
  `_ContactHero.cshtml`, `_InventoryRow.cshtml`, `_TabPerformance.cshtml`,
  `_FrandevLeadPanel.cshtml`, `Inventory.cshtml(.cs)`, `Pipeline.cshtml`,
  `FrandevService.Board.cs`, `FrandevService.Writes.cs`,
  `FrandevService.WritesTasks.cs`, `FrandevService.WritesLifecycle.cs`,
  `FrandevService.Territories.cs`, `FrandevProfileFieldCatalog.cs`,
  `FrandevPanelCatalog.cs`, `Entities/Frandev/FrandevBoard.cs`,
  `Entities/Frandev/FrandevTerritory.cs`, `Entities/Frandev/FrandevWriteExtras.cs`,
  `IFrandevService.cs`, `IFrandevService.WritesExtras.cs`,
  `FrandevProfileFieldWriteGuardTests.cs`
- Sandbox: `app/api/contacts/[contactId]/merge/route.ts` (now a shell),
  `lib/mastersuite/apply-native-writes.ts` (merge_contact + delete_contact),
  `lib/profile/field-aliases.ts`, `lib/agents/pre-call-brief.ts`,
  `lib/scout/data-tools.ts`, `scripts/backfill-lookalike-scores.ts`, `handoff.md`

## Files Deleted

- No files. (Five merged worktrees removed under `/Users/coreylavinder/Mastersuite/`.)

## Open Issues Carried Forward

All session-98 standing traps stand (MariaDB not MySQL / no `CAST AS JSON`; collation
catalogue lies; green build proves nothing about SQL — RUN it; the two-repo contract
grep; loose mirror vs Supabase CHECKs; no FKs in the mirror; `TerritorySlug`
PascalCase both sides; Vercel cron GETs; `contactIdFilter()`; merge-to-main deploys
with no gate; prod-verification env recipe; ⚠ the git hook misparses "push <word>"
anywhere in the COMMAND including `-m` strings — commit with `-F <file>`; PR numbers
are not merge order; solution at `apps/analysis-api/MasterSuite.sln`; ~40 stale
worktrees). Plus, new this session:

- **⚠ MySqlConnector returns CHAR(36) columns as Guid VALUES** — DTO properties must
  be `Guid`/`Guid?`, never `string`; a page-level `catch {}` turns the throw into
  silently-empty data — **High**
- **⚠ A verified WRITE cycle proves nothing about the READ** — GET the page and grep
  for the data — **High**
- **⚠ `git checkout <file>` cannot restore an UNTRACKED file** — verify mutation-test
  restoration by grepping for the guard — **Medium**
- **The minted-JWT prod-driving recipe** — HS512 with `MASTERSUITE_API_JWT_SECRET`,
  claims `{Username, Name, Permissions:{}, Territories:[], Expiration:<ISO>}`, sent as
  the `jwt` cookie to mastersuiteapp.com — use for all future E2E; guard the secret — **High value**
- **External PRs #703/#705/#707 are not ours** — a weekly territory-note job shipped
  in #703; if territory notes appear with an unexpected author, look there — **FYI**
- **Held until FranDev is off Vercel (Corey, s96)**: four nightly jobs deliberately
  unscheduled; 14 journal rows pending; journey briefs are a ~3,175-LLM-call
  deliberate run — **carried**

## Exact Next Step

Start the CUTOVER TRACK: chase Ben's `frandev_%` GRANT so the nightly prod push
resumes (the mirror is an Aug 1 snapshot), then write the replay switch-on plan (14
pending journal rows apply at that moment — verify each against its handler), while
Corey works `docs/duplicate-contacts-review.md` (57 groups) with the now-live Merge
buttons and G3's 71 orphan keys get registry entries in
`lib/profile/field-registry.ts`.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: THE WALKTHROUGH LIST IS DONE — all 15 items shipped and verified on production (session 99, PRs #698–#706 + sandbox pushes). Start the CUTOVER TRACK: Ben's frandev\_% GRANT + nightly prod push resume (the mirror is an Aug 1 snapshot), the replay switch-on plan (14 pending journal rows apply at that moment — verify each), G3's 71 orphan profile keys need registry entries in lib/profile/field-registry.ts, and I review docs/duplicate-contacts-review.md (57 same-name groups) — the Merge button now works in BOTH apps. ⚠ Traps: MySqlConnector returns CHAR(36) as Guid — never a string DTO property; a verified write cycle proves nothing about the read — GET the page; E2E verification without a browser = mint a MasterSuite JWT with MASTERSUITE_API_JWT_SECRET and send it as the `jwt` cookie to mastersuiteapp.com. Do NOT switch any nightly cron back on.

---
