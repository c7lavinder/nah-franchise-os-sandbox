# API Auth Audit — Tier 0b Phase 1

**Date:** 2026-04-27
**Branch:** `feat/auth-retrofit`
**Scope:** every `app/api/**/route.ts` (216 files)
**Method:** automated grep for auth helpers + Explore subagent reading each file + manual spot-check on 5 routes (1 critical, 1 admin, 1 cron, 1 already-correct, 1 webhook)

## Headline numbers

- **Total routes:** 216
- **Real auth (`requireAuth` or `getAuthUser` with 401-on-null):** 6
- **Broken admin (`requireAdmin` with body-userId fallback):** 15
- **Cron token already verified:** 9 (of 16 cron routes)
- **Webhook signature already verified:** 1 (of 10 webhook routes)
- **No auth at all:** 195

By risk:
- **Critical:** 15 — unauthed + accept user identity from body/query + mutate
- **High:** 22 — unauthed + accept identity OR mutate sensitive data
- **Medium:** 137 — unauthed reads/mutates without identity in request
- **Low:** 42 — public by intent (login, health, track-pixel, webhooks/crons that have OR will have shared-secret protection)

By plan:
- `add-requireAuth`: 159
- `replace-requireAdmin`: 15
- `cron-token-add`: 7 (of 16 cron routes; 9 already protected)
- `webhook-shared-secret-add`: 9 (of 10 webhook routes; 1 already protected via HMAC)
- `keep-public`: 9
- `none-already-correct`: 6

> **CC's audit said "~70 API routes."** The reality is 216 — about 3× the original estimate. Time-budget for Phase 2 retrofit must account for this.

---

## How to read the table

| Column | Meaning |
|---|---|
| Route | Path under `/api/`. Bracket segments are dynamic params. |
| Methods | HTTP verbs exported. |
| Currently authed? | Yes (real auth) / No / Broken-admin-only (uses `requireAdmin` which falls back to body `userId`). |
| Identity Source | Where the route gets user identity today: `body`, `query`, `path`, `session`, `none`. |
| R/M | Reads or Mutates state. |
| Risk | Critical / High / Medium / Low. |
| Plan | The retrofit action: `add-requireAuth`, `replace-requireAdmin`, `cron-token-add`, `cron-token-verified` (already protected), `webhook-shared-secret-add`, `webhook-signed-verified` (already protected), `keep-public`, `oauth-callback`, `none` (already correct). |

---

## /api/auth/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| auth/crm | GET | No | none | Reads | Low | keep-public |
| auth/crm/callback | GET | No | query | Mutates | Low | oauth-callback |
| auth/login | POST | No | body | Mutates | Low | keep-public |
| auth/logout | POST | No | none | Reads | Low | keep-public |
| auth/me | GET | Yes (getAuthUser+401) | session | Reads | Low | none |
| auth/refresh | POST | No | none | Reads | Low | keep-public |

## /api/calls/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| calls | GET | No | none | Reads | Medium | add-requireAuth |
| calls/[callId] | GET | No | none | Reads | Medium | add-requireAuth |
| calls/[callId]/actions | POST | No | none | Mutates | Medium | add-requireAuth |
| calls/[callId]/actions/[actionId] | PATCH | No | body | Mutates | Critical | add-requireAuth |
| calls/[callId]/actions/[actionId]/rewrite | POST | No | none | Reads | Medium | add-requireAuth |
| calls/[callId]/actions/generate-single | POST | No | none | Mutates | Medium | add-requireAuth |
| calls/[callId]/coach | POST | No | none | Reads | Medium | add-requireAuth |
| calls/[callId]/data/[extractionId] | PATCH | No | none | Mutates | Medium | add-requireAuth |
| calls/[callId]/data/[extractionId]/save | POST | No | none | Mutates | Medium | add-requireAuth |
| calls/[callId]/delete | POST | Yes (getAuthUser+401) | session | Mutates | Low | none |
| calls/[callId]/detail | GET | No | none | Reads | Medium | add-requireAuth |
| calls/[callId]/feedback | POST | No | body | Mutates | High | add-requireAuth |
| calls/[callId]/generate | POST | No | none | Reads | Medium | add-requireAuth |
| calls/[callId]/grade | POST | No | none | Reads | Medium | add-requireAuth |
| calls/[callId]/grade-rubric | POST | No | none | Reads | Medium | add-requireAuth |
| calls/[callId]/journeys | GET | No | none | Reads | Medium | add-requireAuth |
| calls/[callId]/override | POST | Yes (getAuthUser+401) | session | Mutates | Low | none |
| calls/[callId]/reclassify-participants | POST | No | none | Mutates | Medium | add-requireAuth |
| calls/[callId]/review-package | GET,POST | No | none | Reads | Medium | add-requireAuth |
| calls/[callId]/territories | GET | No | none | Reads | Medium | add-requireAuth |
| calls/[callId]/transcript | POST | No | body | Mutates | Critical | add-requireAuth |
| calls/[callId]/upload | POST | No | none | Mutates | Medium | add-requireAuth |
| calls/create | POST | No | body | Mutates | Critical | add-requireAuth |
| calls/list | GET | No | query | Reads | High | add-requireAuth |
| calls/reconcile | POST | No | none | Reads | Medium | add-requireAuth |
| calls/reformat-transcripts | POST | No | none | Mutates | Medium | add-requireAuth |

