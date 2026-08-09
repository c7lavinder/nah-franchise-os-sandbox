# Session Handoff — 2026-08-09 — Session 104

## Status

Phase: **CUTOVER TRACK — domain 4 step 2 (classifier + 3 processors) is
DONE: MS PR #729 merged 16:37Z, deploy run 31324259967 success, prod probe
answers, flag-gated OFF. Transcript parity proven 421/421 byte-identical
against the current TS formatter. Steps 1+2 of 6 shipped.** / Health: Green /
Duration: full session

## What Was Built This Session

- **Domain 4 step 2 — the native call classifier + processors (MS PR #729,
  branch `frandev-s104-classifier`, worktree `wt-s104-classify`)**: 1:1 C#
  ports of the sandbox `lib/calls` pipeline — participant resolver
  (email/phone/name tiers → territory → journey ranking), category decision
  tree (prospect / onboarding / coaching / group / internal / unknown),
  layer-2 slug table, transcript formatter (speaker-map heuristics,
  case-sensitive transcription fixes), and the 3 processors writing
  `frandev_call` + participants + territory/journey junctions + transcript +
  session link, plus the reconcile safety net. **Flag-gated, default OFF**:
  SystemConfig `Frandev_ReadAi_NativeProcessing='on'` is the whole switch;
  off, the step-1 shadow receiver is byte-identical. Flips at step 6.
- **The resolver's DB seam** (`IFrandevCallResolverDb`): tests pin the
  decision tree with a fake; the replay runs it read-only against the live
  mirror; a REPLAY-ONLY caching decorator cuts the corpus run from 20+ min
  to ~13 (the live path stays uncached — reconcile must see the contact the
  prospect processor creates mid-session).
- **Migration `2026-08-09-252`**: `frandev_contact.IsConvertedFranchisee` —
  the ONLY classifier input the mirror lacked. The schema-driven push maps
  `is_converted_franchisee` automatically (pascalToSnake); no sandbox change.
  Dev got the column + a 71-contact backfill from Supabase in-session.
- **Dev-only validation hooks**: `POST /api/hooks/read-ai-classify-replay`
  (read-only corpus diff) and `POST /api/hooks/read-ai-format-transcript`
  (pure formatter probe with an explicit team set — the parity instrument).
- 25 new pins in `MasterSuite.Platform.Tests/Frandev/FrandevReadAiClassifierTests.cs`
  (every decision-tree branch, slug table, title rules, speaker-map
  heuristics, the fdd→FDD case-sensitivity rule, duration rounding).

## What Is Confirmed Working

**Measured, not predicted.**

- **Transcript parity PROVEN**: current TS `formatTranscript` vs the C# port
  on all 421 archived payloads, identical team set both sides —
  **421/421 byte-identical, 0 mismatches**.
- **Classify replay** (2 runs, identical counters — deterministic): 421
  scanned / 0 parse failures; durations **415/415 exact**; participants
  355/357; categories 358/421. All 63 category mismatches sit in honest
  drift buckets (prospect→coaching 13, prospect→onboarding 9,
  coaching↔onboarding 11, internal↔prospect 11, …): the replay resolves
  against TODAY's mirror, the stored answers were computed months ago —
  journeys advanced/closed, contacts merged, the team roster changed. The 2
  sampled category flips are textbook runway drift (a journey now in runway
  classifies coaching where onboarding was stored, and vice versa).
- **Stored-title (247) and stored-slug (123) diffs are NOT the port**: the
  post-call summary agent rewrites titles to 3-5 words after insert
  (`lib/agents/post-call/prompts/summary.ts` — §8 step 4 scope) and manual
  drag-retypes rewrite slugs (`cohort_call` shows up — a slug the classifier
  never emits). Replayed titles are exactly the processor-insert format
  ("Intro Call w/ Preeti Singh").
