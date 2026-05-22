# Scout Retrieval Brain — Complete Summary

> Built across sessions 50-52 (May 22, 2026). Architecture decision: ADR-0013.

---

## The Problem

An audit on May 22 found that Scout had 35 tools and access to massive amounts of data — but wasn't actually using most of it. Four root problems:

1. **Scout couldn't see profile data.** 199 custom profile fields existed in the database. Zero Scout tools read them. Scout was looking at stale GHL fields and mostly-empty columns instead of the real data.

2. **Extracted data got stuck.** After every call, the system pulls 30-60 data points (capital source, timeline, motivation, etc.) with confidence scores. But every single one required a rep to manually click "Save." Nobody was doing it. Data piled up and never reached profiles.

3. **The search system was built but disconnected.** A full semantic search pipeline existed (embeddings, vector database, retrieval). But only journal entries were being embedded. Call transcripts — the most valuable data — were never searchable. The search tool fell back to basic keyword matching.

4. **Scout didn't follow relationships.** Ask about a franchisee and Scout pulled their contact card. It never automatically followed the chain to their territory performance, inventory, EOS data, or coaching history — even though all that data was one query away.

---

## What Was Built (7 Phases)

### Phase 0: Fix What's Broken

Connected infrastructure that existed but wasn't wired together.

- **Transcript embedding:** Every call transcript now gets automatically embedded (searchable) after transcription completes. Backfilled all 70 existing transcripts.
- **Knowledge base embedding:** Every KB document gets embedded on create/update. Backfilled all 48 existing docs.
- **Profile fields visible to Scout:** `get_entity(contact)` now includes all 199 custom profile fields, not just the stale GHL columns.
- **Next-action recommendations fixed:** `get_next_action` now reads real profile data instead of empty columns, so recommendations are based on what we actually know about a prospect.
- **GHL token logging:** Token refresh success/failure now logged to `cron_job_log` and visible in the admin dashboard. No more silent GHL outages.

### Phase 1: Auto-Populate Profiles

Made profiles fill themselves from call data — no manual clicking required.

- **High confidence (85%+):** Auto-saved to profile immediately, tagged as `ai-auto`
- **Medium confidence (60-84%):** Saved but flagged for rep review
- **Low confidence (<60%):** Held for manual approval (same as before)
- **Safety rule:** Auto-save never overwrites data a rep manually entered
- **Real-time scoring:** Intelligence scores recalculate immediately after auto-save, not on the next nightly cron
- **Visibility:** Contact detail API shows pending + auto-saved extraction counts

### Phase 2: Pre-Computed Briefs

Scout now reads one pre-built document to answer 80% of questions instead of making 4+ separate tool calls.

- **Contact briefs:** One per active contact. Includes profile snapshot, pipeline state, call history summary, intelligence scores, flags, territory link, and recommended next action. Example: _"Chuck Rierson, 63, Birmingham AL. Organic lead. 1 call (Intro, B grade). Capital: unknown. Timeline: unclear, non-compete until May 2027. Next action: confirm capital on framing call."_
- **Territory briefs:** One per active territory. Includes owner info, T12 KPIs, active inventory, EOS grades, funnel conversion. Example: _"Birmingham AL — 11 purchases T12, $46K avg profit per flip, 132-day cycle. EOS: A daily tasks, B meetings. 1 open rock: hire second crew."_
- **Auto-refresh:** Nightly cron regenerates stale briefs. Briefs marked stale automatically after a call is processed or a MasterSuite sync runs.
- **Wired into Scout:** `get_entity(contact)` and `get_entity(territory)` both include their brief summary automatically.

### Phase 3: Smart Retrieval Chaining

Scout now automatically follows relationship chains based on who you're asking about.

- **Prospect question** → Contact brief + calls + intelligence scores
- **Franchisee question** → Contact brief + territory brief + performance KPIs + EOS + inventory
- **Territory question** → Territory brief + owner briefs + network comparison
- **Call prep** → Full chain: contact + territory (if franchisee) + call history + pending actions
- **Franchisee detection:** When Scout pulls a contact, it checks `territory_owners` to see if they're a franchisee. If yes, it auto-includes their territory brief — no extra tool call needed.
- **Territory enrichment:** When Scout pulls a territory, it auto-includes the owner's contact brief.