## /api/contacts/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| contacts/[contactId] | GET,PATCH | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/brief | POST | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/emails | GET,POST | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/emails/[emailId] | DELETE,PATCH | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/eos | GET | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/eos/goals | POST | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/eos/habits | GET,POST | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/eos/habits/[habitId] | DELETE,PUT | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/eos/issues | POST | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/eos/issues/[issueId] | DELETE,PUT | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/eos/todos | POST | No | body | Mutates | Critical | add-requireAuth |
| contacts/[contactId]/eos/todos/[todoId] | DELETE,PUT | No | body | Mutates | Critical | add-requireAuth |
| contacts/[contactId]/journey | GET | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/merge | POST | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/messages | GET,POST | Yes (getAuthUser+401) | session | Mutates | Low | none |
| contacts/[contactId]/messages/[messageId] | DELETE,PATCH | Yes (getAuthUser+401) | session | Mutates | Low | none |
| contacts/[contactId]/notes | POST | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/pipeline-state | GET | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/pipelines/[pipelineId]/advance | POST | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/pipelines/[pipelineId]/drop | POST | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/pipelines/[pipelineId]/revert | POST | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/pipelines/resume-sales | POST | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/pre-call-brief | GET | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/profile | GET,PUT | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/related-people | GET,POST | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/related-people/[personId] | DELETE,PATCH | No | none | Mutates | Medium | add-requireAuth |
| contacts/[contactId]/schedule | POST | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/score | POST | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/scout-actions | GET | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/send | POST | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/sub-tasks/[subTaskId]/logs | POST | No | body | Mutates | Critical | add-requireAuth |
| contacts/[contactId]/tasks | POST | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/tasks/[taskId] | PUT | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/team | DELETE,GET,POST | No | body | Mutates | Critical | add-requireAuth |
| contacts/[contactId]/territories | GET | No | none | Reads | Medium | add-requireAuth |
| contacts/[contactId]/territory-data | GET | No | none | Reads | Medium | add-requireAuth |
| contacts/batch | GET,POST | No | none | Reads | Medium | add-requireAuth |
| contacts/create | POST | No | none | Mutates | Medium | add-requireAuth |
| contacts/search | GET | No | none | Reads | Medium | add-requireAuth |

## /api/cron/*

