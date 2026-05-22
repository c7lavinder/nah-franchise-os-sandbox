# Session Handoff — 2026-05-22 — Session 50

## Status

Phase: Retrieval Brain Build (ADR-0013) — Phases 0-3 complete / Health: Green / Duration: full session

## What Was Built This Session

- **Phase 0a:** Wired `embedTranscript()` into `lib/calls/transcript-processor.ts` — every new transcript now auto-embeds for RAG
- **Phase 0b:** Wired `embedKBDoc()` into `app/api/knowledge/route.ts` — KB docs embed on create/update, old embeddings cleaned on re-embed
- **Phase 0c:** Scout `get_entity(contact)` now includes all 199 EAV profile fields via `getContactProfileFields()` in `lib/scout/data-tools.ts`
- **Phase 0d:** `get_next_action` reads EAV fields (DISC, ghost risk, comms style, capital) instead of 8 hardcoded columns in `lib/scout/tool-executor.ts`
- **Phase 0e:** GHL token refresh logs success/failure to `cron_job_log`, surfaced in admin sync-status dashboard
- **Phase 1a:** Auto-save extractions — high confidence (≥0.85) saved as `ai-auto`, medium (0.60-0.84) saved as `ai` (pending review), manual values never overwritten (`lib/agents/post-call/auto-save-extractions.ts`)
- **Phase 1b:** Intelligence score recalculates immediately after auto-save batch via `updateCandidateScore()`
- **Phase 1c:** Contact detail API returns `extractions.pending` + `extractions.autoSaved` counts
- **Phase 2a:** Created `contact_briefs` and `territory_briefs` tables with stale indexes and RLS
- **Phase 2b:** Built `lib/briefs/contact-brief-generator.ts` (profile, calls, intel, pipeline, territory link) and `lib/briefs/territory-brief-generator.ts` (owners, T12 performance, EOS, market data)
- **Phase 2c:** Nightly cron `app/api/cron/generate-briefs/route.ts` regenerates stale briefs + seeds new ones. Post-call agent marks contact briefs stale. MasterSuite sync marks territory briefs stale.
- **Phase 2d:** Scout `get_entity(contact)` and `get_entity(territory)` include `briefSummary` field
- **Phase 3a:** Added RETRIEVAL CHAINING rules to Scout system prompt — question-type routing for prospects, franchisees, territories, call prep
- **Phase 3b:** `get_entity(contact)` auto-detects franchisees via `territory_owners` and includes territory brief summary. `get_entity(territory)` includes owner brief summaries.
- **Infra:** Paginated backfill functions (avoid Supabase timeout), admin backfill endpoint, ws transport fix for CLI scripts, Supabase upgraded to Pro/Small

## What Is Confirmed Working

- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 13 files, 129 tests, all passing
- Phase 0+1 migration applied on production (`ai-auto` constraint, `auto_saved` column)
- Phase 2 migration applied on production (`contact_briefs`, `territory_briefs` tables with RLS)
- All 4 commits pushed to main, Vercel auto-deploying
- Embedding backfill running successfully on upgraded Supabase (no errors since upgrade)

## What Is Broken or Incomplete

- **Embedding backfill still running** — transcripts actively embedding via OpenAI API, will complete on its own — Low
- **Brief tables empty** — nightly cron hasn't run yet; briefs populate on first cron run or after next call is processed — Low
- **`get_entity(journey)` enrichment deferred** — member scores + documents + call summary not added yet — Low
- **`get_brief` direct-access tool deferred** — Scout can access briefs via get_entity, dedicated tool not yet needed — Low
- **Validate constraint on contact_profile_fields** — `NOT VALID` constraint works for new inserts but existing rows not validated (all are valid, cosmetic only) — Low
- Mauricio Anaya not in MasterSuite PTO table — needs manual creation or intake source identified — Medium (carried forward)

## Decisions Made

- Supabase upgraded from free tier to Pro/Small ($15/mo) — Corey approved (was hitting auto-pause and connection limits)
- Small compute is sufficient for 10 users — no need for Medium yet
- `ai-auto` source type for high-confidence auto-saves, `ai` for medium confidence pending review — aligned with ADR-0013
- Territory brief generation is pure data aggregation (no LLM) — fast and cheap
- Contact brief generation is pure data aggregation (no LLM) — fast and cheap
- Phase 4 (Voyage AI) requires vendor signup — parked until ready

## Files Created

- `lib/agents/post-call/auto-save-extractions.ts` — confidence-based extraction auto-save
- `lib/briefs/contact-brief-generator.ts` — contact brief generator
- `lib/briefs/territory-brief-generator.ts` — territory brief generator
- `app/api/cron/generate-briefs/route.ts` — nightly brief generation cron
- `app/api/admin/backfill-embeddings/route.ts` — admin endpoint for embedding backfill
- `supabase/migrations/20260522200000_add_ai_auto_source_type.sql` — ai-auto constraint + auto_saved column
- `supabase/migrations/20260522300000_create_brief_tables.sql` — contact_briefs + territory_briefs tables

## Files Modified

- `lib/calls/transcript-processor.ts` — embedTranscript() call after transcription
- `lib/rag/embedder.ts` — paginated backfill, KB doc old-embedding cleanup
- `lib/scout/data-tools.ts` — profile fields, brief summaries, franchisee detection, owner briefs
- `lib/scout/tool-executor.ts` — EAV field reads, DISC/ghost risk/comms style in output
- `lib/scout/client.ts` — retrieval chaining rules in system prompt
- `lib/profile/profile-fields.ts` — ai-auto source type
- `lib/agents/post-call/agent.ts` — auto-save hook, stale brief marking
- `lib/supabase/server.ts` — ws transport for CLI scripts
- `app/api/knowledge/route.ts` — embedKBDoc on create/update
- `app/api/cron/refresh-ghl-token/route.ts` — cron_job_log logging
- `app/api/admin/sync-status/route.ts` — added refresh-ghl-token to monitored jobs
- `app/api/cron/sync-ms-territories/route.ts` — mark territory briefs stale after sync
- `app/api/contacts/[contactId]/route.ts` — extraction counts in response
- `docs/retrieval-brain-tracker.md` — Phase 0-3 checkboxes updated

## Files Deleted

- (none)

## Open Issues Carried Forward

- Mauricio Anaya needs manual creation or intake source identified — Medium
- GHL calendar + SMS setup checklist for Chad (no code fix, needs GHL config) — Medium
- L10 metrics dashboard feature request (parked) — Low
- `get_entity(journey)` enrichment — Low
- Embedding backfill in progress (will complete autonomously) — Low

## Exact Next Step

Start Phase 4 of the Retrieval Brain: sign up for Voyage AI, get API key, replace OpenAI embeddings with Voyage `voyage-3-large` in `lib/rag/embedder.ts`, resize vector column from 1536 to 1024 dimensions.

## Copy This To Start Next Session In Claude.ai

---

Read `docs/retrieval-brain-tracker.md` then `handoff.md`. Tell me: current phase, what's done, what's next.
We are building the Retrieval Brain (ADR-0013). Phases 0-3 are complete. Phase 4 is next: Voyage AI integration.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Start Phase 4 — sign up for Voyage AI, replace OpenAI embeddings with Voyage `voyage-3-large`, resize vector dimensions 1536→1024.

---