### Phase 4: Voyage AI + Contextual Retrieval

Replaced the search engine with a dramatically better one.

- **New embedding model:** Switched from OpenAI `text-embedding-3-small` (1536 dimensions) to Voyage AI `voyage-3-large` (1024 dimensions). Better quality, free tier covers our usage.
- **Contextual chunking:** Before embedding a transcript chunk, the system prepends context: _"From Discovery Call with Chuck Rierson on May 15, 2026."_ Before embedding a KB doc chunk: _"From 'Handling the Capital Objection' [objections], last updated May 10."_ This tells the search engine what each chunk is about, reducing failed retrievals by up to 49%.
- **Hybrid search (BM25 + semantic):** Two search methods run in parallel — semantic (meaning-based) and BM25 (keyword-based). Results are merged using reciprocal rank fusion. This catches both exact keyword matches and conceptual matches.
- **Reranking:** After hybrid search returns candidates, Voyage AI's reranker re-scores them by relevance to the actual question. The most relevant chunks float to the top.
- **Migration:** Vector column resized 1536→1024, all 118 items re-embedded with Voyage AI (70 transcripts + 48 KB docs, 0 failures).

### Phase 5: Wire RAG Into Scout Chat

Connected the new search engine directly into Scout's conversation flow.

- **Upgraded `search_knowledge`:** Replaced the old OpenAI semantic + manual keyword scoring with the Phase 4 hybrid search pipeline. Much better results with less code.
- **New tool: `search_transcripts`:** Semantic search across all call transcripts. Can scope to a single contact. Use case: _"What did Chuck say about his timeline?"_ → finds the exact quote from the Discovery Call.
- **New tool: `search_documents`:** Semantic search across uploaded documents (PFS, Zorakle profiles, franchise agreements). Can scope to a journey or contact. Use case: _"What does Chuck's PFS say about liquid capital?"_
- **Pre-fetch context injection:** Before Scout's first response, the system automatically runs a lightweight search on the user's question and injects the top relevant chunks into Scout's system prompt. Scout uses this as background knowledge without needing an extra tool call. Runs in parallel with all other context loading — adds zero extra wait time.
- **Tool count:** 21 → 23

### Phase 6: Retrieval Planner + Quality Logging

Made the pre-fetch intelligent and added tracking to measure quality.

- **Question classifier:** A rule-based system that reads the user's message and classifies it into one of 9 types: prospect, franchisee, territory, call_prep, comparison, metric, search, knowledge, or general. Each type has regex patterns that match common phrasings.
- **Retrieval strategies:** Each question type maps to a strategy that controls:
  - Which content types to search (transcripts, KB docs, uploaded documents)
  - How many chunks to retrieve (0-8)
  - Token budget for context injection (0 / 2K / 5K / 10K)
  - Whether to use reranking