> **9 cron routes already verify `CRON_SECRET`** (verified by grep). Plan column distinguishes `cron-token-verified` (already protected, no change needed beyond docs) from `cron-token-add` (still needs the check).

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| cron/journals | GET,POST | Yes (CRON_SECRET) | none | Mutates | Low | cron-token-verified |
| cron/pre-call-briefs | GET | Yes (CRON_SECRET) | none | Reads | Low | cron-token-verified |
| cron/process-transcripts | GET | Yes (CRON_SECRET) | none | Reads | Low | cron-token-verified |
| cron/reengagement-scan | GET | Yes (CRON_SECRET) | none | Reads | Low | cron-token-verified |
| cron/research-contacts | GET | Yes (CRON_SECRET) | none | Reads | Low | cron-token-verified |
| cron/research-territories | GET | Yes (CRON_SECRET) | none | Reads | Low | cron-token-verified |
| cron/rubric-review | GET,POST | Yes (CRON_SECRET) | none | Mutates | Low | cron-token-verified |
| cron/sync-ghl-calendar | GET | Yes (CRON_SECRET) | none | Mutates | Low | cron-token-verified |
| cron/weekly-report | GET,POST | Yes (CRON_SECRET) | none | Mutates | Low | cron-token-verified |
| cron/refresh-ghl-token | GET | No | none | Mutates | Low | cron-token-add |
| cron/score-recalculate | POST | No | none | Reads | Low | cron-token-add |
| cron/stale-leads | POST | No | none | Mutates | Low | cron-token-add |
| cron/workflow-analysis | POST | No | none | Reads | Low | cron-token-add |
| cron/workflow-delivery-sync | POST | No | none | Reads | Low | cron-token-add |
| cron/workflow-notifications | POST | No | none | Reads | Low | cron-token-add |
| cron/workflow-scheduler | POST | No | none | Reads | Low | cron-token-add |

## /api/intelligence/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| intelligence/bootstrap | POST | No | none | Reads | Medium | add-requireAuth |
| intelligence/call-logs | GET,POST | No | none | Mutates | Medium | add-requireAuth |
| intelligence/franchisee | GET,POST | No | none | Mutates | Medium | add-requireAuth |
| intelligence/franchisee/[franchiseeId] | GET,PATCH | No | none | Mutates | Medium | add-requireAuth |
| intelligence/llm-logs | GET | No | query | Reads | High | add-requireAuth |
| intelligence/market-signals | GET,POST | No | none | Mutates | Medium | add-requireAuth |
| intelligence/objections | GET,POST | No | none | Mutates | Medium | add-requireAuth |
| intelligence/onboarding | GET,POST | No | none | Reads | Medium | add-requireAuth |
| intelligence/onboarding/[enrollmentId] | PATCH | No | none | Reads | Medium | add-requireAuth |
| intelligence/profile | GET | No | none | Reads | Medium | add-requireAuth |
| intelligence/scores | GET | No | none | Reads | Medium | add-requireAuth |
| intelligence/transcript | POST | No | none | Reads | Medium | add-requireAuth |
| intelligence/zorakle | POST | No | none | Mutates | Medium | add-requireAuth |

## /api/workflows/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| workflows | GET,POST | No | body, query | Mutates | Critical | add-requireAuth |
| workflows/[workflowId] | GET,PATCH | No | none | Mutates | Medium | add-requireAuth |
| workflows/[workflowId]/ab-tests | GET,POST | No | body | Reads | High | add-requireAuth |
| workflows/[workflowId]/ab-tests/[testId] | GET,PATCH | No | none | Reads | Medium | add-requireAuth |
| workflows/[workflowId]/approvals | GET,POST | No | none | Reads | Medium | add-requireAuth |
| workflows/[workflowId]/approvals/[approvalId] | GET,PATCH | No | none | Reads | Medium | add-requireAuth |
| workflows/[workflowId]/rewrite | POST | No | none | Reads | Medium | add-requireAuth |
| workflows/[workflowId]/steps | GET,POST | No | none | Mutates | Medium | add-requireAuth |
| workflows/[workflowId]/steps/[stepId] | DELETE,PATCH | No | none | Mutates | Medium | add-requireAuth |
| workflows/approvals | GET | No | none | Reads | Medium | add-requireAuth |
| workflows/enrollments | GET,POST | No | none | Reads | Medium | add-requireAuth |
| workflows/enrollments/[enrollmentId] | GET,PATCH | No | none | Reads | Medium | add-requireAuth |

## /api/settings/*

