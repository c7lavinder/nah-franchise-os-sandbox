# Sprint LLM-2 — Call Details Enhancement
**Goal:** Make the call details page the most powerful page in the platform. Auto-processes on load. Rep reviews and pushes everything with one flow.
**Prerequisite:** Sprint LLM-1 complete
**Estimated time:** 2–3 hours
**Branch:** `feature/llm-call-details`

---

## Read These First
1. `docs/memory.md`
2. `docs/llm-planning/LLM_SESSION_CONTEXT.md`
3. `docs/llm-planning/NAH_Scout_Intelligence_Design.md`
4. Existing `lib/calls/grader.ts`, `lib/calls/coach.ts`, `lib/calls/brief-generator.ts`
5. Current call details page component

---

## Context
Call details currently has grading and coaching built. This sprint enhances it with:
- Auto-trigger on transcript availability (no user action needed)
- Profile update suggestion cards
- Next step action cards
- Edit/Skip/Push flow for all cards
- Learning feedback logging
- Dual execution routing (NAH OS + GHL)

---

## Tasks

### Task 1: Auto-Trigger on Transcript Available
- When a call transcript is saved to Supabase, automatically trigger full Scout processing
- Processing sequence (in parallel where possible):
  1. Grade the call (existing grader, enhance to also return raw rubric scores per criterion)
  2. Generate coaching feedback (existing coach, enhance to cite specific transcript quotes)
  3. Extract profile data points (new — see Task 2)
  4. Generate next step action cards (new — see Task 3)
- Store all 4 outputs in a new `call_review_packages` table:
  ```sql
  id uuid primary key
  call_id uuid references calls(id)
  contact_id uuid
  rep_id uuid
  grade text
  grade_detail jsonb
  coaching_feedback text
  coaching_citations jsonb (array of {quote, criterion, timestamp})
  profile_suggestions jsonb (array of suggested field updates)
  next_step_cards jsonb (array of action cards)
  status text (pending_review | partially_reviewed | complete)
  created_at timestamptz
  ```
- Show a "review package ready" indicator on the call details page

### Task 2: Profile Update Suggestion Cards
Build `lib/calls/profile-extractor.ts`:
- Takes transcript text + contact_id + current profile state
- Calls Claude API with prompt: extract every data point from this transcript that should update the contact's profile
- Returns array of suggestions:
  ```typescript
  {
    field_name: string,        // matches column name in contact_profile
    field_label: string,       // human-readable label
    current_value: any,        // what's there now (null if empty)
    suggested_value: any,      // what Scout extracted
    confidence: 'high' | 'medium' | 'low',
    source_quote: string,      // the transcript text that supports this
    outcome?: 'accepted' | 'edited' | 'skipped'  // set when rep acts
  }
  ```
- Focus extraction on: goals, objections, financial signals, personality signals, background, motivation, timeline, concerns
- Only suggest fields where transcript contains clear evidence (don't guess)
- Cap at 10 suggestions per call (pick highest confidence)

**UI: Profile Update Cards**
- Show as a section on call details page: "Profile updates Scout suggests"
- Each card shows: field label, current value, suggested value, source quote
- Three buttons per card: **Edit** (opens inline edit), **Skip**, **Push**
- Push writes to `contact_profile` with `last_updated_by: 'ai'`
- Summary at top: "5 profile suggestions — review all"
- Cards stack vertically, rep works through them

### Task 3: Next Step Action Cards
Build `lib/calls/next-steps-generator.ts`:
- Takes transcript + call grade + contact profile + pipeline state + GHL action list
- Calls Claude API to generate 3–7 suggested next actions
- Each action card:
  ```typescript
  {
    id: string,
    title: string,             // e.g. "Schedule Sam validation call"
    description: string,       // why Scout suggests this
    action_type: 'nah_os' | 'ghl',
    action_payload: object,    // pre-filled params for the action
    priority: 'high' | 'medium' | 'low',
    outcome?: 'pushed' | 'edited' | 'skipped'
  }
  ```
- For GHL actions: pre-fill all available params (contact_id, suggested calendar, draft message text)
- For NAH OS actions: pre-fill sub-task log drafts, stage advance suggestions

**UI: Next Step Cards**
- Show as a section: "Scout suggests these next steps"
- Each card: title, description, priority badge, pre-filled action preview
- Three buttons: **Edit** (opens action editor), **Skip**, **Push**
- Push routes to correct execution layer (NAH OS or GHL) automatically
- Rep never sees "which layer" — just pushes

### Task 4: Learning Feedback Logger
Create `lib/learning/feedback-logger.ts` and `suggestion_feedback` table:
```sql
id uuid primary key
suggestion_type text (profile_update | next_step | coaching_edit | rubric_edit)
call_id uuid (nullable)
contact_id uuid (nullable)
rep_id uuid
original_value jsonb
accepted_value jsonb (null if skipped)
outcome text (accepted | edited | skipped)
edit_delta jsonb (what changed from original to accepted)
created_at timestamptz
```
- Log every card outcome when rep acts (accepted/edited/skipped)
- Log accepted_value exactly as pushed (captures edits)
- This table is the core learning signal for future improvement

### Task 5: Enhance Coach to Cite Transcript
- Update `lib/calls/coach.ts` to include specific transcript quotes for each coaching point
- Format: *"At 4:32 you said [quote] — this is an opportunity to..."*
- Store citations in `call_review_packages.coaching_citations`
- Render citations in the coaching UI as collapsible quote blocks

### Task 6: Enhance Grader with Per-Criterion Detail
- Update `lib/calls/grader.ts` to return per-criterion scores (not just overall grade)
- Each criterion: score (0–10), reason, supporting quote from transcript
- Store in `call_review_packages.grade_detail`
- Render as an expandable rubric breakdown in the UI

---

## Acceptance Criteria
- [ ] Call details page auto-processes when transcript is available (no user click needed)
- [ ] Profile update cards show with current value, suggested value, source quote
- [ ] Next step cards show with pre-filled action previews
- [ ] Edit / Skip / Push works correctly on all cards
- [ ] Push routes to correct execution layer (NAH OS or GHL) automatically
- [ ] All outcomes logged to `suggestion_feedback` table
- [ ] Coaching shows specific transcript citations
- [ ] Rubric breakdown shows per-criterion scores
- [ ] `call_review_packages` table populated correctly
- [ ] No existing grading/coaching functionality broken

## What NOT to Touch
- Sprint LLM-1 work
- Existing call recording/transcription pipeline
- Existing pipeline/stage data
- Profile tab UI (that's Sprint LLM-4)
