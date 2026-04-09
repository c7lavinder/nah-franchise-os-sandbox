# NAH Franchise OS — LLM Layer Planning Session
**Date:** 2026-04-09
**Status:** Planning complete — ready for Claude Code build
**This file:** Complete context dump of every decision made. Read this before any LLM sprint.

---

## 1. What Was Designed This Session

This session designed the full LLM intelligence layer for NAH Franchise OS. The platform already has Sprints 0–9 complete (pipelines, contacts, calls, grading, coaching, Scout v2). This session defines what Scout becomes — a genuine second brain for the company.

**Scout's 5 roles:**
- **Researcher** — deep profiles on every contact, pulls from industry, markets, sales research, best practices, world events, franchise data
- **Predictor** — conversion likelihood, issue flags, who to focus on, decision impact scoring, performance prediction
- **Organizer** — owns the profile tab, structures all data, maintains completeness
- **Coach** — coaches internal team (reps) on performance; assists with franchisee motivation questions using available data
- **Executor** — executes any of 30 GHL actions + all NAH OS writes, always Draft → Review → Confirm

**Core principle:** Scout answers when called. It does NOT push proactively except on Call Details page and Settings. Trust is earned before automation is expanded.

---

## 2. Architecture Decisions Locked

### RAG System
- **Embedded content** (pgvector): call transcripts (400-tok chunks), KB docs (chunked by section), external research (300-tok chunks), daily journal entries
- **Structured data** (direct Supabase query): contact profile fields, pipeline state, team metrics, prediction scores, Zorakle/PFS data
- **Hybrid retrieval**: intent-routed — contact queries use filter + semantic, KB queries use semantic, prediction queries use direct
- **Embedding model**: text-embedding-3-small (1536 dims)
- **Single embeddings table** with metadata: content_type, contact_id, tenant_id, created_at, category

### Journal System (3 types, 11pm cron daily)
1. **Contact journal** — per contact, auto-generated after any interaction. Embedded in pgvector. Used in pre-call briefs + Scout context.
2. **Rep journal** — per user, daily summary of their activity. Structured in Supabase. Used for coaching context.
3. **System log** — tenant-wide audit of all AI actions. Append-only. Learning signal.

### Two Execution Layers (Scout writes to both simultaneously)
- **NAH OS (Supabase)**: sub-task logs, profile fields, pipeline state, contact journals, stage history, action logs, prediction scores
- **GHL (API)**: the 30 approved actions (see Section 5)

### Profile Tab
- **199 fields, 18 categories** (see `/docs/llm-planning/NAH_Profile_Tab_v2_Expanded.md`)
- **Universal editability**: every field can be written by API, AI, or Manual. No field is locked to one source.
- **Source waterfall**: API enriches on creation → AI updates continuously → Manual overrides anytime
- **Source badge on every field**: shows who last wrote it
- **Summary badge at top of profile tab**: "X Scout suggestions" → click to review all at once
- **Ask LLM always available** on the profile tab

### Call Details Page (auto on load)
- Auto-triggers when transcript is available (no user action needed)
- Auto-generates: call grade + rubric breakdown, coaching feedback with KB citations, profile update suggestions, next step action cards
- Each suggestion card: **Edit / Skip / Push** (not just confirm/reject)
- Nothing fires until rep acts on each card
- All outcomes logged (accepted / edited / rejected) for learning

### All Other Pages (on demand only)
- Pipeline board: flags + priorities only when asked
- Contact page: everything available but nothing pushed
- Daily HQ: morning brief only when asked
- Pre-call brief: only when asking Scout

### Learning Feedback Loop
- Every suggestion outcome logged: `suggestion_id`, `type`, `original_value`, `accepted_value`, `outcome`, `rep_id`, `contact_id`, `timestamp`
- Weekly: Scout performance report (Sunday 11pm cron)
- Monthly: rubric review prompted for Matt/Corey approval
- Automation graduation: gradual, done in Claude Code over time, admin toggle per action type

### Business Intelligence Layer
- No dashboard built
- Lives entirely in Scout chat
- Available to everyone, phrased to their role
- Scout answers with data + always prompts to go deeper / plan
- Draws from: all contacts, all transcripts, all outcomes, pipeline history, profile patterns
- See `/docs/llm-planning/NAH_Scout_Business_Intelligence.md` for full question library + example conversations

---

## 3. Team Roster + Permissions

| Person | Role | Access |
|---|---|---|
| Corey | Admin | Everything |
| Matt | Admin | Everything |
| Ryland | Admin | Everything (territory focus) |
| Chad | Operator | All actions on his contacts, no pipeline template edits |
| Sam | Specialist | C1–C8, T1–T5, A1–A5 (comms, tasks, calendar) |
| Mark | Specialist | Same as Sam |
| John | Specialist | Same as Sam |

---

## 4. GHL Calendars (7) — IDs to be pulled via API

| Calendar | Maps to sub-task | Default rep |
|---|---|---|
| Intro | Stage 1 — Intro Call | Chad |
| Discovery | Stage 2 — Matt Call | Matt |
| Validation | Stage 3 — Sam Call | Sam |
| Capital | Stage 3 — Mark Call | Mark |
| FDD Review | Stage 4 — FDD Review Call | Chad |
| Territory | Stage 4 — Territory Call | Chad |
| Awarding | Stage 5 — Matt Final Call | Matt |