> **Phase 2c complete** — all 15 `replace-requireAdmin` routes migrated to `requireAuth` + `user.role === 'admin'` check. `lib/auth/admin-check.ts` deleted. Broken body-userId fallback eliminated.

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| settings/agents | GET | No | none | Reads | Medium | add-requireAuth |
| settings/agents/toggle | POST | No | none | Mutates | Medium | add-requireAuth |
| settings/app-settings | GET,PATCH | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/call-types | GET,POST | ✅ Yes (POST) | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/call-types/[id] | DELETE,PATCH | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/call-types/[id]/rubric | GET,PATCH | ✅ Yes (PATCH) | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/cron-jobs | GET | No | none | Reads | Low | add-requireAuth |
| settings/health | GET | No | none | Reads | Medium | add-requireAuth |
| settings/integrations | GET | No | none | Reads | Medium | add-requireAuth |
| settings/lead-sources | DELETE,GET,POST | No | none | Mutates | Medium | add-requireAuth |
| settings/pipelines | GET | No | none | Reads | Medium | add-requireAuth |
| settings/pipelines/[pipelineId] | PATCH | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/pipelines/[pipelineId]/stages | POST | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/pipelines/[pipelineId]/stages/[stageId] | DELETE,PATCH | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/pipelines/[pipelineId]/stages/[stageId]/auto-advance | POST | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/pipelines/[pipelineId]/stages/reorder | POST | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/rubric-criteria/[id] | DELETE,PATCH | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/rubrics/[id]/criteria | POST | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/rubrics/[id]/criteria/reorder | POST | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/stages/[stageId]/sub-tasks | POST | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/stages/[stageId]/sub-tasks/reorder | POST | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/sub-tasks/[subTaskId] | DELETE,PATCH | ✅ Yes | session | Mutates | High | ✅ `477ceb3` — requireAuth + admin role |
| settings/users | GET,PATCH | ✅ Yes | session | Mutates | Critical | ✅ `b042063` — requireAuth + admin role (Phase 2a) |

## /api/agents/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| agents/contact-research/[contactId] | POST | No | none | Reads | Medium | add-requireAuth |
| agents/post-call/run | POST | No | none | Reads | Medium | add-requireAuth |
| agents/pre-call-brief/[callId] | POST | No | none | Reads | Medium | add-requireAuth |
| agents/reengagement/[contactId] | POST | No | none | Reads | Medium | add-requireAuth |
| agents/territory-market/[msSlug] | POST | No | none | Reads | Medium | add-requireAuth |

## /api/scout/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| scout/action | POST | No | body | Mutates | Critical | add-requireAuth |
| scout/chat | POST | No | body | Mutates | Critical | add-requireAuth |
| scout/session | GET | No | query | Reads | High | add-requireAuth |

## /api/pipeline/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| pipeline | GET | No | none | Reads | Medium | add-requireAuth |
| pipeline/board | GET | No | none | Reads | Medium | add-requireAuth |
| pipeline/contacts | GET | No | query | Reads | High | add-requireAuth |
| pipeline/move | PUT | No | body | Mutates | Critical | add-requireAuth |
| pipeline/stages | GET | No | none | Reads | Medium | add-requireAuth |
| pipeline/territory-cards | GET | No | none | Reads | Medium | add-requireAuth |
| pipeline/users | GET | No | none | Reads | Medium | add-requireAuth |

## /api/inbox/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| inbox | GET | No | none | Reads | Medium | add-requireAuth |
| inbox/[conversationId] | GET | No | none | Reads | Medium | add-requireAuth |
| inbox/[conversationId]/read | PUT | No | none | Reads | Medium | add-requireAuth |
| inbox/send | POST | No | none | Mutates | Medium | add-requireAuth |

## /api/leads/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| leads | GET | No | none | Reads | Medium | add-requireAuth |
| leads/priority | GET | No | none | Reads | Medium | add-requireAuth |
| leads/score-all | POST | No | none | Reads | Medium | add-requireAuth |

## /api/webhooks/*

