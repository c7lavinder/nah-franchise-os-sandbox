# Scout Retrieval Brain — Gaps & Limitations

> Honest audit of what the Retrieval Brain can't do yet, where it might break, and what could be improved. Organized by severity.

---

## Critical Gaps

### 1. Uploaded documents are never embedded

When someone uploads a PFS, Zorakle profile, or franchise agreement via the journey documents API, the file gets stored — but it is **never embedded** into the search index. The `embedExternalResearch()` function exists but is never called from the upload route (`app/api/journeys/[journeyId]/documents/route.ts`).

**Impact:** The `search_documents` tool will return zero results for uploaded files. It can only find documents that were manually embedded through some other path. This is the biggest gap in the system right now.

**Fix:** Call `embedExternalResearch()` after document upload + text extraction, similar to how `embedTranscript()` is called after transcription.

---

### 2. Transcript embeddings are never updated

When a transcript is first embedded, the system stores the chunks and skips that transcript on future backfill runs. But transcripts can be re-transcribed (better audio, re-processing). If a transcript's text changes after initial embedding, the old (stale) chunks stay in the index forever.

KB documents handle this correctly — `embedKBDoc()` deletes old embeddings before creating new ones. Transcripts don't.

**Impact:** If a transcript is re-processed, the search index has the old version. Could return outdated or incorrect quotes.

**Fix:** Add a delete-before-embed step to `embedTranscript()`, matching the pattern in `embedKBDoc()`.

---

### 3. No embedding failure visibility

When transcript embedding fails (Voyage API down, rate limit, network error), the error is logged to `console.error` and silently swallowed. There is no:

- Record in `cron_job_log` of embedding failures
- Admin dashboard indicator showing un-embedded content
- Retry mechanism for failed embeddings
- Count of total embedded vs total transcripts available anywhere

**Impact:** Transcripts could silently pile up without embeddings and nobody would know. The system would gradually degrade without any visible signal.

**Fix:** Add an embedding health check — compare `call_transcripts` count to `embeddings WHERE content_type = 'transcript'` count. Surface the delta in the admin dashboard. Add retry logic or a "repair embeddings" admin endpoint.

---

## Significant Gaps

### 4. Question classifier is regex-only — no understanding of context

The classifier uses pattern matching to guess what type of question someone is asking. It has no awareness of:

- **Who is being discussed.** "How is John doing?" matches the territory pattern (`how is .* doing`) even if John is a prospect, not a territory.
- **Conversation context.** If Chad is mid-conversation about a specific prospect and asks "what about his capital?", the classifier sees "capital" and picks `prospect` — correct this time, but only by keyword luck.
- **Ambiguous questions.** "What's happening?" matches nothing specific and falls through to `general` with 0 token retrieval budget — even though it might benefit from recent transcript context.
- **Multi-intent questions.** "Prep me for my call with Chuck and also compare Spokane vs Boise" matches `call_prep` (first match wins) and the comparison intent gets no retrieval boost.

**Impact:** Sometimes the wrong retrieval strategy fires. Too little context for complex questions, or wasted retrieval on simple ones. The system still works because Scout has explicit tools it can call — pre-fetch is a bonus, not the only path. But it's leaving quality on the table.

**Fix (future):** Replace regex classifier with a lightweight LLM classification call (Haiku, ~50ms) that understands intent and returns structured JSON. Or use the page context (which page the user is on) to improve classification accuracy.

---

### 5. Pre-fetch context doesn't know which contact is active

The pre-fetch runs a broad search across all content. It doesn't scope the search to the contact currently being viewed in the UI, even though `pageContext.contactId` is available in `buildSystemPrompt`.

**Impact:** If Chad is on Chuck Rierson's detail page and asks "what did he say about capital?", the pre-fetch searches all transcripts for "capital" instead of just Chuck's transcripts. Results may include irrelevant chunks from other contacts' calls.

**Fix:** Pass `pageContext.contactId` into `prefetchContext()` and use it to scope transcript/document searches when available.

---

### 6. No embedding for briefs or intelligence summaries

The `profile_summary` content type exists in the schema but is never used. Contact briefs and territory briefs are stored as text in their own tables but are never embedded into the search index.

**Impact:** When someone asks "which contacts have concerns about construction risk?", the search can find transcript chunks that mention it — but it can't find the brief summary that says "Key concern: construction risk." Briefs are only accessible through `get_entity`, not through search.

**Fix:** Embed brief summaries as `profile_summary` content type. Re-embed when briefs are regenerated. This would make brief content searchable across contacts.

---

### 7. Journal entries don't get contextual chunking

Transcripts and KB docs get contextual metadata prepended before embedding (contact name, call date, category, etc.). Journal entries are embedded as raw text with no context prepended.

**Impact:** Journal entry chunks lack the contextual signals that help the embedding model and reranker understand relevance. A journal note about "capital discussion with Chuck" is embedded without knowing it's about Chuck, making it less likely to surface when searching for Chuck's capital situation.

