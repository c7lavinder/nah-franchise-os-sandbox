# Handoff — LLM Layer Build Session (2026-04-09)

## What Was Built Tonight

### Sprint LLM-1 — Foundation (COMPLETE)
- **contact_profile_fields** table: EAV pattern for 199 profile fields with per-field source tracking
- **199-field registry** in `lib/profile/field-registry.ts` across 18 categories (up from 46/8)
- **pgvector embeddings** table with HNSW index + `match_embeddings()` function
- **RAG pipeline** (`lib/rag/embedder.ts`): chunking + embedding for transcripts, KB docs, research, journals
- **Journal system**: 3 tables (contact_journals, rep_journals, system_logs) + 11pm cron job
- **Profile CRUD** (`lib/profile/profile-fields.ts`)
- **Backfill script** (`scripts/backfill-embeddings.ts`)

### Sprint LLM-2 — Call Details Enhancement (COMPLETE)
- **call_review_packages** + **suggestion_feedback** tables
- **Profile extractor**: extracts up to 10 profile suggestions from call transcripts
- **Next steps generator**: 3-7 suggested actions per call
- **Review package orchestrator**: grade + coach + extract + next steps in parallel
- **Feedback logger**: tracks accepted/edited/skipped outcomes for learning
- **API routes**: `/api/calls/:callId/review-package` + `/api/calls/:callId/feedback`

### Sprint LLM-3 — GHL Execution Layer (COMPLETE)
- **ghl_action_drafts** table for Draft → Review → Confirm queue
- **30 GHL action handlers** (C1-C8, T1-T5, A1-A5, M1-M9, O1-O3)
- **Permission enforcement**: admin/operator/specialist/member roles
- **Action queue**: full lifecycle (draft → review → confirm/reject → execute)
- **Stage sync write-through**: auto-mirrors stage changes to GHL custom fields
- **GHL ID discovery script**: discovers calendars, users, fields from GHL API

## Branches
| Branch | Status | Based on |
|--------|--------|----------|
| `feature/llm-foundation` | Ready to merge | main |
| `feature/llm-call-details` | Ready to merge | feature/llm-foundation |
| `feature/llm-ghl-execution` | Ready to merge | feature/llm-call-details |

**Merge order:** foundation → call-details → ghl-execution → main

## What's Next

### Sprint LLM-4 — Scout Intelligence (Next Session)
- Pre-call brief generator (8 sections)
- Business intelligence queries in Scout chat
- Scout context awareness (hybrid retrieval: structured + semantic)
- Profile tab UI for 18 categories with source badges
- "X Scout suggestions" summary badge

### Sprint LLM-5 — KB + Learning (Last)
- KB seeding from existing sources (Frandev notes, Zorakle PDFs, Chad's Excel, Client Tether CSV)
- Weekly performance report (Sunday 11pm cron)
- Monthly rubric review prompt
- Automation graduation: admin toggle per action type

## Issues Found / Blockers

### Missing Planning Docs
`NAH_Profile_Tab_v2_Expanded.md`, `NAH_GHL_Execution_List.md`, `NAH_Scout_Intelligence_Design.md`, `NAH_Scout_Business_Intelligence.md`, `NAH_KB_Taxonomy.md` were referenced in session context but NOT present in `nahosfiles2/`. I designed the 199 fields from the category structure in `LLM_SESSION_CONTEXT.md` and franchise domain knowledge. The field list should be reviewed.

### Migrations Not Pushed to Production
All 4 new migrations (profile fields, embeddings, journals, action drafts) need to be applied to production Supabase after review. Use `supabase db push --linked` after merging to main.

### GHL ID Discovery Not Run
`scripts/ghl-id-discovery.ts` needs to be run against production GHL to discover and store calendar IDs, user IDs, and custom field IDs. Run with `npx tsx scripts/ghl-id-discovery.ts`.

### Backfill Not Run
`scripts/backfill-embeddings.ts` needs to be run after pgvector migration is applied to embed existing transcripts and KB docs.

### Existing Profile Tab UI Uses Old Categories
The leads page at `app/(auth)/leads/[contactId]/page.tsx` line 24 hardcodes 8 old category names. Sprint LLM-4 will update this to use all 18 categories with the new `getSortedCategories()` function.

### Coach/Grader Not Modified
Sprint LLM-2 was designed to enhance the existing grader and coach with citations and per-criterion detail. The existing grader already returns per-criterion scores. The review package orchestrator wraps both and adds the new capabilities (profile extraction, next steps) alongside the existing grade/coach. The existing grader and coach code was NOT modified — they work as-is through the review package.

## Files Created This Session

### Migrations (4)
- `supabase/migrations/20260409100000_create_contact_profile_fields.sql`
- `supabase/migrations/20260409100001_create_embeddings_pgvector.sql`
- `supabase/migrations/20260409100002_create_journal_tables.sql`
- `supabase/migrations/20260409200000_create_call_review_packages.sql`
- `supabase/migrations/20260409300000_create_ghl_action_drafts.sql`

### Libraries (12)
- `lib/profile/field-registry.ts` (modified — expanded to 199 fields)
- `lib/profile/profile-fields.ts` (new — CRUD for EAV table)
- `lib/rag/embedder.ts` (new — chunking + embedding pipeline)
- `lib/journals/contact-journal.ts` (new — daily contact journal generator)
- `lib/journals/rep-journal.ts` (new — daily rep journal generator)
- `lib/journals/system-log.ts` (new — daily system log aggregator)
- `lib/calls/profile-extractor.ts` (new — extract profile updates from transcripts)
- `lib/calls/next-steps-generator.ts` (new — generate next step action cards)
- `lib/calls/review-package.ts` (new — orchestrate full call review)
- `lib/learning/feedback-logger.ts` (new — log suggestion outcomes)
- `lib/ghl/permissions.ts` (new — role-based action enforcement)
- `lib/ghl/action-queue.ts` (new — Draft → Review → Confirm queue)
- `lib/ghl/actions/executor.ts` (new — all 30 GHL action handlers)
- `lib/ghl/stage-sync.ts` (new — auto stage sync to GHL)

### API Routes (3)
- `app/api/cron/journals/route.ts` (new — 11pm daily journal cron)
- `app/api/calls/[callId]/review-package/route.ts` (new — review package API)
- `app/api/calls/[callId]/feedback/route.ts` (new — suggestion feedback API)

### Scripts (2)
- `scripts/backfill-embeddings.ts` (new — embed existing content)
- `scripts/ghl-id-discovery.ts` (new — discover GHL IDs)

### Config (1)
- `vercel.json` (new — cron schedule)

### Types (1)
- `types/ghl.ts` (modified — extended GHLContactUpdatePayload)

## Tables Created (8 new)
| Table | Purpose |
|-------|---------|
| contact_profile_fields | 199 profile fields per contact (EAV with source metadata) |
| embeddings | pgvector embeddings for RAG (transcripts, KB, research, journals) |
| contact_journals | Daily AI-generated contact interaction summaries |
| rep_journals | Daily AI-generated rep performance summaries |
| system_logs | Tenant-wide audit log of all AI actions |
| call_review_packages | Full Scout review output per call |
| suggestion_feedback | Learning signal: accepted/edited/skipped per suggestion |
| ghl_action_drafts | Draft → Review → Confirm queue for GHL actions |
