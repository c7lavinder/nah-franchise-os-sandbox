# Session Handoff — 2026-08-10 — Session 107

## Status

Phase: **CUTOVER TRACK — DOMAIN 6 (Scout/RAG → Chiron KB) FULLY BUILT +
SANDBOX HALF FLIPPED. One session scoped domain 6 (two full inventories),
fixed a prod post-call KB bug it found on arrival, built the entire native
side (query-aware KB retrieval, KB authoring, journey-brief agent, AiSpend
fold-in — MS PRs #752/#753/#754), and shipped the sandbox flip (3 crons
retired, 11 tables out of the push, ADR-0016). The MS side completes when
Corey merges #752 → #753 → #754, in that order. The embeddings question is
CLOSED: no vector port — lexical retrieval per the house ruling; MariaDB
12.3's VECTOR functions verified available and recorded as the future
option.** / Health: Green / Duration: full session

## What Was Built This Session

**MS PRs (all open, merge in order):**

- **MS #752 — kb-update NRE fix.** Prod call 27fde167 (52 extractions)
  failed its KB merge: the KB-intelligence LLM emitted a title-less item;
  the merge branch dereferenced it (`item.Title.ToLowerInvariant()`,
  PostCallWrites.cs:512). Only the MERGE branch can throw (the insert
  branch interpolates null harmlessly) — that's why every earlier call
  succeeded. A faithful port of a latent TS bug (kb-updater.ts:121).
  Fix: title-less/content-less items die at the parser (documented
  divergence); all-malformed still returns null → retry. 2 pins; 5753
  green.
- **MS #753 — the domain-6 dark build:**
  - `FrandevKbRetriever` (pure Rank, 7 pins) — term-overlap doc ranking
    (title ×2, category boost +1.5, priority ×0.1 nudge) under the same
    25-doc/60k-char budgets; wired into ScoutContext behind
    `Frandev_KbRetrieval_Ranked` with the exact old top-25 stuffing as
    fallback (flag off / greetings / approval cards / zero hits).
    Fourth instance of the no-vector-infra ruling. Ranked path writes
    retrieval telemetry natively: per-doc RetrievalCount/LastRetrievedAt - zero-hit `frandev_kb_gap_signal` (the KB health card had been
    showing numbers frozen at Supabase values since domain 4).
    Contract change: `IScoutContextSource.GetKnowledgeFor(pageContext,
queryText = null)`; ScoutAgent passes the last user message.
  - **KB authoring on /frandev/knowledge** (no flag): create/edit/
    soft-archive handlers + editor view. The native KB has been the live
    KB since domain 4 — the app's KB page edits a frozen copy. ALL KB
    edits happen in MasterSuite now.
  - **Journey-brief agent native** (`FrandevService.JourneyBrief.cs`,
    709 lines, prompt byte-for-byte, 13 pins; divergences in header —
    property reads on the MS ORIGINALS, GHL-id keying for
    intel/objections, shared FrandevAnthropic transport). Behind
    `Frandev_JourneyBrief_Native`: Hangfire `frandev-journey-briefs`
    nightly 10pm local (stale regen + seed missing, cap 25 each — the
    two steps of the app's generate-briefs cron that NEVER successfully
    ran); stale marks at 7 native write sites (advance/revert/drop/
    close/board-move/sub-task-log/post-call); JourneyV2 background-
    regens a stale brief on visit.
  - **AiSpend fold-in**: `frandev_llm_call_log` was invisible on
    /Admin/AiSpend. New source; cost computed from tokens at the budget
    gate's own rates (no CostUsd column); PromptVersion buckets; capped
    line on `Frandev_PostCall_DailyBudgetUsd`. MS full suite **5771**.
- **MS #754 — migration 2026-08-10-256** arming the two flags (merge
  after #753). Verify block in the header.

**Sandbox (c71ab97, deployed):** crons `journals` / `weekly-report` /
`pre-call-briefs` retired (pinned in scheduler-ownership.test.ts); 11
tables out of the push (embeddings, journey_briefs, objection_registry,
contact_briefs, territory_briefs, rep_journals, system_logs,
scout_retrieval_logs, scout_performance_reports, kb_gap_signals,
user_memory — the retirement rationale is a comment block in
push-frandev.ts); **ADR-0016** (flip + embeddings decision); port-plan
**§11** (the domain-6 scoping + build log). 328 vitest, tsc, next build.

## What Is Confirmed Working

- MS: 5771 tests green (5751 + 7 retriever + 13 journey-brief pins);
  #752's branch 5753. Web project builds 0 errors. Sandbox: 328 vitest,
  tsc clean, next build green.