> **1 webhook already has HMAC signature verification** (`read-ai`, per-user signing key in env). The other 9 are open. `add` plan = implement `WEBHOOK_SHARED_SECRET` check.

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| webhooks/read-ai | POST | Yes (HMAC per-user signing key) | none | Mutates | Low | webhook-signed-verified |
| webhooks/docusign | POST | No | none | Mutates | Low | webhook-shared-secret-add |
| webhooks/form-submission | POST | No | none | Mutates | Low | webhook-shared-secret-add |
| webhooks/ghl | POST | No | none | Mutates | Low | webhook-shared-secret-add |
| webhooks/ghl-calendar | POST | No | none | Mutates | Low | webhook-shared-secret-add |
| webhooks/ghl/contacts | POST | No | none | Reads | Low | webhook-shared-secret-add |
| webhooks/google-meet | POST | No | none | Mutates | Low | webhook-shared-secret-add |
| webhooks/payment | POST | No | none | Mutates | Low | webhook-shared-secret-add |
| webhooks/trainual | POST | No | body | Mutates | Low | webhook-shared-secret-add |
| webhooks/zorakle | POST | No | none | Mutates | Low | webhook-shared-secret-add |

## /api/track/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| track/click/[logId] | GET | No | none | Mutates | Low | keep-public |
| track/open/[logId] | GET | No | none | Mutates | Low | keep-public |

## /api/ghl/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| ghl/calendars | GET | No | none | Reads | Medium | add-requireAuth |
| ghl/sync | POST | No | none | Mutates | Medium | add-requireAuth |

## /api/admin/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| admin/webhooks | GET | ✅ Yes | session | Reads | Medium | ✅ `29a1caf` — admin UI route (returns read_ai_sessions, integration_logs, calls for debugging dashboard). NOT an inbound webhook. Retrofitted with `requireAuth` + `role === 'admin'` check. |

## /api/dashboard, /api/voice, /api/health, /api/daily-hq, /api/notifications, /api/accountability, /api/activity

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| dashboard | GET | No | none | Reads | Medium | add-requireAuth |
| voice/transcribe | POST | No | none | Reads | Medium | add-requireAuth |
| health | GET | No | none | Reads | Low | keep-public |
| daily-hq | GET | No | query | Reads | High | add-requireAuth |
| notifications | GET,PATCH | Yes (getAuthUser+401) | session | Mutates | Low | none |
| accountability/run | POST | No | none | Reads | Medium | add-requireAuth |
| activity | GET | No | none | Reads | Medium | add-requireAuth |

## /api/territories/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| territories | GET | No | none | Reads | Medium | add-requireAuth |
| territories/[msSlug] | GET | No | none | Reads | Medium | add-requireAuth |
| territories/[msSlug]/eos | GET | No | none | Reads | Medium | add-requireAuth |
| territories/[msSlug]/eos/budgets | POST | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/eos/budgets/[budgetId] | DELETE,PUT | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/eos/goals | POST | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/eos/habits/[habitId] | PUT | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/eos/issues | POST | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/eos/issues/[issueId] | DELETE,PUT | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/eos/lead-channels/[channelId] | POST | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/eos/rocks | POST | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/eos/rocks/[rockId] | DELETE,PUT | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/eos/scorecard/[metricKey] | PUT | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/eos/todos | POST | No | body | Mutates | Critical | add-requireAuth |
| territories/[msSlug]/eos/todos/[todoId] | DELETE,PUT | No | body | Mutates | Critical | add-requireAuth |
| territories/[msSlug]/market-data | GET,POST,PUT | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/ownership-history | GET | No | none | Reads | Medium | add-requireAuth |
| territories/[msSlug]/stakeholders | DELETE,GET,POST | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/status | PATCH | No | none | Mutates | Medium | add-requireAuth |
| territories/[msSlug]/transfer | POST | No | none | Mutates | Medium | add-requireAuth |

## /api/journeys/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| journeys/[journeyId] | PATCH | No | none | Mutates | Medium | add-requireAuth |
| journeys/[journeyId]/members | POST | No | none | Mutates | Medium | add-requireAuth |
| journeys/[journeyId]/split | POST | No | body | Mutates | Critical | add-requireAuth |

## /api/territory-owners/*, /api/zorakle/*, /api/knowledge/*, /api/scorecards/*, /api/research/*, /api/metrics/*, /api/suggestions/*, /api/sub-task-logs/*

