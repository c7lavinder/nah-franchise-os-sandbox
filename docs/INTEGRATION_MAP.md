# GHL Integration Map — Actual Data Flows

Last verified: 2026-04-28
Source: code audit (lib/ghl/client.ts, all callers, all webhook routes)

---

## GHL Client Functions — Complete Catalog

lib/ghl/client.ts exports 30 functions. Here is every one, what GHL API it hits, and who calls it.

### Contacts (READ from GHL)

| Function                         | GHL API                | Callers                                                                                                                                         |
| -------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `getContact(contactId)`          | GET /contacts/:id      | Scout tool-executor (10+ tools read contact name/fields), workflow scheduler (condition checks), intelligence bootstrap, workflow delivery-sync |
| `searchContacts(params)`         | GET /contacts/?query=X | Scout tool-executor (search_contacts tool)                                                                                                      |
| `countContactsByFilter(filters)` | POST /contacts/search  | No callers found                                                                                                                                |

### Contacts (WRITE to GHL)

| Function                           | GHL API               | Callers                                                                                                                                    |
| ---------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `upsertContact(fields)`            | POST /contacts/upsert | **`/api/contacts/create`** (the main contact creation route), Scout action executor (M1: Create Contact)                                   |
| `updateContact(contactId, fields)` | PUT /contacts/:id     | Scout action executor (M2-M9: update fields, tags, assign, DNC, etc.), stage-sync write-through, workflow enrollment (custom field writes) |

### Opportunities (READ from GHL)

| Function                               | GHL API                               | Callers                                                               |
| -------------------------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| `searchOpportunities(params)`          | GET /opportunities/search             | Scout tool-executor (pipeline view, contact detail), Scout data-tools |
| `searchOpportunitiesPaginated(params)` | GET /opportunities/search (paginated) | Intelligence bootstrap                                                |
| `countOpportunitiesByStatus(status)`   | GET /opportunities/search?limit=1     | No callers found                                                      |
| `getPipelines()`                       | GET /opportunities/pipelines          | Scout tool-executor (pipeline view), workflow delivery-sync           |
| `getStageIdByName(name)`               | GET /opportunities/pipelines + filter | No callers found                                                      |

### Opportunities (WRITE to GHL)

| Function                            | GHL API                | Callers                                                 |
| ----------------------------------- | ---------------------- | ------------------------------------------------------- |
| `createOpportunity(fields)`         | POST /opportunities/   | Scout action executor (O1: Create Opportunity)          |
| `movePipelineStage(oppId, stageId)` | PUT /opportunities/:id | Scout action executor (O2/O3: Update/Close Opportunity) |

### Tasks (READ from GHL)

| Function              | GHL API                          | Callers                                                             |
| --------------------- | -------------------------------- | ------------------------------------------------------------------- |
| `getTasks(contactId)` | GET /contacts/:id/tasks          | No direct callers found (may be used by Scout tools via data-tools) |
| `searchTasks(filter)` | POST /locations/:id/tasks/search | No callers found                                                    |

### Tasks (WRITE to GHL)

| Function                                 | GHL API                         | Callers                                                                      |
| ---------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| `createTask(contactId, task)`            | POST /contacts/:id/tasks        | Scout action executor (T1), **workflow scheduler** (creates Chad call tasks) |
| `updateTask(contactId, taskId, updates)` | PUT /contacts/:id/tasks/:taskId | Scout action executor (T2-T5: update, complete, reassign)                    |

### Calendar/Appointments (READ from GHL)

| Function                                  | GHL API                                           | Callers                                                         |
| ----------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| `getCalendars()`                          | GET /calendars/?locationId=X                      | Scout tool-executor (schedule_call tool), getAllAppointments    |
| `getCalendarFreeSlots(calId, start, end)` | GET /calendars/:id/free-slots                     | No callers found                                                |
| `getAppointments(start, end, filter)`     | GET /calendars/events                             | getAllAppointments                                              |
| `getAllAppointments(start, end)`          | GET /calendars + /calendars/events (per calendar) | Cron sync-ghl-calendar, Scout tool-executor (get_calendar tool) |

### Calendar/Appointments (WRITE to GHL)

