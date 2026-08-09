# Session Handoff — 2026-08-09 — Session 103

## Status

Phase: **CUTOVER TRACK — the Ben logjam BROKE mid-session (billing fixed):
#718 merged + deployed, the eos cron is retired, domains 1+2 are DONE. Domain
4 step 1 (shadow Read.ai receiver) is BUILT, validated 421/421, and open as
MS PR #722.** / Health: Green / Duration: full session

## What Was Built This Session

- **Domain 4 step 1 — the shadow-mode Read.ai receiver (MS PR #722,
  branch `frandev-s103-readai-receiver`, worktree `wt-s103-readai`)**:
  `POST /api/hooks/read-ai` (HMAC verify → policy → dedupe →
  `frandev_read_ai_session` upsert → `frandev_integration_log` row), GET
  probe, dev-only replay harness `POST /api/hooks/read-ai-replay`. Ingest
  columns ONLY: new rows land `'pending'`; ProcessingStatus / CallType /
  ClassifiedAt / LinkedCallId are never touched on existing rows, so the
  nightly push and the #716 coaching feed keep winning until cutover. 9 new
  pins in `MasterSuite.Platform.Tests/Frandev/FrandevReadAiReceiverTests.cs`
  (externally computed HMAC vectors, UTC-seconds truncation, participant
  filter parity, rejection-policy table).
- **Signature policy DECIDED (was flagged for build time)**: accept-and-log
  by default; every delivery logs `sig=valid|invalid|missing`; SystemConfig
  `Frandev_ReadAi_RequireSignature='on'` flips enforcement; rejected
  deliveries still answer 200 (SignWell rule). Decided on evidence, not
  taste: `read_ai_webhook_keys` has ZERO rows in Supabase, the mirror is
  empty, and no `READ_AI_WEBHOOK_SIGNING_KEY_*` env exists anywhere — a
  reject default would drop 100% of live traffic at the flip. Recorded in
  port-plan §8 step 1.
- **The Ben chain executed the moment it unblocked**: GH Actions billing was
  discovered FIXED (CI runs completing with real durations from ~14:30 UTC);
  reran #718's dead check → green; merged #718 (14:48Z); deploy run
  31319436354 → success (live in prod); then merged the staged sandbox branch
  `s102-retire-sync-ms-eos` into main (318/318 tests + full `next build`
  before push) — the `sync-ms-eos` cron is retired.

## What Is Confirmed Working

**Measured, not predicted.**

- Replay of ALL 421 archived Read.ai deliveries through the C# mapper against
  the dev mirror: **421 matched / 0 mismatched / 0 parse failures** —
  timestamps to the second, participant arrays element-for-element.
- `writes=1` re-delivery of all 421 through the real ingest: **421 deduped /
  0 errors** — the complete-session dedupe gate holds against live data.
- E2E on the locally-running app (dev DB): synthetic probe ingested
  `'pending'` with classification columns null; DB-keyed signature verified
  both ways (`sig=valid` / `sig=invalid` logged); invalid JSON → the one 400;
  missing session_id → logged + 200. Probe + test key cleaned up after.
- `MasterSuite.Platform.Tests` 185/185 (gated suite); app project builds
  clean; sandbox suite 318/318 + `next build` green on the merged main.
- MS PR #718's check green on rerun; its deploy completed (success).
- **MS PR #722 went green (4m14s), merged 15:00:30Z, deployed, and the prod
  probe answers**: `GET https://mastersuiteapp.com/api/hooks/read-ai` →
  `{"status":"ok","endpoint":"read-ai-webhook"}` — the reverse proxy routes
  the path, so the step-6 URL flip has no infrastructure unknowns left.

## What Is Broken or Incomplete

- **GRANT SQL still not run** (`database/2026-08-09_grant_frandev_note_chat_write.sql`,
  30 sec at a prod terminal, Ben) — housekeeping; future notes won't sync
  until it runs — **Low**
- **Sandbox Vercel deploy of the merge commit `3194e53` not visually
  confirmed** (build passed locally with identical config; Vercel emails on
  failure) — check the dashboard shows the eos cron gone — **Low**
- `knowledge_documents.updated_by` → `UpdatedByUserId` mapping gap — fix in
  passing during domain 4 — **Low**
- Vercel property/revenue/L10/Scout-property surfaces frozen at Aug 9
  snapshot — BY DESIGN (ADR-0014) — **Low/FYI**
- Carried, all Low: `charleston@` office-named-as-person rename; three
  inline-edit implementations; `ResolveUser`/`ResolveUsername` duplicated;
  `updateCandidateScore`/`Flags` write on every event; `GetAvgCycleDays`
  uncalled; ungraded calls read "Group Call"; `DataAccess.Tests` empty

