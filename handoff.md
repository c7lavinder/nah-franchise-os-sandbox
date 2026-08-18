# Session Handoff — 2026-08-19 — Session 112

## Status

Phase: **THE WHOLE LIST SHIPPED + THE DUPLICATES CLEANED — Corey's
contacts-focused bug list built end to end (five MasterSuite PRs merged
green: #964 access-close, #969 contact batch, #971 CI scope guard, #972 +
#974 cleanup migrations), the old app stopped auto-adding emails, and the
Corey-approved dedupe executed live: 66 duplicate journeys archived, all
8 contact merges done, test rows deleted, the pto_102844 split repaired,
Michael Scott + Courtney McDonald restored as one journey with two
contacts.** / Health: Green / Duration: full session (spanned 8/18-8/19)

## What Was Built This Session

- **Old app (main, `593f0d2` + follow-ups):** call-participant mapping no
  longer auto-adds attendee emails (label "auto" paths removed from
  `app/(auth)/calls/[callId]/page.tsx` + `components/calls/CallOverrideControls.tsx`);
  `lib/mastersuite/apply-native-writes.ts` `update_contact` now applies
  city/state and forwards them to GHL.
- **MS PR #964 (merged):** migration `2026-08-19-306` (Gunner=0 for
  john+chad — both held Gunner=1 on prod; `Users.FrandevRole='admin'`),
  `GunnerService.ScopeClauses`/`ContactScopeSql`/`PropertyIdScopeSql`
  fail closed to `1 = 0` under a FranDev scope (was the 'Corey Lavinder'
  referral-partner fallback — Matt's screenshot), `ApplyViewScope` forces
  the FranDev scope for Frandev-without-Gunner users, ViewScopeTests
  re-pinned.
- **MS PR #969 (merged, reworked module-only per Corey):** FranDev phone
  standard `(800) 456-7890` via new `MasterSuite.Modules.Frandev/FrandevFmt`
  (platform `PhoneNumberHelper` untouched — Ben's pages keep the 1); Team
  card off contact pages (Overview `ShowTeam` switch + rail stub gone);
  Contacts-list scorecard tiles are click-filters (`?filter=sales|onboarding|runway`);
  Location editable as "City, ST" through journaled `UpdateContactFields`
  (+city/state in the journal); ONE Contacts card on the contact rail
  (`_RailRelatedPeople` = the person + journey peers + related people;
  tiles strip + contacts accordion folded in; `GetJourneyMembers` unions
  in primary-without-membership); team chat on contact + territory
  (migration `-307` `frandev_record_chat`, `GetRecordChat`/`AddRecordChat`,
  `ChatCreate` handlers — J3 completed on all three record pages).
- **MS PR #971 (merged):** `.github/workflows/frandev-scope-guard.yml` —
  a `frandev-*` PR touching files outside FranDev surfaces fails CI;
  shared Gunner/Records pages warn.
- **The dedupe (Corey "go", two passes via minted-JWT native handlers +
  Supabase REST + scratchpad `dedupe-run.mjs`):** Testy McTester + Bob
  Jones deleted (journey archive required before DeleteJourney), 66
  duplicate journeys archived (58 import twins + 8 post-merge), all 8
  ledger merges (Samples/Alioglu/Heist/Majester/Vickers/Suarez/Roy/Cates),
  71 app pipeline-state rows closed, Eric Banks inserted app-side as
  `pto_102844_ebanks`. **MS PR #972 (merged)** = mirror half (migration
  `-308`: 69 state closes, Banks id handover so Pearson keeps pto_102844,
  4 orphan contacts re-inserted, `-2` journeys archived, 3 stubs deleted).
- **Scott + McDonald (Corey ruling "one journey, two contacts"):** a
  pre-existing merge had wrongly folded Courtney into Michael (she'd been
  a 'spouse' member 5/14-5/15 before it). App un-merge + active
  co_primary membership (uuid `f0fca14f…` in BOTH systems so the nightly
  push upserts, not doubles) + native rename "Michael Scott + Courtney
  McDonald" + her journey archived; **MS PR #974 (merged)** = migration
  `-309` mirror half.
- **Duplicates Ledger artifact** (created, then updated to the executed
  state): https://claude.ai/code/artifact/b8314eeb-a404-43ec-934e-1530d98b0814

## What Is Confirmed Working

- All five MasterSuite PRs CI green and MERGED (Corey granted standing
  green-CI merge authority).
- Gunner.Tests 2109/2109; FormatHelpersTests 5/5; Platform.Tests 482/483
  (the 1 = pre-existing local-env comms-flag test, fails on untouched
  main too; CI clean).
- Old app: `tsc` clean, `next build` green, 337/337 tests on the commit.
- Dedupe verified post-run against both systems: the only same-person
  active-journey clusters left are the 3 intentional parks (NAH System,
  Jason Semper, Michael Scott — since resolved); merge marks 8/8 in the
  mirror; test rows 0 both sides; Pearson (`pto_102844`) and Banks
  (`pto_102844_ebanks`) both exist app-side.
- Corey's couples concern checked in data: ZERO '+'-named journeys
  archived; the member-count history rule made archiving a two-person
  journey impossible (Nicki + Ron Cates was the keeper).
- Matt's grants verified complete on prod — his fix is one log-out/log-in
  (session predates the access migration).

## What Is Broken or Incomplete

- Migrations 306-309 apply at the NEXT DEPLOY BOOT — until then the
  mirror still shows john/chad's Gunner grant, 70 open pipeline rows,
  the Banks/Pearson mirror split, and missing orphan contacts — Low
  (self-resolves at boot)
- App-side merge marks 0/8 until the apply-mastersuite-writes cron
  replays the journal — Low (automatic)
- 4 ask-the-rep contact pairs parked: Ricky Burts Jr, Mack/Jon Wright,
  Derrick Washington, Angel Lane — Low
- Team relogins pending (Matt/John/Chad, once, after boot) — Low
- Denzel Lavinder left archived not deleted (journey holds 2 real calls;
  delete guard refused; ledger ruling allowed "or leave") — Low, decided
- Known residue: archived `-2` journeys' stray mirror-native contact
  rows — Low
- HELD from s111 (unchanged): Calls page 0-of-440 + Aug-14 re-ingest —
  wait for the backfill-everything pass; rest of the s110 tail

## Decisions Made

- Access fix first, then the list — Corey
- John + Chad must NOT access the Gunner referral-partner account;
  FranDev scope fails closed to zero Gunner rows — Corey
- Stop auto-adding call emails; KEEP the ones already saved — Corey
- Phone standard `(423) 555-1234` no leading 1 — then scoped to the
  FranDev module only ("we should only be editing the module") — Corey
- Team off contact pages ENTIRELY (rail + Overview) — Corey
- FranDev work stays module-only and CI flags violations — Corey
- Standing authority: merge any PR with green CI — Corey
- Dedupe waves 1-5 "go"; keeper = copy with history, else older — Corey
- Michael Scott + Courtney = one journey, two contacts (couple
  convention) — Corey

## Files Created

- MS: `Migrations/2026-08-19-306_FrandevOnlyForJohnAndChad.sql`, `-307_FrandevRecordChat.sql`,
  `-308_DuplicatesCleanupMirror.sql`, `-309_ScottMcDonaldCoupleJourney.sql`
- MS: `MasterSuite.Modules.Frandev/FrandevFmt.cs`
- MS: `.github/workflows/frandev-scope-guard.yml`
- scratchpad: `dedupe-run.mjs`, `scott-mcdonald-fix.mjs`, `verify-dedupe.mjs`,
  `duplicates-ledger.html`, access/couples check scripts
- `~/Desktop/frandev-dedupe-backup-2026-08-19/` (full row backups)

## Files Modified

- Old app: `app/(auth)/calls/[callId]/page.tsx`,
  `components/calls/CallOverrideControls.tsx`, `lib/mastersuite/apply-native-writes.ts`
- MS: `GunnerService.cs`, `GunnerPageModel.cs`, `ViewScopeTests.cs`,
  `ContactV2/JourneyV2/TerritoryV2.cshtml.cs`, `Contacts.cshtml(+.cs)`,
  `FrandevService.{Chat,Contacts,Journey,Messaging,WritesContact,WritesContactLifecycle}.cs`,
  `IFrandevService*.cs`, `FrandevPanelCatalog.cs`, `RecordSharedVm.cs`,
  RecordPanels partials (`_ContactHero`, `_RailRelatedPeople`, `_TabOverview`,
  `_TabData`, `_TabEcosystem`, `_TabTerritories`)

## Files Deleted

- No repo files. Data: Testy McTester + Bob Jones journeys, Bob Jones
  contact (both systems); mirror stubs (Participant One, bare Joe/Will)
  via migration -308; all backed up first.

## Open Issues Carried Forward

- 4 ask-the-rep contact pairs → merges on their answers — Low
- Verify migrations 306-309 landed after the next deploy boot (grants,
  scorecard drop, Banks/Pearson, orphan contacts) — Low
- Team relogins — Low
- Calls page 0-of-440 + backfills — High but HELD (backfill pass)
- s110 fix-first tail remainder — see s110 handoff

## Exact Next Step

After the next deploy boot: spot-check migrations 306-309 landed (john/
chad Gunner=0, scorecard counts drop, Pearson in the mirror), have Matt/
John/Chad log out and in once — then collect the reps' answers on the 4
parked contact pairs and finish those merges.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: spot-check migrations 306-309 landed after the deploy boot, get the team's one-time relogins done, then the reps' answers on the 4 parked contact pairs.

---
