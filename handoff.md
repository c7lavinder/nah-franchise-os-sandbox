# Session Handoff — 2026-08-10 — Session 108

## Status

Phase: **CUTOVER TRACK — DOMAIN 6 LIVE. The three MS PRs (#752 kb-fix →
#753 dark build → #754 flip) merged in order and deployed; migration 256
confirmed both flags `on` in prod. The old app went READ-ONLY for
contact/pipeline/KB writes (the domains-5/6 tail's first item, verified
live on Vercel with 410s). Domain 7 scoped end-to-end in port-plan §12:
what keeps the app alive, the 9 remaining crons with retirement
conditions, and the kill sequence. Both damaged calls re-queued; one
recovered in-session.** / Health: Green / Duration: late-night session

## What Was Built This Session

- **The three merges + deploy watch.** #752 (04fe3b5e) → #753 (b045d0d9)
  → #754 (dc6ef04d), squash-merged in order; final deploy green.
  (#753's own deploy run was cancelled by GitHub's one-pending-per-group
  concurrency — harmless, #754's deploy carried all three commits.)
  wt-d6-kbfix / wt-d6-build / wt-d6-flip worktrees removed.
- **Read-only guard (sandbox de151f0, deployed + E2E-verified).**
  `lib/auth/retired-writes.ts`: an explicit method+path deny list wired
  into `requireAuth` — 410 + "changes happen in MasterSuite" on the
  contact/pipeline/journey/KB writes whose native replacement is live.
  Scout's DRC executor refuses stage_move / profile_update /
  sub_task_log; every other action type still runs. Crons and webhooks
  never call requireAuth, so the bridges are exempt by construction.
  Deliberate carve-outs stay writable (native side unbuilt):
  related-people, journey documents, notes (store built, NO UI), contact
  emails/team/messages (tables still ride the push), pipeline CONFIG
  under /api/settings, sub-task-log photo upload, GHL comms
  (tasks/send/schedule), lead intake. 7 pins in
  `tests/critical-paths/retired-writes.test.ts`; 335 vitest, tsc,
  next build green. Prod-verified: board/move + knowledge POST → 410,
  GET knowledge → 200, carve-out POST passes the guard.
- **Port-plan §12 — domain 7 scoped**: what the app still does, the
  9-cron table with per-cron retirement conditions, the kill sequence,
  and the flip-night verification record.
- **Call recovery**: 13fa518b re-ran clean in-session (its pre-#740
  auto-saves now land). 27fde167 re-queued (AiSummaryGeneratedAt
  nulled); the 10-min sweep re-runs it — its 29,934-char KbIntelItems
  snapshot is intact on the call row.

## What Is Confirmed Working

- Migration 256: `Frandev_KbRetrieval_Ranked` + `Frandev_JourneyBrief_Native`
  both `on` in prod SystemConfig.
- **Ranked retrieval VERIFIED live**: a Chiron KB question ("royalty
  pushback") at 00:02:31 UTC stamped LastRetrievedAt on 24 docs and
  ticked their RetrievalCounts ("Common Franchise Objections" ×2,
  "Conversion Playbook" ×3...) — the migration-256 retrieval check
  passes, telemetry writes natively.
- **27fde167 RECOVERED**: agent_run success 23:47 UTC — 21 extractions,
  7 KB docs, graded (the failed run wrote 0 KB docs). Both damaged
  calls now clean.
- The read-only guard live on Vercel (410/200 checks above).
- Post-call pipeline healthy all day: 27 successes; the SourceHistory
  db_write_error pair was ALREADY fixed by #740 (merged 19:19 UTC —
  the two failures predate it); no recurrence after.
- Sandbox suite: 335 vitest (7 new), tsc clean, next build green.

## What Is Broken or Incomplete

- **First native ticks are all AFTER this session** — journals 11pm ET,
  journey-briefs 10pm ET, coaching 7am ET, contact research next Sun
  2am ET. Check `frandev_integration_log` (trap: CreatedAt is UTC, DB
  session is ET — compare with UTC_TIMESTAMP(), never NOW()) — **watch**
- **11 territory-market JSON-parse errors in 8 days** — the APP-side
  research cron's LLM output truncates ("Expected ',' or ']'..."). It
  writes MS tables directly and has NO native equivalent (the native
  Sun-2am slot is CONTACT research) — fix app-side; it outlives the
  app — **Medium**
- **Read.ai: zero delivery rows ever** — first-call E2E watch stays
  open — **Medium (watch)**
- Remaining tail (unchanged): native Zorakle receiver, related-people
  panel, journey-doc upload (S3+extract), notes UI, then the carve-outs
  tighten — **Low**
- Domain-4 tail: drop `call_coaching`, sig enforcement flip — **Low**

## Decisions Made

- **Read-only sweep = explicit deny list at requireAuth**, not
  middleware or per-route edits; carve-outs = surfaces whose native
  replacement doesn't exist yet (each pinned). — Claude
- **research-territories cron does NOT retire yet** — no native
  territory researcher exists; the cron already writes MS tables
  directly, so its output lands natively. Retire when a native agent is
  built or Corey/Ben rule the research dead. — Claude
- **Recovery via AiSummaryGeneratedAt = NULL** (re-enters the 10-min
  sweep) instead of a prod-gated manual hook. — Claude

## Files Created

- Sandbox: `lib/auth/retired-writes.ts`,
  `tests/critical-paths/retired-writes.test.ts`

## Files Modified

- Sandbox: `lib/auth/session.ts` (guard wiring),
  `app/api/scout/action/route.ts` (DRC deny),
  `docs/supabase-cutover-port-plan.md` (§12), `handoff.md`
- MS: none locally (3 PRs merged via GitHub; worktrees removed)
- Prod data: frandev_call ×2 (AiSummaryGeneratedAt → NULL, the re-queue)

## Files Deleted

- 3 MS worktrees + their merged branches (wt-d6-kbfix/build/flip)

## Open Issues Carried Forward

All standing traps stand (CHAR(36)→Guid CAST; MariaDB not MySQL;
verified WRITE proves nothing about the READ; minted-JWT recipe — now
also proven as Bearer against the sandbox API; green build proves
nothing about SQL; git hook misparses "push <word>" — use `-F` files,
keep `git push` standalone; solution at
`apps/analysis-api/MasterSuite.sln`; ⚠ Vercel writes PROD Supabase;
sandbox prod DB grant = SELECT + frandev** writes; new `frandev**`table needs migration + grant same PR; local-run recipe + kill port
5199;`dotnet test`from`apps/analysis-api/`; Hangfire dashboard
trigger POSTs 500 — wait for the tick). Plus new this session:

- **frandev_integration_log.CreatedAt is UTC but the DB session runs
  ET** — WHERE clauses must use UTC_TIMESTAMP(); mysql2 needs
  `timezone: "Z"` or reads shift by the client offset.
- Scout chat budget: Scout_DailyBudgetUsd $25/day, resets midnight UTC.
- The s96 "held until off Vercel" item — re-review at domain 7 close.
- Ben's notes/chat GRANT — **Low**
- Carried code cleanups (charleston@, inline-edit ×3, ResolveUser dup,
  GetAvgCycleDays, "Group Call" label, empty DataAccess.Tests) — **Low**

## THE GAMEPLAN TO GET OFF VERCEL (domain scoreboard)

| #   | Domain                 | State                                                                    |
| --- | ---------------------- | ------------------------------------------------------------------------ |
| 1   | Properties/mirrors     | ✅ **DONE**                                                              |
| 2   | EOS                    | ✅ **DONE**                                                              |
| 3   | Workflows              | ✅ RESOLVED — archive, don't port                                        |
| 4   | Calls                  | ✅ **LIVE** — first-call watch open; tail = call_coaching drop, sig flip |
| 5   | Contacts+pipeline      | ✅ **LIVE** — write routes now read-only; tail = carve-outs              |
| 6   | **Scout/RAG → Chiron** | ✅ **LIVE + VERIFIED** — flags on, ranked retrieval ticking natively     |
| 7   | Platform residue       | ⏳ **SCOPED (§12)** — kill sequence written; tail builds next            |

**What is left, in order (port-plan §12.3 is the master copy):**

1. **Verify the overnight ticks**: 'journey-briefs' agent_run after
   tonight's 22:00 ET; journals 23:00 ET; coaching 07:00 ET. (Chiron
   retrieval + both call recoveries already verified in-session.)