| Function                         | GHL API                             | Callers                                                                                        |
| -------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `createAppointment(appointment)` | POST /calendars/events/appointments | Scout action executor (A1/A4: schedule/reschedule), `/api/contacts/[contactId]/schedule` route |

### Conversations/Messaging (READ from GHL)

| Function                          | GHL API                                       | Callers                 |
| --------------------------------- | --------------------------------------------- | ----------------------- |
| `getConversations(params)`        | GET /conversations/search                     | No direct callers found |
| `getConversationMessages(convId)` | GET /conversations/:id/messages               | No direct callers found |
| `getContactHistory(contactId)`    | GET /conversations/search + /messages         | Workflow delivery-sync  |
| `markConversationRead(convId)`    | PUT /conversations/:id                        | No callers found        |
| `getCallRecording(messageId)`     | GET /conversations/messages/:id/recording     | No callers found        |
| `getCallTranscription(messageId)` | GET /conversations/messages/:id/transcription | No callers found        |

### Messaging (WRITE to GHL)

| Function               | GHL API                      | Callers                                                                                                                                           |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sendMessage(payload)` | POST /conversations/messages | Scout action executor (C1-C4, C7-C8: SMS, email, notes), **workflow scheduler** (sends SMS + email steps), `/api/contacts/[contactId]/send` route |

### Workflows (READ from GHL)

| Function         | GHL API                      | Callers          |
| ---------------- | ---------------------------- | ---------------- |
| `getWorkflows()` | GET /workflows/?locationId=X | No callers found |

### Workflows (WRITE — triggers GHL workflow via webhook URL)

| Function                           | GHL API                                      | Callers                                     |
| ---------------------------------- | -------------------------------------------- | ------------------------------------------- |
| `triggerWorkflow(contactId, name)` | POST to webhook_url from ghl_workflows table | Scout action executor (C5: Add to Campaign) |

### Notes (READ/WRITE to GHL)

| Function                   | GHL API                  | Callers          |
| -------------------------- | ------------------------ | ---------------- |
| `getNotes(contactId)`      | GET /contacts/:id/notes  | No callers found |
| `addNote(contactId, body)` | POST /contacts/:id/notes | No callers found |

### Custom Fields (READ from GHL)

| Function                      | GHL API                         | Callers                                             |
| ----------------------------- | ------------------------------- | --------------------------------------------------- |
| `getCustomFieldDefinitions()` | GET /locations/:id/customFields | No callers found (field IDs cached in app_settings) |

---

## Outbound Flows (NAH OS --> GHL)

### 1. Contact Creation: NAH OS creates contacts IN GHL

```
User clicks "Create Contact" in NAH OS UI
  --> POST /api/contacts/create (authenticated)
    --> ghl.upsertContact() --> GHL POST /contacts/upsert
    --> Supabase contacts.upsert (local mirror)
    --> ensureJourneyForContact() (Supabase)
    --> journey_pipeline_state.insert (Sales pipeline, Engagement stage)
    --> EOS goals seed
    --> Background: runContactResearch()
```

**This is the primary contact creation path.** NAH OS is the system of record. GHL gets a copy via API upsert.

### 2. Stage Sync Write-Through: NAH OS syncs pipeline stages TO GHL custom fields

```
User advances a pipeline stage in NAH OS UI
  --> POST /api/contacts/[id]/pipelines/[id]/advance
    --> Supabase journey_pipeline_state.update
    --> syncStageToGHL() --> ghl.updateContact(customFields: [{id, value}])

Auto-advance (when all sub-tasks complete)
  --> lib/contacts/auto-advance.ts
    --> Supabase journey_pipeline_state.update
    --> syncStageToGHL() --> ghl.updateContact(customFields)
```

**Pipelines live in Supabase. GHL only stores the current stage as a custom field for reference.**

### 3. Workflow Engine: Sends SMS/Email/Tasks via GHL

```
Cron: POST /api/cron/workflow-scheduler (every N minutes)
  --> lib/workflows/scheduler.ts
    --> For each active enrollment with due steps:
      SMS step:  ghl.sendMessage({type: "SMS", ...})
      Email step: ghl.sendMessage({type: "Email", ...})
      Chad call step: ghl.createTask() on the contact
      Condition check: ghl.getContact() to read custom fields