## Decisions Made

- **Read.ai signature policy** (above) — Claude, evidence-based; the
  enforcement flip is deliberately left for after key provisioning.
- **Merged #718 and the staged sandbox branch without waiting** — the repo's
  standing rule (CI is the gate, opener can merge; wait-gate retired by Corey
  2026-08-02) plus the handoff's own sequenced plan authorized both the
  moment CI came back. — Claude
- **New receiver rows land `'pending'` not `'processing'`** — nothing native
  advances them yet; `'processing'` would read as stuck. — Claude

## Files Created

- MS worktree `wt-s103-readai`: `Entities/Frandev/FrandevReadAi.cs`,
  `MasterSuite.Modules.Frandev/FrandevService.ReadAi.cs`,
  `MasterSuite.Modules.Frandev/IFrandevService.ReadAi.cs`,
  `MasterSuite/FrandevHooks.cs`,
  `MasterSuite.Platform.Tests/Frandev/FrandevReadAiReceiverTests.cs`

## Files Modified

- MS: `MasterSuite/Program.cs` (`app.MapFrandevHooks()`)
- Sandbox main: `docs/supabase-cutover-port-plan.md` (§8 step 1 marked BUILT +
  policy decision + the #716 coaching-feed consumer note), `handoff.md`,
  plus the merge of `s102-retire-sync-ms-eos` (`vercel.json` −1 cron,
  `scheduler-ownership.test.ts`)

## Files Deleted

- None (dev-DB probes and the test signing key were cleaned up in-session)

## Open Issues Carried Forward

All standing traps stand (MySqlConnector CHAR(36)→Guid; verified WRITE proves
nothing about the READ; minted-JWT prod-driving recipe; MariaDB not MySQL;
green build proves nothing about SQL; git hook misparses "push <word>" — commit
with `-F <file>`; solution at `apps/analysis-api/MasterSuite.sln`; ⚠ Vercel
WRITES PRODUCTION; ⚠ new `frandev_` table needs migration + grant in the SAME
PR; replay batch limit 50; the inbound EOS sync never deleted — Supabase
`eos_territory_*` is a historical superset). Plus:

- **Local-run recipe that works**: `dotnet run --no-launch-profile` with
  `ASPNETCORE_URLS=http://localhost:5199` — launchSettings.json otherwise
  OVERRIDES the port (7128, usually taken) and BLANKS `NAH_DB_PASSWORD`.
  DB creds come from `~/.zshrc` (`NAH_DB_*`); query MariaDB via node
  `mysql2` (no mysql CLI on this Mac).
- **`sync-ms-territories` does NOT retire until the domain-5 flip** (FK
  reference + pipeline seeding; ADR-0014 Correction) — **FYI**
- **Held until FranDev is fully off Vercel (Corey, s96)**: four nightly jobs
  deliberately unscheduled; journey briefs ~3,175-LLM-call run — **carried**

## THE GAMEPLAN TO GET OFF VERCEL (domain scoreboard)

| #   | Domain                | State                                                           |
| --- | --------------------- | --------------------------------------------------------------- |
| 1   | Properties/mirrors    | ✅ **DONE** — #718 merged + deployed 2026-08-09                 |
| 2   | EOS                   | ✅ **DONE** — native tab live on originals; eos cron retired    |
| 3   | Workflows             | ✅ RESOLVED — archive, don't port (no build)                    |
| 4   | **Calls**             | 🔨 **IN BUILD** — step 1 of 6 MERGED + live (#722); step 2 next |
| 5   | Contacts + pipeline   | ⏳ after 4 — the big one (core CRM)                             |
| 6   | Scout/RAG → Chiron KB | ⏳ after 5 — decision resolved, build pending                   |
| 7   | Platform residue      | ⏳ dies with the app                                            |

Off Vercel = domains 4 + 5 built natively + webhook re-pointed + Supabase
archived. **Nothing on the critical path waits on Ben anymore** (GRANT is
Low housekeeping).

## Exact Next Step

Build port-plan §8 step 2 in a fresh MS worktree: the classifier + 3 processors
(prospect / coaching+onboarding / group+internal) behind a SystemConfig flag,
writing `frandev_call` + transcript + participants + junctions, validated by
replaying archived payloads against known Supabase output (same harness
pattern as step 1 — the corpus and diff loop are already in
`FrandevService.ReadAi.cs`).

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Build port-plan §8 step 2: classifier + 3 processors behind a SystemConfig flag in the MasterSuite repo, validated by replaying archived payloads against known Supabase output (the step-1 receiver #722 is merged + live; its replay harness pattern is in FrandevService.ReadAi.cs). Ben items left: just the GRANT SQL (Low). Do NOT retire sync-ms-territories (domain-5 exit).

---