2. **Native tail builds**: related-people panel, journey-doc upload,
   notes UI, Zorakle receiver, emails/team/messages (or per-table
   freeze rulings), pipeline-config UI (or freeze).
3. **Re-point externals at MasterSuite**: website form intake, Read.ai
   delivery, Trainual/Vonage/SignalHouse/DocuSign/payment webhooks.
4. **Comms to native GHL** (MS connected its own GHL: location
   0WYp7DssxULm1SJYaOsz) → retire token refresh + calendar sync.
5. **The kill**: team confirmed off the app → final push-frandev →
   retire both bridges → archive Supabase → Vercel off → held items
   unblock.

## Exact Next Step

Check the overnight native ticks in frandev_integration_log —
journey-briefs 22:00 ET, journals 23:00 ET, coaching 07:00 ET (use
UTC_TIMESTAMP in queries, never NOW()) — plus any first Read.ai
delivery. Then start the native tail builds (§12.3 step 2) — Corey
picks the order; related-people panel or notes UI are the smallest, the
Zorakle receiver closes a webhook.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Domain 6 is LIVE + VERIFIED (three PRs merged + deployed, flags on, ranked retrieval ticking; both damaged calls recovered) and the old app is READ-ONLY for contact/pipeline/KB writes (410s them). First: check frandev_integration_log for the overnight native ticks — journey-briefs 22:00 ET, journals 23:00 ET, coaching 07:00 ET (CreatedAt is UTC, DB NOW() is ET — use UTC_TIMESTAMP) — and any first Read.ai delivery. Then: domain-7 tail builds per port-plan §12.3 — related-people panel, notes UI, journey-doc upload, Zorakle receiver, then re-point externals. Reminder: ALL contact/pipeline/KB changes happen in MasterSuite now.

---