- **Prod probes run this session:** native intake (scanned 16 / created
  3 / 0 errors) and runway (update 2 / 0 errors) logs clean; KB table
  healthy (58 docs, 19 categories, no NULLs, actively written by the
  native post-call merge all day); MariaDB `VERSION()` = 12.3.2 and
  `VEC_FromText()` works (the recorded future option).
- Data sized for the port: 58 KB docs both sides, 2,226 embedding chunks
  (retiring), 58 journey briefs, 170 contact journals, 89 rep journals
  (retiring), 760 commitments (static), contact/territory briefs EMPTY
  in prod (their cron never ran — route was POST-only while scheduled).

## What Is Broken or Incomplete

**⚠ THE ONLY ACTION ITEM ON THE CRITICAL PATH — Corey, ~5 minutes:**

- **Merge MS PRs #752 → #753 → #754, in that order** (verified OPEN at
  session end). The domain-6 flip completes when migration 256 runs on
  deploy. Until then: chat grounding is unchanged, and journey briefs sit
  frozen at their last pushed state (the sandbox push no longer carries
  them — merge soon to keep that freeze short). Everything else below
  either waits on the clock or is deliberately deferred tail work —
  **Medium**
- **No live Read.ai delivery observed yet** (domain 4; still nothing has
  ended a meeting) — first-call E2E watch stays open — **Medium (watch)**
- **Overnight native agent runs not yet verifiable** — session ran
  Sunday evening BEFORE the ticks (journals 11pm, coaching 7am, research
  Sun 2am local; DB local = ET). Check `frandev_integration_log`
  tomorrow — **watch**
- Old app's domain-5 write routes still exist (behavioral rule: ALL
  contact/pipeline — and now KB — changes in MasterSuite) — **Medium →
  Low after route removal**
- Domain-5 tail unchanged: Zorakle receiver, related-people panel,
  journey-doc upload (embeddings no longer block it — it's now just S3 +
  extract), old-app write-route removal — **Low**
- Domain-4 tail: drop `call_coaching`, sig enforcement flip — **Low**
- App-side Scout chat stays on the frozen KB + trailing copies until the
  app dies (domain 7) — deprecated by design — **accepted**
- The failed call 27fde167's KB merge was lost (its KbIntelItems
  snapshot survives on the call row; extractions + grade committed).
  After #752 deploys, a manual agent re-run on that call would recover
  it — suggestions upsert as pending rows, so no dupes — **Low**

## Decisions Made

- **Embeddings: retire pgvector, no vector port, no external store** —
  lexical retrieval per the standing ruling (×3 in-repo precedents);
  MariaDB 12.3 VECTOR recorded as future option. ADR-0016. — Claude
- **Retire-don't-port** (evidence-based): contact/territory brief
  generators (never ran, empty tables), rep_journals + system_logs +
  scout_retrieval_logs + scout_performance_reports (zero readers),
  user_memory (dead), pre-call-briefs cron (nothing durable). — Claude
- **KB authoring ships live, no flag** — the native KB is already the
  live KB; there is no competing writer. — Claude
- **journey_briefs leaves the push in the SAME window as the flag**
  (clobber pairing), sandbox half first — done. — Claude
