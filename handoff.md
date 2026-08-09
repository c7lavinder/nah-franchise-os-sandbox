# Session Handoff — 2026-08-09 — Session 102

## Status

Phase: **CUTOVER TRACK — Ben items verified still pending (billing, GRANT, #718);
sync-ms-eos retirement PRE-STAGED on a branch; domain 4 (calls) SCOPED and
parity-verified — it is the next build and nothing in it waits on Ben.** /
Health: Green / Duration: short session

## What Was Built This Session

- **All three Ben blockers re-verified live** (not assumed from s101): GitHub
  Actions billing still broken org-wide (runs die in ~4s; Corey is repo ADMIN
  but org MEMBER — cannot reach Billing & plans); the GRANT is still not run
  (`SHOW GRANTS` shows no `frandev_note`/`frandev_journey_chat` write); PR #718
  is OPEN + MERGEABLE, blocked only on the dead CI check (failed run
  31316067018 — just needs `gh run rerun` after billing is fixed).
- **GRANT urgency downgraded with evidence**: the nightly push is GREEN — the
  2026-08-09 11:31 UTC run pushed 104,844 rows / 92 tables to PROD, 0 errors
  (`cron_job_log`). The 3 "unpushable" notes are the SAME UUIDs already in prod
  — soft-deleted s99 test probes that went native→Supabase. Nothing user-facing
  waits on the GRANT; it is housekeeping so future notes sync.
- **sync-ms-eos retirement PRE-STAGED**: sandbox branch `s102-retire-sync-ms-eos`
  commit `e4b3cfa` — `vercel.json` −1 cron; `scheduler-ownership.test.ts` moves
  eos to the must-stay-retired list (kept = territories + prospects only).
  Mutation-tested red/green; 318 tests pass. **Merge ONLY after #718 is live in
  prod** — merging early freezes the native EOS tab.
- **Port-plan decision 5 RESOLVED (Corey): the 52 app-created EOS rows are
  DISCARDED, not migrated** — all are the 2026-04-14 Q2 agent-extraction batch
  (`ms_id IS NULL` in `eos_territory_*`), stale/undone/near-duplicated. Recorded
  in `docs/supabase-cutover-port-plan.md` §7.5 (commit `d6bc4fe`). Closes the
  s101 open issue.
- **Domain 4 (calls) SCOPED, code-verified** — port-plan §8 (commit `f8762b8`):
  the plan's "map into gunner tables" was WRONG (`gunner_call*` = acquisitions
  domain). The 16 `frandev_call*` mirrors exist AND the native read surface is
  already built (`Pages/Frandev/Calls.cshtml`, `Call.cshtml`, `CallsV2`, DayHub
  panel). The real port is the WRITE side only: webhook receiver → classifier +
  3 processors → transcript-job worker → parity-gated grader → settings UI →
  flip the Read.ai webhook URL.

## What Is Confirmed Working

**Measured, not predicted.**

- Nightly outbound push to PROD: 104,844 rows / 92 tables / 0 table errors
  (2026-08-09 11:31 UTC run, `cron_job_log`).