**Fix:** Add a `contextualizeJournalChunk()` function similar to transcript/KB contextualizers. Prepend contact name + journal date.

---

### 8. External research has no contextual chunking

Similar to journals — `embedExternalResearch()` chunks the content at 300 tokens with no context prepended. The caller only passes `contactId`, `content`, and `source` — no contact name, document title, or category.

**Impact:** Uploaded document chunks are embedded without context about who they belong to or what type of document they are. Retrieval quality for these chunks will be lower than transcripts or KB docs.

**Fix:** Expand `embedExternalResearch()` to accept and prepend contextual metadata (contact name, document title, document type).

---

### 9. Reranking happens twice in some pre-fetch paths

When the question classifier calls for reranking, the `prefetchContext` function first searches each content type individually without reranking, then runs a second full `hybridSearch` with reranking on the merged query. This second search is a completely independent search — it doesn't rerank the merged results from step one, it runs a fresh search.

**Impact:** Double the Voyage API calls (embeddings + reranking). Extra latency (~100-200ms per rerank call). The fresh reranked search might return different results than the per-content-type searches, meaning some relevant results from step one could get dropped.

**Fix:** Search all content types in one `hybridSearch` call with rerank enabled, instead of searching per-type then re-searching with rerank.

---

## Moderate Gaps

### 10. No territory-scoped transcript search

The ADR spec called for `search_transcripts(query, contact_id?, territory_slug?)` but territory_slug was not implemented. You can search all transcripts or scope to one contact, but you can't search across all calls for contacts in a specific territory.

**Impact:** "What are Spokane franchisees saying about lead flow?" requires searching each franchisee's transcripts individually instead of one territory-scoped query.

**Fix:** Add territory_slug parameter. Resolve territory → owner contact IDs, then search transcripts scoped to those contacts.

---

### 11. Chunk size is fixed — not adapted to content type

All transcripts use 400-token chunks with 50-token overlap. All external research uses 300-token chunks. These are hardcoded.

Some content benefits from larger chunks (long monologues, detailed financial discussions) and some from smaller (quick Q&A exchanges). The same chunk size is used regardless.

**Impact:** Long-form content gets fragmented into chunks that lose context. Short-form content gets combined into chunks that mix unrelated topics.

**Fix (future):** Adaptive chunking based on content structure — split on speaker turns for transcripts, on section headers for documents, on topic boundaries for longer content.

---

### 12. BM25 search uses basic English tokenization

The `content_tsv` column uses PostgreSQL's built-in `to_tsvector('english', content)` which handles English stemming and stop words. But it doesn't handle:

- Industry-specific acronyms (FDD, ARV, NDA, EOS, PFS) — these get treated as regular words
- Franchise-specific terms (Trainual, MasterSuite, Zorakle) — no special handling
- Contact names with unusual spelling — stemming can mangle them

**Impact:** A BM25 search for "FDD" will work (exact match), but searching for "franchise disclosure" won't connect to chunks that only contain "FDD." The semantic search usually compensates, but BM25 misses are missed opportunities in the hybrid fusion.

**Fix (future):** Add a custom text search dictionary or synonym list for NAH-specific terms. Or add a term expansion step before BM25 search.

---

### 13. No retrieval quality feedback loop

The `scout_retrieval_logs` table records what was retrieved, but there's no mechanism to measure whether the retrieval was actually useful. We don't track:

- Whether Scout's answer used the pre-fetched context or ignored it
- Whether the user was satisfied with the answer
- Whether Scout had to make additional tool calls for information that should have been in the pre-fetch

**Impact:** We can see what was retrieved but not whether it helped. Tuning retrieval parameters is guesswork without this data.

**Fix (future):** Post-response analysis — compare Scout's answer text to the pre-fetched chunks to calculate a "reference rate" (how much of the pre-fetch actually appeared in the answer). Track when Scout calls search tools despite having pre-fetch context — that's a signal the pre-fetch missed.

---

### 14. Briefs can be stale for up to 24 hours

Contact briefs are marked stale after a call is processed, but they're only regenerated by the nightly cron. If a call happens at 8 AM, the brief stays stale until the cron runs that night (~11 PM). During that window, Scout serves the old brief summary.

**Impact:** Scout's "at a glance" summary could be missing information from today's calls for most of the business day.

**Fix:** Regenerate stale briefs on-demand when `get_entity` detects a stale brief, instead of waiting for the nightly cron. The brief generator is fast enough (~1-2 seconds) to run inline.

---

### 15. Token budget estimation is rough

Token budgets are enforced using a "4 characters = 1 token" estimate. Real tokenization varies — some words are 1 token, some are 3+ tokens. The estimate can be off by 20-30%.

**Impact:** A 5K token budget might actually inject 4K or 6.5K tokens of context. Not a major issue since the system prompt has plenty of headroom, but it means the budget isn't precise.

