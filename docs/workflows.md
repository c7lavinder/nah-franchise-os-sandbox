# workflows.md — Workflow Intelligence Engine Specification

> Last updated: 2026-03-23
> This document defines the complete workflow engine for NAH Franchise OS.
> Workflows are the automated communication sequences that move prospects through the pipeline.
> Scout is the intelligence layer — analyzes performance and rewrites content.
> GHL is the execution layer only — receives instructions and sends messages.

---

## Architecture Decision

Workflows live entirely in the NAH Franchise OS database.
GHL is the execution layer only — it receives contact_id + message_content + send_type and sends the message.
GHL does NOT own workflow logic, content, sequencing, or intelligence.

**Why this matters:**
- We control all content, timing, and logic in our own database
- We can version, A/B test, and roll back without touching GHL
- Scout can analyze performance and rewrite content because we own it
- GHL is interchangeable — if we switch CRM later, workflows come with us
- Every change is tracked, approved, and versioned

**The flow:**
```
Workflow Engine (NAH OS) decides what to send and when
  → Sends instruction to GHL API: contact_id + content + type
  → GHL delivers the message (SMS, email)
  → GHL returns delivery data: delivered, opened, clicked, responded
  → Workflow Engine records the result and decides next step
  → Scout analyzes patterns across all results and suggests improvements
```

---

## Workflow Types

### 1. New Lead 30-Day Sequence

**Purpose:** Get the prospect on a call with Chad and into Trainual within 30 days.
**Trigger:** New lead enters Stage 1 — New Lead
**Duration:** 30 days
**Exit conditions:**
- Call booked AND Trainual opened → exit to active pipeline management
- Day 30 with no call booked → exit to Follow-up pipeline
**Pause conditions:**
- Call is scheduled → pause sequence, resume after call is logged
**Primary metric:** Call booking rate
**Secondary metric:** Trainual open rate

**Chad call tasks:** Days 3, 10, 14, 20, 30 — these are NOT automated messages, they create tasks for Chad to make personal calls.

**Rules:**
- If Chad logs call → workflow continues to next step
- If Chad does not log call by end of day → Scout alerts Chad
- One SMS per day maximum
- Each SMS has one goal only: get on phone OR open Trainual, never both
- Emails every 2–3 days with one theme each
- Clear next step at bottom of every email

Full day-by-day plan defined in docs/pipeline.md "30-Day New Lead Sequence" section.

---

### 2. Pre-Call Reminder Sequence

**Purpose:** Reduce no-shows and set expectations for the call.
**Trigger:** Appointment created in GHL (any call type)
**Duration:** From appointment creation until call time
**Exit conditions:** Call completed or cancelled
**Primary metric:** No-show rate reduction

**Steps:**
- Appointment confirmed: SMS confirmation with date/time
- 24 hours before: EMAIL — what the call covers, what to prepare, what happens after
- 1 hour before: SMS — short calendar confirm only
- Example SMS: "Hey [Name] — confirming our call tomorrow at [time]. See you then."
- Example email: Deeper content — what the call covers, what to prepare, what to expect after

**Rules:**
- SMS reminders are short — calendar confirm only
- Email reminders are deeper — content, preparation, expectations
- Never send pressure language in reminders
- If prospect cancels → trigger reschedule task for Chad

---

### 3. Post-Call Follow-up Sequence

**Purpose:** Recap the call and deliver next steps.
**Trigger:** Chad logs call completion in GHL
**Duration:** 1–3 days after call
**Exit conditions:** Next stage action taken (discovery scheduled, Trainual started, etc.)
**Primary metric:** Next step completion rate

**Steps:**
- Same day: EMAIL — personalized recap of call discussion + agreed next steps
- Next day: SMS — one key action reminder (e.g., "Check your email for the Trainual link")
- Day 3 (if no action): SMS — gentle nudge toward the agreed next step

**Rules:**
- Recap email content is drafted by Scout based on Chad's call notes
- Chad reviews and confirms before sending
- If no call notes logged → Scout cannot generate recap → alerts Chad to log notes first