- **Flag-on E2E on the running app** (dev DB): synthetic prospect delivery →
  session `complete` + linked; call row with correct slug/title/duration/
  host; transcript row (Source=upload, WordCount right); contact created
  (`readai_` placeholder GhlContactId, NeedsReview=1) and — via reconcile —
  linked onto its participant row; `webhook_received` + `call_classified`
  log rows. Probe rows cleaned up; flag returned to off.
- `MasterSuite.Platform.Tests` **210/210** (was 185; +25); app project builds
  clean.

## What Is Broken or Incomplete

- **The E2E probe caught a real bug pre-review**: `FULLTEXT` is a MariaDB
  reserved word — the transcript INSERT backticks it now. Also 14 queries
  initially hit the standing CHAR(36)→Guid trap; all now use the repo's
  `CAST(... AS CHAR)` convention. Both fixed in #729 — recorded here because
  the traps EARNED their standing status again.
- **GRANT SQL still not run** (`database/2026-08-09_grant_frandev_note_chat_write.sql`,
  30 sec at a prod terminal, Ben) — **Low**
- `knowledge_documents.updated_by` → `UpdatedByUserId` mapping gap — **Low**
- Carried, all Low: `charleston@` office-named-as-person rename; three
  inline-edit implementations; `ResolveUser`/`ResolveUsername` duplicated;
  `updateCandidateScore`/`Flags` write on every event; `GetAvgCycleDays`
  uncalled; ungraded calls read "Group Call"; `DataAccess.Tests` empty

## Decisions Made

- **Prospect-created contacts get `readai_` placeholder GhlContactIds** —
  the mirror's GhlContactId is NOT NULL; same convention as the
  pto*/manual*/franchisee\_ families. — Claude
- **Category replay is a triage report, not a 100% gate** — the DB-dependent
  half of classification cannot be re-validated against months-old answers
  from today's DB; the deterministic half (transcript/title/duration/slug
  rules) is where byte-parity is enforced, and it holds. — Claude
- **The classify replay caches its resolver reads; the live path never does**
  — reconcile must observe the contact created mid-processing. — Claude
- **Step-6 note added to the port plan**: the flag flip must also sweep the
  `'pending'` backlog accumulated in shadow — the live path only processes
  new deliveries. — Claude

## Files Created

