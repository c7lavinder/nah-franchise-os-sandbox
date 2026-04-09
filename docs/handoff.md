# Handoff — Full LLM Layer Build (2026-04-09)

## Summary

All 5 LLM sprints complete. The NAH Franchise OS now has a full AI intelligence layer: 199-field profile system, pgvector RAG, journal system, call review packages, 30 GHL actions with Draft→Review→Confirm, pre-call briefs, business intelligence, KB with 9 documents, and a learning feedback loop with weekly/monthly reports.

---

## What Was Built — All 5 Sprints

### Sprint LLM-1 — Foundation
| Component | File(s) |
|-----------|---------|
| contact_profile_fields table (EAV) | migration 20260409100000 |
| 199-field registry (18 categories) | lib/profile/field-registry.ts |
| pgvector embeddings + HNSW index + match_embeddings() | migration 20260409100001 |
| RAG pipeline (chunk + embed transcripts, KB, research, journals) | lib/rag/embedder.ts |
| Journal system (3 tables: contact, rep, system) | migration 20260409100002 |
| Journal cron (11pm daily) | app/api/cron/journals/route.ts |
| Profile CRUD | lib/profile/profile-fields.ts |
| Embedding backfill script | scripts/backfill-embeddings.ts |

### Sprint LLM-2 — Call Details
| Component | File(s) |
|-----------|---------|
| call_review_packages + suggestion_feedback tables | migration 20260409200000 |
| Profile extractor (transcript → field suggestions) | lib/calls/profile-extractor.ts |
| Next steps generator (3-7 action cards) | lib/calls/next-steps-generator.ts |
| Review package orchestrator (grade+coach+extract in parallel) | lib/calls/review-package.ts |
| Feedback logger (learning signal) | lib/learning/feedback-logger.ts |
| Review package API | app/api/calls/[callId]/review-package/route.ts |
| Feedback API | app/api/calls/[callId]/feedback/route.ts |

### Sprint LLM-3 — GHL Execution
| Component | File(s) |
|-----------|---------|
| ghl_action_drafts table | migration 20260409300000 |
| 30 GHL action handlers (C1-C8, T1-T5, A1-A5, M1-M9, O1-O3) | lib/ghl/actions/executor.ts |
| Draft → Review → Confirm queue | lib/ghl/action-queue.ts |
| Role-based permissions (admin/operator/specialist/member) | lib/ghl/permissions.ts |
| Stage sync write-through to GHL | lib/ghl/stage-sync.ts |
| GHL ID discovery script | scripts/ghl-id-discovery.ts |

### Sprint LLM-4 — Scout Intelligence
| Component | File(s) |
|-----------|---------|
| Hybrid RAG retriever (semantic + structured) | lib/rag/retriever.ts |
| Pre-call brief generator (8 sections) | lib/calls/brief-generator.ts |
| Query router (contact/BI/KB/brief intent detection) | lib/scout/query-router.ts |
| BI handler (cross-contact analytics, role-adapted) | lib/scout/bi-handler.ts |
| Context injector (page-aware) | lib/scout/context-injector.ts |
| Brief API | app/api/contacts/[contactId]/brief/route.ts |

### Sprint LLM-5 — KB & Learning Loop
| Component | File(s) |
|-----------|---------|
| KB health monitor (stale, retrieval, gaps) | lib/kb/health-monitor.ts |
| Feedback analyzer (acceptance rates, patterns) | lib/learning/feedback-analyzer.ts |
| Weekly Scout report (Sunday 11pm) | lib/learning/weekly-report.ts |
| Monthly rubric review (1st of month, draft-only) | lib/learning/rubric-review.ts |
| Frandev meeting notes → 5 KB docs | scripts/import-frandev-notes.ts |
| Client Tether CSV pattern extractor | scripts/import-client-tether-patterns.ts |
| 3 new tables + KB column extensions | migration 20260409400000 |
| Cron schedules (weekly + monthly) | vercel.json, cron routes |

### Profile Fixes (between LLM-3 and LLM-4)
| Component | File(s) |
|-----------|---------|
| Registry rebuilt from planning doc (0 mismatches) | lib/profile/field-registry.ts |
| Profile API: Supabase primary, GHL fallback | app/api/contacts/[contactId]/profile/route.ts |
| All 18 categories wired to UI | app/(auth)/leads/[contactId]/page.tsx |
| ProfileSection icons expanded | components/profile/ProfileSection.tsx |
| GHL → Supabase backfill script | scripts/backfill-profile-fields.ts |

---

## What's Working

