# Scout Retrieval Brain — Build Tracker

> Master checklist for ADR-0013. Read this at the start of every session.
> Full architecture: `docs/adr/0013-retrieval-brain-architecture.md`

---

## Current Phase: 8 — Trust & Measurement (COMPLETE)

**Start date:** 2026-05-22
**Target:** Replace OpenAI embeddings with Voyage AI, add contextual chunking, BM25 hybrid search, and reranking.

---

## Phase 0: Fix What's Broken

### 0a. Wire transcript embedding into post-call pipeline

- [x] Add `embedTranscript(transcriptId)` call to `lib/calls/transcript-processor.ts` after transcription completes
- [x] Run `embedAllExistingTranscripts()` backfill for existing transcripts
- [ ] Verify: pre-call brief generator (`lib/calls/brief-generator.ts`) now returns transcript chunks
- **Files:** `lib/calls/transcript-processor.ts`, `lib/rag/embedder.ts`, `scripts/backfill-embeddings.ts`
- **Test:** Generate a pre-call brief for a contact with past calls → confirm transcript context appears

### 0b. Wire KB doc embedding on create/update

- [x] Add `embedKBDoc(docId)` call to KB document create/update API
- [x] Run `embedAllExistingKBDocs()` backfill for existing docs
- [ ] Verify: `search_knowledge` tool returns semantic results (not just keyword fallback)
- **Files:** `app/api/knowledge/route.ts`, `lib/rag/embedder.ts`
- **Test:** Ask Scout "what is the NAH construction support model?" → confirm semantic match

### 0c. Give Scout access to contact_profile_fields

- [x] Add `contact_profile_fields` query to `getContactProfile()` in `lib/scout/data-tools.ts`
- [x] Include populated EAV fields in entity response (under `profileFields` key)
- [ ] Verify: Scout response includes fields like `disc_type`, `employment_status` when populated
- **Files:** `lib/scout/data-tools.ts` (getContactProfile function)
- **Test:** Ask Scout about a contact with saved profile fields → confirm fields appear in response

### 0d. Fix get_next_action to read EAV fields

- [x] Replace hardcoded contacts column reads with `getContactProfileFields(contactId)` query
- [x] Remove misleading "includes all profile fields" comment
- [x] Use populated fields to improve recommendation quality
- **Files:** `lib/scout/tool-executor.ts` (executeGetNextAction function)
- **Test:** Contact with EAV fields but empty contacts columns → get_next_action uses the EAV data

### 0e. Log GHL token refresh to cron_job_log

- [x] Add `cron_job_log` insert to `app/api/cron/refresh-ghl-token/route.ts`
- [x] Surface in admin sync-status check
- [ ] Verify: failed token refresh shows in admin dashboard
- **Files:** `app/api/cron/refresh-ghl-token/route.ts`, `app/api/admin/sync-status/route.ts`
- **Test:** Check admin sync status page shows GHL token refresh status

### Phase 0 verification

- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx vitest run` — all tests passing (129/129)
- [ ] Pre-call brief for a real contact includes transcript context
- [x] Scout `get_entity(contact)` response includes profileFields
- [x] `get_next_action` reads from contact_profile_fields
- [x] Admin sync dashboard shows GHL token status

---

## Phase 1: Auto-Populate Profiles

### 1a. Confidence-based auto-save

- [x] After extraction batch in `lib/agents/post-call/agent.ts`, auto-save high-confidence (≥0.85) extractions
- [x] Tag auto-saved fields with `last_updated_by = 'ai-auto'`
- [x] Never overwrite `last_updated_by = 'manual'` (rep-confirmed wins)
- [x] Medium confidence (0.60-0.84): saved with `last_updated_by = 'ai'` (pending review via getPendingSuggestionCount)
- **Files:** `lib/agents/post-call/auto-save-extractions.ts`, `lib/profile/profile-fields.ts`

### 1b. Real-time score recalculation

- [x] After auto-save batch, call `updateCandidateScore(contactId, 'extraction_auto_save')`
- [ ] Mark `contact_briefs.stale = true` (for Phase 2 — table doesn't exist yet)
- **Files:** `lib/agents/post-call/auto-save-extractions.ts`, `lib/intelligence/scoring.ts`

### 1c. Pending extraction visibility

- [x] Add extraction count to contact detail API response (pending + autoSaved counts)
- [ ] (Optional) Admin notification when high-value fields auto-saved
- **Files:** `app/api/contacts/[contactId]/route.ts`

### Phase 1 verification

- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx vitest run` — all tests passing (129/129)
- [ ] Process a call → verify high-confidence extractions auto-saved to contact_profile_fields
- [ ] Verify manual values not overwritten
- [x] Intelligence score recalculation wired after auto-save batch
- [x] Audit trail: source_history auto-appended via DB trigger on upsert