- **Build dark → flip by migration, two PRs** (#753 build, #754 flip) —
  mirrors the domain-5 pattern; Corey controls the order. — Claude

## Files Created

- MS: `FrandevKbRetriever.cs`, `FrandevService.JourneyBrief.cs`,
  `IFrandevService.JourneyBrief.cs`,
  `Migrations/2026-08-10-256_FrandevDomain6CutoverOn.sql`,
  `FrandevKbRetrieverTests.cs`, `FrandevJourneyBriefTests.cs`
- Sandbox: `docs/adr/0016-domain-6-flip-scout-rag-chiron-kb.md`

## Files Modified

- MS: `FrandevConfig.cs` (2 flags), `FrandevService.ScoutContext.cs`
  (ranked path + telemetry), `IScoutContextSource.cs` + `ScoutAgent.cs`
  (queryText), `FrandevService.Knowledge.cs` + `IFrandevService.cs`
  (authoring), `Knowledge.cshtml(.cs)` (editor),
  `FrandevService.{Writes,Board,WritesTasks,PostCall}.cs` (stale marks
  ×7), `JourneyV2.cshtml.cs` (on-visit regen), `FrandevAgentsJobs.cs` +
  `HangfireConfiguration.cs` (nightly job),
  `AiSpend{Model,Rollup,Service}.cs` + `DataAccessLayer.AiSpend.cs`
  (FranDev source), `FrandevService.PostCallPrompts.cs` +
  `FrandevPostCallTests.cs` (#752)
- Sandbox: `vercel.json` (3 crons out), `lib/mastersuite/push-frandev.ts`
  (11 tables out), `tests/critical-paths/scheduler-ownership.test.ts`
  (3 new pins), `docs/supabase-cutover-port-plan.md` (§11), `handoff.md`

## Files Deleted

- None (2 MS worktrees added: wt-d6-build, wt-d6-flip, plus wt-d6-kbfix —
  remove after merges)

## Open Issues Carried Forward

All standing traps stand (CHAR(36)→Guid CAST; MariaDB not MySQL;
verified WRITE proves nothing about the READ; minted-JWT recipe; green
build proves nothing about SQL; git hook misparses "push <word>" in
compound commands — use `-F` files and keep `git push` standalone;
solution at `apps/analysis-api/MasterSuite.sln`; ⚠ Vercel writes PROD
Supabase + reads the PROD journal; sandbox prod DB grant = SELECT +
frandev** writes; new `frandev**`table needs migration + grant same PR;
local-run recipe + kill port 5199 first;`dotnet test`from`apps/analysis-api/`; Hangfire dashboard trigger POSTs return 500 — wait
for the cron tick). Plus:

- **Held until FranDev is fully off Vercel (Corey, s96)**: the four
  nightly jobs deliberately unscheduled — NOTE: journey briefs are now
  native (#753), and contact/territory briefs were retired-not-ported,
  so this held item largely DISSOLVED with domain 6 — **re-review at
  domain 7**
- Ben's notes/chat GRANT — **Low**
- Carried code cleanups (charleston@, inline-edit ×3, ResolveUser dup,
  GetAvgCycleDays, "Group Call" label, empty DataAccess.Tests) — **Low**

## THE GAMEPLAN TO GET OFF VERCEL (domain scoreboard)

| #   | Domain                 | State                                                                       |
| --- | ---------------------- | --------------------------------------------------------------------------- |
| 1   | Properties/mirrors     | ✅ **DONE**                                                                 |
| 2   | EOS                    | ✅ **DONE**                                                                 |
| 3   | Workflows              | ✅ RESOLVED — archive, don't port                                           |
| 4   | Calls                  | ✅ **LIVE** — first-call watch open; tail = call_coaching drop, sig flip    |
| 5   | Contacts+pipeline      | ✅ **FLIPPED + LIVE** — tail small                                          |
| 6   | **Scout/RAG → Chiron** | ✅ **BUILT + sandbox FLIPPED** — completes when Corey merges #752→#753→#754 |
| 7   | Platform residue       | ⏳ dies with the app; then Supabase archives + held items unblock           |

**What is left, in order:**

1. **Merge the three MS PRs** (#752 fix → #753 dark build → #754 flip).
   Then verify per migration 256's block: KB RetrievalCount ticks on a
   Chiron question; a 'journey-briefs' agent_run row after the 22:00
   tick.
2. **Watch items**: first live Read.ai call E2E; overnight agent ticks
   (journals 11pm / coaching 7am / research Sun 2am) in
   `frandev_integration_log`; first native journey-brief regen.
3. **Domains 5+6 tail (fold into any session)**: remove/read-only the
   old app's write routes (contacts, pipeline, KB); native Zorakle
   receiver; related-people panel; journey-doc upload (now just
   S3 + extract).
4. **Domain 7**: platform residue dies with the app → archive Supabase →
   held items unblock. The remaining Vercel crons after this session:
   research-territories, refresh-ghl-token, 4 workflow crons (domain 3,
   archived-not-ported — retire with the app), sync-ghl-calendar, and
   the two bridge crons.

**Nothing on the critical path waits on anyone except the 3 PR merges.**

## Exact Next Step

Merge MS #752 → #753 → #754 (in order). After deploy, verify domain 6
live per migration 256's verify block (KB RetrievalCount ticks on a
Chiron KB question; 'journey-briefs' agent_run after the 22:00 local
tick), spot-check the overnight agent runs + first Read.ai delivery in
`frandev_integration_log`, then start the domains-5/6 tail sweep
(old-app write-route removal first — it closes the "make all changes in
MasterSuite" behavioral rule).

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Domain 6 is BUILT and the sandbox half is FLIPPED (ADR-0016; MS PRs #752 kb-fix / #753 dark build / #754 flip migration await merge IN ORDER). First: check the PRs merged + deployed, then verify per migration 256's verify block (KB RetrievalCount ticks when Chiron answers a KB question; 'journey-briefs' agent_run row after the 22:00 local tick). Also verify the overnight native agent runs (journals 11pm, coaching 7am, research Sun 2am) and any first Read.ai delivery in frandev_integration_log. Then: domains-5/6 tail sweep — remove/read-only the old app's write routes (contacts, pipeline, KB), native Zorakle receiver, related-people panel, journey-doc upload (S3+extract, embeddings no longer needed). Reminder: ALL contact/pipeline/KB changes happen in MasterSuite now.

---
