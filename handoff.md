# Session Handoff — 2026-08-09 — Session 106

## Status

Phase: **CUTOVER TRACK — DOMAIN 5 (contacts + pipeline) FLIPPED AND LIVE,
with first native runs OBSERVED on prod. One session took domain 5 from
"scoping is next" through all 7 build steps, the flip itself (ADR-0015 +
MS migration 255), instant lead intake, and live verification: the first
native lead import (3 real leads) and the first native runway application
(the 2 corrections the dry-run predicted) both ran clean on production.
MariaDB is the CRM's system of record; Supabase trails via the replay
bridge until domain 6. Also: MS #740 fixed the post-call profile
auto-save before the first live call hits it.** / Health: Green /
Duration: full session

## What Was Built This Session

Six MS PRs (#740, #741, #746, #747, #749, #751 — all merged + deployed)
and eight sandbox commits. By wave:

- **Scoping (3 parallel inventories)** → port-plan **§10**: every domain-5
  write path, all 18 crons/syncs mapped, MS native-surface inventory.
- **MS #740** — post-call auto-save fix (prod probe found it pre-first-
  call): `SourceHistory` NOT-NULL omission + saves now journal
  `update_profile_field` source `ai-auto`; sandbox replay honors the
  label, manual always wins.
- **MS #741 — build steps 1/2/3/5, dark**: `FrandevGhl.cs` (sub-account
  GHL door + `Frandev_GhlStageFieldMap` + smoke hook);
  `FrandevService.LeadIntake.cs` (sync-ms-prospects 1:1, spam rules
  test-pinned, wire-existing branch, journals
  `intake_contact`/`wire_sales_journey`); `FrandevService.GhlStageSync.cs`
  (`ghl_synced` ownership handshake on advance/revert/board/close);
  `FrandevRunwayRules.cs` + `FrandevService.RunwayDerivation.cs` (pure
  placement ladder + dry-run parity instrument).
- **MS #746** — the authenticated GHL connect hook
  (`/api/hooks/frandev-ghl-connect`, jwt-cookie, validate-before-store);
  driven via minted JWT with Corey's PIT + location id
  (0WYp7DssxULm1SJYaOsz — the same location the sandbox uses). Prod + dev
  store creds + auto-resolved stage map. Smoke reads "connected".
