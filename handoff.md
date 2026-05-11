# Session Handoff — 2026-05-11 — Session 37

## Status

Phase: GHL Integration Audit / Health: Green / Duration: full session

## What Was Built This Session

- **Comprehensive GHL integration audit**: 43 tests across 5 layers (direct API, API routes, Scout DRC actions, Scout LLM drafting, UI/streaming endpoints) using Denzel Lavinder contact
- **Fixed trigger_workflow argument swap** in `app/api/scout/action/route.ts:355` — contactId and workflowName were reversed, would cause runtime failure on every workflow trigger
- **Fixed missing auth on notes route** in `app/api/contacts/[contactId]/notes/route.ts` — requireAuth imported but never called, allowing unauthenticated note creation
- **Fixed missing auth on inbox read route** in `app/api/inbox/[conversationId]/read/route.ts` — requireAuth imported but never called, allowing unauthenticated conversation marking

## What Is Confirmed Working

- All 31 GHL client functions connect and return expected data (PIT key auth)
- OAuth tokens stored in app_settings, auto-refresh mechanism in place
- SMS sends to real phone numbers (Denzel received texts)
- Email sends to real email addresses (Denzel received emails)
- GHL task creation, update (mark complete), and org-wide search
- GHL note creation and retrieval
- GHL appointment creation (with slot availability), update (cancel), and calendar listing (11 calendars)
- GHL contact search, get, update (tags, custom fields), upsert (dedup works)
- GHL conversation list, message history, mark-as-read
- All API routes authenticated and returning correct data
- Scout DRC action execution: SMS, Email, Task, Note all execute through `/api/scout/action`
- Scout LLM drafts correct DRC cards for: SMS, Email, Task, Note, Appointment
- Scout streaming endpoint (`/api/scout/chat-stream`) returns proper SSE events
- `npx tsc --noEmit` — 0 errors
- 129 tests passing (13 test files)
- Commit `cec804a` pushed to main, Vercel deploying

## What Is Broken or Incomplete

- `ghl_custom_fields` table missing from live Supabase DB (migration exists but not applied) — **High**: blocks profile_update action, silently degrades touch tracking and pipeline validation gates
- No pipelines in GHL location — **Medium**: pipeline board empty, stage moves impossible, all pipeline features non-functional (may be expected for sandbox)
- `ghl_workflows` table empty — **Medium**: triggerWorkflow has nothing to trigger
- `ghl_pipeline_stages` has 58 stale cached stages referencing deleted pipeline `znmzzd8MwcwxUvPz4LMI` — **Low**: no runtime impact since GHL has no pipelines
- PTO prospects have placeholder GHL IDs (`pto_*`) — need real GHL contact creation — Medium
- Phase 3 supporting table sync (mortgages, comparables, royalty, etc.) — Medium
- pgvector embeddings need backfill for RAG — Medium

## Decisions Made

- All 3 bugs fixed immediately during audit — Corey authorized testing with real SMS/email to Denzel

## Files Created

- None

## Files Modified

- `app/api/scout/action/route.ts` — Fixed trigger_workflow argument swap
- `app/api/contacts/[contactId]/notes/route.ts` — Added missing requireAuth
- `app/api/inbox/[conversationId]/read/route.ts` — Added missing requireAuth
- `handoff.md` — this file

## Files Deleted

- None

## Open Issues Carried Forward

- `ghl_custom_fields` table needs migration applied + populated from GHL — High
- No pipelines in GHL location (sandbox state) — Medium
- `ghl_workflows` table empty — Medium
- PTO prospects need real GHL contact creation or sync — Medium
- Phase 3 supporting table sync (mortgages, comparables, royalty, etc.) — Medium
- pgvector embeddings need backfill for RAG — Medium
- Rate limiter needs Redis for durability at scale — Low

## Exact Next Step

Apply the `ghl_custom_fields` migration to Supabase and populate it from `getCustomFieldDefinitions()` so profile updates, touch tracking, and pipeline validation gates work.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Apply ghl_custom_fields migration and populate from GHL, then create pipelines in GHL or address next priority from open issues.

---
