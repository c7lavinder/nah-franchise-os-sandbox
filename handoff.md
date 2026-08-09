# Session Handoff — 2026-08-09 — Session 100

## Status

Phase: **CUTOVER TRACK — EXECUTED, not planned. All 5 outstanding items closed, the
bidirectional pipeline is LIVE against production, the duplicate backlog is ZERO, and
cutover Phase 1 has begun (ADR-0014).** The only human step left anywhere: Ben runs
two GRANT lines. / Health: Green / Duration: double session

## What Was Built This Session

- **G3 closed** (`231f609`): the 67 surviving orphan profile keys (169 rows) became
  registry entries in `lib/profile/field-registry.ts` — 0 orphans, verified live
  against `contact_profile_fields` after the edit.
- **The GRANT blocker un-diagnosed**: probed prod directly — Ben's Aug 1 grant COVERS
  116 tables; only `frandev_note` + `frandev_journey_chat` (born after it) are
  uncovered, and the missing note line is the whole reason the mirror froze.
  **MasterSuite PR #709** (2-line grant file,
  `database/2026-08-09_grant_frandev_note_chat_write.sql`) — CI green, **MERGED**
  (`2460b8e`) on Corey's instruction.
- **The 13 pending journal rows APPLIED against prod** (one-off local run of
  `applyNativeWrites` with `MASTERSUITE_WRITE_TARGET=prod`): 13/13, 0 failed; every
  landing verified in Supabase by id.
- **Vercel flipped to production**: `MASTERSUITE_WRITE_TARGET=prod` + 5
  `MASTERSUITE_PROD_DB_*` env vars added, redeployed; replay cron triggered manually
  on the deployment and confirmed reading the PROD journal.
- **Mirror UNFROZEN**: full push run against prod — 116 tables,
  **104,706/104,709 rows, 0 table errors**; the 3 "skipped (bad)" rows are exactly
  the 3 `frandev_note` rows (privilege — heals when Ben runs #709's SQL).
- **D5 CLOSED** (`3324854` + `ceb6464`): evidence pass (subagent, read-only) proved
  46 of the 57 name-only groups — 43 were a PHONE-FORMAT artifact (`+1XXX` vs bare
  10 digits compared as strings), 3 hid in the `contact_emails` multi-email table.
  All 46 merged via `lib/contacts/merge.ts`: 0 failures, 0 orphaned journeys. The 4
  needs-human calls DECIDED on Corey's "knock these out": jimmy stratton MERGED
  (double-import — sequential pto\_ ids ONE SECOND apart); angel lane, derrick
  washington, ron cates kept distinct. **20 junk shells DELETED through prod
  MasterSuite's own guarded handlers** (minted JWT; archive→delete journey→delete
  contact ×20 = 60 journal rows, replayed 60/60, verified gone BOTH sides).
- **ADR-0014 — the cutover begins** (`ceb6464`): `sync-ms-properties` +
  `sync-ms-lead-list` retired from `vercel.json` crons (native reads the MySQL
  property originals directly — `PropertyRoyalty`; zero native reads of those
  mirrors). Begins superseding ADR-0002/0009. `scheduler-ownership.test.ts` updated
  to the new contract (kept syncs present, retired syncs ABSENT) and mutation-tested.

## What Is Confirmed Working

**Measured against PRODUCTION after each step. None predicted.**

- Replay E2E at volume: 13 + 50 + 10 journal rows applied, 0 failures total; the
  60-row junk sweep is the first real-volume proof of the full loop
  (MasterSuite handler → journal → Vercel cron → Supabase + mirror).
- Deployed replay cron reads the prod journal (manual trigger:
  `{"success":true,...}`); nightly push cron now targets prod on the same env.
- Mirror freshness: `frandev_contact` MAX(UpdatedAt) = 2026-08-09, 3,215 rows;
  83 merged-away contacts visible; both `-2` journeys `archived` in the mirror.
- 47 merges aftermath: 0 active journeys point at merged-away contacts.
- 20 junk contacts + their 20 journeys: 0 rows remaining in EITHER database.
- Grant probe: 116/118 frandev\_ tables writable; `frandev_native_write` writable;
  only `frandev_note` + `frandev_journey_chat` uncovered.
- Guard mutation test: green → cron re-added → RED → restored → green.
- Sandbox: `npx tsc --noEmit` 0, `npx next build` clean, `npx vitest run` 318/318.

## What Is Broken or Incomplete

- **Notes don't cross the fold until Ben RUNS #709's SQL** (merge done, execution
  pending — needs his root credential; every local avenue exhausted and proven
  impossible, incl. the migration route: the runner account lacks GRANT OPTION,
  verified on dev). 3 frandev_note rows unpushable meanwhile — **Medium**
- **The round-trip trap blocks the next two retirements**: native FranDev reads
  `frandev_territory_market_data` + `frandev_eos_territory_scorecard` — mirrors of
  Supabase tables fed by the very inbound syncs we'd retire
  (MySQL→Supabase→push→mirror→native read). `sync-ms-territories` + `sync-ms-eos`
  stay until MasterSuite re-points those reads to originals — **Medium (named work item)**
- Vercel app's property/revenue/L10/Scout-property surfaces frozen at the Aug 9
  snapshot — BY DESIGN (ADR-0014); current numbers live native — **Low/FYI**
- GHL dup-tag/keeper-note steps failed on all 47 merges (placeholder GHL ids, same
  as every D5 batch); DB steps all green — **Low**
- Dev mirror now goes stale (write target is prod; dev push stopped) — expected — **Low**
- `charleston@newagainhouses.com` contact is the Charleston OFFICE named like a
  person ("Ron Cates") — rename candidate so it stops tripping dup scans — **Low**