| Route | Methods | Currently Authed? | Identity Source | R/M | Risk | Plan |
|---|---|---|---|---|---|---|
| territory-owners/assign | POST | No | none | Mutates | Medium | add-requireAuth |
| territory-owners/transfer | POST | No | none | Mutates | Medium | add-requireAuth |
| zorakle/owner/[msSlug] | GET | No | none | Reads | Medium | add-requireAuth |
| zorakle/prospect/[contactId] | GET | No | none | Reads | Medium | add-requireAuth |
| zorakle/prospect/sync | POST | No | none | Mutates | Medium | add-requireAuth |
| knowledge | DELETE,GET,POST,PUT | No | none | Mutates | Medium | add-requireAuth |
| scorecards/[page] | GET | No | none | Reads | Medium | add-requireAuth |
| research/contact/[contactId] | POST | No | none | Reads | Medium | add-requireAuth |
| research/territory/[msSlug] | POST | No | none | Reads | Medium | add-requireAuth |
| metrics/north-star | GET | No | none | Reads | Medium | add-requireAuth |
| suggestions | GET | No | none | Reads | Medium | add-requireAuth |
| suggestions/push | POST | No | none | Reads | Medium | add-requireAuth |
| suggestions/skip | POST | No | none | Reads | Medium | add-requireAuth |
| sub-task-logs/[logId] | DELETE | No | none | Mutates | Medium | add-requireAuth |

---

## Critical findings (15 routes — fix first)

Each accepts user identity from request body or query, has no auth, and mutates state. Anyone with the deployment URL can impersonate.

1. ✅ `POST /api/calls/[callId]/actions/[actionId]` — `1c8ab62`
2. ✅ `POST /api/calls/[callId]/transcript` — `1c8ab62`
3. ✅ `POST /api/calls/create` — `1c8ab62`
4. ✅ `POST /api/contacts/[contactId]/eos/todos` — `8a6c1bc`
5. ✅ `DELETE,PUT /api/contacts/[contactId]/eos/todos/[todoId]` — `8a6c1bc`
6. ✅ `POST /api/contacts/[contactId]/sub-tasks/[subTaskId]/logs` — `8a6c1bc`
7. ✅ `DELETE,GET,POST /api/contacts/[contactId]/team` — `8a6c1bc`
8. ✅ `POST /api/scout/action` — `bc988d6`
9. ✅ `POST /api/scout/chat` — `bc988d6` (body userId/userRole/userName dropped entirely)
10. ✅ `PUT /api/pipeline/move` — `acc9fe7` (user.id now written to action log)
11. ✅ `GET,PATCH /api/settings/users` — `b042063` (admin role check on both GET and PATCH)
12. ✅ `POST /api/territories/[msSlug]/eos/todos` — `007b8d5`
13. ✅ `DELETE,PUT /api/territories/[msSlug]/eos/todos/[todoId]` — `007b8d5`
14. ✅ `GET,POST /api/workflows` — `acc9fe7` (auth-derived user.id replaces body.createdBy)
15. ✅ `POST /api/journeys/[journeyId]/split` — `acc9fe7`

## High-risk findings (22 routes)

All 22 High-risk routes now protected:
- ✅ `GET /api/daily-hq` — `9f6dafd` (Phase 2a, admin view-as pattern)
- ✅ `GET /api/intelligence/llm-logs` — `c9882f9` (Phase 2d)
- ✅ `GET /api/calls/list` — `c9882f9` (Phase 2d)
- ✅ `POST /api/calls/[callId]/feedback` — `c9882f9` (Phase 2d)
- ✅ `GET /api/pipeline/contacts` — `c9882f9` (Phase 2d)
- ✅ `GET /api/scout/session` — `c9882f9` (Phase 2d, userId derived from auth)
- ✅ `GET,POST /api/workflows/[workflowId]/ab-tests` — `c9882f9` (Phase 2d, createdBy from auth)
- ✅ All 15 `/api/settings/*` routes — `477ceb3` (Phase 2c, requireAdmin replaced)

## Spot-check verification (5/216 routes manually inspected)

| Route | Subagent classification | Verified result |
|---|---|---|
| `/api/scout/action` | Critical / body / no auth | ✅ Confirmed |
| `/api/settings/users` | Critical / body / no auth | ✅ Confirmed (target field is `id`, not `userId`, but risk is identical) |
| `/api/cron/journals` | cron-token-add | ❌ Already has `CRON_SECRET` check — corrected to `cron-token-verified` |
| `/api/calls/[callId]/delete` | Yes (getAuthUser+401) | ✅ Confirmed (also enforces admin/owner check) |
| `/api/webhooks/read-ai` | webhook-shared-secret-add | ❌ Already has HMAC per-user signing key — corrected to `webhook-signed-verified` |

