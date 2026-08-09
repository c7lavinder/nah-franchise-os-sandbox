# Session Handoff — 2026-08-09 — Session 105

## Status

Phase: **CUTOVER TRACK — domain 4 (calls) BUILD IS COMPLETE. Steps 3+4+5
shipped in one session (MS PR #734): transcript worker, post-call agent +
grader (parity gate PASSED — 12/15 prompts byte-identical, 8/8 live
grade agreement), call-types/rubrics settings inside the existing Gunner
Settings page. Step 6 is now a checklist (port-plan §9), gated on Ben's
GRANT + prod push backfill + the Read.ai URL re-point.** / Health: Green /
Duration: full session

## What Was Built This Session

All in MS PR #734 (branch `frandev-s105-callsport`, worktree
`wt-s105-callsport`), everything DARK behind
`Frandev_ReadAi_NativeProcessing` (off everywhere):

- **Step 3 — transcript worker + native intake**
  (`FrandevService.TranscriptJobs/CallUploads/ReadAiSweep`,
  `Jobs/FrandevCallsJobs`): `frandev_transcript_job`'s first consumer
  (Whisper, TS shape + a stale-'processing' reaper the TS worker lacked);
  native uploads stop proxying to Vercel when the flag is on (recordings →
  S3 + queue, transcripts inline with extract-speakers/resolve/reclassify);
  three Hangfire jobs registered dark — `frandev-transcript-jobs` (\*/5),
  `frandev-readai-sweep` (10-min pending-session backstop; **it IS the
  flip-day backlog drain**), `frandev-analyze-calls` (replaces the TS
  processors' fire-and-forget generate calls).
- **Step 4 — post-call agent + grader**
  (`FrandevService.PostCall/PostCallContext/PostCallPrompts/PostCallWrites/
Grading/GradeParity`, `FrandevAnthropic`, `FrandevConfig`): the four live
  LLM sections (summary+title+classification / extraction / KB intelligence /
  rubric grade) ported prompt-byte-for-byte on the pinned Haiku model, no
  temperature; allSettled orchestration + idempotency guard + large-group
  extraction skip + refuse-before-spending budget
  (`Frandev_PostCall_DailyBudgetUsd`, default $25); `frandev_llm_call_log`
  gets its first native writer (per-section PromptVersion + tokens). NOT
  ported, deliberately: generic coaching (dead in TS), next-steps (TS
  discarded its own output), review packages (no reader anywhere),
  commitments writer (dead).
- **Step 5 — call types + rubrics settings**
  (`FrandevService.CallTypesAdmin` + `Settings.cshtml` lens branch): the
  EXISTING `/Gunner/Settings?tab=calls` branches on the workspace picker —
  FranDev lens gets the `frandev_call_type`/`rubric`/`rubric_criterion`
  editor (first C# writers for those tables), Gunner lens keeps its
  calibration-locked set untouched. No duplicated settings machinery.
  Rubric writes REFUSE while the flag is off (nightly push would clobber
  them) — read-only banner until the flip. `/Gunner/Settings` added to
  `frandevSharedPages`.
- **Parity instruments**: dev-only `POST /api/hooks/read-ai-grade-parity`
  (prompts mode = sha256 per call, free; live mode = no-write re-grade) +
  sandbox `scripts/dump-grade-prompts.ts` (verbatim grader.ts assembly,
  no LLM) — the two ends of the byte-diff.
- **Dev-only pipeline drivers**: `read-ai-postcall-run`,
  `read-ai-transcript-jobs-run`, `read-ai-sweep-run`.
- **Step-6 cutover runbook** written: port plan **§9** — preconditions
  (Ben's GRANT → prod backfill; #734 deployed; signature decision), the
  9-step flip-day sequence, the push-retirement table list, rollback.
- 7 new test pins (`FrandevPostCallTests`) — 225/225 green.

## What Is Confirmed Working

**Measured, not predicted.**

- **Grade parity tier 1 (deterministic)**: grading prompts for the 15
  newest graded calls, C# probe vs TS script on the same ids — **12/15
  sha256-byte-identical**. All 3 mismatches are mirror-vs-Supabase data
  drift (journey stages + durations that changed after the nightly push;
  field-verified: e.g. Supabase says stage "Nurture"/7-min, dev mirror says
  "Engagement"/437s), the same honest-drift class as s104's category diffs.
- **Grade parity tier 2 (statistical)**: live re-grade of 8 held-out graded
  calls, writeGrade=false — **8/8 letter-grade agreement, avg |score Δ|
  1.88 points, criteria 6/6 on every call**. No probe wrote a grade row.
- **Prompt-section parity**: the three post-call prompt builders were
  validated by transpiling the REAL TS prompt files and byte-diffing against
  the C# output on 15 branch-covering contexts + 16 parser cases — all
  identical (subagent harness, scratchpad `parity/`).
- **Full agent E2E on dev** (flag on, then returned off): a 41-KB-item
  quarterly team call and a 2-line garbage intro call both analyzed —
  title ("Q3 Franchise Development Review"), summary, 3 bullets, grade
  (C/62, 6 criteria), extractions routed, KB merged (13 docs), integration
  log + 4 metered LLM rows per run. The garbage call degraded gracefully.
- **Worker E2E**: reaper requeued a 2h-stale 'processing' job; a 404 audio
  URL failed after exactly 3 attempts with the error recorded.
- **Sweep E2E**: a re-pended session re-processed idempotently
  (`skipped_existing`, back to `complete`).
- **Settings E2E via minted JWT**: FranDev lens renders the editor (14
  types), Gunner lens still shows the locked set, add-criterion POST
  round-trips (row landed weight 1, next sort slot; cleaned up).
- Solution builds 0 errors; **225/225 platform tests** (was 218; +7).

## What Is Broken or Incomplete

- **`frandev_llm_call_log` JSON_VALID CHECK** bit the first E2E run —
  InputMessages/OutputContent are jsonb mirrors, raw text violates the
  CHECK. Fixed in #734 (serialize always); recorded because it's the
  MariaDB-not-MySQL trap family again.
- **KB-merge vs nightly push overlap window**: after the flip, the native
  KB merge writes `frandev_knowledge_document`, but the nightly push still
  owns that table until domain 6 — native KB edits get clobbered nightly.
  Documented in the runbook (§9 step 7) as a flip-session decision:
  tolerate the window, or retire the table from the push at flip and
  accept a Supabase-side KB freeze.
- **CORRECTED IN-SESSION: prod mirrors are NOT empty.** A prod probe found
  the nightly push feeding prod (frandev_call 494, call types 14, rubrics
  14+66, KB docs 58, contacts 3,195 updated same-day, sessions 450 with 0
  pending). The "0 rows / blocked on Ben's frandev\_% GRANT" picture was
  stale — the still-open Ben item is only the notes/chat GRANT
  (`database/2026-08-09_grant_frandev_note_chat_write.sql`), **back to
  Low**. The flip's real remaining gates: Read.ai dashboard access for the
  URL re-point + the prod flag, same day (§9).
- `knowledge_documents.updated_by` → `UpdatedByUserId` mapping gap — the
  fix-in-passing didn't happen this session (all step files were new;
  the mapper lives in the push) — **Low, carried**
- Carried, all Low: `charleston@` rename; three inline-edit
  implementations; `ResolveUser`/`ResolveUsername` duplicated;
  `updateCandidateScore`/`Flags` write on every event; `GetAvgCycleDays`
  uncalled; ungraded calls read "Group Call"; `DataAccess.Tests` empty

## Decisions Made

- **Rubrics become MasterSuite-owned at the flip; until then edits refuse**
  — no `frandev_native_write` journaling for rubric edits because the
  tables retire from the push at cutover (nothing left to replay into).
  Before the flip the push owns them, so the Settings tab is read-only
  with a banner. — Claude
- **Dead TS code was not ported**: next-steps section (output discarded by
  the TS agent itself), generic coaching, review packages, commitments
  writer. The mirror keeps receiving `commitments` via the push for the
  brief/Scout readers. — Claude
- **Analysis is sweep-driven, not inline**: the transcript worker and the
  processors do NOT run the agent inline; `frandev-analyze-calls` picks up
  completed calls with no `AiSummaryGeneratedAt` within ~10 min. Keeps the
  webhook fast and the worker batch honest; the TS fired HTTP calls at
  itself for the same decoupling. — Claude
- **Grade-parity two-tier gate**: deterministic prompt bytes gated hard
  (sha256), LLM output gated statistically (letter agreement on a held-out
  sample) — exact-output equality is not a meaningful bar for an LLM. — Claude
- **`Frandev_PostCall_Model` pins Haiku 4.5** (`claude-haiku-4-5-20251001`),
  overridable via SystemConfig; budget default $25/day. — Claude

## Files Created

- MS worktree `wt-s105-callsport` (all in MS PR #734):
  `Entities/Frandev/FrandevPostCall.cs`,
  `MasterSuite.Modules.Frandev/FrandevAnthropic.cs`, `FrandevConfig.cs`,
  `FrandevService.CallTypesAdmin.cs`, `FrandevService.CallUploads.cs`,
  `FrandevService.GradeParity.cs`, `FrandevService.Grading.cs`,
  `FrandevService.PostCall.cs`, `FrandevService.PostCallContext.cs`,
  `FrandevService.PostCallPrompts.cs`, `FrandevService.PostCallWrites.cs`,
  `FrandevService.ReadAiSweep.cs`, `FrandevService.TranscriptJobs.cs`,
  `IFrandevService.PostCall.cs`, `Jobs/FrandevCallsJobs.cs`,
  `MasterSuite.Platform.Tests/Frandev/FrandevPostCallTests.cs`
- Sandbox main: `scripts/dump-grade-prompts.ts` (parity instrument)

## Files Modified

- MS: `FrandevHooks.cs` (grade-parity probe + 3 dev drivers),
  `Pages/Frandev/Calls.cshtml.cs` (native-intake branch),
  `Pages/Gunner/Settings.cshtml`(+`.cs`) (FranDev lens branch + handlers),
  `Program.cs` (Settings → frandevSharedPages),
  `DependencyInjectionConfig.cs` + `HangfireConfiguration.cs` (job
  registration, dark)
- Sandbox main: `docs/supabase-cutover-port-plan.md` (§8 steps 3-5 marked
  BUILT with validation records; new **§9 cutover runbook**), `handoff.md`

## Files Deleted

- None (all E2E rows cleaned in-session: fake transcript jobs, probe
  grades/extractions, AiSummary fields on the 2 test calls; dev flag
  returned to 'off'; KB-doc merges left — tonight's push overwrites them)

## Open Issues Carried Forward

All standing traps stand (MySqlConnector CHAR(36)→Guid — CAST convention;
verified WRITE proves nothing about the READ; minted-JWT recipe — used
again this session to drive Settings; MariaDB not MySQL — new member:
jsonb-mirror columns carry JSON*VALID CHECKs, serialize before insert;
green build proves nothing about SQL; git hook misparses "push <word>" —
commit with `-F <file>`; solution at `apps/analysis-api/MasterSuite.sln`;
⚠ Vercel WRITES PRODUCTION; ⚠ new `frandev*`table needs migration + grant
in the SAME PR; replay batch limit 50; the inbound EOS sync never deleted;
local-run recipe:`dotnet run --no-launch-profile`+`ASPNETCORE_URLS=http://localhost:5199`, creds from `~/.zshrc`). Plus:

- **`sync-ms-territories` does NOT retire until the domain-5 flip** — **FYI**
- **Held until FranDev is fully off Vercel (Corey, s96)**: four nightly jobs
  deliberately unscheduled; journey briefs ~3,175-LLM-call run — **carried**

## THE GAMEPLAN TO GET OFF VERCEL (domain scoreboard)

| #   | Domain                | State                                                            |
| --- | --------------------- | ---------------------------------------------------------------- |
| 1   | Properties/mirrors    | ✅ **DONE** — #718 merged + deployed 2026-08-09                  |
| 2   | EOS                   | ✅ **DONE** — native tab live on originals; eos cron retired     |
| 3   | Workflows             | ✅ RESOLVED — archive, don't port (no build)                     |
| 4   | **Calls**             | ✅ **BUILD DONE** — #734 (steps 3+4+5); step 6 = runbook §9 flip |
| 5   | Contacts + pipeline   | ⏳ NEXT — the big one (core CRM)                                 |
| 6   | Scout/RAG → Chiron KB | ⏳ after 5 — decision resolved, build pending                    |
| 7   | Platform residue      | ⏳ dies with the app                                             |

**What's left, in order:**

1. **Domain 4 step 6 — the flip** (port-plan §9 runbook). Preconditions
   all but done: prod mirror POPULATED (probe-verified s105), #734 MERGED
   (17:58Z) + deploy run 31327834895. Remaining: Read.ai URL re-point +
   prod flag on (same day, together — §9 order note) → sweep → retire the
   3 call crons + ~17 push tables → drop `call_coaching`. Only human
   action: whoever holds the Read.ai dashboard login (Corey schedules).
2. **Domain 5** — contacts + pipeline (also retires `sync-ms-territories` +
   `sync-ms-prospects`). The big one.
3. **Domain 6** — Scout/RAG → Chiron KB (decision made, build pending).
   Also ends the KB-push overlap window (§9 step 7).
4. **Domain 7** — platform residue dies with the app; then archive Supabase.

**OUTSTANDING (everything not on the critical path):**

- **Ben's GRANT SQL** — back to **Low** (notes/chat tables only; the
  domain-4 flip does NOT need it — prod probe s105)
- `knowledge_documents.updated_by` → `UpdatedByUserId` mapping gap — **Low**
- Carried Low cleanups: `charleston@` rename; three inline-edit
  implementations; `ResolveUser`/`ResolveUsername` duplicated;
  `updateCandidateScore`/`Flags` write on every event; `GetAvgCycleDays`
  uncalled; ungraded calls read "Group Call"; `DataAccess.Tests` empty
- Held until fully off Vercel (Corey, s96): four nightly jobs unscheduled;
  journey briefs ~3,175-LLM-call run

## Exact Next Step

Execute the domain-4 flip per port-plan **§9** — preconditions are
satisfied (prod mirror populated, #734 merged + deployed); the flip needs
the Read.ai dashboard login (URL re-point) and the prod flag, same day. If
the flip isn't scheduled yet, start **domain 5 (contacts + pipeline)**
scoping: inventory the native write surface needed to retire
`sync-ms-territories`/`sync-ms-prospects` and the contact/journey/pipeline
crons, using the domain-4 pattern (shadow → flag-gated port → parity
replay → flip).

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Domain 4 build is DONE, MERGED and DEPLOYED (#734 — worker, agent, grader with passed parity gate, settings). Prod mirrors are POPULATED (probe s105) — the §9 flip needs only the Read.ai dashboard URL re-point + the prod flag, same day, then retire the 3 call crons + push tables + drop call_coaching. If I'm ready to flip, walk me through §9 of docs/supabase-cutover-port-plan.md step by step. If not, start domain 5 (contacts + pipeline) scoping with the domain-4 pattern. Do NOT retire sync-ms-territories (domain-5 exit). The flag stays OFF until the flip.

---