**Fix (low priority):** Use a proper tokenizer (like `tiktoken` or Anthropic's token counter) for accurate counting. Probably not worth the added dependency for the marginal improvement.

---

## Low-Priority Gaps

### 16. No multi-language support

All chunking, BM25 tokenization, and contextual prepending assumes English. If a call transcript contains Spanish, French, or other languages (from bilingual prospects), those sections will be poorly tokenized and may not retrieve well.

**Impact:** Minimal for now — NAH operates in English. Would matter if the franchise expands internationally.

---

### 17. No embedding versioning

There's no record of which embedding model or version was used for each row in the embeddings table. If Voyage releases a new model (voyage-4?) or we switch providers again, we can't identify which embeddings need re-generation without a full re-embed.

**Impact:** Future model upgrades require truncating everything and re-embedding from scratch, as we did in Phase 4. With a version column, we could selectively re-embed.

**Fix:** Add a `model_version` column to the embeddings table. Populate on insert.

---

### 18. Pre-fetch adds to system prompt size

Every pre-fetch injection adds 2K-10K tokens to the system prompt, which is already large (knowledge base, pipeline snapshot, scoring context, calendars, etc.). This increases input token costs on every Scout turn.

**Impact:** Higher API costs per conversation turn. At scale, this adds up. Currently negligible with Haiku execution.

**Fix (future):** The question classifier already prevents retrieval on simple questions (general, metric). Could also add a system prompt token budget that limits total context size — if the system prompt is already at 50K tokens, reduce or skip the pre-fetch.

---

### 19. Backfill is one-shot, not idempotent for transcripts

`embedAllExistingTranscripts()` checks if a transcript already has embeddings and skips it. But it only checks existence — not whether the embeddings are current (same model, same contextual chunking). After a model change, re-embedding requires using the admin `backfill-embeddings` endpoint with `force: true` to delete everything first.

**Impact:** There's no "smart re-embed" — it's all or nothing. Fine for now with 70 transcripts, would be slow at 10,000+.

---

### 20. No search result attribution in Scout's response

When Scout uses pre-fetched context or search results, there's no visible attribution in the response. The user can't tell whether Scout's answer came from a specific call transcript, a KB document, or structured data.

**Impact:** Trust issue — the user can't verify where information came from. If Scout says "Chuck mentioned capital concerns," the user can't click through to the specific call or transcript moment.

**Fix (future):** Include source citations in Scout's response format. The chunk metadata has `source_id` which maps to transcript IDs and KB doc IDs — pass these through and render as clickable links.

---

## Summary Table

| #   | Gap                                   | Severity    | Effort | Impact                                   |
| --- | ------------------------------------- | ----------- | ------ | ---------------------------------------- |
| 1   | Uploaded documents never embedded     | Critical    | Small  | search_documents returns nothing         |
| 2   | Transcript embeddings never updated   | Critical    | Small  | Stale search results after re-processing |
| 3   | No embedding failure visibility       | Critical    | Medium | Silent degradation                       |
| 4   | Classifier is regex-only              | Significant | Medium | Wrong retrieval strategy sometimes       |
| 5   | Pre-fetch ignores active contact      | Significant | Small  | Irrelevant chunks on contact pages       |
| 6   | Briefs/intelligence not embedded      | Significant | Small  | Brief content not searchable             |
| 7   | Journals lack contextual chunking     | Significant | Small  | Lower retrieval quality for journals     |
| 8   | External research lacks context       | Significant | Small  | Lower retrieval quality for docs         |
| 9   | Double reranking in pre-fetch         | Significant | Small  | Wasted API calls + latency               |
| 10  | No territory-scoped transcript search | Moderate    | Medium | Can't search by territory                |
| 11  | Fixed chunk sizes                     | Moderate    | Medium | Suboptimal chunking                      |
| 12  | BM25 lacks NAH terminology            | Moderate    | Medium | Missed keyword matches                   |
| 13  | No retrieval feedback loop            | Moderate    | Large  | Can't measure quality                    |
| 14  | Briefs stale for up to 24 hours       | Moderate    | Small  | Stale summaries during business day      |
| 15  | Rough token budget estimation         | Moderate    | Small  | Budget off by 20-30%                     |
| 16  | No multi-language support             | Low         | Large  | English-only                             |
| 17  | No embedding versioning               | Low         | Small  | Full re-embed on model change            |
| 18  | Pre-fetch increases prompt size       | Low         | Small  | Higher API costs                         |
| 19  | Backfill not idempotent               | Low         | Medium | All-or-nothing re-embedding              |
| 20  | No source attribution                 | Low         | Medium | User can't verify sources                |

---

## Recommended Priority Order

If picking what to fix next, these deliver the most value for the least effort:

1. **#1 — Embed uploaded documents** (1 hour, critical)
2. **#5 — Scope pre-fetch to active contact** (30 min, high impact)
3. **#2 — Delete-before-embed for transcripts** (30 min, critical)
4. **#9 — Fix double reranking** (30 min, saves API calls)
5. **#3 — Embedding health check** (1-2 hours, prevents silent failures)
6. **#14 — On-demand brief regeneration** (1 hour, better freshness)
7. **#7 + #8 — Contextual chunking for journals + external research** (1 hour total)