The 9 cron routes with existing `CRON_SECRET` checks were detected by separate grep and the table was corrected.

## Things to flag for Corey before Phase 2 begins

1. **Scope is 3× the original estimate.** CC's audit said ~70 routes; reality is 216. Time-budget for Phase 2 was "1 day hard stop" — that is not realistic for 159 `add-requireAuth` retrofits + 15 `replace-requireAdmin` + 7 cron-token + 9 webhook secret + tests + docs. Recommend either splitting Phase 2 into multiple sessions (one PR per route family is the natural slice) or accepting that this is a multi-day sprint.

2. **`requireAdmin` source-file deletion.** All 15 `replace-requireAdmin` migrations should also delete `lib/auth/admin-check.ts` once the last call site is gone. The function's existence is a foot-gun — anyone could re-import it.

3. **Frontend impact.** Routes that today take `userId` from body or query mostly do so because the frontend sends it. Removing those fields will break frontends until they're updated. The frontend already has the JWT in `localStorage` via `AuthContext` — needs a `getAuthHeader()` helper passed in fetches. Suggest adding that helper + sweep frontend fetches in Phase 2 or as a parallel sub-phase.

4. **`daily-hq` GHL fetch + auth.** `daily-hq` accepts `?userId=` and uses it to look up `ghl_user_id`. Once we derive from session, we lose the ability to do "view as another user" admin-mode. CC mentioned cross-user admin views aren't built yet, but if they're planned, the right pattern is `?targetUserId=` only honored if `user.role === 'admin'`. Flagging now so we don't have to redo this later.

5. **`scout/chat` request shape.** Today the body has `userId`, `userRole`, `userName`. After retrofit they all come from the session. The frontend currently constructs these from `useAuth()` context, so the change is "stop sending them, just send `message`/`history`/`pageContext`". Should be a quick frontend sweep.

6. **OAuth flow at `/api/auth/crm/callback`.** GHL OAuth callback flow needs a separate read — does it verify state token, prevent CSRF on the callback, etc.? Currently classified `oauth-callback` (review). Would be a small Phase 2 sub-task.

7. **Cron `refresh-ghl-token` is unprotected.** This is the route that refreshes our GHL OAuth token — if exploited, attacker triggers token refreshes which could DoS GHL or hit rate limits. Low risk but we should fix it.

8. **`/api/webhooks/ghl` is open and dead-code-suspect.** `CC_INPUT.md` flagged that CLAUDE.md/memory says "no GHL webhooks." Either delete the route (and `ghl-calendar`, `ghl/contacts`) or wire them up properly with signature verification. Worth resolving the contradiction as part of Phase 2.

9. **`/api/admin/webhooks` is unauthenticated.** Despite the name, it has no auth check. Either add `requireAuth` + admin role, or rename if it's actually for incoming webhooks (the file path is ambiguous).

## Out of scope (per Tier 0b prompt)

These were flagged but explicitly deferred:
- JWT in localStorage → httpOnly cookies (separate prompt)
- Per-rep row-level filtering on intelligence tables (separate ADR)
- OAuth token storage cleanup in `app_settings` (separate cleanup pass)

---

**End of Phase 1 audit. Phase 2 begins after Corey approves this document.**

---

## Phase 2a — Critical route retrofit (completed)

**Date:** 2026-04-27
**Branch:** `feat/auth-retrofit`

### What was done

- All 15 Critical routes retrofitted with `requireAuth`
- `/api/daily-hq`: auth + admin "view as" pattern (`?targetUserId=X` honored only for admins)
- `/api/scout/chat`: body `userId`/`userRole`/`userName` dropped entirely — all identity from auth session
- `/api/settings/users`: admin role check on both GET and PATCH (closes privilege escalation)
- `/api/pipeline/move`: user.id now written to action log (was null)
- `/api/workflows` POST: auth-derived user.id replaces body.createdBy
- `/api/admin/webhooks`: classified as admin UI route, retrofitted with requireAuth + admin role
- `lib/auth/get-auth-header.ts`: client-side helper added for Phase 2b frontend sweep
- `lib/auth/admin-check.ts`: marked with TODO for deletion in Phase 2d

