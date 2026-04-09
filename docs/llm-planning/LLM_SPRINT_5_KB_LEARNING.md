# Sprint LLM-5 — Knowledge Base & Learning Loop
**Goal:** Seed the KB with all available existing sources, wire KB more deeply to coaching/grading, build the learning feedback system and weekly Scout performance report.
**Prerequisite:** Sprints LLM-1 through LLM-4 complete
**Estimated time:** 2–3 hours
**Branch:** `feature/llm-kb-learning`

---

## Read These First
1. `docs/memory.md`
2. `docs/llm-planning/LLM_SESSION_CONTEXT.md`
3. `docs/llm-planning/NAH_KB_Taxonomy.md`
4. `docs/llm-planning/NAH_Scout_Intelligence_Design.md`
5. Existing KB structure in codebase + Supabase
6. `suggestion_feedback` table (created in Sprint LLM-2)

---

## Tasks

### Task 1: Import Frandev CRM Meeting Notes to KB
- The meeting transcript is at `/mnt/user-data/uploads/Frandev_CRM__2026_03_27_10_00_EDT__Notes_by_Gemini.pdf`
- Parse and extract structured KB content into these categories:
  - Sales methodology → "NAH sales process overview" doc
  - Objection library → "Capital + funding objections" doc (capital timing concern mentioned multiple times)
  - Ideal candidate profile → "Red flags and dropout patterns" doc (84% Trainual fallout, capital timing issue)
  - Product knowledge → "NAH business model and platform overview" doc
  - Competitor intelligence → "Home Investors funnel crossover" doc
- Create each as a KB document in the `knowledge_base_documents` table
- Embed each via `embedKBDoc()` from Sprint LLM-1
- Tag with `seeded_from: 'frandev_meeting_2026_03_27'`

### Task 2: Import Client Tether CSV — Pattern Extraction
- CSV is at `/mnt/user-data/uploads/CT_Contact_Master__Sheet1_1.csv` (1,389 records)
- Analyze for conversion patterns. Extract and create KB doc "Historical conversion patterns":
  - What % reached each stage (funnel analysis)
  - Lead source breakdown (which sources had most records)
  - Deal size distribution
  - Time patterns (creation dates, close patterns)
  - Geographic patterns (state/city concentration)
- Create summary KB doc in Ideal Candidate Profile category
- Also store raw pattern data in `app_settings` as `historical_conversion_patterns` for BI queries
- Tag with `seeded_from: 'client_tether_csv'`
- Do NOT import the raw contacts — just extract patterns

### Task 3: Structure KB Health Monitoring
Add to `knowledge_base_documents` table if not existing:
```sql
last_retrieved_at timestamptz
retrieval_count int default 0
retrieval_quality_score float (avg of call grades when this doc was used)
flagged_as_stale boolean default false
gap_signal text (if Scout searched for this topic and found nothing)
```

Build `lib/kb/health-monitor.ts`:
- `flagStaleDocuments()` — marks docs not updated in 90+ days
- `logRetrieval(docId, callId, gradeImprovement)` — tracks when doc was used + did it help
- `detectGaps(failedSearchQuery)` — logs topics Scout searched for but found no KB docs
- `generateHealthReport()` — returns: total docs, docs with no content, stale docs, top 10 most retrieved, gap signals

Add KB health section to the Settings page (read-only display).

### Task 4: Wire KB More Deeply to Grading + Coaching
Update `lib/calls/grader.ts`:
- Before grading, retrieve relevant KB docs via RAG (search: "what good looks like at [current stage]")
- Use retrieved KB content to inform per-criterion scoring
- Log which KB docs were used in the grade (for health tracking)

Update `lib/calls/coach.ts`:
- Before generating coaching, retrieve: (1) objection library docs if objections detected, (2) stage methodology doc, (3) ideal candidate profile doc
- Coaching feedback must reference KB sources where possible: *"Per the objection playbook: ..."*
- Log which KB docs were used

### Task 5: Learning Feedback Analysis
Build `lib/learning/feedback-analyzer.ts`:
- `getRepAcceptanceRate(repId, days)` → % of suggestions accepted vs skipped/edited per rep
- `getActionTypeAcceptanceRate(actionType, days)` → acceptance rate per suggestion type
- `getMostEditedFields()` → which profile fields get corrected most often
- `getRejectionPatterns()` → what types of suggestions get rejected and why
- `getTopEditDeltas()` → what are the most common edits (original → accepted)

These power the weekly report and future rubric refinement.

### Task 6: Weekly Scout Performance Report (Sunday 11pm cron)
Add to cron system: `scout_weekly_report_cron` (Sunday 23:00)

Report stored in `scout_performance_reports` table:
```sql
id uuid primary key
week_start date
week_end date
total_suggestions int
acceptance_rate float
edit_rate float
rejection_rate float
top_rejected_types jsonb
most_edited_fields jsonb
kb_retrieval_count int
kb_gap_signals jsonb
rep_breakdown jsonb (per-rep acceptance rates)
action_type_breakdown jsonb
created_at timestamptz
```

Report should be viewable in Settings by admins.
Add to Settings cron calendar view.

### Task 7: Rubric Refinement Prompt (Monthly)
Add monthly cron (1st of month, 23:00): `rubric_review_prompt_cron`
- Analyzes `suggestion_feedback` for coaching edits
- Identifies rubric criteria with consistently low confidence or high edit rates
- Creates a draft rubric review suggestion in the admin inbox
- Admin (Matt or Corey) reviews + approves changes in Settings
- Does NOT automatically change rubric — always Draft → Review → Confirm

---

## Acceptance Criteria
- [ ] Frandev meeting notes imported as 5 KB docs, embedded, retrievable
- [ ] Client Tether CSV patterns extracted and stored (not raw contacts)
- [ ] KB health metrics tracked per document
- [ ] KB health report visible in Settings
- [ ] Call grader uses KB docs and logs which ones it used
- [ ] Coaching uses KB docs and cites sources in feedback
- [ ] `feedback-analyzer.ts` functions return correct data
- [ ] Weekly performance report generates Sunday 11pm and is viewable in Settings
- [ ] Monthly rubric review cron creates draft suggestions (never auto-applies)
- [ ] All new cron jobs appear in Settings cron calendar

## What NOT to Touch
- Sprint LLM-1 through LLM-4 work
- Existing KB documents already created
- Existing rubric criteria (22 criteria) — only suggest changes, never auto-apply
- Existing call history or grades