- Carried, all Low: three inline-edit implementations; `ResolveUser`/`ResolveUsername`
  duplicated; `updateCandidateScore`/`Flags` write on every event; `GetAvgCycleDays`
  uncalled; ungraded calls read "Group Call"; `DataAccess.Tests` empty

## Decisions Made

- **Corey's instructions were the authorizations**: "hammer through all 5", "if CI
  is green get it merged" (#709), "take care of everything else on the critical
  path, get it done" (Vercel flip + full prod push), "knock these out" (the 4 dup
  calls delegated, junk deletion, sync retirement go-ahead).
- **ADR-0014 filed** — first inbound-sync retirement; begins superseding ADR-0002 +
  ADR-0009 per the port plan's own §7.1. — Claude, on Corey's go
- **The redundancy test for retiring a sync**: native surface reads the MySQL
  originals AND no app-side write path consumes the mirror. Properties + lead-list
  pass; territories + EOS fail (round-trip); prospects is the lead inflow. — Claude
- **jimmy stratton is one person** — records imported one second apart with
  sequential pto\_ ids; merged. angel lane / derrick washington: no proof, kept.
  ron cates: keep-both, second record is the office. — Claude, delegated by Corey
- **Junk deletion went through the native guarded handlers**, not direct DB — the
  guard, the journal, and the replay each got exercised; nothing bypassed. — Claude
- **The GRANT-as-migration idea was REJECTED on evidence** — the runner account
  holds ALL PRIVILEGES _without_ GRANT OPTION (dev-verified, same account pattern
  as prod); shipping it would jam Ben's release train. — Claude
- **Merge keeper rule** (46-batch): most activity → real (non-auto) journey →
  oldest record. — Claude

## Files Created

- Sandbox: `docs/adr/0014-cutover-begins-first-inbound-syncs-retired.md`
- MasterSuite: `database/2026-08-09_grant_frandev_note_chat_write.sql` (PR #709,
  merged; branch + worktree cleaned up)

## Files Modified

- Sandbox: `lib/profile/field-registry.ts` (+67 entries), `vercel.json` (−2 crons),
  `tests/critical-paths/scheduler-ownership.test.ts` (new contract),
  `docs/duplicate-contacts-review.md` (rewritten → RESOLVED, nothing pending),
  `handoff.md`
- Vercel production env (not a file): +6 vars (`MASTERSUITE_WRITE_TARGET`,
  `MASTERSUITE_PROD_DB_*`)

## Files Deleted

- No files. (Data: 20 junk contacts + their 20 journeys deleted from BOTH databases
  through the journaled path; 47 contacts merged.)

## Open Issues Carried Forward

All session-99 standing traps stand (MySqlConnector returns CHAR(36) as Guid VALUES —
never a string DTO property; a verified WRITE proves nothing about the READ — GET the
page; `git checkout` cannot restore an UNTRACKED file; the minted-JWT prod-driving
recipe — HS512, `MASTERSUITE_API_JWT_SECRET`, `jwt` cookie; MariaDB not MySQL; green
build proves nothing about SQL; the git hook misparses "push <word>" — commit with
`-F <file>`; solution at `apps/analysis-api/MasterSuite.sln`). Plus, new this session:

- **⚠ Vercel now WRITES PRODUCTION** — `MASTERSUITE_WRITE_TARGET=prod` lives in the
  Vercel env; the dev-target safety default is gone for the deployed app. Local
  scripts still default to dev unless the env says otherwise — **High awareness**
- **⚠ A new `frandev_` table needs BOTH a migration AND a grant line in the same
  PR** — MariaDB cannot wildcard table grants, so every table born after a grant is
  born uncovered; that is exactly how the mirror froze (#709's lesson) — **High**
- **Replay batch limit is 50** (`applyNativeWrites(limit = 50)`) — a backlog >50
  needs multiple cron ticks or manual triggers — **FYI**
- **The round-trip trap** (see Broken) — the named blocker for the next two sync
  retirements; the fix lives in MasterSuite, not the sandbox — **Medium**
- **Held until FranDev is fully off Vercel (Corey, s96)**: four nightly jobs
  deliberately unscheduled; journey briefs are a ~3,175-LLM-call deliberate run —
  **carried**

## Exact Next Step

Ben runs `database/2026-08-09_grant_frandev_note_chat_write.sql` against prod (30
seconds, his root credential — the message to send him is in the session log); the
next nightly push then heals `frandev_note` automatically — verify the 3 note rows
crossed, then start the MasterSuite work item that unblocks the next retirements:
re-point `FrandevService.Territories.cs` (`frandev_territory_market_data`) and
`FrandevService.TerritoryEos.cs` (`frandev_eos_territory_scorecard`) to the MySQL
originals, retire `sync-ms-territories` + `sync-ms-eos`, and domain 1 is complete.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Session 100 executed the cutover critical path: Vercel writes PROD now (replay + nightly push live, mirror unfrozen at 104.7k rows), duplicates CLOSED (47 merged, 20 junk deleted E2E through the native guarded handlers), G3 closed, ADR-0014 retired sync-ms-properties + sync-ms-lead-list. ONLY human step left: Ben runs database/2026-08-09*grant_frandev_note_chat_write.sql (PR #709, already merged) — then verify the 3 frandev_note rows cross in the nightly push. Next build item: re-point frandev_territory_market_data + frandev_eos_territory_scorecard native reads to the MySQL originals (the round-trip trap) so sync-ms-territories + sync-ms-eos can retire and domain 1 completes. ⚠ Traps: Vercel now writes production; a new frandev* table needs migration + grant line in the SAME PR; replay batches 50 per tick; MySqlConnector returns CHAR(36) as Guid; a verified write proves nothing about the read.

---
