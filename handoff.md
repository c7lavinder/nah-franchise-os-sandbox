# Session Handoff — 2026-08-09 — Session 105

## Status

Phase: **CUTOVER TRACK — domain 4 (calls) is LIVE IN PRODUCTION. One
session took it from "step 3 next" to flipped: steps 3+4+5 built (MS
#734), the grade-parity gate passed (12/15 prompts byte-identical, 8/8
live grade agreement), Corey re-pointed the Read.ai workspace webhook,
MS #737 turned the flag on (18:26Z, verified), and the sandbox retired
the calls domain from its sync + crons. The next ended meeting is the
first fully-native call.** / Health: Green / Duration: full session

## What Was Built This Session

**MS PR #734** (merged + deployed) — everything shipped dark, then lit by #737:

- **Step 3 — transcript worker + native intake**:
  `FrandevService.TranscriptJobs.cs` (Whisper queue, first consumer of
  `frandev_transcript_job`, + a stale-claim reaper the TS worker lacked),
  `FrandevService.CallUploads.cs` (native uploads: recordings → S3 + queue,
  transcripts inline with extract-speakers/resolve/reclassify),
  `FrandevService.ReadAiSweep.cs` (pending-session drain + post-call
  analyzer), `Jobs/FrandevCallsJobs.cs` + Hangfire registration (3 lanes:
  \*/5 transcripts, 10-min sweep, 10-min analyzer).
- **Step 4 — post-call agent + grader**: `FrandevService.PostCall.cs`
  (orchestrator), `.PostCallContext.cs` (context loader),
  `.PostCallPrompts.cs` (summary/extraction/KB prompts, byte-parity),
  `.PostCallWrites.cs` (extraction routing, auto-save, KB merge),
  `.Grading.cs` (the parity-locked grader), `.GradeParity.cs` (the gate),
  `FrandevAnthropic.cs` (transport + `frandev_llm_call_log` metering),
  `FrandevConfig.cs` (flag/model/budget shelf). Dead TS code NOT ported
  (next-steps, coaching, review packages, commitments writer).
- **Step 5 — settings**: `FrandevService.CallTypesAdmin.cs` + a FranDev-lens
  branch in the EXISTING `/Gunner/Settings?tab=calls` (Gunner's locked set
  untouched; no duplicated machinery; editing unlocked by the same flag).
- 7 test pins (`FrandevPostCallTests.cs`); parity instruments
  (`read-ai-grade-parity` probe + sandbox `scripts/dump-grade-prompts.ts`).

**MS PR #737** (merged + deployed) — migration
`2026-08-09-253_FrandevCallsCutoverOn.sql`: the one-row flip.

**Sandbox** (commits be3564a, 471d69c, 3fa0781): `updated_by` column-mapping
fix; 21 call-domain tables retired from `push-frandev.ts` + 3 crons from
`vercel.json`; port-plan §8 marked BUILT ×3 + new **§9 cutover runbook**.

## What Is Confirmed Working

**Measured, not predicted.**

- **Grade parity**: prompts 12/15 sha256-byte-identical vs the TS grader
  (3 misses = mirror-data drift, field-verified); live re-grade of 8
  held-out calls: **8/8 same letter grade**, avg |score Δ| 1.88, criteria
  6/6. Prompt-section parity: 15 contexts + 16 parser cases, all identical
  (real TS transpiled and byte-diffed).
- **Full agent E2E on dev**: 41-KB-item team call + a 2-line garbage call
  both analyzed — title/summary/bullets/grade/extractions/KB merge/
  integration-log/LLM-metering all verified in MariaDB.
- **Worker E2E**: stale-claim reaper requeued; 404 audio failed after
  exactly 3 attempts. **Sweep E2E**: re-pended session idempotently
  re-processed. **Settings E2E** (minted JWT): both lenses render,
  add-criterion round-trips.
- **THE FLIP, verified in prod**: flag 'on', endpoint answering, 10 signing
  keys stored (prod + dev), 0 pending backlog, CI green ×2, deploys green
  ×3, 225/225 platform tests, sandbox build + 318 vitest green.