---

## 5. GHL Execution — 30 Actions

Full list in `/docs/llm-planning/NAH_GHL_Execution_List.md`

**Categories:**
- Communication (8): SMS, email, templates, campaigns, call log, internal note
- Tasks (5): create, update, complete, delete, reassign
- Calendar (5): schedule, update, cancel, reschedule, reminder
- Contact management (9): create, field updates, stage writes, tags, assign, lost, DNC
- Opportunities (3): create, update, close

**Rules:**
- ALL 30 require Draft → Review → Confirm — no exceptions
- GHL workflows NOT used — all workflow logic lives in NAH OS
- Every executed action logged in `scout_action_logs`

---

## 6. Profile Tab — 18 Categories Summary

Full field list in `/docs/llm-planning/NAH_Profile_Tab_v2_Expanded.md`

| Category | Fields | Primary source |
|---|---|---|
| Identity & Contact | 8 | API |
| Background & Demographics | 14 | AI |
| Personality & Psychology | 14 | API (Zorakle) |
| Goals & Vision | 12 | AI |
| Financial Profile | 18 | Manual + AI |
| Franchise Fit | 10 | Manual → AI |
| Territory | 10 | Manual + AI |
| Sales Journey | 12 | API |
| Validation | 8 | Manual + AI |
| Trainual | 5 | API |
| Compliance | 6 | Manual |
| Objections & Concerns | 12 | AI |
| Behavioral Signals | 12 | AI |
| Engagement | 8 | Auto |
| External Research | 10 | AI |
| AI Scout Intelligence | 16 | AI |
| Predictive Scores | 12 | AI |
| Metadata & Audit | 12 | Auto |

**Existing fields to preserve** (46 fields currently in site — do not break these):
Territory (4), Franchise Fit (7), Financial (5), Trainual (5), Validation (6), Engagement (6), AI Scout (9), Compliance (4)

---

## 7. KB Structure — 10 Categories

Full taxonomy in `/docs/llm-planning/NAH_KB_Taxonomy.md`

| Category | Docs | Owner |
|---|---|---|
| Sales methodology | 9 | Matt |
| Objection library | 9 | Matt + Chad |
| Ideal candidate profile | 8 | Matt |
| Territory analysis | 8 | Ryland |
| Franchise unit economics | 8 | Matt |
| Product knowledge | 7 | Matt |
| Competitor intelligence | 6 | Matt + Chad |
| Franchisee stories | 6 | Matt |
| Onboarding playbook | 7 | Matt + John |
| Coaching framework | 7 | John |

**Immediately seedable** (no writing needed):
- Frandev CRM meeting notes (Mar 27) → sales methodology, objections, red flags, NAH story
- Zorakle PDFs → ideal candidate profile benchmarks
- Chad's onboarding Excel → onboarding playbook
- Client Tether CSV (1,389 records) → conversion patterns, candidate success data
- Trainual content → product knowledge, onboarding

---

## 8. Pre-Call Brief Design

Auto-generated when rep asks Scout. 8 sections:
1. Who is this person (DISC, occupation, capital, fit score)
2. Where they are in process (stage, sub-tasks, days in stage)
3. What happened last time (last call summary, commitments made)
4. Open concerns + objections (unresolved, yellow/red flags)
5. What to accomplish this call (stage goal, 3 recommended questions, data gaps)
6. How they compare to best franchisees (Zorakle match, financial similarity)
7. Prediction snapshot (close probability, capital risk, ghost risk, trend)
8. Suggested opening (2–3 sentence opener Scout drafts)

Full design in `/docs/llm-planning/NAH_Scout_Intelligence_Design.md`

---

## 9. Post-Call Workflow

1. Call ends on Google Meet
2. Transcript captured via Whisper → saved to Supabase
3. Scout processes in parallel: grades, coaches, extracts data points, drafts next steps
4. Review package assembled
5. Rep reviews in platform (Edit / Skip / Push each item)
6. Confirmed items route to NAH OS + GHL simultaneously
7. Contact journal + rep journal + system log written (or queued for 11pm cron)

---

## 10. Build Principles (carry forward from existing sessions)

- Never push or merge to main without explicit approval
- All work on feature branches
- Draft → Review → Confirm for every Scout action — no exceptions
- Never modify production data without dry-run first
- GHL is execution-only; Supabase is source of truth
- Commit per logical change
- Read `docs/memory.md` + this file before starting any task
- Self-audit: Write → Question (18-check list) → Improve → Validate before finalizing
- Respect existing Sprint 0–9 patterns (auth, error handling, API shape)

---

## 11. Planning Docs Reference

All located at `/docs/llm-planning/` in repo after import:

| File | Contents |
|---|---|
| `NAH_Profile_Tab_v2_Expanded.md` | 199 fields, full source map |
| `NAH_KB_Taxonomy.md` | 75 KB docs, seeding plan |
| `NAH_GHL_Execution_List.md` | 30 GHL actions, permissions |
| `NAH_Scout_Intelligence_Design.md` | Pre-call brief, learning loop, automation path |
| `NAH_Scout_Business_Intelligence.md` | BI layer, question library, example conversations |
| `LLM_SESSION_CONTEXT.md` | This file |
