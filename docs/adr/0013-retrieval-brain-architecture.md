# ADR-0013: Scout Retrieval Brain Architecture

## Status

Proposed — 2026-05-22

## Context

Scout retrieves data through 35 tools but has critical blind spots. A comprehensive audit on 2026-05-22 revealed the system is more broken than it appears — infrastructure exists but isn't wired together, data gets extracted but never reaches Scout, and failures happen silently.

**The audit found 4 root problems:**

1. **Scout can't see profile data.** The system has 199 custom profile fields in a `contact_profile_fields` table. ZERO Scout tools query it. Scout reads from GHL custom fields (often stale) and denormalized `contacts` columns (mostly empty). The richest contact data in the system is invisible to Scout.

2. **Extracted data gets stuck.** The post-call agent extracts 30-60 data points per call with confidence scores. Every single extraction requires a rep to manually click "Save" before it reaches the profile. Nobody is doing this. Data piles up in `call_data_extractions` and never flows to profiles or Scout.

3. **RAG pipeline is built but dormant.** A full RAG system exists (`lib/rag/embedder.ts`, `lib/rag/retriever.ts`) with pgvector, chunking, hybrid retrieval. But only journal entries are being embedded. Call transcripts — the most valuable data — are never embedded. The pre-call brief generator uses the retriever, but gets zero transcript results because nothing is in the index.

4. **Scout doesn't follow relationships.** When asked about a franchisee, Scout pulls their contact card. It doesn't automatically follow the chain to their territory, inventory, performance, or EOS data — even though all that data exists and is queryable via separate tools.

**Additional findings:**

- `get_next_action` has a comment saying "includes all profile fields" but only reads hardcoded column names from `contacts` table — misleading
- No active alerting on sync failures — admin must manually check
- GHL token refresh failures are logged to console only, not `cron_job_log` — all GHL APIs break silently
- Transcript processing failures leave transcripts stuck in queue with no visibility
- Score recalculation is decoupled from profile saves — scores can be 24+ hours stale after new data arrives

---

## Decision

Build the Scout Retrieval Brain in 7 phases. Each phase is independently shippable. Phases 0-3 fix critical gaps with zero new costs. Phases 4-6 add the semantic intelligence layer.

---

## Phase 0: Fix What's Broken (Critical)

**Goal:** Close the gaps where built infrastructure isn't wired in. No new features — just connect what exists.

### 0a. Wire transcript embedding into post-call pipeline

- After `process-transcripts` cron transcribes a call, call `embedTranscript(transcriptId)`
- One line addition to transcript processor
- Run `embedAllExistingTranscripts()` backfill script for existing transcripts
- **Impact:** Pre-call briefs immediately start getting transcript context. `search_knowledge` can find call content.

### 0b. Wire KB doc embedding on create/update

- After a knowledge document is created or updated, call `embedKBDoc(docId)`
- Run `embedAllExistingKBDocs()` backfill for existing docs
- **Impact:** `search_knowledge` gets semantic results instead of keyword-only fallback.

### 0c. Give Scout access to contact_profile_fields

- Add `contact_profile_fields` query to `getContactProfile()` in `data-tools.ts`
- Include populated EAV fields in the entity response alongside GHL data
- **Impact:** Scout can finally see the 199 custom fields. Every tool that calls `get_entity(contact)` benefits.

### 0d. Fix get_next_action to read EAV fields

- Replace hardcoded contacts column reads with `getContactProfileFields(contactId)` call
- Remove misleading "includes all profile fields" comment
- **Impact:** Next-action recommendations based on actual profile data, not empty columns.

### 0e. Log GHL token refresh to cron_job_log

- Add cron_job_log entry for `refresh-ghl-token` success/failure
- Surface in admin sync-status check alongside other cron jobs
- **Impact:** GHL outages become visible before all APIs break.

### Effort: 2-3 sessions

### Cost: $0

---

## Phase 1: Auto-Populate Profiles from Extractions

**Goal:** Call extractions flow to profiles automatically. Profiles fill up passively from every call.

### What gets built

**Confidence-based auto-save in post-call agent:**

- High confidence (≥ 0.85) → auto-save to `contact_profile_fields`, mark `saved_to_profile = true`, tag `last_updated_by = 'ai-auto'`
- Medium confidence (0.60–0.84) → save but flag `needs_review = true` for rep
- Low confidence (< 0.60) → hold for manual approval (current behavior)

