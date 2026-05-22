# Session Handoff — 2026-05-22 — Session 53

## Status

Phase: Retrieval Brain Phase 7+8 complete / Health: Green / Duration: full session

## What Was Built This Session

### Phase 7 — Stabilization (all 7 critical/significant gaps closed)

- **Gap #1:** Wired `embedExternalResearch()` into document upload route — uploaded docs now searchable
- **Gap #2:** Added delete-before-embed to `embedTranscript()` — re-processed transcripts get fresh embeddings
- **Gap #3:** Embedding health check in `/api/admin/sync-status` + new `/api/admin/repair-embeddings` endpoint
- **Gap #5:** Pre-fetch now scoped to `pageContext.contactId` — contact pages get relevant chunks
- **Gap #7:** Journal entries get contextual chunking (contact name + date prepended before embedding)
- **Gap #8:** External research gets contextual chunking (contact name, document title, document type)
- **Gap #9:** Single `hybridSearch` call replaces double search-then-rerank in pre-fetch

### Phase 8 — Trust & Measurement

- **Gap #6:** Brief summaries embedded as `profile_summary` content type on generation (contact + territory)
- **Gap #14:** Stale briefs regenerate on-demand in `get_entity` (~1-2s) instead of waiting for nightly cron
- **Gap #17:** `model_version` column on embeddings table — populated on insert, migration applied
- **Source attribution:** `sourceId` included in all search tool results (knowledge, transcripts, documents), citation instructions added to Scout system prompt, source metadata in pre-fetch context
- **Eval framework:** 20 Q&A pairs across 9 question types, run via `npm run eval:retrieval`, scores classification accuracy, content type coverage, keyword hit rate, similarity
- **Phase 7+ plan:** Revised sprint plan committed at `docs/retrieval-brain-phase-7-plan.md`

## What Is Confirmed Working

- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 13 files, 129 tests, all passing
- `npx next build` — clean build, no ESLint errors
- Migration applied on Supabase (`model_version` column + index confirmed live, 2102 rows backfilled)
- All prior migrations confirmed applied (`contact_briefs`, `territory_briefs`, `scout_retrieval_logs`, `voyage_ai_bm25_hybrid_search`)
- All commits pushed to main, Vercel auto-deployed

## What Is Broken or Incomplete

- **Retrieval quality dashboard deferred** — query `scout_retrieval_logs` directly for now — Low
- **`get_entity(journey)` enrichment deferred** — member scores + documents + call summary not added yet — Low
- **Eval baseline not yet locked** — need to run `npm run eval:retrieval` against live Supabase to capture baseline scores. Do this early in Session 54.

## Decisions Made

- Combined Phase 7 gaps into one commit (speed over granularity) — Corey approved
- Phase 7+ plan revised: 8 phases (7-14), Phase 11 conditional on eval gate, Daily HQ gets its own phase
- Enrichment (Phase 12) triggers from NAH OS contact creation route, not GHL webhooks
- Eval set starts at 20 pairs, expand to 50 over time — don't block Phase 9 on 50
- Source attribution uses `[Source: title]` format in Scout responses (not clickable links yet — deferred to Phase 13)

## Gaps Resolved This Session

| Gap                                      | Severity    | Resolution                     |
| ---------------------------------------- | ----------- | ------------------------------ |
| #1 — Uploaded documents never embedded   | Critical    | Wired into upload route        |
| #2 — Transcript embeddings never updated | Critical    | Delete-before-embed added      |
| #3 — No embedding failure visibility     | Critical    | Health check + repair endpoint |
| #5 — Pre-fetch ignores active contact    | Significant | contactId passed through       |
| #6 — Briefs not embedded                 | Significant | Embedded as profile_summary    |
| #7 — Journal entries lack context        | Significant | contextualizeJournalChunk()    |
| #8 — External research lacks context     | Significant | contextualizeExternalChunk()   |
| #9 — Double reranking                    | Significant | Single hybridSearch call       |
| #14 — Briefs stale up to 24h             | Moderate    | On-demand regen in get_entity  |
| #17 — No embedding versioning            | Low         | model_version column added     |

## Gaps Remaining (from original 20)

| Gap                                         | Severity    | Status                                   |
| ------------------------------------------- | ----------- | ---------------------------------------- |
| #4 — Regex classifier                       | Significant | Deferred to Phase 13                     |
| #10 — No territory-scoped transcript search | Moderate    | Deferred to Phase 13                     |
| #11 — Fixed chunk sizes                     | Moderate    | Deferred to Phase 13                     |
| #12 — BM25 lacks NAH terms                  | Moderate    | Deferred to Phase 13                     |
| #13 — No retrieval feedback loop            | Moderate    | Deferred to Phase 15+                    |
| #15 — Rough token estimation                | Moderate    | Deferred to Phase 13                     |
| #16 — No multi-language                     | Low         | Not planned                              |
| #18 — Pre-fetch prompt size                 | Low         | Deferred to Phase 13                     |
| #19 — Backfill not idempotent               | Low         | Deferred to Phase 13                     |
| #20 — No source attribution rendering       | Low         | Core shipped Phase 8, polish in Phase 14 |

## Files Created

- `app/api/admin/repair-embeddings/route.ts` — admin endpoint to find and re-embed missing content
- `lib/rag/eval.ts` — retrieval eval framework (20 Q&A pairs, CLI runner)
- `supabase/migrations/20260523300000_add_model_version_to_embeddings.sql` — model versioning
- `docs/retrieval-brain-phase-7-plan.md` — revised 8-phase sprint plan

## Files Modified

- `lib/rag/embedder.ts` — delete-before-embed for transcripts, contextual chunking for journals + external research, embedBriefSummary(), model_version on insert
- `lib/scout/client.ts` — contact-scoped pre-fetch, single hybridSearch call, source metadata in chunks, citation instructions in prompt
- `lib/scout/data-tools.ts` — on-demand stale brief regeneration for contact + territory
- `lib/scout/tool-executor.ts` — sourceId in search_knowledge results
- `lib/briefs/contact-brief-generator.ts` — embed brief on generation
- `lib/briefs/territory-brief-generator.ts` — embed brief on generation
- `app/api/admin/sync-status/route.ts` — embedding health check
- `app/api/journeys/[journeyId]/documents/route.ts` — embed uploaded documents
- `package.json` — added eval:retrieval script
- `docs/retrieval-brain-tracker.md` — session log updated

## Open Issues Carried Forward

- Mauricio Anaya needs manual creation or intake source identified — Medium
- GHL calendar + SMS setup checklist for Chad (no code fix, needs GHL config) — Medium
- L10 metrics dashboard feature request (parked) — Low
- `get_entity(journey)` enrichment — Low

## Exact Next Step

Phase 9 — Cross-call & Cross-rep Intelligence. Read `docs/retrieval-brain-phase-7-plan.md` section 3. Three deliverables:

1. Commitment tracker (new `commitments` table + extraction from transcripts + backfill 70 transcripts with Haiku)
2. Cross-call analytics (grade trends, recurring objections, response time trends in get_entity)
3. Cross-rep signals (flags from one rep's call surface in next rep's brief for same contact)

Pre-flight: confirm schema_migrations is current, verify post-call extraction agent output format.

## Copy This To Start Next Session

---

Read `docs/retrieval-brain-phase-7-plan.md` then `handoff.md`.
Tell me: current status, what was done in Phases 7-8, Phase 9 scope.

First action: run `npm run eval:retrieval` to lock the Phase 8 baseline scores.
Then: start Phase 9 — Cross-call & Cross-rep Intelligence.

Wait for explicit approval before writing any code.

---