```

**The workflow engine is the heaviest GHL user.** It sends all automated comms and creates follow-up tasks.

### 4. Scout AI Actions (Draft-Review-Confirm): Creates tasks, sends messages, updates contacts

```
Scout drafts an action --> User confirms in UI
  --> POST /api/scout/action
    --> lib/ghl/action-queue.ts --> confirmAction()
      --> lib/ghl/actions/executor.ts --> executeGHLAction()
        C1/C2: ghl.sendMessage() (SMS/Email)
        T1: ghl.createTask()
        A1: ghl.createAppointment()
        M1: ghl.upsertContact()
        M2-M9: ghl.updateContact()
        O1-O3: ghl.createOpportunity() / movePipelineStage()
        C5: ghl.triggerWorkflow()
```

**30 action codes covering all GHL write operations.** All go through DRC (Draft-Review-Confirm).

### 5. Call Action Executor: Post-call tasks and appointments

```
User approves a post-call action in the call detail page
  --> PATCH /api/calls/[callId]/actions/[actionId]
    --> executeGHLAction("T1" | "A1" | actionCode, ...)
      --> ghl.createTask() or ghl.createAppointment() or ghl.sendMessage()
```

### 6. Direct Send/Schedule Routes

```
Send message from contact detail page:
  --> POST /api/contacts/[id]/send
    --> ghl.sendMessage()

Schedule appointment from contact detail page:
  --> POST /api/contacts/[id]/schedule
    --> ghl.createAppointment()
```

---

## Inbound Flows (External --> NAH OS)

### 1. Read.ai Webhooks (meeting data)

```
Meeting ends on Zoom/Meet
  --> Read.ai processes recording
    --> POST /api/webhooks/read-ai (HMAC-signed)
      --> classifyCall() --> process by type (prospect/coaching/group)
      --> Creates call record + participants in Supabase
```

**This is the primary data ingestion path for call data.**

### 2. GHL Webhooks (currently no active subscriptions)

```
/api/webhooks/ghl           --> Messages + stage changes (Ed25519 verified)
/api/webhooks/ghl/contacts  --> ContactCreate sync (Ed25519 verified)
/api/webhooks/ghl-calendar  --> Calendar events (Ed25519 verified)
```

**All three routes have handlers but NO events are subscribed in GHL Marketplace App.** Zero inbound GHL webhook traffic confirmed via Vercel logs.

### 3. Other Webhooks (not yet active)

```
/api/webhooks/form-submission  --> PFS document forms (shared-secret)
/api/webhooks/docusign         --> DocuSign envelope events
/api/webhooks/trainual         --> Trainual completion events
/api/webhooks/zorakle          --> Zorakle assessment results
/api/webhooks/google-meet      --> Google Meet events
/api/webhooks/payment          --> Payment events
```

**All have handler code. None are actively receiving traffic.**

---

## Reads from GHL (NAH OS pulls data FROM GHL)

### Scout AI (on-demand reads)

Scout tools read GHL data when the user asks questions:

- `getContact()` — contact details, custom fields (10+ tools)
- `searchContacts()` — find contacts by name/email/phone
- `searchOpportunities()` — pipeline/deal data
- `getPipelines()` — pipeline structure
- `getAllAppointments()` — calendar view

### Cron Jobs (periodic reads)

- `sync-ghl-calendar` — pulls all appointments from GHL calendars for local display
- Workflow `delivery-sync` — checks GHL message history for delivery/response status
- Workflow `scheduler` — reads contact custom fields for condition checks

### Intelligence Bootstrap (one-time bulk read)

- `getContact()` + `searchOpportunitiesPaginated()` — initial data load for scoring

---

## Unknown / Unclear

1. **How do prospects from newagainhouses.com enter the system?**
   - No `/api/forms/submit` or similar external entry point exists
   - No reference to newagainhouses.com in the codebase
   - `/api/contacts/create` requires authentication (JWT) -- it's an internal route, not a public form endpoint
   - **Best guess:** Someone (Corey or a team member) manually creates contacts in the NAH OS UI, which calls `/api/contacts/create`
   - **Or:** The marketing site has its own backend that calls GHL directly, and contacts are then synced via some other mechanism not in this repo
   - **This is the key gap Corey needs to clarify**

2. **Are GHL opportunities actually used?**
   - `createOpportunity()` and `movePipelineStage()` exist as Scout actions (O1-O3) but have no automated callers
   - Scout reads opportunity data for display, but all pipeline state is managed in Supabase
   - Pipeline stages are synced FROM Supabase TO GHL custom fields (not the other way)
   - **It's possible GHL pipelines were used historically but the app now manages its own**

3. **Are GHL notes used?**
   - `getNotes()` and `addNote()` exist but have ZERO callers anywhere in the codebase
   - Scout action executor uses `sendMessage()` with "[Internal Note]" prefix for C8 action instead
   - **Dead code — notes API is unused**

4. **Are GHL tasks being read back?**
   - `getTasks()` and `searchTasks()` exist but have no callers outside the client file
   - Tasks are CREATED via workflow scheduler and Scout actions, but never READ back
   - **Write-only integration for tasks — we push but never pull**

5. **Is `triggerWorkflow` actually wired?**
   - Calls GHL workflow webhook URLs stored in `ghl_workflows` table
   - Only caller is Scout action C5 (Add to Campaign)
   - Unknown if the `ghl_workflows` table has active entries

6. **Calendar sync direction**
   - `sync-ghl-calendar` cron reads FROM GHL
   - `createAppointment` writes TO GHL
   - But `/api/webhooks/ghl-calendar` (inbound webhook) is not subscribed
   - **Two-way sync partially built, inbound side inactive**

---

## Summary: The Actual Model

```
newagainhouses.com (marketing site)
    |
    ? (unknown entry point -- manual? direct GHL? separate backend?)
    |
    v