## What Is Broken or Incomplete

- **No live delivery observed yet** — flip happened Saturday evening;
  nothing ended a meeting since. First-call verification is next session's
  opening move — **Medium (watch item, not a defect)**
- `call_coaching` table still exists in Supabase (inert: nothing reads,
  writes, or syncs it) — drop in a housekeeping migration — **Low**
- Signature enforcement off (accept-and-log): flip
  `Frandev_ReadAi_RequireSignature` after a week of sig=valid rows — **Low**
- Supabase `knowledge_documents` is now FROZEN (retired from the sync;
  native KB merge owns the mirror). Sandbox Scout still reads its stale
  copy until domain 6 — accepted at flip — **Low**
- Ben's notes/chat GRANT (`database/2026-08-09_grant_frandev_note_chat_write.sql`)
  — unrelated to calls — **Low**
- Carried Lows: `charleston@` rename; three inline-edit implementations;
  `ResolveUser`/`ResolveUsername` duplicated; `updateCandidateScore`/`Flags`
  write on every event; `GetAvgCycleDays` uncalled; ungraded calls read
  "Group Call"; `DataAccess.Tests` empty

## Decisions Made

- **Flip executed same-session** — Corey re-pointed the Read.ai workspace
  webhook and provided its signing key; that satisfied §9's human step, so
  the flag flipped via migration 253. — Corey
- **The signing key is the WORKSPACE webhook's key** (not Matt's personal
  one); stored for all 10 known owner emails; accept-and-log unchanged. — Claude
- **`knowledge_documents` retired from the sync AT the flip** (§9 step-7
  option B): the native KB merge owns the mirror; Supabase's copy freezes
  rather than clobbering native edits nightly. — Claude
- **Rubrics are MasterSuite-owned from the flip**; Settings editing
  unlocked by the same flag. — Claude
- **Dead TS code not ported**; analysis is sweep-driven, not inline;
  two-tier parity gate (bytes hard, LLM statistical); Haiku 4.5 pinned,
  $25/day budget. — Claude (details in port-plan §8/§9)
- Prod-mirror-empty picture was STALE — probe found the sync feeding prod;
  Ben's GRANT demoted back to Low. — Claude

## Files Created

- MS #734: `Entities/Frandev/FrandevPostCall.cs`; in
  `MasterSuite.Modules.Frandev/`: `FrandevAnthropic.cs`, `FrandevConfig.cs`,
  `FrandevService.{CallTypesAdmin,CallUploads,GradeParity,Grading,PostCall,
PostCallContext,PostCallPrompts,PostCallWrites,ReadAiSweep,TranscriptJobs}.cs`,
  `IFrandevService.PostCall.cs`, `Jobs/FrandevCallsJobs.cs`;
  `MasterSuite.Platform.Tests/Frandev/FrandevPostCallTests.cs`
- MS #737: `DatabaseMigrationRunner/Migrations/2026-08-09-253_FrandevCallsCutoverOn.sql`
- Sandbox: `scripts/dump-grade-prompts.ts`

## Files Modified

- MS: `FrandevHooks.cs`, `Pages/Frandev/Calls.cshtml.cs`,
  `Pages/Gunner/Settings.cshtml`(+`.cs`), `Program.cs`,
  `DependencyInjectionConfig.cs`, `HangfireConfiguration.cs`
- Sandbox: `lib/mastersuite/push-frandev.ts` (column override + 21-table
  retirement), `vercel.json` (3 crons out),
  `tests/business-logic/push-frandev-naming.test.ts` (retirement pin),
  `docs/supabase-cutover-port-plan.md` (§8 ×3 BUILT + §9), `handoff.md`

## Files Deleted

- None (E2E rows cleaned in-session; worktree `wt-s105-callsport` removed
  after merge)

## Open Issues Carried Forward