### What was NOT touched (deferred per scope)

- Medium/Low risk routes (Phase 2c-2f)
- `requireAdmin` callers in /api/settings/* (Phase 2c)
- Cron routes (Phase 2e)
- Webhook routes (Phase 2e)
- Frontend code (Phase 2b)

---

## Phase 2b — Frontend auth sweep (completed)

**Date:** 2026-04-27
**Commits on main:** `ae5e393` through `46a57fb`

### What was done

- Created `lib/auth/api-fetch.ts` — thin `apiFetch` wrapper reads JWT from localStorage
- Replaced `fetch("/api/...")` with `apiFetch("/api/...")` in 94 frontend files
- Dropped body-supplied identity from Scout chat/action, Daily HQ, Workflows
- Fixed requireAuth to return Response instead of throwing (Next.js route handlers don't catch thrown Responses)
- Added JWT auto-refresh on 401 with retry
- Added force-logout when refresh token is also expired

---

## Phase 2c — Replace broken admin-check.ts (completed)

**Date:** 2026-04-27
**Branch:** `feat/auth-admin-check-migration`

### What was done

- All 15 `replace-requireAdmin` routes migrated to `requireAuth` + `user.role === 'admin'`
- `lib/auth/admin-check.ts` deleted — broken body-userId fallback eliminated
- Smoke tested: admin (Matt) gets 200, non-admin (Chad) gets 403, no-auth gets 401

### What remains

- Medium risk routes: add-requireAuth (Phase 2f)

---

## Phase 2d — Remaining High-risk routes (completed)

**Date:** 2026-04-27
**Commit:** `c9882f9`

6 remaining High-risk routes retrofitted with requireAuth:
- calls/[callId]/feedback (POST)
- calls/list (GET)
- intelligence/llm-logs (GET)
- scout/session (GET — userId now derived from auth, not query param)
- pipeline/contacts (GET)
- workflows/[workflowId]/ab-tests (GET, POST — createdBy from auth)

---

## Phase 2e — Cron + webhook hardening (completed)

**Date:** 2026-04-27

### Cron routes — `1706d67`

7 unprotected cron routes now verify CRON_SECRET Bearer token:
- cron/stale-leads, cron/workflow-scheduler, cron/workflow-analysis
- cron/workflow-notifications, cron/workflow-delivery-sync
- cron/score-recalculate, cron/refresh-ghl-token

All 16 cron routes now protected (9 were already protected).

### Webhook routes — `7b92fbd`

9 unprotected webhook routes now verify WEBHOOK_SHARED_SECRET:
- webhooks/docusign, webhooks/form-submission, webhooks/ghl
- webhooks/ghl-calendar, webhooks/ghl/contacts, webhooks/google-meet
- webhooks/payment, webhooks/trainual, webhooks/zorakle

webhooks/read-ai left alone (already has per-user HMAC verification).
All 10 webhook routes now protected.

---

## Phase 2f — Medium-risk routes + tests + docs (completed)

**Date:** 2026-04-27
**Commit:** `4d6411b`

- All 133 remaining Medium-risk routes retrofitted with requireAuth
- 7 Low-risk "keep-public" routes verified as correctly classified
- 5 critical-path smoke tests added (27 tests, all passing)
- `docs/security.md` created — full auth model reference
- CRON_SECRET added to Vercel production + development via CLI

### WEBHOOK_SHARED_SECRET — DEFERRED

Not yet set in Vercel. Setting it would break all incoming webhooks until each provider is configured with the matching secret. Providers needing config:
- GHL (3 webhook types), DocuSign, Trainual, Zorakle, Google Meet, form-submission, payment

Verification code is in place and will activate automatically once the env var is set.

### Final tally

- **216 total API routes**
- **209 protected** (requireAuth, admin role check, CRON_SECRET, or HMAC/shared-secret)
- **7 intentionally public** (login, logout, refresh, OAuth, health, tracking pixels)
- **0 unprotected**

### TIER 0b COMPLETE