**Auto-trigger score recalculation:**

- After auto-save batch completes, call `updateCandidateScore(contactId, 'extraction_auto_save')`
- Scores update in real-time instead of waiting for nightly cron

**Safety rails:**

- Auto-save never overwrites a value where `last_updated_by = 'manual'` (rep-confirmed data wins)
- Source history preserved: which call, which extraction, confidence score
- Dashboard indicator distinguishes auto-saved vs rep-confirmed fields

**Pending extraction visibility:**

- Add extraction count badge to contact detail UI ("12 pending extractions")
- Notify rep when high-value extractions are auto-saved ("Scout auto-saved 8 fields from today's call with Chuck")

### Effort: 2 sessions

### Cost: $0

---

## Phase 2: Pre-Computed Briefs

**Goal:** Scout reads one document to answer 80% of questions instead of making 4+ tool calls.

### What gets built

**`contact_briefs` table:**

```sql
CREATE TABLE contact_briefs (
  contact_id uuid PRIMARY KEY REFERENCES contacts(id),
  brief jsonb NOT NULL DEFAULT '{}',
  summary text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  stale boolean NOT NULL DEFAULT true
);
```

- One row per active contact
- JSON: profile snapshot, pipeline state, call history summary, intelligence scores, flags, territory link, key dates, missing data, recommended next action
- Natural language `summary` field (1-2 paragraphs)

**`territory_briefs` table:**

```sql
CREATE TABLE territory_briefs (
  territory_slug text PRIMARY KEY,
  brief jsonb NOT NULL DEFAULT '{}',
  summary text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  stale boolean NOT NULL DEFAULT true
);
```

- One row per active territory
- JSON: owner info, T12 KPIs, active inventory count, EOS grades, open rocks/issues, funnel conversion, channel effectiveness

**Example contact brief:**

> Chuck Rierson, 63, Birmingham AL. Organic lead, added May 12. 1 call (Intro, B grade). Capital: unknown. Timeline: unclear, non-compete until May 2027. Framing call: not logged. Trainual: not sent. Prior experience: house flipping, had $60-70K contractor overrun. Key concern: construction risk. Next action: confirm capital and timeline on framing call.

**Example territory brief:**

> Birmingham AL — Active, owned by John Davis since Jan 2025. T12: 11 purchases, 4 sold, $187K total profit, $46K avg profit per flip. 5 active in inventory. 132-day avg cycle. EOS: A on daily tasks, B on meetings, C on financial tracking. 1 open rock: hire second contractor crew. Funnel: 45 leads → 18 Stage 4 → 11 purchased (24% conversion).

### When briefs refresh

- **Contact briefs:** Nightly cron + triggered after any call is processed for that contact
- **Territory briefs:** Nightly cron after MasterSuite sync completes
- **On-demand:** `get_entity` checks brief freshness; if stale (>24h or flagged), regenerates inline

### Scout integration

- `get_entity(type="contact")` includes brief summary automatically
- `get_entity(type="contact")` for franchisees auto-includes linked territory brief
- New tool: `get_brief(type, id)` for direct brief access

### Effort: 2-3 sessions

### Cost: ~$5-15/mo additional Claude Haiku for brief generation

---

## Phase 3: Smart Retrieval Chaining

**Goal:** When asked about a franchisee, Scout automatically follows the full relationship chain.

### What gets built

**Retrieval rules in Scout system prompt by question type:**

- Prospect question → contact brief + call history + intelligence
- Franchisee question → contact brief + territory brief + performance KPIs + EOS + inventory summary
- Territory question → territory brief + owner contact briefs + network comparison
- Network question → network benchmarks + high performer list + territory rankings
- Call prep → contact brief + territory brief (if franchisee) + call history + pending actions + documents

**Enriched `get_entity(type="contact")`:**

- Detect if contact is a franchisee (has active territory via `territory_owners`)
- If yes, auto-include territory brief in response
- Include `contact_profile_fields` (from Phase 0c)
- Include uploaded documents summary (PFS, Zorakle status)

**Enriched `get_entity(type="territory")`:**

- Auto-include owner contact briefs
- Include franchisee_performance post-close data
- Include conversion funnel from `ms_property_status_history`

