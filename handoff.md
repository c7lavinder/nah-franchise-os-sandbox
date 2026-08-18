# Session Handoff — 2026-08-18 — Session 111

## Status

Phase: **PUNCH LIST SHIPPED — Corey's 10-item FranDev list worked end to
end in one day: two MasterSuite PRs merged green and deployed (#956
pipeline polish + access gates, #957 test-data mirror cleanup), Read.ai
proven WORKING on prod (the Aug-17 fix held — it only looked dead because
the Calls page renders 0), the team door opened and verified live for
Matt/John/Chad, test data deleted from both sides with backups.** /
Health: Green (team can log in and see FranDev today) /
Duration: full session

## What Was Built This Session

- **MasterSuite PR #956 (merged + deployed):** sticky Pipeline/Kanban
  view per user via `frandevInvView`/`gunnerInvView` cookies (server-side
  in `MasterSuite/Pages/Gunner/Inventory.cshtml.cs` OnGet — explicit
  `?view=` wins and is remembered, plain entry opens the remembered view,
  deep links never rewrite it); newest-first in every kanban lane
  (`MasterSuite.Modules.Frandev/FrandevService.Kanban.cs` — bare-stage
  fetch always ASC, big-lane re-sort flipped, lane handler default
  `asc = true`; tagline starts `data-asc="1"` "NEWEST FIRST" in
  `_FrandevKanban.cshtml`); kanban drawer at Gunner pull-down specs
  (`_FrandevKanbanDrawer.cshtml` — grid `clamp(540px, 88vh, 1100px)`,
  columns stretch + scroll, 392px thread cap only when stacked);
  city/state dropped from territory-pipeline kanban cards
  (onboarding/runway/territories).
- **Migration `2026-08-18-301_FranDevTeamAccess.sql`:** all three access
  gates (Frandev permission incl. Chad's explicit 0 → 1, picker CSV
  +john, registry BetaUserIds +john/chad on `frandev_*`/`strip_fd_*`
  rows), BetaTest (dev mode) revoked for John/Chad, `frandev_user`
  Role='admin' for both.
- **MasterSuite PR #957 (merged, deploys next boot):** migration
  `2026-08-18-302_TestDataCleanup.sql` — mirror-side deletion of the
  approved test rows, pinned by UUID.
- **Old-app deletions executed** (script:
  scratchpad `cleanup-test-data.mjs`): 21 test contacts, 20 test
  journeys, 21 pipeline states, 20 journey links, 8 test calls (+8 call
  links), 12 profile fields, 10 contact emails; 21 `integration_logs`
  rows detached (kept, reference nulled); Demo Admin user **deactivated**
  (hard delete blocked by the append-only `scout_action_logs` trigger).
  Full row backup: `~/Desktop/frandev-test-data-backup-2026-08-18/`.
- **Supabase `users.role='admin'` for john@ + chad@** (Corey-approved) so
  the nightly push keeps the mirror's see-all role.
- **Two compiled reports** (published on the punch-list artifact):
  test-data inventory (delete list + ambiguous rows) and the
  fields-to-link report (journey/territory/contact pages vs native
  MasterSuite tables — free wins, drift register, real gaps).
- **Punch-list artifact:**
  https://claude.ai/code/artifact/d51dcd9b-8100-4bba-9f33-fd0b50d3c067

## What Is Confirmed Working

- Read.ai → native, on prod: all 5 of Mon Aug-17's live calls ingested
  end-to-end (webhook → classify → transcript → grade), Tue Aug-18's
  coaching call verified sitting on Eric Wilkening's prod journey,
  Settings→Webhooks showed a success delivery minutes old.
- Sticky view, newest-first lanes, drawer height, no-city cards — all
  verified on a local run against dev DB (both lenses), then the sticky
  view re-verified on prod post-deploy.
- The team door, verified ON PROD with minted sessions: John's picker
  offers FranDev + all 5 pipeline strips + Day Hub frandev cards render;
  Chad same, and no dev-mode overlay. (Real logins still mint the
  permission claim at sign-in — each of the three does one
  log-out/log-in and picks FranDev once.)
- Old-app deletions: dry-run counts matched the approved list exactly
  (21/20/21/8) before executing; migration counts verified against the
  dev copy before authoring.

## What Is Broken or Incomplete

- Calls page renders 0 of 440 calls (why Read.ai looked dead) — High,
  but **HELD by Corey** until the big backfill
- Five Aug-14 calls missing natively (Ben Harrison team call, Franklin
  Witter, Joel Chevrette, Rebecca Kamude, group call) — Medium, **HELD**
  for the same backfill
- Four journeys with orphan primary contacts in MySQL only
  (Colman/Bara/Abraham/Pearson — real leads; adam-pearson's contact never
  synced and GHL id `pto_102844` collides with Eric Banks) — Medium,
  sync-repair job
- Old Vercel app's Anthropic key out of credits (~Aug 18) — Low, its
  copies of new calls sit unprocessed; native does the work now
- Testy McTester journey (real contact Keith Levenson attached) and the
  John Samples duplicate pair — Low, need Corey's rename/merge call

## Decisions Made

- Roster: FranDev = Matt, John, Chad, all see everything; John and Chad
  WITHOUT dev mode — Corey
- John + Chad → role 'admin' in the old app too (keeps the mirror right
  through the nightly push) — Corey
- Delete the clean test-data list; ambiguous rows held back — Corey
- Merge both PRs once CI green — Corey
- Row labels + territory rows in filters: parked / confirmed fine — Corey
- Calls page fix + Aug-14 re-ingest: HELD until the upcoming
  backfill-everything pass — Corey
- Kanban "newest first" = smallest days-since-touch on top, everywhere —
  Corey (superseded the design's oldest-first queue default)

## Files Created

- `Mastersuite/.../DatabaseMigrationRunner/Migrations/2026-08-18-301_FranDevTeamAccess.sql`
- `Mastersuite/.../DatabaseMigrationRunner/Migrations/2026-08-18-302_TestDataCleanup.sql`
- scratchpad `cleanup-test-data.mjs` + `frandev-punch-list.html`
- `~/Desktop/frandev-test-data-backup-2026-08-18/` (10 JSON backups)

## Files Modified

- `Mastersuite/.../MasterSuite.Modules.Frandev/FrandevService.Kanban.cs`
- `Mastersuite/.../MasterSuite/Pages/Gunner/Inventory.cshtml` + `.cshtml.cs`
- `Mastersuite/.../MasterSuite/Pages/Gunner/_FrandevKanban.cshtml`
- `Mastersuite/.../MasterSuite/Pages/Gunner/_FrandevKanbanDrawer.cshtml`
- Supabase (old app): `users` roles john/chad → admin; Demo Admin
  `is_active=false`; 21 `integration_logs.related_contact_id` → null

## Files Deleted

- No repo files. Data: the approved test rows on the old app (see above);
  their MasterSuite mirrors go when #957's deploy boots.

## Open Issues Carried Forward

- Calls page 0-of-440 — High (HELD for backfill)
- Aug-14 five-call re-ingest — Medium (HELD for backfill)
- Orphan-contact journey repair (4) — Medium
- Testy McTester rename / John Samples merge — Low
- Fields-to-link execution (free wins first: territory Team/Documents/Map
  panels, contact Owner + Capital tiles; then the 3 one-line source
  swaps; franchise-fee needs a native home decision) — Low until picked up
- Rest of the s110 fix-first tail (no add-lead form, HostedByUserId='0'
  attribution, webhook token doors open, comms first-send smoke) — see
  s110 handoff

## Exact Next Step

Corey brings the next list; nothing is blocked — the held items (Calls
page fix + all backfills) wait for the deliberate backfill-everything
pass.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Corey brings the next list; held items (Calls page + backfills) wait for the backfill-everything pass.

---