All standing traps stand (CHAR(36)→Guid CAST convention; MariaDB not MySQL
— jsonb mirrors carry JSON*VALID CHECKs, serialize before insert; verified
WRITE proves nothing about the READ; minted-JWT recipe; green build proves
nothing about SQL; git hook misparses "push <word>" — commit with `-F`;
solution at `apps/analysis-api/MasterSuite.sln`; ⚠ Vercel WRITES PRODUCTION;
new `frandev*`table needs migration + grant in the SAME PR; local-run:`dotnet run --no-launch-profile`+`ASPNETCORE_URLS=http://localhost:5199`,
creds from `~/.zshrc`; run `dotnet test`from`apps/analysis-api/`, not repo
root). Plus:

- **`sync-ms-territories` + `sync-ms-prospects` retire at the DOMAIN-5
  flip, not before** — **FYI**
- **Held until FranDev is fully off Vercel (Corey, s96)**: four nightly
  jobs deliberately unscheduled; journey briefs ~3,175-LLM-call run —
  **carried**

## THE GAMEPLAN TO GET OFF VERCEL (domain scoreboard)

| #   | Domain                | State                                                             |
| --- | --------------------- | ----------------------------------------------------------------- |
| 1   | Properties/mirrors    | ✅ **DONE** — #718 merged + deployed                              |
| 2   | EOS                   | ✅ **DONE** — native tab live on originals; eos cron retired      |
| 3   | Workflows             | ✅ RESOLVED — archive, don't port (no build)                      |
| 4   | **Calls**             | ✅ **LIVE** — #734 built, #737 flipped 2026-08-09; tail items low |
| 5   | Contacts + pipeline   | ⏳ **NEXT** — the big one (core CRM)                              |
| 6   | Scout/RAG → Chiron KB | ⏳ after 5 — decision resolved, build pending                     |
| 7   | Platform residue      | ⏳ dies with the app                                              |

**What is left, in order:**

1. **Domain 4 tail (small, this week)**: verify the first live Read.ai
   call end-to-end (session → call → transcript → grade → KB, ≤10 min);
   after ~a week of sig=valid log rows flip
   `Frandev_ReadAi_RequireSignature='on'`; drop `call_coaching` in a
   housekeeping migration.
2. **Domain 5 — contacts + pipeline (the big one)**: scope with the proven
   domain-4 pattern (shadow → flag-gated native writes → parity replay →
   flip). Exit also retires `sync-ms-territories` + `sync-ms-prospects`
   and the contact/journey crons.
3. **Domain 6 — Scout/RAG → Chiron KB**: decision made (Chiron KB is the
   landing zone); build pending. Also un-freezes the KB story (Supabase
   copy is frozen since the domain-4 flip).
4. **Domain 7 — platform residue**: dies with the app; then archive
   Supabase and the held items unblock (4 nightly jobs, journey-brief run).

**OUTSTANDING (not on the critical path, all Low):**

- Ben: notes/chat GRANT (30 sec at a prod terminal)
- Drop `call_coaching`; signature enforcement flip (both domain-4 tail)
- Carried code cleanups (charleston@, inline-edit ×3, ResolveUser dup,
  updateCandidateScore, GetAvgCycleDays, "Group Call" label, empty
  DataAccess.Tests)

**Nothing on the critical path waits on anyone.** Domain 5 can start now.

## Exact Next Step

Verify the first live Read.ai delivery processed natively end-to-end
(prod: `frandev_integration_log` webhook_received → `frandev_call` row →
transcript → grade + KB within ~10 min), then start domain 5 (contacts +
pipeline) scoping with the domain-4 pattern.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Domain 4 (calls) is LIVE — first verify the newest Read.ai delivery processed natively end-to-end on prod (frandev*integration_log → frandev_call → transcript → grade/KB within ~10 min of a meeting ending; sig=valid on the log rows). Then start domain 5 (contacts + pipeline) scoping using the domain-4 pattern: inventory every Supabase write path for contacts/journeys/pipeline, map to frandev* mirrors, plan shadow → flag-gated native writes → parity replay → flip. Do NOT retire sync-ms-territories/sync-ms-prospects (they retire at the domain-5 flip). Domain-4 tail items (call_coaching drop, signature enforcement) are Low — fold into any session.

---