---

## Phase 2: Pre-Computed Briefs

### 2a. Create tables

- [x] Migration: `contact_briefs` table (contact_id PK, brief jsonb, summary text, updated_at, stale bool)
- [x] Migration: `territory_briefs` table (territory_slug PK, brief jsonb, summary text, updated_at, stale bool)
- [ ] Run migration on Supabase

### 2b. Brief generation logic

- [x] `lib/briefs/contact-brief-generator.ts` — pulls profile fields, call history, intelligence, pipeline, territory link
- [x] `lib/briefs/territory-brief-generator.ts` — pulls KPIs, EOS, inventory, owners, funnel
- [x] Both produce JSON structure + natural language summary

### 2c. Cron jobs

- [x] `app/api/cron/generate-briefs/route.ts` — nightly, generates/refreshes all stale briefs + seeds new
- [x] Trigger contact brief refresh after post-call agent completes (mark stale)
- [x] Trigger territory brief refresh after MasterSuite territory sync completes (mark stale)

### 2d. Wire into Scout

- [x] `get_entity(type="contact")` includes briefSummary
- [x] `get_entity(type="territory")` includes briefSummary
- [ ] New tool: `get_brief(type, id)` for direct access (deferred to Phase 3)

### Phase 2 verification

- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx vitest run` — all tests passing (129/129)
- [ ] Contact brief generated for a real contact — includes all sections
- [ ] Territory brief generated for a real territory — includes KPIs, EOS, inventory
- [x] Brief marked stale after post-call agent completes
- [x] Territory briefs marked stale after MasterSuite territory sync

---

## Phase 3: Smart Retrieval Chaining

### 3a. System prompt retrieval rules

- [x] Add question-type rules to Scout system prompt in `lib/scout/client.ts`
- [x] Prospect → contact brief + calls + intelligence
- [x] Franchisee → contact brief + territory brief + performance + EOS
- [x] Territory → territory brief + owner briefs + network comparison
- [x] Call prep → full chain per existing rules + territory if franchisee

### 3b. Enriched get_entity responses

- [x] `get_entity(contact)` — detect franchisee via territory_owners, auto-include territory brief summary
- [x] `get_entity(territory)` — auto-include owner brief summaries
- [ ] `get_entity(journey)` — include member scores + documents + call summary (deferred)

### Phase 3 verification

- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx vitest run` — all tests passing (129/129)
- [ ] "How is [franchisee] doing?" → response includes territory KPIs, EOS, inventory
- [ ] "How is [territory] doing?" → response includes owner info + benchmarks
- [ ] Call prep for franchisee → includes territory performance context

---

## Phase 4: Voyage AI + Contextual Retrieval

### 4a. Voyage AI integration

- [x] Sign up for Voyage AI, get API key
- [x] Replace OpenAI embedding calls in `lib/rag/embedder.ts` with Voyage `voyage-3-large`
- [x] Update vector dimension: 1536 → 1024

### 4b. Contextual chunking

- [x] Prepend context to transcript chunks before embedding (call type, contact, territory, date)
- [x] Prepend context to KB doc chunks (category, topic, last updated)
- [x] Update chunking functions in `lib/rag/embedder.ts`

### 4c. BM25 dual search

- [x] Add `content_tsv` generated column to embeddings table
- [x] Add GIN index for full-text search
- [x] Update `lib/rag/retriever.ts` to combine semantic + BM25 with reciprocal rank fusion

### 4d. Reranking

- [x] Add Voyage rerank API call to `lib/rag/retriever.ts`
- [x] Rerank combined results before returning

### 4e. Re-embedding migration

- [x] Resize vector column (1536 → 1024)
- [x] Re-embed all existing content with Voyage + contextual chunking (admin endpoint + migration truncates old)
- [ ] Verify search quality improvement (after migration applied + re-embed run)

### Phase 4 verification

- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx vitest run` — all tests passing (129/129)
- [ ] "Which leads mentioned royalty concerns?" → finds relevant transcript moments (not just keyword matches)
- [x] Contextual chunks include prepended metadata
- [ ] Reranked results show higher relevance than pre-rerank order (verify after re-embed)

---

## Phase 5: Wire RAG Into Scout Chat

### 5a. Upgrade search_knowledge

- [x] Use contextual retrieval + reranking from Phase 4
- [x] Search all content types (transcripts, KB, journals, documents)

### 5b. New tools

- [x] `search_transcripts(query, contact_id?, limit?)` — semantic search across call transcripts
- [x] `search_documents(query, journey_id?, contact_id?, limit?)` — semantic search across uploaded documents

### 5c. Pre-fetch context

- [x] Before Scout's first LLM call, run lightweight retrieval on user's message
- [x] Inject top 5 relevant chunks into system prompt

### Phase 5 verification

- [ ] Scout can find specific quotes from past calls
- [ ] Scout can search across uploaded PFS/Zorakle documents
- [ ] Background context injection doesn't slow response time significantly

---

## Phase 6: Retrieval Planner + Quality Logging

### 6a. Question classifier

- [x] Rule-based classifier maps question types to retrieval strategies (9 types: prospect, franchisee, territory, call_prep, comparison, metric, search, knowledge, general)
- [x] Token budget per question type (0/2K/5K/10K)

### 6b. Quality logging

- [x] Log retrieved context per Scout response (scout_retrieval_logs table)
- [x] Track pre-fetch chunks with metadata (content type, source ID, similarity, preview)
- [ ] Dashboard for retrieval quality metrics (deferred — query the table directly for now)
- [ ] Track which chunks Scout referenced in its answer (requires post-response analysis — deferred)

### Phase 6 verification

- [ ] Simple questions use minimal context (brief only)
- [ ] Complex questions use full retrieval (brief + structured + semantic)
- [ ] Quality logs show retrieval-to-reference ratio

---

## Session Log

| Session | Date       | Phase | What was done                                                                                                                                                                                                                                                                                                                       | What's next                                  |
| ------- | ---------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 50      | 2026-05-22 | 0-3   | All Phase 0 sub-tasks (embeddings, profile fields, GHL logging), Phase 1 (auto-save extractions + score recalc), Phase 2 (pre-computed briefs + cron), Phase 3 (retrieval chaining + franchisee detection)                                                                                                                          | Phase 4: Voyage AI integration               |
| 51      | 2026-05-22 | 4     | Voyage AI integration (voyage-3-large), contextual chunking, BM25 hybrid search with RRF, Voyage reranking, vector resize migration 1536→1024, batch embedding                                                                                                                                                                      | Phase 5: Wire RAG into Scout chat            |
| 52      | 2026-05-22 | 5     | Upgraded search_knowledge to hybridSearch, added search_transcripts + search_documents tools, added pre-fetch context injection into system prompt                                                                                                                                                                                  | Phase 6: Retrieval Planner + Quality Logging |
| 52      | 2026-05-22 | 6     | Question classifier (9 types with regex rules), retrieval strategies with token budgets, scout_retrieval_logs table + logger, wired into both chat + stream routes                                                                                                                                                                  | Retrieval Brain complete — all 7 phases done |
| 53      | 2026-05-22 | 7     | Phase 7 Stabilization: gaps #1 (embed uploads), #2 (delete-before-embed transcripts), #3 (embedding health check + repair endpoint), #5 (contact-scoped pre-fetch), #7 (journal contextual chunking), #8 (external research contextual chunking), #9 (single rerank pass)                                                           | Phase 8: Trust & Measurement                 |
| 53      | 2026-05-22 | 8     | Phase 8 Trust & Measurement: gaps #6 (embed briefs as profile_summary), #14 (on-demand stale brief regen), #17 (model_version column), source attribution in all search results + Scout prompt, eval framework (20 Q&A pairs, npm run eval:retrieval)                                                                               | Phase 9: Cross-call & Cross-rep Intelligence |
| 54      | 2026-05-22 | 9     | Phase 9 Cross-call & Cross-rep Intelligence: commitments table + extraction category + processor + agent wiring, cross-call analytics (grade trends, recurring objections, total time) in get_entity(contact), cross-rep signals (low grades + overdue commitments) in contact briefs, backfill 562 commitments from 70 transcripts | Phase 10: Predictive Lookalike Models        |

---

## Rules for Every Session

1. **Read this file first.** Check what phase we're in and what's next.
2. **Don't drift.** Only work on the current phase. If you spot something unrelated, note it in "Open Issues" below — don't fix it.
3. **Check the boxes.** Mark items done as you complete them.
4. **Verify before moving on.** Every phase has verification steps. Don't start the next phase until all checks pass.
5. **Update the session log.** At the end of every session, add a row.
6. **Run `npx tsc --noEmit` and `npx vitest run` before committing.**

---

## Open Issues (found during build, not in scope)

| Issue | Found in | Severity | Notes |
| ----- | -------- | -------- | ----- |
| —     | —        | —        | —     |