---

### 4. Trainual Nudge Sequence

**Purpose:** Get the prospect to open Trainual within 48 hours of receiving access.
**Trigger:** Trainual access granted to prospect
**Prerequisite:** Chad framing call must be logged BEFORE Trainual invite fires
**Duration:** 7 days
**Exit conditions:** Prospect opens Trainual
**Primary metric:** Trainual open rate within 48 hours

**Steps:**
- 0 hours: Trainual access link delivered (via GHL)
- 24 hours (if not opened): SMS nudge — "Did you get a chance to check out the Trainual link I sent?"
- 48 hours (if not opened): SMS nudge — direct link resend with encouragement
- 48 hours (if not opened): Scout alerts Chad with task for personal follow-up
- 96 hours (if not opened): SMS — social proof nudge ("Most prospects who open Trainual move forward faster")
- Day 7 (if not opened): Final SMS — personal message from Chad drafted by Scout

**Rules:**
- No Trainual invite fires without prior Chad framing call logged
- 48hr no open → Scout sends automated nudge to prospect
- 96hr no open → Scout alerts Chad with task to follow up personally
- Trainual completion % visible on every lead card
- 75%+ completion flagged as high engagement
- 100% complete with no stage advance flagged urgent → Scout alerts Chad

---

### 5. FDD Nurture Sequence

**Purpose:** Keep the prospect engaged during the mandatory 14-day FDD review period with legal-safe educational content.
**Trigger:** FDD formally delivered (Stage 8 entry)
**Duration:** 14 days (matches legal minimum)
**Exit conditions:** Day 14 reached → prospect moves to Decision Call stage
**Primary metric:** Prospect engagement during FDD window

**Steps:**
- Day 1: EMAIL — what to expect during your FDD review period
- Day 3: SMS — legal-safe check-in ("Any questions so far?") — Chad confirms before send
- Day 5: EMAIL — educational content about the NAH business model (not sales pressure)
- Day 7: SMS — legal-safe check-in — Chad confirms before send
- Day 9: EMAIL — franchisee spotlight story (social proof, not pressure)
- Day 10: SMS — legal-safe check-in — Chad confirms before send
- Day 12: EMAIL — what happens after FDD review (onboarding overview)
- Day 14: SMS — "Your FDD review period is complete. Ready to discuss next steps?" — Chad confirms

**Rules:**
- ALL content must be legal-safe — no pressure, no urgency language, no earnings claims
- Every SMS check-in must be confirmed by Chad before sending
- Scout will flag any urgency language in drafted content
- Always append: "For legal questions, please consult your attorney"
- Hard block on moving to Stage 9 until day 14 passes — this is system-enforced

---

### 6. Re-engagement Sequence

**Purpose:** Bring cold leads back from Nurture or Follow-up pipelines.
**Trigger:** Manual enrollment by Chad or auto-trigger on content engagement
**Duration:** 14 days
**Exit conditions:** Prospect responds or books a call
**Primary metric:** Response rate