NAH OS (Supabase = source of truth)
    |
    |--> GHL: upsertContact (create/update contacts)
    |--> GHL: sendMessage (SMS/Email via workflow engine + Scout)
    |--> GHL: createTask (follow-up tasks via workflow engine + Scout)
    |--> GHL: createAppointment (calendar bookings via Scout + UI)
    |--> GHL: updateContact(customFields) (stage sync write-through)
    |
    |<-- GHL: getContact (Scout reads contact data)
    |<-- GHL: searchOpportunities (Scout reads pipeline data)
    |<-- GHL: getAllAppointments (calendar sync cron)
    |<-- GHL: getContactHistory (delivery sync)
    |
    |<-- Read.ai: call transcripts + meeting data (webhook, active)
    |<-- GHL webhooks: NOT ACTIVE (handlers exist, no subscriptions)
```

**GHL is a comms channel + CRM mirror. NAH OS is the brain.**

---

## Decision Log

### 2026-04-28 — Tier 1 #7 (form webhook) SHELVED

**Context:** Original plan assumed GHL fires ContactCreate webhooks when prospects fill out forms on newagainhouses.com. Investigation revealed the actual flow is opposite — NAH OS creates contacts in GHL via API, not the reverse.

**Findings:**

- Forms live on newagainhouses.com (marketing site), not in GHL
- NAH OS creates contacts via `/api/contacts/create` → `ghl.upsertContact()`
- Pipelines live in Supabase, not GHL. Stage sync is outbound (NAH OS → GHL custom fields).
- No public form endpoint exists in this repo. Prospect creation requires authenticated access.
- Marketing site backend is not editable by our team.

**Decision:** Shelve form webhook work. Ed25519 signature verification code (`lib/auth/ghl-webhook-verify.ts`) is deployed and ready for future use. GHL webhook handlers are dormant (no events subscribed).

**Revisit when:** Marketing site access is available, OR a public ingestion API is needed.

### 2026-04-28 — GHL client cleanup flagged

13 of 30 GHL client functions have zero callers:

- `countContactsByFilter`, `countOpportunitiesByStatus`, `getStageIdByName`
- `getTasks`, `searchTasks` (tasks are write-only)
- `getCalendarFreeSlots`
- `getConversations`, `getConversationMessages`, `markConversationRead`
- `getCallRecording`, `getCallTranscription`
- `getNotes`, `addNote` (notes are completely unused)
- `getWorkflows`, `getCustomFieldDefinitions`

**Decision:** Flag for cleanup pass (Tier 2). Not blocking — dead code doesn't hurt, but adds confusion.
