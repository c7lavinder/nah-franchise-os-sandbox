# Sprint LLM-3 — GHL Execution Layer
**Goal:** Finalize all 30 GHL actions, discover and store all field/calendar IDs, wire calendars to sub-tasks, enforce permissions.
**Prerequisite:** Sprint LLM-1 complete
**Estimated time:** 2–3 hours
**Branch:** `feature/llm-ghl-execution`

---

## Read These First
1. `docs/memory.md`
2. `docs/llm-planning/LLM_SESSION_CONTEXT.md`
3. `docs/llm-planning/NAH_GHL_Execution_List.md`
4. Existing GHL service layer / API wrapper in codebase
5. Existing `scout_action_logs` table schema

---

## Context
GHL is execution-only. Our app owns all pipeline logic. GHL receives instructions via API.
30 actions are approved. 7 calendars exist in GHL and need their IDs pulled + stored.
4 custom fields exist in GHL for NAH stage sync and need their IDs confirmed.
All actions require Draft → Review → Confirm — no exceptions.
GHL workflows are NOT used — all workflow logic lives in NAH OS.

---

## Tasks

### Task 1: GHL ID Discovery — Pull and Store All IDs
Create a one-time setup script `scripts/ghl-id-discovery.ts`:

**Pull and store these GHL IDs:**
- All 7 calendar IDs (search by name: Intro, Discovery, Validation, Capital, FDD Review, Territory, Awarding)
- All NAH custom field IDs (search by name: nah_sales_stage_id, nah_onboarding_stage_id, nah_followup_stage_id, plus any others)
- All active campaign IDs (for C5/C6 actions)
- All user IDs mapped to: Chad, Matt, Sam, Mark, Ryland, John, Corey

Store everything in `app_settings` table as structured JSON:
```json
{
  "ghl_calendars": {
    "intro": "cal_xxx",
    "discovery": "cal_xxx",
    "validation": "cal_xxx",
    "capital": "cal_xxx",
    "fdd_review": "cal_xxx",
    "territory": "cal_xxx",
    "awarding": "cal_xxx"
  },
  "ghl_custom_fields": {
    "nah_sales_stage_id": "field_xxx",
    "nah_onboarding_stage_id": "field_xxx",
    "nah_followup_stage_id": "field_xxx"
  },
  "ghl_users": {
    "chad": "user_xxx",
    "matt": "user_xxx",
    "sam": "user_xxx",
    "mark": "user_xxx",
    "ryland": "user_xxx",
    "john": "user_xxx",
    "corey": "user_xxx"
  },
  "ghl_campaigns": { ... }
}
```

Log all discovered IDs clearly. Alert if any expected ID is not found.

### Task 2: Calendar → Sub-Task Mapping
Store this mapping in `app_settings`:
```json
{
  "subtask_to_calendar": {
    "intro_call": "intro",
    "matt_call": "discovery",
    "sam_call": "validation",
    "mark_call": "capital",
    "fdd_review_call": "fdd_review",
    "territory_call": "territory",
    "matt_final_call": "awarding"
  },
  "calendar_to_default_rep": {
    "intro": "chad",
    "discovery": "matt",
    "validation": "sam",
    "capital": "mark",
    "fdd_review": "chad",
    "territory": "chad",
    "awarding": "matt"
  }
}
```

When Scout suggests scheduling a call, it automatically uses these mappings to pre-fill calendar_id and assigned rep.

### Task 3: Verify + Complete All 30 GHL Actions
Review existing GHL service layer. For each of the 30 actions in `NAH_GHL_Execution_List.md`, verify:
- The API endpoint exists and works
- Required inputs are validated
- Response is handled (success + error)
- Action is logged to `scout_action_logs`

Build any missing action handlers in `lib/ghl/actions/`:
- `lib/ghl/actions/communication.ts` — C1–C8
- `lib/ghl/actions/tasks.ts` — T1–T5
- `lib/ghl/actions/calendar.ts` — A1–A5
- `lib/ghl/actions/contacts.ts` — M1–M9
- `lib/ghl/actions/opportunities.ts` — O1–O3

Each action function signature:
```typescript
async function executeAction(
  actionType: GHLActionType,
  params: ActionParams,
  userId: string,        // who is executing
  contactId: string,     // who this is for
  draftedBy: 'scout' | 'user'
): Promise<ActionResult>
```

### Task 4: Draft → Review → Confirm Enforcement
Build `lib/ghl/action-queue.ts`:
- `draftAction(actionType, params, userId, contactId)` → creates draft, returns draftId
- `reviewAction(draftId)` → returns draft for human review
- `confirmAction(draftId, finalParams)` → executes action with any edits, logs outcome
- `rejectAction(draftId, reason?)` → logs rejection, does not execute

Draft storage in `ghl_action_drafts` table:
```sql
id uuid primary key
action_type text
contact_id uuid
drafted_by_user_id uuid
drafted_by_source text (scout | user)
params jsonb
edited_params jsonb (null until confirmed with edits)
status text (draft | confirmed | rejected | executed)
outcome jsonb (GHL API response)
created_at timestamptz
executed_at timestamptz (null until executed)
```

### Task 5: Permission Enforcement
Build `lib/ghl/permissions.ts`:
- Check user role before allowing any action
- Chad (Operator): all 30 actions on his contacts
- Sam/Mark/John (Specialist): C1–C8, T1–T5, A1–A5 only
- Matt/Ryland/Corey (Admin): all 30 actions on any contact
- If user attempts blocked action: return clear error message "Your role doesn't have access to this action"

### Task 6: Stage Sync Write-Through
- On every pipeline stage change in NAH OS, automatically write the new stage_id to the corresponding GHL custom field
- Use the field IDs from `app_settings.ghl_custom_fields`
- This write does NOT require Draft → Review → Confirm (it's automatic, mirrors our state)
- Log to `scout_action_logs` with `was_auto: true`
- On failure: queue + retry 3x, then alert admin

---

## Acceptance Criteria
- [ ] All GHL IDs discovered and stored in `app_settings`
- [ ] Calendar → sub-task mapping stored and used in scheduling suggestions
- [ ] All 30 action handlers exist and handle errors gracefully
- [ ] Draft → Review → Confirm enforced on all 30 actions
- [ ] `ghl_action_drafts` table populated correctly on draft
- [ ] Permission checks work correctly for all 4 role types
- [ ] Stage sync writes to GHL on every stage change
- [ ] All actions logged to `scout_action_logs`
- [ ] No GHL workflow triggers anywhere in the codebase

## What NOT to Touch
- Sprint LLM-1 or LLM-2 work
- Existing pipeline stage logic
- Existing contact sync from GHL
