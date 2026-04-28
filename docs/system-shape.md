---
Last verified: 2026-04-27
Source: code
---

# System Shape — NAH Franchise OS

Architecture, data flow, and key components.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Database | Supabase (PostgreSQL + Auth) |
| AI | Anthropic Claude Haiku 4.5 (Scout), OpenAI Whisper (transcription) |
| CRM | GoHighLevel (GHL) via PIT key + OAuth |
| Hosting | Vercel (auto-deploy from main) |
| Cron | Vercel Cron + node-cron (accountability engine) |

---

## Data flow

```
Browser → apiFetch (JWT from localStorage)
  → Next.js API Route → requireAuth (Supabase JWT verification)
    → Supabase (app state) and/or GHL API (CRM data)
      → Response → Frontend
```

All API routes require auth except 7 public routes (login, logout, refresh, OAuth, health, tracking pixels).

Admin routes additionally check `user.role === "admin"`.

Cron routes check `CRON_SECRET` Bearer token.

Webhook routes check `WEBHOOK_SHARED_SECRET` header (or HMAC for Read.ai).

---

## Pages (14)

| Page | Route | Purpose |
|---|---|---|
| Daily HQ | `/daily-hq` | Inbox, calendar, tasks, scorecard |
| Scout AI | `/scout` | Chat with Scout, execute drafted actions |
| Pipeline | `/pipeline` | Lead board, contact cards, stage management |
| Calls | `/calls` | Call list, detail, grading, action items |
| Call Detail | `/calls/[callId]` | Transcript, coaching, data extraction |
| Contact Detail | `/contacts/[contactId]` | Profile, EOS, pipeline state, team |
| Journey Detail | `/journeys/[journeyId]` | Journey members, pipeline states, split |
| Territory Detail | `/territories/[msSlug]` | Market data, EOS, stakeholders |
| Workflows | `/workflows` | Workflow list, create, health scores |
| Workflow Builder | `/workflows/[workflowId]` | Steps, A/B tests, approvals |
| Knowledge Base | `/knowledge` | KB document CRUD |
| Onboarding | `/onboarding` | New franchisee onboarding tracker |
| Settings | `/settings` | Users, pipelines, call types, integrations |
| Webhooks Admin | `/settings/webhooks` | Read.ai session viewer, integration logs |

---

## API routes (216)

Organized by domain. See `docs/AUTH_AUDIT.md` for full route-by-route auth status.

| Domain | Routes | Auth |
|---|---|---|
| auth/* | 6 | Public (login/logout/refresh/OAuth) |
| calls/* | 26 | requireAuth |
| contacts/* | 40 | requireAuth |
| cron/* | 16 | CRON_SECRET |
| daily-hq | 1 | requireAuth (admin view-as) |
| ghl/* | 2 | requireAuth |
| inbox/* | 4 | requireAuth |
| intelligence/* | 13 | requireAuth |
| journeys/* | 3 | requireAuth |
| knowledge | 1 | requireAuth |
| leads/* | 3 | requireAuth |
| pipeline/* | 7 | requireAuth |
| scout/* | 3 | requireAuth |
| settings/* | 22 | requireAuth (admin role on mutations) |
| territories/* | 22 | requireAuth |
| webhooks/* | 10 | HMAC or shared secret |
| workflows/* | 12 | requireAuth |
| other | 25 | requireAuth or public |

---

## Pipelines (4)

| Pipeline | Purpose | Stages |
|---|---|---|
| Sales | Franchise prospect journey | New Lead → Intro → Matt Call → Sam Call → Mark Call → FDD → Application → Awarded |
| Follow-up | Post-initial-contact nurture | Nurture → Re-engaged → Active Follow-up |
| Onboarding | Post-signing setup | Welcome → Training → Territory Setup → Launch Prep |
| Runway | Territory operational readiness | Market Research → First Deal → Running |

---

## Database

45+ tables across supabase/migrations/ (numbered 001-007 + timestamped).
See `docs/data-model.md` for table-by-table reference.

Key table families:
- **Users/auth:** users, sessions, notifications
- **Contacts:** contacts, contact_profile_fields, contact_team_members, contact_activity_messages
- **Pipelines:** pipelines, pipeline_stages, pipeline_sub_tasks, journey_pipeline_state
- **Journeys:** journeys, journey_contacts
- **Calls:** calls, call_transcripts, call_participants, call_action_items, call_data_extractions
- **Intelligence:** candidate_intelligence, call_logs, candidate_score_history, objection_registry
- **Workflows:** workflows, workflow_versions, workflow_steps, workflow_enrollments
- **EOS:** eos_contact_todos/goals/habits/issues, eos_territory_todos/goals/rocks/scorecard
- **Territories:** territories, territory_market_data, territory_stakeholders
- **Knowledge:** knowledge_documents
- **Integrations:** read_ai_sessions, integration_logs, ghl_custom_fields
