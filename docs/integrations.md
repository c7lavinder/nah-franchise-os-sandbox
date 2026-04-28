---
Last verified: 2026-04-27
Source: code
---

# Integrations — NAH Franchise OS

---

## GoHighLevel (GHL) — CRM

| Item | Detail |
|---|---|
| Role | Contacts, messaging (SMS/Email), tasks, appointments, opportunities |
| Client | `lib/ghl/client.ts` (~30 wrapper functions) |
| Auth | OAuth (primary) + PIT key (fallback). OAuth tokens in `app_settings` table. |
| Refresh | `cron/refresh-ghl-token` runs every 12h. Tokens expire in 24h, refresh tokens are single-use. |
| Rate limits | 150-200ms between calls. Retry with exponential backoff on 429. |
| Env vars | `GHL_API_KEY` (PIT), `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_LOCATION_ID` |
| Webhooks | 3 routes: `/api/webhooks/ghl`, `/api/webhooks/ghl-calendar`, `/api/webhooks/ghl/contacts`. Shared-secret verification (DEFERRED activation). |

**Key rule:** GHL is contacts + messaging ONLY. The app owns all pipeline logic, scoring, and workflow state. Nobody works directly in GHL.

---

## Anthropic Claude — Scout AI

| Item | Detail |
|---|---|
| Role | Powers Scout AI — the tool-call chat loop |
| Model | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Client | `lib/scout/client.ts` (Anthropic SDK) |
| Env vars | `ANTHROPIC_API_KEY` |
| Logging | All LLM inputs/outputs logged to `llm_call_logs` table |

---

## OpenAI Whisper — Voice transcription

| Item | Detail |
|---|---|
| Role | Transcribes uploaded audio files for call records |
| Client | `lib/calls/whisper.ts` |
| Env vars | `OPENAI_API_KEY` |
| Usage | Optional — only used when rep uploads audio via call detail page |

---

## Read.ai — Meeting intelligence

| Item | Detail |
|---|---|
| Role | Receives meeting data (transcripts, participants) via webhook |
| Webhook | `/api/webhooks/read-ai` — per-user HMAC signature verification |
| Processing | `lib/calls/classifier.ts` classifies call type, resolves participants |
| Env vars | `READ_AI_API_KEY`, `READ_AI_WEBHOOK_SIGNING_KEY_{EMAIL_PREFIX}` (per user) |

---

## Supabase — Database + Auth

| Item | Detail |
|---|---|
| Role | PostgreSQL database, user authentication |
| Server client | `lib/supabase/server.ts` (service role key, bypasses RLS) |
| Browser client | `lib/supabase/client.ts` (anon key, respects RLS) |
| Env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` |

---

## Other webhook providers

| Provider | Route | Status |
|---|---|---|
| DocuSign | `/api/webhooks/docusign` | Shared-secret verification (DEFERRED) |
| Trainual | `/api/webhooks/trainual` | Shared-secret verification (DEFERRED) |
| Zorakle | `/api/webhooks/zorakle` | Shared-secret verification (DEFERRED) |
| Google Meet | `/api/webhooks/google-meet` | Shared-secret verification (DEFERRED) |
| Form submission | `/api/webhooks/form-submission` | Shared-secret verification (DEFERRED) |
| Payment | `/api/webhooks/payment` | Shared-secret verification (DEFERRED) |

---

## Parked integrations

| Integration | Status | Notes |
|---|---|---|
| MasterSuite | Parked | Not in scope until v1 complete |
| Vonage | Dropped | GHL handles SMS |
