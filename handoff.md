# Session Handoff — 2026-08-19 — Session 113

## Status

Phase: **THE VISUAL PASS PAID OFF — Corey's morning-after eyeball of the
s112 dedupe caught a real regression the verify query missed: MasterSuite's
lead-intake job had re-minted 4 duplicate journeys (8/18 20:35 UTC) because
its "already has a journey" guard was too narrow. Root-caused end to end,
fixed as MS PR #978 (merged green: widened guard + Journeys-card collapse +
migration 310), app-side junk archived live. Safari header-dropdown bug
diagnosed (iframe contraption) and logged, not fixed.** / Health: Green /
Duration: short session (2:45 AM–4 AM)

## What Was Built This Session

- **MS PR #978 (merged):** `FrandevService.LeadIntake.cs` wire-existing
  guard widened from "active SALES state on a journey whose
  PrimaryContactId = the LIMIT-1 email-matched contact" to "ANY active
  journey via PrimaryContactId OR un-left `frandev_journey_contact`
  membership, across EVERY contact row sharing the email"
  (`HasSalesState` → `HasActiveJourney`); `FrandevService.Contacts.cs`
  `GetContactJourneys` now collapses the member/primary UNION double
  (GroupBy JourneyId, prefer the member row — the doc comment promised
  this collapse but it was never implemented); migration
  `2026-08-19-310_LeadIntakeRewireCleanup.sql` archives the four re-wired
  `-3` journeys (frank-sweeney-3, troy-langer-3, andrew-colman-3,
  pramod-abraham-3) and closes their 4 pipeline-state rows.
- **App side (live, Supabase REST):** `frank-sweeney-3` + `troy-langer-3`
  journeys archived, their 2 `journey_pipeline_state` rows closed (the
  Pramod/Andrew re-wires never replayed app-side — their journal writes
  failed on missing contacts — so those two are mirror-only).
- **Root-cause chain established:** s112 dedupe archived the four
  form-linked journeys → intake guard stopped matching (Frank/Troy keepers
  live in the FOLLOWUP pipeline, not sales; Pramod/Andrew keeper primaries
  are app-uuid orphans until 308 re-inserts them; one email can match two
  contact rows) → `wire_sales_journey` ×4 at 20:35:06 UTC by `lead-intake`.
- **Safari header diagnosis (logged only):** the Gunner top bar is a 52px
  iframe (`_GunnerHeader.cshtml` → `HeaderBar.cshtml`); the BS3 dropdown
  opens inside it and only a postMessage height-grow reveals it. Safari's
  subframe blur re-collapses it, and the floating "MasterSuite" box is the
  logo text leaking when the frame's CSS fails. Chrome works.

## What Is Confirmed Working

- PR #978 CI green (build+test, frandev scope guard) and MERGED; local:
  Gunner.Tests 2114/2114, Platform.Tests 482/483 (the 1 = pre-existing
  local-env comms-flag test, fails on untouched main; CI clean).
- New guard SQL dry-run against the LIVE mirror: all four leads return
  HasActiveJourney=1, and stay 1 after the junk archives (matched via
  keeper membership) — no re-wire possible.
- App-side archives verified by returned rows: both journeys → archived,
  both states → is_active=false; keepers (frank-sweeney-2, troy-langer-2)
  hold their own active states app-side.
- Keepers on the mirror verified holding active positions (sales for
  Pramod/Andrew, followup for Frank/Troy) — nothing drops off the board
  when 310 lands.
- Migration 308 cross-checked: touches NONE of 310's 12 ids (no collision).
- The "5 journeys" card on Pramod's contact page fully explained: 3 real
  journey rows (1 keeper + 2 archived-or-junk) rendered as 5 by the
  member/primary double-listing.

## What Is Broken or Incomplete

- Migrations 308/309/310 sit UNAPPLIED until the next MasterSuite deploy
  boot (last boot 8/18 16:32 UTC applied through 307; MS deploys are
  batch/manual on Ben's side) — until then mastersuiteapp.com still shows
  the Pramod/Andrew junk active and the card double-listing — Low
  (self-resolves at boot; sequencing is safe in every interleaving)
- Safari header dropdown broken (iframe machinery); Chrome fine — Low,
  logged; real fix = de-iframe the header or harden its script loading
- 84 failed rows total in `frandev_native_write` (incl. the 2 failed
  Pramod/Andrew wires) — not triaged beyond ours — Low
- Carried from s112 (unchanged): 4 ask-the-rep contact pairs, team
  relogins after boot, app-side merge marks await replay cron, archived
  `-2` journeys' stray mirror-native contact rows, Calls page 0-of-440
  HELD for the backfill-everything pass

## Decisions Made

- Fix the intake guard + archive the junk + card collapse, all one deploy
  — Corey ("okay do the fixes")
- A lead already on ANY active journey (sales, followup, onboarding) never
  gets a second journey auto-minted; promoting a nurture lead back into
  Sales is a rep decision — implemented per the one-journey convention
- Safari dropdown: log, don't fix tonight; Corey uses Chrome for the
  visual pass — Claude, told to Corey
- Junk journeys archived not deleted (dedupe convention, delete cascade
  still unsettled) — Claude, per s112 ruling

## Files Created

- MS: `Migrations/2026-08-19-310_LeadIntakeRewireCleanup.sql`
- memory: `project_s113_intake_rewire.md`
- scratchpad: `check-pramod.mjs`

## Files Modified

- MS: `MasterSuite.Modules.Frandev/FrandevService.LeadIntake.cs`,
  `MasterSuite.Modules.Frandev/FrandevService.Contacts.cs`
- memory: `MEMORY.md` (s113 index line)
- Supabase (data, not files): 2 journeys archived, 2 states closed

## Files Deleted

- None

## Open Issues Carried Forward

- MS deploy boot needed for 308/309/310 + the #978 code (then: team
  relogins, mirror visual re-check) — Medium (everything queued waits on it)
- Safari header dropdown rework — Low
- s112 tail: 4 ask-the-rep pairs, replay-cron merge marks, `-2` stray
  contact rows, Calls-page backfill pass — Low

## Exact Next Step

After the next MasterSuite deploy boot, re-run the duplicate sweep +
eyeball Pramod Abraham's contact page in Chrome (expect 3 journeys, 1
active, each listed once) to confirm 308/309/310 and the #978 guard landed
clean.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: After the next MasterSuite deploy boot, re-run the duplicate sweep + eyeball Pramod Abraham's contact page in Chrome (expect 3 journeys, 1 active, each listed once) to confirm 308/309/310 and the #978 guard landed clean.

---