- **Token budgets in practice:**
  - _"Hi Scout"_ → general → 0 tokens (no retrieval, don't waste time)
  - _"How many leads this month?"_ → metric → 0 tokens (this is a database query, not a search)
  - _"Tell me about Chuck"_ → prospect → 2K tokens (brief + a few relevant chunks)
  - _"How do we handle the capital objection?"_ → knowledge → 5K tokens (KB docs)
  - _"Prep me for my call with Chuck"_ → call_prep → 10K tokens (transcripts + KB + docs)
  - _"Which leads mentioned royalty concerns?"_ → search → 10K tokens (deep transcript search)
- **Quality logging:** Every Scout conversation turn logs what was retrieved — question type, chunks found, token budget used, similarity scores, and content previews. Stored in `scout_retrieval_logs` table. This data lets us tune the retrieval parameters over time.

---

## How It All Works Together

Here's what happens when someone asks Scout a question:

1. **Classify** — The question classifier reads the message and determines the type (e.g., "call_prep")
2. **Plan** — The retrieval planner picks the right strategy (content types, chunk limit, token budget)
3. **Search** — Hybrid search runs: Voyage AI embeddings (meaning) + BM25 (keywords), merged with rank fusion
4. **Rerank** — Voyage AI reranker re-scores results by relevance to the question
5. **Budget** — Results trimmed to fit the token budget (no context bloat)
6. **Inject** — Top chunks injected into Scout's system prompt as background context
7. **Respond** — Scout sees the relevant context and responds. If it needs more detail, it can call `search_knowledge`, `search_transcripts`, or `search_documents` explicitly.
8. **Log** — What was retrieved gets logged to `scout_retrieval_logs` for quality tracking

All of this happens in parallel with loading the knowledge base, pipeline snapshot, user memory, and other context. No extra latency.

---

## Files Created or Modified

### New Files

| File                                                                  | Purpose                                              |
| --------------------------------------------------------------------- | ---------------------------------------------------- |
| `lib/rag/question-classifier.ts`                                      | Question classification + retrieval strategy mapping |
| `lib/scout/retrieval-logger.ts`                                       | Fire-and-forget retrieval quality logging            |
| `lib/briefs/contact-brief-generator.ts`                               | Pre-computed contact brief generation                |
| `lib/briefs/territory-brief-generator.ts`                             | Pre-computed territory brief generation              |
| `lib/agents/post-call/auto-save-extractions.ts`                       | Confidence-based auto-save of call extractions       |
| `supabase/migrations/20260522300000_create_brief_tables.sql`          | contact_briefs + territory_briefs tables             |
| `supabase/migrations/20260523100000_voyage_ai_bm25_hybrid_search.sql` | Vector resize + BM25 + hybrid search                 |
| `supabase/migrations/20260523200000_scout_retrieval_logs.sql`         | Retrieval quality logging table                      |

### Modified Files

| File                                 | What Changed                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `lib/rag/embedder.ts`                | Voyage AI client, batch embedding, contextual chunking                            |
| `lib/rag/retriever.ts`               | Voyage reranker, BM25 search, RRF fusion, hybrid search                           |
| `lib/scout/client.ts`                | Pre-fetch context injection, question classifier integration, retrieval logging   |
| `lib/scout/tools.ts`                 | Updated search_knowledge description, added search_transcripts + search_documents |
| `lib/scout/tool-executor.ts`         | Rewrote search_knowledge, added search_transcripts + search_documents executors   |
| `app/api/scout/chat-stream/route.ts` | Retrieval logging wired into streaming route                                      |
| `lib/calls/transcript-processor.ts`  | Wired transcript embedding after transcription                                    |
| `app/api/knowledge/route.ts`         | Wired KB doc embedding on create/update                                           |
| `lib/scout/data-tools.ts`            | Added profile fields to get_entity(contact)                                       |
| `types/scout.ts`                     | Added search_transcripts + search_documents to ScoutToolName                      |

---

## Costs

| Item                                  | Monthly Cost                       |
| ------------------------------------- | ---------------------------------- |
| Voyage AI embeddings (voyage-3-large) | Free (200M tokens/month free tier) |
| Voyage AI reranking (rerank-2)        | Free tier, ~$5-10 at scale         |
| Brief generation (Claude Haiku)       | ~$5-15                             |
| **Total new cost**                    | **~$10-25/month**                  |

---

## What's Deferred

These items were identified during the build but intentionally deferred:

| Item                                              | Why Deferred                                           |
| ------------------------------------------------- | ------------------------------------------------------ |
| Retrieval quality dashboard UI                    | Can query `scout_retrieval_logs` directly for now      |
| Track which chunks Scout referenced in its answer | Requires post-response analysis — complex, low urgency |
| `get_entity(journey)` enrichment                  | Member scores + documents + call summary not added yet |
| `get_brief` direct access tool                    | Scout gets briefs through `get_entity` already         |

---

## How to Know It's Working

Ask Scout these questions and compare to before:

- **"What did Chuck say about his timeline?"** → Should find the exact quote from a past call transcript (before: Scout couldn't search transcripts)
- **"How do we handle the capital objection?"** → Should return relevant KB docs ranked by meaning, not just keyword matches
- **"Prep me for my call with Chuck"** → Should include transcript context from past calls, profile data, and territory info if he's a franchisee
- **"Hi Scout"** → Should respond instantly with no retrieval overhead (question classifier skips it)
- **"How many leads this month?"** → Should go straight to database query, no semantic search wasted

Check the `scout_retrieval_logs` table in Supabase to see classification and retrieval patterns over time.
