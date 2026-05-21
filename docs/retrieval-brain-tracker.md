# Scout Retrieval Brain — Build Tracker

> Master checklist for ADR-0013. Read this at the start of every session.
> Full architecture: `docs/adr/0013-retrieval-brain-architecture.md`

---

## Current Phase: 0 — Fix What's Broken

**Start date:** TBD
**Target:** Wire existing infrastructure together. Zero new features, just connect what's built.

---

## Phase 0: Fix What's Broken

### 0a. Wire transcript embedding into post-call pipeline

- [ ] Add `embedTranscript(transcriptId)` call to `lib/calls/transcript-processor.ts` after transcription completes
- [ ] Run `embedAllExistingTranscripts()` backfill for existing transcripts
- [ ] Verify: pre-call brief generator (`lib/calls/brief-generator.ts`) now returns transcript chunks
- **Files:** `lib/calls/transcript-processor.ts`, `lib/rag/embedder.ts`, `scripts/backfill-embeddings.ts`
- **Test:** Generate a pre-call brief for a contact with past calls → confirm transcript context appears

### 0b. Wire KB doc embedding on create/update

- [ ] Add `embedKBDoc(docId)` call to KB document create/update API
- [ ] Run `embedAllExistingKBDocs()` backfill for existing docs
- [ ] Verify: `search_knowledge` tool returns semantic results (not just keyword fallback)
- **Files:** KB create/update API route, `lib/rag/embedder.ts`
- **Test:** Ask Scout "what is the NAH construction support model?" → confirm semantic match

### 0c. Give Scout access to contact_profile_fields

- [ ] Add `contact_profile_fields` query to `getContactProfile()` in `lib/scout/data-tools.ts`
- [ ] Include populated EAV fields in entity response (under `profileFields` key)
- [ ] Verify: Scout response includes fields like `disc_type`, `employment_status` when populated
- **Files:** `lib/scout/data-tools.ts` (getContactProfile function)
- **Test:** Ask Scout about a contact with saved profile fields → confirm fields appear in response

### 0d. Fix get_next_action to read EAV fields

- [ ] Replace hardcoded contacts column reads with `getContactProfileFields(contactId)` query
- [ ] Remove misleading "includes all profile fields" comment
- [ ] Use populated fields to improve recommendation quality
- **Files:** `lib/scout/tool-executor.ts` (executeGetNextAction function)
- **Test:** Contact with EAV fields but empty contacts columns → get_next_action uses the EAV data

### 0e. Log GHL token refresh to cron_job_log

- [ ] Add `cron_job_log` insert to `app/api/cron/refresh-ghl-token/route.ts`
- [ ] Surface in admin sync-status check
- [ ] Verify: failed token refresh shows in admin dashboard
- **Files:** `app/api/cron/refresh-ghl-token/route.ts`, `app/api/admin/sync-status/route.ts`
- **Test:** Check admin sync status page shows GHL token refresh status

