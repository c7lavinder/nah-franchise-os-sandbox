# ADR-0015 — Domain-5 flip: contacts + pipeline go native in MasterSuite

- **Status:** Accepted
- **Date:** 2026-08-09
- **Decider:** Corey ("get rest of 5 completed"), executed same-day
- **Supersedes:** the domain-5 half of ADR-0002 (Supabase as app-state
  source of truth). With domains 1–5 flipped, Supabase remains master only
  for domain 6 (Scout/RAG/KB) and domain 7 (platform residue).

## Decision

MasterSuite's MariaDB is now the system of record for the core CRM —
contacts, journeys, pipeline placement, profile data, agent outputs. The
sandbox app's inbound domain-5 syncs and agent crons are retired; the
native twins (built dark across MS PRs #741/#746/#747) are armed by
migration 255.

## What flipped (one window, 2026-08-09 evening)

**Sandbox (this commit):**

- Crons retired: `sync-ms-prospects` (native lead intake owns inflow),
  `sync-ms-territories` + `runway-pipeline-guardian` (native runway
  derivation owns jps placement), `research-contacts`,
  `reengagement-scan`, `coaching-brief` (native Hangfire agents own them).
- Push retired for the 10 tables whose native writers do NOT journal —
  `contacts`, `journey_pipeline_state`, `contact_profile_fields`,
  `contact_journals`, `contact_scores`, `notifications`,
  `candidate_intelligence`, `candidate_score_history`,
  `data_update_suggestions`, `eos_contact_goals` — a nightly upsert of
  Supabase's trailing copies would clobber live native rows.

**MasterSuite (migration 2026-08-09-255):** four flags on —
`Frandev_LeadIntake_Native`, `Frandev_Ghl_NativeStageSync`,
`Frandev_RunwayDerivation_Native`, `Frandev_Agents_Native`. GHL
sub-account credentials + stage-field map were already live (#746).

**Gate passed before arming:** the prod runway dry-run returned 0 inserts
/ 0 deactivations / 0 errors; its only 2 updates are live-evidence
corrections the old system could not see (its property facts froze at the
domain-1 flip).

## What deliberately did NOT flip

- **The bridge stays.** `apply-mastersuite-writes` keeps replaying native
  writes into Supabase (Supabase becomes a trailing copy so Scout, briefs,
  and remaining app readers stay fresh until domain 6), and `push-frandev`
  keeps carrying the non-retired tables.
- **Dual-write-consistent tables stay in the push** (journeys,
  journey_contacts, pipeline_stage_history, sub-task logs, notes, tasks,
  pipeline config, briefs, emails, satellites): their native writes replay
  1:1 by minted id, so the push is idempotent over them. They retire when
  the sandbox write surfaces retire.
- **The `journals` cron stays** — its rep-journal + system-log halves are
  domain 6/7; its contact-journal half now double-runs (app copy feeds
  Scout/RAG until domain 6; native copy feeds the mirror). Accepted:
  separate stores, separate readers, small Haiku spend.
- **Journey/contact brief agents stay app-side** — they are
  retrieval-coupled and port with domain 6.

## Consequences and accepted risks

1. **Old-app pipeline/contact WRITES no longer reach the mirror** (their
   tables left the push). All contact and pipeline changes must be made in
   MasterSuite from now on. The old app's domain-5 write surfaces get
   removed in a follow-up; until then a move made there is visible only
   there. The replay keeps native writes flowing the other way, so nothing
   made natively is ever lost.
2. **Lead intake gap-and-catch-up:** leads that arrived between the cron
   retirement and the flag arming are picked up by the native intake's
   cursorless NOT-EXISTS scan — no loss, minutes of delay.
3. **Domain-5 tail (small, non-blocking):** a native Zorakle webhook
   receiver (until then zorakle data freezes at its last push state), a
   related-people panel, native journey-document upload (embeddings ride
   domain 6), and removing the old app's domain-5 write routes.

## Rollback

Set the four flags off (migration or connect-hook pattern) and restore the
crons/push entries from this commit's parent. The replay never stopped, so
Supabase is at most minutes behind at any point — the same recipe as the
domain-4 rollback, with the journal as the safety net.