- MS worktree `wt-s104-classify` (all in MS PR #729):
  `DatabaseMigrationRunner/Migrations/2026-08-09-252_FrandevContactConvertedFlag.sql`,
  `Entities/Frandev/FrandevReadAiClassify.cs`,
  `MasterSuite.Modules.Frandev/FrandevCallResolverDb.cs`,
  `MasterSuite.Modules.Frandev/FrandevService.ReadAiText.cs`,
  `MasterSuite.Modules.Frandev/FrandevService.ReadAiClassifier.cs`,
  `MasterSuite.Modules.Frandev/FrandevService.ReadAiProcessors.cs`,
  `MasterSuite.Modules.Frandev/IFrandevService.ReadAiClassify.cs`,
  `MasterSuite.Platform.Tests/Frandev/FrandevReadAiClassifierTests.cs`

## Files Modified

- MS: `FrandevService.ReadAi.cs` (one flag-gated call after ingest),
  `MasterSuite/FrandevHooks.cs` (two dev-only validation endpoints)
- Sandbox main: `docs/supabase-cutover-port-plan.md` (§8 step 2 marked BUILT
  - validation record + step-6 backlog-sweep note), `handoff.md`

## Files Deleted

- None (E2E probe rows + test flag cleaned up in-session; dev's manual
  IsConvertedFranchisee column persists but the deployed migration owns it)

## Open Issues Carried Forward

All standing traps stand (MySqlConnector CHAR(36)→Guid — bit TWICE this
session before the CAST convention was applied; verified WRITE proves nothing
about the READ; minted-JWT prod-driving recipe; MariaDB not MySQL — FULLTEXT
is a reserved word, backtick it; green build proves nothing about SQL; git
hook misparses "push <word>" — commit with `-F <file>`; solution at
`apps/analysis-api/MasterSuite.sln`; ⚠ Vercel WRITES PRODUCTION; ⚠ new
`frandev_` table needs migration + grant in the SAME PR; replay batch limit
50 (step-1 harness); the inbound EOS sync never deleted). Plus:

- **Local-run recipe that works**: `dotnet run --no-launch-profile` with
  `ASPNETCORE_URLS=http://localhost:5199` — launchSettings.json otherwise
  OVERRIDES the port and BLANKS `NAH_DB_PASSWORD`. DB creds from `~/.zshrc`
  (`NAH_DB_*`); query MariaDB via node `mysql2` (import it by absolute path
  from the sandbox's node_modules).
- **`sync-ms-territories` does NOT retire until the domain-5 flip** — **FYI**
- **Held until FranDev is fully off Vercel (Corey, s96)**: four nightly jobs
  deliberately unscheduled; journey briefs ~3,175-LLM-call run — **carried**

## THE GAMEPLAN TO GET OFF VERCEL (domain scoreboard)

| #   | Domain                | State                                                           |
| --- | --------------------- | --------------------------------------------------------------- |
| 1   | Properties/mirrors    | ✅ **DONE** — #718 merged + deployed 2026-08-09                 |
| 2   | EOS                   | ✅ **DONE** — native tab live on originals; eos cron retired    |
| 3   | Workflows             | ✅ RESOLVED — archive, don't port (no build)                    |
| 4   | **Calls**             | 🔨 **IN BUILD** — steps 1+2 of 6 done (#722, #729); step 3 next |
| 5   | Contacts + pipeline   | ⏳ after 4 — the big one (core CRM)                             |
| 6   | Scout/RAG → Chiron KB | ⏳ after 5 — decision resolved, build pending                   |
| 7   | Platform residue      | ⏳ dies with the app                                            |

**What's left, in build order:**

1. **Domain 4 step 3** — transcript-job worker (model on `ChironNtnJobs` /
   `CbEstimationVisionJobs` — MasterSuite has no Vercel-cron analogue). ← **NEXT**
2. **Domain 4 step 4** — post-call agent + grader in C#, **parity-gated**
   (re-grade held-out graded calls and diff BEFORE writing any grade row —
   the riskiest piece of the whole port).
3. **Domain 4 step 5** — call-types/rubrics settings UI + fan-out
   (extractions, action items, review packages, commitments).
4. **Domain 4 step 6** — cutover: keys-vs-unsigned decision, re-point the
   Read.ai webhook URL, flip `Frandev_ReadAi_NativeProcessing` on, **sweep
   the 'pending' backlog accumulated in shadow**, retire the sandbox call
   crons + call tables from the push, drop `call_coaching` (KEEP
   `calls.coaching_data`).
5. **Domain 5** — contacts + pipeline (also retires `sync-ms-territories` +
   `sync-ms-prospects`).
6. **Domain 6** — Scout/RAG → Chiron KB.
7. **Domain 7** — platform residue dies with the app; then archive Supabase.

**Outstanding but NOT on the critical path:** Ben's GRANT SQL (30 sec, Low);
`knowledge_documents.updated_by` mapping gap; carried Low cleanups.
**Nothing on the critical path waits on Ben.**

## Exact Next Step

Build port-plan §8 step 3 in a fresh MS worktree: the transcript-job worker,
modeled on `ChironNtnJobs` / `CbEstimationVisionJobs` (Hangfire — see
`HangfireConfiguration.cs`). Study what `frandev_transcript_job` rows the
Vercel pipeline creates/consumes first, then port the worker loop. The step-2
classifier (#729) is merged and flag-gated off; its replay + probe harness
pattern is in `FrandevService.ReadAiProcessors.cs`.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Build port-plan §8 step 3: the transcript-job worker in the MasterSuite repo, modeled on ChironNtnJobs (Hangfire). Steps 1+2 are merged (#722 receiver live; #729 classifier flag-gated OFF). Study frandev_transcript_job usage in the sandbox first. Ben items left: just the GRANT SQL (Low). Do NOT retire sync-ms-territories (domain-5 exit). Do NOT flip Frandev_ReadAi_NativeProcessing.

---