### Phase 0 verification

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` — all tests passing
- [ ] Pre-call brief for a real contact includes transcript context
- [ ] Scout `get_entity(contact)` response includes profileFields
- [ ] `get_next_action` reads from contact_profile_fields
- [ ] Admin sync dashboard shows GHL token status

---

## Phase 1: Auto-Populate Profiles

### 1a. Confidence-based auto-save

- [ ] After extraction batch in `lib/agents/post-call/agent.ts`, auto-save high-confidence (≥0.85) extractions
- [ ] Tag auto-saved fields with `last_updated_by = 'ai-auto'`
- [ ] Never overwrite `last_updated_by = 'manual'` (rep-confirmed wins)
- [ ] Medium confidence (0.60-0.84): save but set `needs_review = true`
- **Files:** `lib/agents/post-call/agent.ts`, `lib/profile/profile-fields.ts`

### 1b. Real-time score recalculation

- [ ] After auto-save batch, call `updateCandidateScore(contactId, 'extraction_auto_save')`
- [ ] Mark `contact_briefs.stale = true` (for Phase 2)
- **Files:** `lib/agents/post-call/agent.ts`, `lib/intelligence/scoring.ts`

### 1c. Pending extraction visibility

- [ ] Add extraction count to contact detail API response
- [ ] (Optional) Admin notification when high-value fields auto-saved
- **Files:** Contact detail API route

### Phase 1 verification

- [ ] Process a call → verify high-confidence extractions auto-saved to contact_profile_fields
- [ ] Verify manual values not overwritten
- [ ] Verify intelligence score updated after auto-save (not waiting for nightly cron)
- [ ] Verify audit trail: source_history shows call_id, confidence, auto-save flag

---

## Phase 2: Pre-Computed Briefs

### 2a. Create tables

- [ ] Migration: `contact_briefs` table (contact_id PK, brief jsonb, summary text, updated_at, stale bool)
- [ ] Migration: `territory_briefs` table (territory_slug PK, brief jsonb, summary text, updated_at, stale bool)
- [ ] Run migration on Supabase

### 2b. Brief generation logic

- [ ] `lib/briefs/contact-brief-generator.ts` — pulls profile fields, call history, intelligence, pipeline, territory link
- [ ] `lib/briefs/territory-brief-generator.ts` — pulls KPIs, EOS, inventory, owners, funnel
- [ ] Both produce JSON structure + natural language summary

### 2c. Cron jobs

- [ ] `app/api/cron/generate-briefs/route.ts` — nightly, generates/refreshes all stale briefs
- [ ] Trigger contact brief refresh after post-call agent completes (mark stale, regenerate)
- [ ] Trigger territory brief refresh after MasterSuite sync completes

### 2d. Wire into Scout

- [ ] `get_entity(type="contact")` includes brief summary
- [ ] `get_entity(type="contact")` for franchisees includes territory brief
- [ ] New tool: `get_brief(type, id)` for direct access

### Phase 2 verification

- [ ] Contact brief generated for a real contact — includes all sections
- [ ] Territory brief generated for a real territory — includes KPIs, EOS, inventory
- [ ] Brief refreshes after a call is processed
- [ ] Scout response for a franchisee includes territory context

---

## Phase 3: Smart Retrieval Chaining

### 3a. System prompt retrieval rules

- [ ] Add question-type rules to Scout system prompt in `lib/scout/client.ts`
- [ ] Prospect → contact brief + calls + intelligence
- [ ] Franchisee → contact brief + territory brief + performance + EOS
- [ ] Territory → territory brief + owner briefs + network comparison
- [ ] Call prep → full chain per existing rules + territory if franchisee

### 3b. Enriched get_entity responses

- [ ] `get_entity(contact)` — detect franchisee via territory_owners, auto-include territory brief
- [ ] `get_entity(territory)` — auto-include owner briefs + franchisee_performance
- [ ] `get_entity(journey)` — include member scores + documents + call summary

### Phase 3 verification

- [ ] "How is [franchisee] doing?" → response includes territory KPIs, EOS, inventory
- [ ] "How is [territory] doing?" → response includes owner info + benchmarks
- [ ] Call prep for franchisee → includes territory performance context

---

## Phase 4: Voyage AI + Contextual Retrieval

### 4a. Voyage AI integration

- [ ] Sign up for Voyage AI, get API key
- [ ] Replace OpenAI embedding calls in `lib/rag/embedder.ts` with Voyage `voyage-3-large`
- [ ] Update vector dimension: 1536 → 1024

### 4b. Contextual chunking

- [ ] Prepend context to transcript chunks before embedding (call type, contact, territory, date)
- [ ] Prepend context to KB doc chunks (category, topic, last updated)
- [ ] Update chunking functions in `lib/rag/embedder.ts`

### 4c. BM25 dual search

- [ ] Add `content_tsv` generated column to embeddings table
- [ ] Add GIN index for full-text search
- [ ] Update `lib/rag/retriever.ts` to combine semantic + BM25 with reciprocal rank fusion

### 4d. Reranking

- [ ] Add Voyage rerank API call to `lib/rag/retriever.ts`
- [ ] Rerank combined results before returning

### 4e. Re-embedding migration

- [ ] Resize vector column (1536 → 1024)
- [ ] Re-embed all existing content with Voyage + contextual chunking
- [ ] Verify search quality improvement

### Phase 4 verification

- [ ] "Which leads mentioned royalty concerns?" → finds relevant transcript moments (not just keyword matches)
- [ ] Contextual chunks include prepended metadata
- [ ] Reranked results show higher relevance than pre-rerank order

---

## Phase 5: Wire RAG Into Scout Chat

### 5a. Upgrade search_knowledge

- [ ] Use contextual retrieval + reranking from Phase 4
- [ ] Search all content types (transcripts, KB, journals, documents)

### 5b. New tools

- [ ] `search_transcripts(query, contact_id?, territory_slug?)` — semantic search across call transcripts
- [ ] `search_documents(query, journey_id?)` — semantic search across uploaded documents

### 5c. Pre-fetch context

- [ ] Before Scout's first LLM call, run lightweight retrieval on user's message
- [ ] Inject top 5 relevant chunks into system prompt

### Phase 5 verification

- [ ] Scout can find specific quotes from past calls
- [ ] Scout can search across uploaded PFS/Zorakle documents
- [ ] Background context injection doesn't slow response time significantly

---

## Phase 6: Retrieval Planner + Quality Logging

### 6a. Question classifier

- [ ] Rule-based classifier maps question types to retrieval strategies
- [ ] Token budget per question type (2K/5K/10K)

### 6b. Quality logging

- [ ] Log retrieved context per Scout response
- [ ] Track which chunks Scout referenced in its answer
- [ ] Dashboard for retrieval quality metrics

### Phase 6 verification

- [ ] Simple questions use minimal context (brief only)
- [ ] Complex questions use full retrieval (brief + structured + semantic)
- [ ] Quality logs show retrieval-to-reference ratio

---

## Session Log

| Session | Date | Phase | What was done | What's next |
| ------- | ---- | ----- | ------------- | ----------- |
| —       | —    | —     | —             | —           |

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
