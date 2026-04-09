# Sprint LLM-1 — Foundation
**Goal:** Lay the infrastructure everything else depends on. Do not skip this sprint.
**Estimated time:** 3–4 hours
**Branch:** `feature/llm-foundation`

---

## Read These First
1. `docs/memory.md`
2. `docs/llm-planning/LLM_SESSION_CONTEXT.md`
3. `docs/llm-planning/NAH_Profile_Tab_v2_Expanded.md`
4. Current Supabase schema (query it directly to see what exists)

---

## Context
The platform has 46 profile fields today across 8 categories. We are expanding to 199 fields across 18 categories. We are also setting up the RAG infrastructure (pgvector embeddings) and a 3-type journal system that runs on an 11pm cron.

**Existing profile fields to PRESERVE — do not rename or remove:**
Territory (4 fields), Franchise Fit (7), Financial (5), Trainual (5), Validation (6), Engagement (6), AI Scout (9), Compliance (4)

---

## Tasks

### Task 1: Supabase Schema — Profile Tab Expansion
- Read `/docs/llm-planning/NAH_Profile_Tab_v2_Expanded.md` for the full 199-field list
- Add all new fields to the `contact_profile` table (or equivalent) in Supabase
- Preserve all 46 existing fields exactly as they are
- Add metadata columns to every field: `last_updated_by` (enum: api / ai / manual), `last_updated_at` (timestamp), `source_history` (jsonb array of last 3 updates)
- Indexes: add index on `contact_id`, `last_updated_by`, `last_updated_at`
- Write migration file. Dry-run first, confirm no data loss, then execute.

### Task 2: pgvector Embeddings Table
- Create `embeddings` table in Supabase with pgvector extension
- Schema:
  ```sql
  id uuid primary key
  tenant_id uuid
  contact_id uuid (nullable — null for KB docs + external research)
  content_type text (enum: transcript | kb_doc | external_research | journal | profile_summary)
  content text
  embedding vector(1536)
  metadata jsonb (store: chunk_index, source_id, category, date, rep_id, call_id as applicable)
  created_at timestamptz
  updated_at timestamptz
  ```
- Enable pgvector extension if not already enabled
- Create HNSW index on embedding column for fast similarity search
- Create helper function: `match_embeddings(query_embedding, content_type_filter, contact_id_filter, limit)` → returns top-k results with similarity score

### Task 3: Chunking + Embedding Pipeline
Build `lib/rag/embedder.ts` with these functions:
- `embedTranscript(transcriptId)` — chunks by 400 tokens with 50-token overlap, embeds each chunk, stores with metadata (contact_id, call_id, call_date, rep_id)
- `embedKBDoc(docId)` — chunks by section header (split on ##), embeds each section, stores with metadata (category, doc_title, last_updated)
- `embedExternalResearch(contactId, content, source)` — chunks by 300 tokens, embeds, stores with contact_id + source metadata
- `embedJournalEntry(journalId)` — embeds full entry as single chunk (journals are short), stores with contact_id + date
- `getEmbedding(text)` — calls OpenAI text-embedding-3-small, returns vector
- Backfill function: `embedAllExistingTranscripts()` — runs on all existing call transcripts in DB
- Backfill function: `embedAllExistingKBDocs()` — runs on all existing KB docs

### Task 4: Journal System — Schema
Create 3 new tables:

**contact_journals**
```sql
id uuid primary key
contact_id uuid references contacts(id)
tenant_id uuid
journal_date date
summary text (AI-generated summary of day's interactions)
interactions jsonb (array of: type, timestamp, key_signals, sub_task_logged, action_taken)
signals_extracted jsonb (new data points noticed today)
embedding_id uuid (references embeddings table after embed)
created_at timestamptz
```

**rep_journals**
```sql
id uuid primary key
user_id uuid references users(id)
tenant_id uuid
journal_date date
summary text (AI-generated summary of rep's day)
contacts_touched int
calls_completed int
sub_tasks_logged int
ghl_actions_fired int
coaching_notes text (patterns Scout noticed in rep's calls today)
focus_tomorrow text (Scout's suggestion for tomorrow)
created_at timestamptz
```

**system_logs**
```sql
id uuid primary key
tenant_id uuid
log_date date
action_type text
contact_id uuid (nullable)
user_id uuid (nullable)
input_params jsonb
result_summary text
was_auto boolean default false
created_at timestamptz
```

### Task 5: Journal Cron Jobs (11pm daily)
Add 3 cron jobs to the cron system at 23:00 daily:

**contact_journal_cron**: 
- For every contact that had any interaction today (call, message, sub-task log, Scout action)
- Pull all of today's activity for that contact
- Call Claude API to generate structured journal entry
- Save to `contact_journals`
- Immediately embed the journal entry (call `embedJournalEntry`)
- Log to cron_job_log

**rep_journal_cron**:
- For every active user
- Pull all of their activity today (calls made, tasks completed, sub-tasks logged, GHL actions)
- Call Claude API to generate structured rep journal
- Save to `rep_journals`
- Log to cron_job_log

**system_log_cron**:
- Aggregate all `scout_action_logs` from today into a daily summary
- Save to `system_logs`
- Log to cron_job_log

All 3 cron jobs should appear in the Settings cron calendar view.

### Task 6: Backfill Existing Data
- Run `embedAllExistingTranscripts()` for all calls in DB
- Run `embedAllExistingKBDocs()` for all KB docs in DB
- Log completion counts to console
- Do NOT embed contact profiles as vectors — those are queried directly from Supabase

---

## Acceptance Criteria
- [ ] `contact_profile` table has all 199 fields with source metadata columns
- [ ] All 46 existing profile fields still work exactly as before
- [ ] `embeddings` table exists with pgvector, HNSW index, and `match_embeddings` function
- [ ] All 4 embedding functions exist and tested with a sample transcript + KB doc
- [ ] All 3 journal tables exist with correct schema
- [ ] All 3 cron jobs exist, fire at 11pm, and appear in Settings cron calendar
- [ ] Backfill runs successfully without errors
- [ ] Migration is reversible (write down migration)
- [ ] No existing functionality broken

## What NOT to Touch
- Existing call grader, coach, or brief generator logic
- Existing Scout chat UI
- Existing pipeline/stage data
- Existing KB document structure
- Auth system
