---
Last verified: 2026-04-28
Source: code
---

# Integrations — NAH Franchise OS

---

## GoHighLevel (GHL) — CRM

| Item        | Detail                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------- |
| Role        | Contacts, messaging (SMS/Email), tasks, appointments, opportunities                           |
| Client      | `lib/ghl/client.ts` (~30 wrapper functions)                                                   |
| Auth        | OAuth (primary) + PIT key (fallback). OAuth tokens in `app_settings` table.                   |
| Refresh     | `cron/refresh-ghl-token` runs every 12h. Tokens expire in 24h, refresh tokens are single-use. |
| Rate limits | 150-200ms between calls. Retry with exponential backoff on 429.                               |
| Env vars    | `GHL_API_KEY` (PIT), `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_LOCATION_ID`                  |
| Webhooks    | 3 routes (see table below). Verified via Ed25519 signature (`X-GHL-Signature` header).        |

### GHL Webhook Routes

Webhooks are configured in the **GHL Marketplace App** (Advanced Settings → Webhooks). GHL signs every outbound webhook with Ed25519 — no custom header or shared secret needed. Verification via `lib/auth/ghl-webhook-verify.ts`.

| Route                        | Events                                                  | Purpose                                                              |
| ---------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| `/api/webhooks/ghl/contacts` | ContactCreate                                           | Canonical new-prospect handler: sync → pipeline → alert → action log |
| `/api/webhooks/ghl`          | InboundMessage, OutboundMessage, OpportunityStageUpdate | Message tracking + stage change workflows                            |
| `/api/webhooks/ghl-calendar` | CalendarAppointment\*                                   | Calendar sync (deferred)                                             |

**Key rule:** GHL is contacts + messaging ONLY. The app owns all pipeline logic, scoring, and workflow state. Nobody works directly in GHL.

---

## Anthropic Claude — Scout AI

| Item     | Detail                                                 |
| -------- | ------------------------------------------------------ |
| Role     | Powers Scout AI — the tool-call chat loop              |
| Model    | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)         |
| Client   | `lib/scout/client.ts` (Anthropic SDK)                  |
| Env vars | `ANTHROPIC_API_KEY`                                    |
| Logging  | All LLM inputs/outputs logged to `llm_call_logs` table |

---

## OpenAI Whisper — Voice transcription

| Item     | Detail                                                           |
| -------- | ---------------------------------------------------------------- |
| Role     | Transcribes uploaded audio files for call records                |
| Client   | `lib/calls/whisper.ts`                                           |
| Env vars | `OPENAI_API_KEY`                                                 |
| Usage    | Optional — only used when rep uploads audio via call detail page |

---

## Read.ai — Meeting intelligence

| Item       | Detail                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| Role       | Receives meeting data (transcripts, participants) via webhook              |
| Webhook    | `/api/webhooks/read-ai` — per-user HMAC signature verification             |
| Processing | `lib/calls/classifier.ts` classifies call type, resolves participants      |
| Env vars   | `READ_AI_API_KEY`, `READ_AI_WEBHOOK_SIGNING_KEY_{EMAIL_PREFIX}` (per user) |

---

## Supabase — Database + Auth

| Item           | Detail                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| Role           | PostgreSQL database, user authentication                                            |
| Server client  | `lib/supabase/server.ts` (service role key, bypasses RLS)                           |
| Browser client | `lib/supabase/client.ts` (anon key, respects RLS)                                   |
| Env vars       | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` |

---

## Other webhook providers

All providers share the same `WEBHOOK_SHARED_SECRET` env var, verified via `x-webhook-secret` header (or `?secret=` query param fallback). Each provider must be configured with the secret before activation.

| Provider        | Route                           | Status                                              |
| --------------- | ------------------------------- | --------------------------------------------------- |
| DocuSign        | `/api/webhooks/docusign`        | Code ready, provider config pending                 |
| Trainual        | `/api/webhooks/trainual`        | Code ready, provider config pending                 |
| Zorakle         | `/api/webhooks/zorakle`         | Code ready, provider config pending                 |
| Google Meet     | `/api/webhooks/google-meet`     | Code ready, provider config pending                 |
| Form submission | `/api/webhooks/form-submission` | Code ready — PFS document forms (not new prospects) |
| Payment         | `/api/webhooks/payment`         | Code ready, provider config pending                 |

---

## Parked integrations

| Integration | Status  | Notes                          |
| ----------- | ------- | ------------------------------ |
| MasterSuite | Parked  | Not in scope until v1 complete |
| Vonage      | Dropped | GHL handles SMS                |