- Domain-4 column parity: dry-run push of all 21 call-domain tables against the
  prod schema — 23,366 rows read+mapped, 0 errors, 0 skipped. Only gap:
  `knowledge_documents.updated_by` has no mapped mirror column (cosmetic;
  `UpdatedByUserId` exists but the pluralizer doesn't connect them).
  `UpdatedAt` mirror columns are DB-maintained — expected unmapped.
- The staged retirement branch: scheduler-ownership guard fails when the eos
  cron is re-added and passes when absent (mutation test), full suite 318/318.
- The 3 prod `frandev_note` rows verified identical to the 3 Supabase rows
  (same UUIDs, all soft-deleted probes) — confirmed nothing real is stuck.

## What Is Broken or Incomplete

- **GitHub Actions billing-blocked org-wide** — nothing merges anywhere until
  an org admin (Ben) fixes Billing & plans — **High (blocks all merges)**
- **PR #718 awaits billing fix → CI rerun → merge → deploy** via Ben's release
  train — **Medium (sequenced, not broken)**
- **GRANT SQL not yet run** (`database/2026-08-09_grant_frandev_note_chat_write.sql`,
  30 sec at a prod terminal) — downgraded to housekeeping; future notes won't
  sync until it runs — **Low (was Medium)**
- Branch `s102-retire-sync-ms-eos` must NOT merge before #718 is live —
  **guard-railed by test + commit message** — **FYI**
- `knowledge_documents.updated_by` → `UpdatedByUserId` mapping gap — fix in
  passing during domain 4 — **Low**
- Vercel property/revenue/L10/Scout-property surfaces frozen at Aug 9 snapshot —
  BY DESIGN (ADR-0014) — **Low/FYI**
- Carried, all Low: `charleston@` office-named-as-person rename; three
  inline-edit implementations; `ResolveUser`/`ResolveUsername` duplicated;
  `updateCandidateScore`/`Flags` write on every event; `GetAvgCycleDays`
  uncalled; ungraded calls read "Group Call"; `DataAccess.Tests` empty

## Decisions Made

- **The 52 app-created EOS rows: discard, don't migrate** — they drop off the
  native tab when #718 deploys; they stay archived in Supabase. — Corey
- **GRANT reprioritized Low** — evidence: green nightly push; the 3 note rows
  are deleted probes already present in prod. — Claude (evidence-based)
- **Domain 4 build order** = the 6-step sequence in port-plan §8, starting with
  a shadow-mode ingest-only webhook receiver. — Claude (scoping), unopposed
- **Webhook signature policy must be decided at §8 step 1** — today's route
  accepts unsigned payloads; don't silently carry the hole OR silently drop
  live traffic. — flagged for Corey/Ben at build time

## Files Created

- Sandbox branch `s102-retire-sync-ms-eos` (commit `e4b3cfa`, NOT on main)
- (temp parity-check script created and removed in-session)

## Files Modified

- Sandbox main: `docs/supabase-cutover-port-plan.md` (§7.5 decision + row-4
  correction + new §8 domain-4 scoping; commits `d6bc4fe`, `f8762b8`),
  `handoff.md`
- On the staged branch only: `vercel.json`,
  `tests/critical-paths/scheduler-ownership.test.ts`

## Files Deleted

- None

## Open Issues Carried Forward

All standing traps stand (MySqlConnector CHAR(36)→Guid; verified WRITE proves
nothing about the READ; minted-JWT prod-driving recipe; MariaDB not MySQL;
green build proves nothing about SQL; git hook misparses "push <word>" — commit
with `-F <file>`; solution at `apps/analysis-api/MasterSuite.sln`; ⚠ Vercel
WRITES PRODUCTION; ⚠ new `frandev_` table needs migration + grant in the SAME
PR; replay batch limit 50; the inbound EOS sync never deleted — Supabase
`eos_territory_*` is a historical superset). Plus:

- **⚠ GH Actions org billing** — Ben, then `gh run rerun` #718's check — **High**
- **Merge `s102-retire-sync-ms-eos` ONLY after #718 is live in prod** — **Medium**
- **`sync-ms-territories` does NOT retire until the domain-5 flip** (FK
  reference + pipeline seeding; ADR-0014 Correction) — **FYI**
- **Held until FranDev is fully off Vercel (Corey, s96)**: four nightly jobs
  deliberately unscheduled; journey briefs ~3,175-LLM-call run — **carried**

## THE GAMEPLAN TO GET OFF VERCEL (domain scoreboard)

| #   | Domain                | State                                                             |
| --- | --------------------- | ----------------------------------------------------------------- |
| 1   | Properties/mirrors    | ✅ DONE app-side (ADR-0014); #718 merge finishes it               |
| 2   | EOS                   | ✅ BUILT (#718) — waits on Ben merge, then merge staged branch    |
| 3   | Workflows             | ✅ RESOLVED — archive, don't port (no build)                      |
| 4   | **Calls**             | 🔨 **NEXT BUILD** — scoped in §8, read side done, 6 sessions est. |
| 5   | Contacts + pipeline   | ⏳ after 4 — the big one (core CRM)                               |
| 6   | Scout/RAG → Chiron KB | ⏳ after 5 — decision resolved, build pending                     |
| 7   | Platform residue      | ⏳ dies with the app                                              |

Off Vercel = domains 4 + 5 built natively + webhook re-pointed + Supabase
archived. Everything Ben-blocked is in domains 1+2; **domain 4 proceeds now
without him.**

## Exact Next Step

Build port-plan §8 step 1 in the MasterSuite repo: a shadow-mode Read.ai
webhook receiver (ingest-only — HMAC verify + `frandev_read_ai_session`
upsert/dedupe + logging, NO call creation), validated by replaying archived
`raw_payload` rows and diffing against Supabase; decide the unsigned-payload
policy explicitly at this step.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Build port-plan §8 step 1 in the MasterSuite repo: a shadow-mode Read.ai webhook receiver (ingest-only — HMAC verify + frandev_read_ai_session upsert/dedupe + logging, NO call creation), validated by replaying archived raw_payload rows; decide the unsigned-payload policy explicitly. Ben items unchanged: fix GH billing → rerun #718's check → merge #718 → run the GRANT SQL. After #718 is live in prod, merge sandbox branch s102-retire-sync-ms-eos. Do NOT retire sync-ms-territories (domain-5 exit).

---