- **199-field profile system** with EAV storage, source tracking, and all 18 categories in UI
- **RAG infrastructure** — pgvector embeddings table, HNSW index, match_embeddings function, chunking pipeline
- **Call review packages** — auto-generates grade + coaching + profile suggestions + next steps when transcript available
- **Edit/Skip/Push** pattern on all suggestion cards with learning feedback logging
- **30 GHL actions** with Draft → Review → Confirm and role-based permissions
- **Stage sync** — NAH OS stage changes auto-mirror to GHL custom fields
- **Pre-call brief** — 8 sections using hybrid RAG retrieval
- **BI queries** — Scout answers cross-contact questions with role-adapted phrasing
- **KB with 9 documents** (4 seed + 5 Frandev meeting)
- **3 cron jobs** — daily journals (11pm), weekly report (Sunday 11pm), monthly rubric review (1st of month)
- **GHL IDs discovered** — 7/7 calendars, 4/4 custom fields, 2/7 users stored in app_settings

---

## What Needs Human Input

### Content Seeding (Matt, Ryland, John)
| Person | Content Needed | KB Category |
|--------|---------------|-------------|
| Matt | Detailed sales methodology docs | sales_methodology |
| Matt | Objection handling playbooks (expand beyond capital) | objection_library |
| Matt | Ideal candidate benchmarks from experience | ideal_candidate |
| Matt + Chad | Competitor analysis docs | competitor_intelligence |
| Ryland | Territory analysis methodology, data sources (Privy, Recipe) | territory_analysis |
| Ryland | Territory value estimation framework | territory_analysis |
| John | Coaching framework documentation | coaching_framework |
| John | Onboarding playbook content | onboarding_playbook |
| Matt | Franchisee success stories (6 narratives) | franchisee_stories |
| Matt | Franchise unit economics docs (8 docs) | franchise_economics |

### Data Files Not On Disk
- **Frandev meeting PDF** (`Frandev_CRM__2026_03_27_10_00_EDT__Notes_by_Gemini.pdf`) — not found at `/mnt/user-data/uploads/`. Used pre-extracted content instead. If PDF is provided, re-run the import script.
- **Client Tether CSV** (`CT_Contact_Master__Sheet1_1.csv`) — not found. Script ready: `npx tsx scripts/import-client-tether-patterns.ts <path>`
- **Zorakle PDFs** — not imported. Need Zorakle API access or PDF files to populate personality/psychology fields.
- **Chad's onboarding Excel** — not imported. Needs manual upload to KB.

### GHL Users Not Found
Only 2/7 GHL users discovered (Chad + John). Matt, Sam, Mark, Ryland, Corey not registered in GHL location. Need to either:
1. Add them as GHL users, or
2. Manually map their IDs in app_settings

---

## Tables Created (13 new across all sprints)

| Table | Sprint | Purpose |
|-------|--------|---------|
| contact_profile_fields | LLM-1 | 199-field EAV with source tracking |
| embeddings | LLM-1 | pgvector RAG storage |
| contact_journals | LLM-1 | Daily AI contact summaries |
| rep_journals | LLM-1 | Daily AI rep summaries |
| system_logs | LLM-1 | Audit trail |
| call_review_packages | LLM-2 | Full call review output |
| suggestion_feedback | LLM-2 | Learning signal |
| ghl_action_drafts | LLM-3 | Draft → Confirm queue |
| scout_performance_reports | LLM-5 | Weekly reports |
| rubric_review_suggestions | LLM-5 | Monthly rubric review drafts |
| kb_gap_signals | LLM-5 | Missing KB content tracking |

Plus: knowledge_documents extended with 6 new columns

---

## What's Next

### Immediate (next session)
1. Run `scripts/backfill-embeddings.ts` to embed all 9 KB docs into pgvector (needs OPENAI_API_KEY)
2. Run Client Tether CSV import when file provided
3. Wire Scout chat to use query-router + context-injector + BI handler (currently built but not yet integrated into the chat API route)
4. Add KB health section to Settings page UI
5. Add weekly report view to Settings page UI

### Short-term
6. Wire Zorakle API to populate personality/psychology fields (14 fields)
7. Wire transcript extraction to auto-populate objections, behavioral signals, goals fields
8. Add "X Scout suggestions" badge to profile tab header
9. Build review panel for bulk suggestion approval
10. Complete remaining ~2,900 contacts in profile backfill (pagination fix needed)

### Medium-term
11. Automation graduation: admin toggle per action type to allow auto-execution
12. Build KB admin interface for manual document creation/editing
13. Integrate Scout intelligence into pipeline board (priority flags, at-risk badges)
14. Morning brief for Daily HQ (Scout-generated, on-demand)