**Enriched `get_entity(type="journey")`:**

- Include contact intelligence scores for all journey members
- Include uploaded documents list
- Include call history summary

### Effort: 2 sessions

### Cost: $0

---

## Phase 4: Voyage AI Embeddings + Contextual Retrieval

**Goal:** Replace OpenAI embeddings with Voyage AI. Add Anthropic's Contextual Retrieval for dramatically better search accuracy.

### What gets built

**Swap embedding provider:**

- Replace `text-embedding-3-small` (OpenAI, 1536d) with `voyage-3-large` (Voyage AI, 1024d)
- Update `lib/rag/embedder.ts` to use Voyage AI SDK
- Re-embed all content (one-time migration job)

**Contextual chunking (Anthropic's technique, reduces failed retrieval by 49%):**

- Before embedding a transcript chunk, prepend context:
  ```
  "From [call type] with [contact name] on [date].
   Contact is in [pipeline stage] for [territory].
   [Previous chunk summary for continuity]."
  ```
- Same treatment for KB docs, journal entries, uploaded documents

**Dual search — BM25 + embeddings:**

- Add full-text search index on `embeddings.content` column
- Combine semantic + keyword results with reciprocal rank fusion
- Supabase supports both natively

**Reranking:**

- After hybrid search returns candidates, call Voyage AI rerank API
- Reorder by relevance before passing to Scout

### Schema change

```sql
ALTER TABLE embeddings ALTER COLUMN embedding TYPE vector(1024);
ALTER TABLE embeddings ADD COLUMN content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX idx_embeddings_content_tsv ON embeddings USING gin(content_tsv);
```

### Effort: 3-4 sessions

### Cost: ~$20-50/mo (Voyage AI embeddings + reranking)

---

## Phase 5: Wire RAG Into Scout Chat

**Goal:** Scout's main chat uses the hybrid RAG pipeline for every conversation.

### What gets built

**Upgrade `search_knowledge` tool:**

- Use contextual retrieval + reranking from Phase 4
- Search across all content types (transcripts, KB, journals, documents)

**New tool: `search_transcripts(query, contact_id?, territory_slug?)`**

- Semantic search across all call transcripts
- Returns specific quotes and moments, not just summaries
- Filtered by contact or territory when relevant

**New tool: `search_documents(query, journey_id?)`**

- Semantic search across uploaded documents (PFS, Zorakle, agreements)
- Returns relevant extracted text with source attribution

**Pre-fetch context injection:**

- Before each Scout conversation turn, run lightweight retrieval on user's message
- Inject top 5 relevant chunks into system prompt as background context
- Scout uses this passively — no extra tool call needed for basic context

### Effort: 2-3 sessions

### Cost: Included in Phase 4 Voyage AI spend

---

## Phase 6: Retrieval Planner + Quality Logging

**Goal:** Scout automatically determines the optimal retrieval strategy per question.

### What gets built

**Question classifier (rule-based):**

- Name mentioned → contact retrieval path
- Territory mentioned → territory retrieval path
- "How is [X] doing" → full chain (contact + territory + performance)
- "Which leads..." / "Who..." → cross-contact search
- "Compare..." → multi-territory benchmark
- Specific metric → structured SQL
- Open-ended → semantic RAG

**Retrieval budget:**

- Simple questions: 2K tokens context (brief only)
- Medium questions: 5K tokens (brief + structured data)
- Deep questions: 10K tokens (brief + structured + semantic chunks)
- Prevents context bloat and controls cost

**Quality logging:**

- Log what context was retrieved per Scout response
- Track which chunks Scout actually referenced in its answer
- Use this data to tune retrieval parameters over time

### Effort: 2-3 sessions

### Cost: $0

---

## Infrastructure Inventory

### Already built — needs wiring (Phase 0)

- [x] pgvector extension + embeddings table + HNSW index
- [x] RAG embedder with 5 content types (`lib/rag/embedder.ts`)
- [x] Hybrid retriever (`lib/rag/retriever.ts`)
- [x] Pre-call brief generator using RAG (`lib/calls/brief-generator.ts`)
- [x] Journal embedding cron (11pm nightly)
- [x] `embedTranscript()` function (exists, never called in production)
- [x] `embedAllExistingTranscripts()` backfill script (exists, never run)
- [x] `search_knowledge` hybrid tool (semantic + keyword)
- [x] 199-field profile registry (`lib/profile/field-registry.ts`)
- [x] `contact_profile_fields` EAV table with source tracking
- [x] Post-call extraction pipeline (30-60 fields per call with confidence)
- [x] Candidate intelligence scoring (4 dimensions, nightly recalc)
- [x] MasterSuite sync (properties, territories, EOS — 23 crons)
- [x] 35 Scout tools including territory_performance + network_benchmarks
- [x] LLM call logging with token counts
- [x] Model router (Haiku/Sonnet/Opus)
- [x] cron_job_log with status tracking

### Needs to be built

- [ ] Phase 0: Wire transcripts → embedder, KB docs → embedder, Scout → profile fields, fix get_next_action, GHL token logging
- [ ] Phase 1: Auto-save high-confidence extractions + real-time score recalc
- [ ] Phase 2: contact_briefs + territory_briefs tables + generation crons
- [ ] Phase 3: Retrieval chaining rules + enriched get_entity responses
- [ ] Phase 4: Voyage AI integration + contextual chunking + BM25 + reranking
- [ ] Phase 5: Scout chat RAG integration + search_transcripts + search_documents tools
- [ ] Phase 6: Question classifier + retrieval budget + quality logging

### New vendor

- Voyage AI (Phase 4+): embeddings + reranking — ~$20-50/month

---

## Monitoring Gaps To Fix (Alongside Phase 0)

| Issue                                        | Fix                                            | When     |
| -------------------------------------------- | ---------------------------------------------- | -------- |
| GHL token refresh not logged to cron_job_log | Add logging                                    | Phase 0e |
| No active alerting on sync failures          | Add admin banner for ANY failure (not just 3+) | Phase 0  |
| Transcript queue stuck silently              | Add queue depth to admin dashboard             | Phase 0  |
| EOS sub-sync partial failures invisible      | Break into separate logged sub-jobs            | Phase 2  |
| Score recalc decoupled from profile saves    | Add real-time recalc trigger                   | Phase 1  |

---

## Total Effort & Cost

| Phase                                | Sessions  | New Monthly Cost | Cumulative Impact                                                      |
| ------------------------------------ | --------- | ---------------- | ---------------------------------------------------------------------- |
| 0 — Fix what's broken                | 2-3       | $0               | Transcripts searchable, profile fields visible, briefs get real data   |
| 1 — Auto-populate profiles           | 2         | $0               | Profiles fill from calls automatically, scores update in real-time     |
| 2 — Pre-computed briefs              | 2-3       | ~$10             | 80% of questions answered from one read, consistent fast responses     |
| 3 — Retrieval chaining               | 2         | $0               | Franchisee questions get full picture automatically                    |
| 4 — Voyage AI + contextual retrieval | 3-4       | ~$30             | Semantic search across all transcripts, 49-67% fewer failed retrievals |
| 5 — RAG in Scout chat                | 2-3       | $0               | Every Scout answer enriched with relevant transcript/doc context       |
| 6 — Retrieval planner                | 2-3       | $0               | Scout picks optimal strategy per question, quality improves over time  |
| **Total**                            | **15-21** | **~$40/mo**      |                                                                        |

---

## Success Criteria

After all 7 phases:

1. **"How is franchisee X doing?"** → Full picture: contact + territory + KPIs + EOS + inventory in one response
2. **"Which prospects mentioned concerns about royalties?"** → Specific quotes from relevant call transcripts
3. **Profiles auto-populate** — after 3 calls, 50+ structured fields without anyone clicking save
4. **Response time under 5 seconds** for brief-based questions (80% of questions)
5. **Zero "I don't have that data" failures** on questions where the data exists in the system
6. **Works at scale** — 900K properties, 1M+ transcript chunks, thousands of contacts
7. **No silent failures** — every sync issue visible in admin dashboard within 15 minutes

## Consequences

- Monthly cost increases ~$40 (Voyage AI + brief generation)
- One-time re-embedding job when switching OpenAI → Voyage (Phase 4)
- Embedding dimension change requires index rebuild (Phase 4)
- Auto-save means data appears without rep action — clear labeling needed
- Brief generation adds ~2 minutes to nightly cron runtime
- Richer Scout responses use more tokens per turn (offset by fewer tool calls)