**Steps:**
- Day 1: SMS — "Hey [Name], it's been a while. Wanted to check in — has anything changed on your end?"
- Day 3: EMAIL — value-driven update (new franchisee win, market data, Lowe's partnership news)
- Day 5: SMS — simple question ("Still thinking about business ownership?")
- Day 7: EMAIL — personalized from Chad based on their previous conversation history
- Day 10: SMS — territory availability update (if relevant)
- Day 14: EMAIL — final touchpoint — "The door is always open"

**Rules:**
- Re-engaged leads are HIGH PRIORITY — Chad contacts within 2 hours
- Scout pulls full history for instant context brief
- Re-scored with current context before outreach
- If no response by day 14 → return to Nurture

---

### 7. Long-term Nurture Sequence

**Purpose:** Monthly personal touch from Chad plus continuous automated value content for prospects not ready now but with future potential.
**Trigger:** Lead moved to Nurture pipeline
**Duration:** Ongoing (review at 90 days)
**Exit conditions:** Prospect re-engages → moves to Re-engaged stage
**Primary metric:** Content engagement rate (opens, clicks)

**Cadence:**
- Monthly: Scout-drafted personal check-in from Chad (Chad confirms before send)
- Bi-weekly: Automated content emails — market insights, franchisee spotlights, house flipping education, NAH news
- Quarterly: "Has anything changed?" re-engagement message

**Rules:**
- Chad must personally touch nurture leads at least once per month
- 45 days with no personal touch → Scout reminder to Chad
- Any content engagement (opens, clicks) → Scout flags for possible re-engagement
- Suggest re-engagement timing based on what prospect said their timeline was
- 90 days zero engagement → auto-archive review

---

### 8. Follow-up Cadence Sequence

**Purpose:** Consistent touches for warm leads in Follow-up pipeline who have interest but no locked-in next step.
**Trigger:** Lead moved to Follow-up pipeline
**Duration:** Ongoing (7–14 day cadence)
**Exit conditions:** Prospect re-engages → moves back to appropriate Pipeline 1 stage
**Primary metric:** Re-engagement rate

**Cadence:**
- Every 7 days: Scout drafts next follow-up message based on last conversation (Chad confirms)
- Every 14 days: Email with value content tailored to their interests/objections

**Rules:**
- Alert Chad at 7 days with no touch
- Score and surface highest-value follow-up leads at top of Chad's daily view
- Suggest best angle for each follow-up based on conversation history
- 14 days with no touch → task for Chad + leadership alert

---

### 9. Onboarding Welcome Sequence

**Purpose:** Welcome new franchisee and kick off onboarding at Stage 11 (Funds Received).
**Trigger:** Lead reaches Stage 11 — Funds Received / Closed Won
**Duration:** 14 days
**Exit conditions:** All onboarding tasks assigned and first onboarding call scheduled
**Primary metric:** Onboarding task completion rate

**Steps:**
- Day 0: SMS + EMAIL — congratulations from Chad (confirmed before send) + welcome kit info
- Day 1: EMAIL — onboarding overview — what happens in the first 30/60/90 days
- Day 1: System — generate complete onboarding task list in GHL (assigned to team members)
- Day 2: EMAIL — intro to construction coach + scheduling link
- Day 3: SMS — checking in, any immediate questions?
- Day 5: EMAIL — intro to lending partner + next steps on financing
- Day 7: EMAIL — training schedule and access credentials
- Day 14: SMS + EMAIL — first onboarding call scheduling if not already booked

**Rules:**
- All team members notified: construction coach, lending partner, leadership
- Full win data logged: territory, lead source, time-to-close, stage durations
- Lead score model updated with win signal

---

## Step Types

Each step in a workflow can be one of these types:

| Step Type | Description | Requires Confirmation |
|-----------|-------------|----------------------|
| **SMS** | Text message to prospect via GHL | Yes — Chad confirms |
| **Email** | Email to prospect via GHL | Yes — Chad confirms |
| **Chad Call Task** | Creates a task for Chad to make a personal call | No — task created automatically |
| **Team Notify** | Sends internal notification to team member(s) | No — fires automatically |
| **AI Agent Action** | Scout performs an analysis or generates content | No — internal only |
| **Condition Check** | Evaluates a condition before proceeding (e.g., "has Trainual been opened?") | No — system check |
| **Stage Move Suggestion** | Scout suggests a pipeline stage change for Chad to confirm | Yes — Chad confirms |
| **Trainual Check** | Checks prospect's Trainual completion status | No — system check |

---

## The 4 Core Views

### View 1 — Workflow Dashboard

The main view showing all workflows and their health status.

**Header stats:**
- Total active workflows
- Total prospects currently in workflows
- Workflows needing attention (D or F health score)

**Workflow list (one row per workflow):**
- Workflow name
- Health score (A–F) graded by Scout
- Active prospect count currently in this workflow
- Primary metric with current value (e.g., "Call booking rate: 34%")
- Quick actions: Pause / Clone / Archive

**Scout intelligence panel (right side or bottom):**
- Automatically surfaces the top issue across all workflows
- Example: "New Lead 30-Day has a 12% drop-off at Day 5 SMS. The message is too long and has two asks. I've drafted 3 shorter variants — want to review?"
- Shows only one issue at a time — the most impactful one
- Links to View 3 (Scout Workflow Intelligence) for full analysis

---

### View 2 — Visual Workflow Builder

Drag-and-drop canvas for creating and editing workflows.

**Layout:**
- Days laid out vertically (Day 1 at top, Day 30 at bottom)
- Step library on left panel — drag step types onto the canvas
- Inline step editor on right panel — opens when a step is clicked
- Performance color coding on each step: green (above benchmark), yellow (at benchmark), red (below benchmark)

**Step editor (right panel):**
- Step type selector
- Content editor (for SMS/Email steps)
- Timing controls (time of day, delay from previous step)
- Condition builder (for Condition Check steps)
- Scout assist button on every step:
  - "Write" — Scout drafts content from scratch based on the step's goal
  - "Improve" — Scout rewrites existing content to perform better
  - "Shorten" — Scout condenses the message while keeping the core intent

**New workflow creation flow:**
1. Name the workflow
2. Define the trigger (what enrolls a prospect)
3. Define the goal (what exits a prospect successfully)
4. Build the step sequence on the canvas
5. Scout reviews the draft and flags any issues
6. Submit for admin approval
7. Admin approves → workflow goes live

**Additional features:**
- Clone entire workflow (creates draft copy for editing)
- Clone individual steps between workflows
- Condition branching logic (if Trainual opened → path A, else → path B)
- Drag to reorder steps within a day
- Preview mode — see the prospect's experience day by day

---

### View 3 — Scout Workflow Intelligence

This is NOT a metrics dashboard. Scout tells you what is broken and rewrites it.

**24-hour analysis cycle:**
Scout analyzes all live workflows every 24 hours and generates:

**Drop-off identification:**
- Where are prospects exiting the sequence?
- Which specific step has the highest drop-off rate?
- Is there a pattern (e.g., prospects drop off at day 5 across all workflows)?

**Correlation insights:**
- Which steps drive call bookings?
- Which email subject lines get the highest open rates?
- Which SMS messages get the highest response rates?
- Does Trainual completion correlate with stage advancement?

**Rewrite suggestions:**
- For every underperforming step, Scout drafts 3 rewrite variants
- Each variant has a different approach (e.g., shorter, more personal, different angle)
- Human reviews and picks the best one (or requests more options)
- Selected variant can be pushed as an A/B test or direct replacement

**Health score alerts:**
- D health score → Scout flags the workflow with diagnosis and suggested fixes
- F health score → Immediate admin alert with detailed diagnosis
- All alerts include: what is broken, why Scout thinks it is broken, and specific steps to fix it

**All insights in plain language:**
- Not: "CTR dropped 2.3% week-over-week on step 7"
- Instead: "The Day 5 email about financing options isn't getting opened. The subject line is too generic. Here are 3 alternatives that reference what prospects care about at this stage."

---

### View 4 — A/B Testing

Built-in experimentation for continuous improvement.

**Creating a test:**
- Select any step in a live workflow
- Click "Create A/B Test"
- Scout pre-fills Variant B with an improved version (editable)
- Or: write Variant B manually
- Set minimum sample size (default: 20 per variant)
- Submit for admin approval → test goes live

**Test execution:**
- 50/50 split on new enrollees automatically
- Prospects already past the test step are not affected
- Both variants tracked independently

**Declaring a winner:**
- Scout declares winner after minimum sample size reached
- Winner explanation in plain language:
  - "Variant B had a 23% higher response rate. It used a question format instead of a statement, which prompted more replies."
- Admin confirms the winner → losing variant archived (never deleted)
- Winning variant becomes the new default for all future enrollees

**Full workflow A/B test:**
- Option to test an entire sequence vs another sequence
- Same 50/50 split logic
- Scout compares overall goal completion rate (not individual step metrics)

---

## Workflow Update Rules

### Who Can Do What

| Action | Rep | Marketing | Leadership | Admin |
|--------|-----|-----------|------------|-------|
| View workflows | ✓ | ✓ | ✓ | ✓ |
| Edit draft workflows | — | ✓ | ✓ | ✓ |
| Submit for approval | — | ✓ | ✓ | ✓ |
| Pause live workflows | — | — | ✓ | ✓ |
| Approve and push live | — | — | — | ✓ |
| Archive workflows | — | — | — | ✓ |
| Create A/B tests | — | ✓ | ✓ | ✓ |
| Declare A/B winner | — | — | — | ✓ |
| Rollback to previous version | — | — | — | ✓ |

### Update Scope When Pushing Changes

When a workflow change is approved and pushed live, the admin chooses one of two modes:

**Option A — New enrollees only:**
- Prospects already in the workflow stay on the old version
- Only new enrollees get the updated workflow
- Safest option — no disruption to in-progress sequences
- Use when: content changes, tone changes, minor improvements

**Option B — Full overwrite:**
- All prospects currently in the workflow are updated to the new version
- Steps already passed are skipped — only future steps use the new content
- Use when: fixing a broken step, correcting an error, critical improvements

Both options require admin approval. The system logs which mode was used for every change.

---

## Workflow Health Scoring

Scout grades every workflow A–F based on how its steps perform against benchmarks.

| Grade | Meaning | Action |
|-------|---------|--------|
| **A** | Above benchmark on all primary metrics | No action needed — workflow is performing well |
| **B** | At benchmark — meeting expectations | Monitor — no immediate action |
| **C** | Average — some metrics below benchmark | Scout suggests improvements, low priority |
| **D** | Underperforming — Scout flags | Scout generates diagnosis and rewrite suggestions |
| **F** | Broken — immediate attention | Immediate admin alert with detailed diagnosis |

### Default Benchmarks

| Metric | Benchmark | Measured On |
|--------|-----------|-------------|
| Call booking rate | 30%+ | Percentage of workflow enrollees who book a call |
| SMS response rate | 15%+ | Percentage of SMS messages that get a reply |
| Email open rate | 25%+ | Percentage of emails opened |
| Trainual nudge open rate | 40%+ | Percentage of prospects who open Trainual after nudge |

Benchmarks are defaults — after 90 days of live data, Scout recalibrates based on actual performance.

---

## GHL Execution Layer

The workflow engine sends instructions to GHL and receives delivery data back.

### Outbound (NAH OS → GHL)

```
POST /conversations/messages
{
  "contactId": "contact_abc123",
  "type": "SMS" | "Email",
  "message": "Hey [Name], ...",
  "subject": "Your NAH Journey" (email only)
}
```

### Inbound (GHL → NAH OS)

GHL returns delivery data via webhooks or polling:
- `delivered` — message was sent successfully
- `opened` — email was opened (tracking pixel)
- `clicked` — link in message was clicked
- `responded` — prospect replied to the message

### GHL Custom Fields Required

These custom fields must be created on GHL contacts for workflow tracking:

| Custom Field | Type | Purpose |
|-------------|------|---------|
| `workflow_name` | Text | Name of the active workflow this contact is enrolled in |
| `workflow_day` | Number | Current day number in the workflow (1–30, etc.) |
| `workflow_version` | Text | Version ID of the workflow the contact is on |
| `last_workflow_touch` | Date | Timestamp of the last workflow step executed for this contact |
| `workflow_goal_achieved` | Checkbox | Whether the workflow's exit goal was met |

---

## Version Control

Every workflow change is versioned. Nothing is ever permanently deleted.

**Version tracking:**
- Every save creates a new version with a unique version ID
- Each version records: who changed it, what changed, when, and who approved it
- Rollback to any previous version is available to admin at any time
- Change log visible in the workflow builder: who changed what, when, approved by whom

**Archive behavior:**
- Archived workflows are hidden from the dashboard but still exist in the database
- All historical performance data is preserved
- Archived workflows can be unarchived by admin
- A/B test losing variants are archived, never deleted

---

## Database Tables Required

### workflows

```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  workflow_type VARCHAR(100) NOT NULL,
  trigger_type VARCHAR(100) NOT NULL,
  trigger_config JSONB DEFAULT '{}'::jsonb,
  exit_conditions JSONB DEFAULT '{}'::jsonb,
  pause_conditions JSONB DEFAULT '{}'::jsonb,
  health_score CHAR(1) DEFAULT 'C' CHECK (health_score IN ('A','B','C','D','F')),
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','live','paused','archived')),
  current_version_id UUID,
  active_enrollee_count INTEGER DEFAULT 0,
  primary_metric_name VARCHAR(100),
  primary_metric_value DECIMAL(5,2),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_type ON workflows(workflow_type);
CREATE INDEX idx_workflows_health ON workflows(health_score);
```

### workflow_versions

```sql
CREATE TABLE workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  change_description TEXT,
  update_mode VARCHAR(50) CHECK (update_mode IN ('new_enrollees_only','full_overwrite')),
  created_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workflow_id, version_number)
);

CREATE INDEX idx_wf_versions_workflow ON workflow_versions(workflow_id);
```

### workflow_steps

```sql
CREATE TABLE workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  step_type VARCHAR(50) NOT NULL CHECK (step_type IN ('sms','email','chad_call_task','team_notify','ai_agent_action','condition_check','stage_move_suggestion','trainual_check')),
  content TEXT,
  subject VARCHAR(500),
  send_time TIME,
  condition_config JSONB,
  requires_confirmation BOOLEAN DEFAULT true,
  performance_status VARCHAR(20) DEFAULT 'neutral' CHECK (performance_status IN ('green','yellow','red','neutral')),
  open_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),
  response_rate DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workflow_version_id, step_number)
);

CREATE INDEX idx_wf_steps_version ON workflow_steps(workflow_version_id);
CREATE INDEX idx_wf_steps_day ON workflow_steps(day_number);
```

### workflow_enrollments

```sql
CREATE TABLE workflow_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id),
  ghl_contact_id VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  current_day INTEGER DEFAULT 1,
  current_step_id UUID REFERENCES workflow_steps(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','exited','expired')),
  exit_reason VARCHAR(255),
  goal_achieved BOOLEAN DEFAULT false,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  last_step_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ
);

CREATE INDEX idx_wf_enrollments_workflow ON workflow_enrollments(workflow_id);
CREATE INDEX idx_wf_enrollments_contact ON workflow_enrollments(ghl_contact_id);
CREATE INDEX idx_wf_enrollments_status ON workflow_enrollments(status);
CREATE INDEX idx_wf_enrollments_active ON workflow_enrollments(workflow_id, status) WHERE status = 'active';
```

### workflow_step_logs

```sql
CREATE TABLE workflow_step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES workflow_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES workflow_steps(id),
  ghl_contact_id VARCHAR(255) NOT NULL,
  step_type VARCHAR(50) NOT NULL,
  content_sent TEXT,
  ghl_message_id VARCHAR(255),
  delivered BOOLEAN DEFAULT false,
  opened BOOLEAN DEFAULT false,
  clicked BOOLEAN DEFAULT false,
  responded BOOLEAN DEFAULT false,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  delivery_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wf_step_logs_enrollment ON workflow_step_logs(enrollment_id);
CREATE INDEX idx_wf_step_logs_step ON workflow_step_logs(step_id);
CREATE INDEX idx_wf_step_logs_contact ON workflow_step_logs(ghl_contact_id);
CREATE INDEX idx_wf_step_logs_executed ON workflow_step_logs(executed_at);
```

### workflow_ab_tests

```sql
CREATE TABLE workflow_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('step','full_workflow')),
  variant_a_step_id UUID REFERENCES workflow_steps(id),
  variant_b_step_id UUID REFERENCES workflow_steps(id),
  variant_a_version_id UUID REFERENCES workflow_versions(id),
  variant_b_version_id UUID REFERENCES workflow_versions(id),
  min_sample_size INTEGER DEFAULT 20,
  variant_a_count INTEGER DEFAULT 0,
  variant_b_count INTEGER DEFAULT 0,
  variant_a_metric DECIMAL(5,2),
  variant_b_metric DECIMAL(5,2),
  winner VARCHAR(10) CHECK (winner IN ('A','B')),
  winner_explanation TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','running','complete','archived')),
  created_by UUID NOT NULL REFERENCES users(id),
  declared_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_wf_ab_tests_workflow ON workflow_ab_tests(workflow_id);
CREATE INDEX idx_wf_ab_tests_status ON workflow_ab_tests(status);
```

### workflow_approvals

```sql
CREATE TABLE workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  workflow_version_id UUID REFERENCES workflow_versions(id),
  ab_test_id UUID REFERENCES workflow_ab_tests(id),
  approval_type VARCHAR(50) NOT NULL CHECK (approval_type IN ('publish','pause','archive','ab_test_start','ab_test_winner','rollback')),
  submitted_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_wf_approvals_workflow ON workflow_approvals(workflow_id);
CREATE INDEX idx_wf_approvals_status ON workflow_approvals(status);
```

---

## 30-Day New Lead Workflow — Detailed Rules

### Exit Rules
- **Exits when:** Call booked AND Trainual opened
- **Pauses when:** Call is scheduled (resumes after call is logged)
- **Exits to Follow-up at day 30** if no call booked
- **Exits to Stage 3 Qualified** if call completed and prospect qualifies

### Chad Call Tasks
Chad call tasks are created at days 3, 10, 14, 20, and 30. These are not automated messages — they create tasks in GHL for Chad to make personal calls.

- If Chad logs call → workflow continues to next step
- If Chad does not log call by end of day → Scout alerts Chad
- Chad call notes are required — Scout cannot generate post-call content without them

### AI Agent Behavior
- If no call booked by day 7 → AI scheduling agent attempts to auto-schedule
- AI agent checks Chad's calendar availability
- AI agent drafts scheduling message with available time slots
- Chad confirms before the scheduling message is sent (Draft → Review → Confirm)

---

## Open Items — To Be Built

- [ ] Workflow engine database tables (7 tables defined above)
- [ ] Workflow enrollment service (enroll, pause, resume, exit logic)
- [ ] Workflow step scheduler (determines what step to execute next and when)
- [ ] Workflow condition evaluator (checks conditions like Trainual status)
- [ ] GHL message execution integration (send via GHL API, receive delivery data)
- [ ] Workflow Dashboard UI (View 1)
- [ ] Visual Workflow Builder UI (View 2)
- [ ] Scout Workflow Intelligence analysis engine (View 3)
- [ ] A/B Testing engine (View 4)
- [ ] Workflow approval flow (submit → admin approve → push live)
- [ ] Version control system (create version, rollback, change log)
- [ ] Health scoring algorithm (A–F grading based on benchmarks)
- [ ] Scout rewrite engine (analyze underperforming steps, draft 3 variants)
- [ ] 30-Day New Lead Workflow content (all 30 days of SMS + email content)
- [ ] Pre-Call Reminder workflow content
- [ ] Post-Call Follow-up workflow content
- [ ] Trainual Nudge workflow content
- [ ] FDD Nurture workflow content
- [ ] Re-engagement workflow content
- [ ] Long-term Nurture workflow content
- [ ] Follow-up Cadence workflow content
- [ ] Onboarding Welcome workflow content
- [ ] GHL custom fields setup (5 fields for workflow tracking)
- [ ] GHL webhook integration for delivery data (opened, clicked, responded)
- [ ] Trainual API integration for completion tracking
- [ ] Cron job for daily Scout workflow analysis
- [ ] Admin notification system for D/F health scores
- [ ] Workflow migration SQL file for Supabase
