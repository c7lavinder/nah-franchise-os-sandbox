# ADR-0016 — Domain-6 flip: Scout/RAG → Chiron KB, and the embeddings decision

- **Status:** Accepted
- **Date:** 2026-08-10
- **Decider:** Corey ("let's get through number 6 in gameplan"); landing
  zone resolved 2026-08-09 (fold into the Chiron KB — internal team
  knowledge, not a separate vector store)
- **Supersedes:** the domain-6 half of ADR-0002; narrows ADR-0013 (the
  retrieval brain) to app-lifetime-only — its Supabase machinery is not
  ported.

## Decision

The knowledge/retrieval domain goes native in MasterSuite, WITHOUT a
vector store. Query-aware knowledge selection for Chiron's FranDev chat
is lexical (term-overlap ranking, the `ChironKbRetriever` pattern — now
its fourth instance); KB authoring moves to `/frandev/knowledge`; the
journey-brief agent runs natively; the journals/weekly-report/
pre-call-briefs crons retire; 11 more tables leave the nightly push.

## The embeddings decision (the one open architecture call — closed)

**Retire pgvector. No vector port. No external vector service.**

- Three native retrievers already state "deliberately NO vector infra"
  as a standing ruling (`ChironKbRetriever` K2, `IntakeRetriever`,
  `GunnerGrading.Knowledge`). Domain 6 follows the house pattern rather
  than importing a second retrieval architecture for one module.
- The corpus is small: 58 KB docs. The app itself never ranked docs for
  chat — it bulk-loaded the top 25 by priority into every prompt. Ranked
  lexical selection is strictly better than what it replaces.
- Prod MariaDB is 12.3 — `VEC_FromText()` works (verified 2026-08-10),
  so native VECTOR columns are the recorded FUTURE option if lexical
  ever proves insufficient. Deliberately unused now.
- Consequences accepted: `frandev_contact_journal.EmbeddingId` stays
  NULL forever; semantic search over the ~70 pre-flip transcripts
  retires with the app (native transcript search, if ever wanted, will
  be lexical over `frandev_call_transcript`); Voyage AI + the 2,226-row
  Supabase `embeddings` index archive with the app.

## What flipped (2026-08-10)

**Sandbox (this commit):**

- Crons retired: `journals` (contact half double-ran with the native
  contact-journals agent since the domain-5 flip; rep + system halves
  wrote `rep_journals` / `system_logs` — zero readers anywhere),
  `weekly-report` (wrote `scout_performance_reports` — zero readers),
  `pre-call-briefs` (output was never stored durably; MS #733's native
  pre-call cue replaced it).
- Push retired for 11 tables: `embeddings` (inert longtext mirror of a
  pgvector index), `journey_briefs` (native agent owns it — clobber
  pairing), `objection_registry` (native post-call writes it since
  domain 4), `contact_briefs` + `territory_briefs` (empty in prod;
  generator cron never successfully ran — its route was POST-only while
  scheduled), `rep_journals`, `system_logs`, `scout_retrieval_logs`,
  `scout_performance_reports`, `kb_gap_signals` (write-only telemetry —
  the native retrieval writes its own), `user_memory` (dead, zero refs).

**MasterSuite (built dark, then armed by migration):**

- `FrandevKbRetriever` + query-aware grounding in Scout chat behind
  `Frandev_KbRetrieval_Ranked` (fallback: the exact pre-domain-6
  priority stuffing; approval-card turns and term-less greetings keep
  the broad KB). Native retrieval telemetry: per-doc RetrievalCount /
  LastRetrievedAt + `frandev_kb_gap_signal` on zero-hit — the KB health
  card had been showing numbers frozen at their Supabase values.
- KB authoring on `/frandev/knowledge` (create / edit / soft-archive;
  no flag — the native KB has been the live KB since domain 4, there is
  no competing writer to fence off). ALL KB edits happen in MasterSuite
  now; the app's knowledge page edits a frozen copy.
- Journey-brief agent behind `Frandev_JourneyBrief_Native` (nightly
  regen of stale briefs + native stale marks; replaces the app's
  event-driven route).
- `frandev_llm_call_log` folded into `/Admin/AiSpend` (the FranDev batch
  lane was invisible there; cost computed from tokens at the budget
  gate's own rates).

## What deliberately does NOT port (retire-with-app)

- The app-side retrieval brain (`lib/rag/*` — Voyage embedder, hybrid
  BM25+semantic search, reranker, question classifier) keeps serving the
  app's own Scout chat until the app dies. Chiron is the assistant of
  record.
- Contact + territory brief generators (never successfully scheduled;
  tables empty; no native reader).
- `scout_retrieval_logs` / `scout_performance_reports` / `rep_journals`
  / `system_logs` telemetry writers.
- `draft_knowledge_doc`'s dead-end suggestion path.

## What stays (bridge, until domain 7)

- The replay bridge (`apply-mastersuite-writes`) — unchanged; its
  `markJourneyBriefStale` calls now tend a frozen Supabase table
  (harmless).
- The push for `scout_user_memory`, `scout_action_logs`, `sessions`,
  `flagged_responses`, `commitments`, `suggestion_feedback`,
  `territory_market_data`, `journey_documents` and the
  dual-write-consistent CRM tables — app surfaces still read/write these
  until the old app's write routes retire (domain-5 tail / domain 7).
- `research-territories` cron (domain-1/6 tail, accepted: mirror-only
  market data with a native reader).

## Rollback

Set the flag(s) off. The retrieval flag falls back to priority stuffing
in the same code path. The journey-brief flag stops the native agent;
re-adding `journey_briefs` to the push would re-mirror the app's copy.
Cron re-adds are pinned against by `scheduler-ownership.test.ts` — a
rollback that needs one is a deliberate contract change, not a hotfix.