- **MS #747 — build step 4 + Settings**: four agents dark behind
  `Frandev_Agents_Native` (contact journals nightly / research weekly,
  TS-whitelist-gated into the EAV profile store / reengagement monthly /
  coaching briefs daily) on the shared LLM budget;
  `FrandevCandidateScoreRules` (11 pins) + post-call auto-saves recalc
  scores (the #734 dangling hook, closed); **Settings integrations tab
  (FranDev lens) cutover card** — sub-account status + who-runs-what.
- **MS #749 — THE FLIP**: migration `2026-08-09-255_FrandevDomain5CutoverOn.sql`
  arms the four flags. Sandbox half (8189d1e): 6 crons retired
  (sync-ms-prospects/-territories, guardian, research-contacts,
  reengagement-scan, coaching-brief), 10 mirror-only tables out of the
  push, scheduler-ownership contract updated, **ADR-0015** filed.
- **MS #751 — instant lead intake** (Corey: "I need it to be instant"):
  both franchise-form completion paths `TriggerJob` the intake on
  submit; the 10-min sweep stays as backstop.
- **Sandbox replay**: handlers for `intake_contact`/`wire_sales_journey`,
  the `ghl_synced` skip ×4, and the switchover-double guard (same
  ghl_contact_id under a different uuid → settle, don't duplicate).
- Also: `requireAuth` added to the pipeline drop route;
  `contact_pipeline_state` removed from the push list.

## What Is Confirmed Working

**Measured on PRODUCTION, post-flip:**

- **All 5 `Frandev_*Native` flags 'on'**; all 9 frandev Hangfire jobs
  registered (3 calls + intake, runway, journals, research,
  reengagement, coaching).
- **First native lead import**: scanned 16 / **created 3** (Warren Bara,
  Pramod Abraham, Andrew Colman) / dup 13 / spam 0 / **0 errors**.
- **First native runway application**: insert 0 / **update 2** /
  deactivate 0 / 0 errors — exactly the two corrections the pre-flip
  dry-run gate predicted (GREENB → running at 3 purchases; LAFALA →
  first-completed). The old system had been placing from evidence frozen
  at the domain-1 flip.
- **Switchover overlap handled**: the 3 leads' journal rows settled
  manually (old sync had imported them Supabase-side in its final runs);
  the replay now guards this permanently by ghl_contact_id.
- **GHL sub-account connected** (prod + dev): smoke = "connected", stage
  map resolved (sales WE90XmjQ…, followup NNIqrzmi…, onboarding
  bOjnT44u…).

**Measured on dev during the build**: intake E2E 24 scanned / 12 created /
1 wired / 0 errors (extras on columns, wire branch proven); runway parity
0/0/0 + 3 honest-drift updates; agents flag-on E2E (reengagement 2/2,
research 1/1 — the run caught the ungated registry writing
'location'/'email', now TS-whitelist-gated); #740's INSERT shapes
round-tripped. MS: **5751 platform tests** (41 new pins). Sandbox:
**328 vitest**, tsc clean, next build green — every commit.

## What Is Broken or Incomplete

- **No live Read.ai delivery observed yet** (domain 4, flipped Saturday
  evening; nothing has ended a meeting since) — first-call E2E
  verification still pending — **Medium (watch)**
- **Old app's domain-5 write routes still exist**: a contact/pipeline
  change made there reaches only Supabase now (its tables left the push).
  Until those routes are removed/read-only'd: **make ALL contact and
  pipeline changes in MasterSuite** — **Medium (behavioral, then Low
  after route removal)**
- **Native Zorakle webhook receiver not built** — zorakle data frozen at
  its last push state until it exists (read-ai receiver pattern) — **Low**
- Related-people panel + native journey-document upload (embeddings ride
  domain 6) — no native surface yet — **Low**
- Journey/contact **brief agents remain app-side** (retrieval-coupled;
  port with domain 6); `journals` cron kept for its rep/system halves —
  its contact half now double-runs by design (separate stores, separate
  readers, small Haiku spend) — **Low (accepted)**
- Domain-4 tail unchanged: drop `call_coaching`, flip signature
  enforcement after a week of sig=valid — **Low**
- Territory market-data + objection-registry auto-saves still
  mirror-only (domains 1/6) — **Low (accepted)**

## Decisions Made

- **Execute the flip same-session** — Corey ("get rest of 5 completed");
  order: parity gate → sandbox crons/push out → flags on. — Corey
- **Instant lead intake** — Corey ("I need it to be instant");
  implemented as TriggerJob-on-submit with the sweep as backstop. — Corey
- **The replay bridge STAYS post-flip** — Supabase trails native writes
  so Scout/briefs stay fresh until domain 6; only the 10 mirror-only
  tables left the push (dual-write-consistent tables stay until the old
  app's write routes retire). — Claude
- **FranDev GHL = the existing sub-account** via PIT (never the sandbox's
  OAuth chain — rotation would fork it); connect hook validates before
  storing; field ids resolved per-location. — Corey/Claude
- **Settings cutover card is status-only** — every flip pairs a flag with
  a cron retirement in one window; not page-clickable. — Claude
- **Research findings land in the EAV profile store** the native Profile
  tab reads (TS whitelist + registry + manual protection), not the flat
  mirror nothing reads; journal embeddings + brief agents defer to
  domain 6; suggestion dedupe simplified to pending-row upsert. — Claude
- Activity messages (@-mentions) **archived** — native journey chat
  supersedes. — Claude

## Files Created

- MS: `FrandevGhl.cs`, `FrandevRunwayRules.cs`,
  `FrandevCandidateScoreRules.cs`,
  `FrandevService.{LeadIntake,GhlStageSync,RunwayDerivation,GhlConnect,Agents,CoachingBrief,CandidateScoring}.cs`,
  `IFrandevService.{LeadIntake,RunwayDerivation,GhlConnect,Agents}.cs`,
  `Jobs/{FrandevLeadIntakeJobs,FrandevAgentsJobs}.cs`,
  `Migrations/2026-08-09-255_FrandevDomain5CutoverOn.sql`, 3 test files
  (41 pins)
- Sandbox: `docs/adr/0015-domain-5-flip-contacts-pipeline-native.md`

## Files Modified

- MS: `FrandevConfig.cs` (4 flags), `FrandevService.Writes.cs` +
  `.Board.cs` (ghl_synced ×4), `FrandevService.PostCall.cs` (score hook),
  `FrandevService.PostCallWrites.cs` (#740), `FrandevHooks.cs` (5 hooks),
  `FrandevWriteExtras.cs`, `Pages/Gunner/Settings.cshtml`(+`.cs`)
  (cutover card), `FormsService.cs` (instant trigger ×2), Frandev csproj
  (+Gunner ref), `DependencyInjectionConfig.cs`,
  `HangfireConfiguration.cs` (6 jobs)
- Sandbox: `lib/mastersuite/apply-native-writes.ts` (2 new handlers +
  ghl_synced skip + double-guard + ai-auto), `lib/mastersuite/push-frandev.ts`
  (11 tables retired), `vercel.json` (6 crons out),
  `tests/business-logic/apply-native-writes.test.ts` (+8),
  `tests/business-logic/push-frandev-naming.test.ts`,
  `tests/critical-paths/scheduler-ownership.test.ts` (contract updated),
  `app/api/contacts/[contactId]/pipelines/[pipelineId]/drop/route.ts`,
  `docs/supabase-cutover-port-plan.md` (§10 complete), `handoff.md`

## Files Deleted

- None (all E2E rows cleaned in-session on dev; the 3 prod journal rows
  settled, not deleted; 5 worktrees removed after merges)

## Open Issues Carried Forward

All standing traps stand (CHAR(36)→Guid CAST; MariaDB not MySQL —
JSON*VALID CHECKs need serialized JSON; verified WRITE proves nothing
about the READ; minted-JWT recipe — also drives the connect hook; green
build proves nothing about SQL; git hook misparses "push <word>" ANYWHERE
in a compound command — use `-F` files and keep `git push` standalone;
solution at `apps/analysis-api/MasterSuite.sln`; ⚠ Vercel writes PROD
Supabase + reads the PROD journal; sandbox prod DB grant = SELECT +
frandev*_ writes only, SystemConfig needs the connect-hook/migration
paths; new `frandev\__`table needs migration + grant same PR; local-run`dotnet run --no-launch-profile`+`ASPNETCORE_URLS=http://localhost:5199`— AND kill port 5199 first, a stopped wrapper can orphan the dotnet
child;`dotnet test`from`apps/analysis-api/`; Hangfire dashboard
trigger POSTs return 500 — wait for the cron tick instead). Plus:

- **Held until FranDev is fully off Vercel (Corey, s96)**: four nightly
  jobs deliberately unscheduled; journey briefs ~3,175-LLM-call run —
  **carried**
- Ben's notes/chat GRANT — **Low**
- Carried code cleanups (charleston@, inline-edit ×3, ResolveUser dup,
  GetAvgCycleDays, "Group Call" label, empty DataAccess.Tests) — **Low**

## THE GAMEPLAN TO GET OFF VERCEL (domain scoreboard)

| #   | Domain                | State                                                                    |
| --- | --------------------- | ------------------------------------------------------------------------ |
| 1   | Properties/mirrors    | ✅ **DONE**                                                              |
| 2   | EOS                   | ✅ **DONE**                                                              |
| 3   | Workflows             | ✅ RESOLVED — archive, don't port                                        |
| 4   | Calls                 | ✅ **LIVE** — first-call watch open; tail = call_coaching drop, sig flip |
| 5   | **Contacts+pipeline** | ✅ **FLIPPED + LIVE + first runs verified** — tail small (see below)     |
| 6   | Scout/RAG → Chiron KB | ⏳ **NEXT** — decision made (Chiron KB), build pending                   |
| 7   | Platform residue      | ⏳ dies with the app; then Supabase archives + held items unblock        |

**What is left, in order:**

1. **Watch items (this week)**: first live Read.ai call E2E; a few days
   of native intake/runway/agent runs in `frandev_integration_log`
   (agents' first ticks: journals 11pm, coaching 7am, research Sunday).
2. **Domain-5 tail (fold into any session)**: remove/read-only the old
   app's contact+pipeline write routes; native Zorakle receiver;
   related-people panel; journey-doc upload; then retire the remaining
   dual-write tables from the push.
3. **Domain 6 — Scout/RAG → Chiron KB (the next build)**: un-freezes the
   KB story (Supabase copy frozen since domain 4), ports the brief
   agents, retires the journals cron + embeddings decision, shrinks the
   replay + push again.
4. **Domain 7**: platform residue dies with the app → archive Supabase →
   the held items unblock.

**Nothing on the critical path waits on anyone.**

## Exact Next Step

Verify the first live Read.ai delivery processed natively end-to-end
(prod: `frandev_integration_log` webhook_received → `frandev_call` →
transcript → grade + KB within ~10 min) and spot-check the overnight
native agent runs (journals 11pm, coaching 7am in
`frandev_integration_log` / `frandev_notification`), then start domain 6
(Scout/RAG → Chiron KB) scoping.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Domain 5 is FLIPPED and LIVE (ADR-0015; first native lead import + runway run verified on prod). First: verify the newest Read.ai delivery processed natively end-to-end on prod (frandev*integration_log → frandev_call → transcript → grade/KB ≤10 min) AND spot-check the overnight native agent runs (contact journals, coaching briefs in frandev_integration_log). Then start domain 6 scoping: Scout/RAG → Chiron KB (the resolved landing zone) — inventory scout*\*, knowledge_documents, embeddings readers/writers, port the journey/contact brief agents, plan the journals-cron retirement. Domain-5 tail items are Low: old-app write-route removal, Zorakle receiver, related-people panel, doc upload. Reminder: ALL contact/pipeline changes happen in MasterSuite now.

---
