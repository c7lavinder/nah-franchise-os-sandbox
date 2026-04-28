# Session Handoff — 2026-04-27 — Session 13

## Status
Phase: Tier 0b Phases 2d+2e (High-risk routes + cron/webhook hardening) / Health: Green / Duration: short session

## What Was Built This Session
- Phase 2d: Retrofitted 6 remaining High-risk routes with `requireAuth` (`c9882f9`)
  - `calls/[callId]/feedback` (POST), `calls/list` (GET)
  - `intelligence/llm-logs` (GET), `scout/session` (GET — userId now from auth)
  - `pipeline/contacts` (GET), `workflows/[workflowId]/ab-tests` (GET, POST — createdBy from auth)
- Phase 2e cron: Added CRON_SECRET verification to 7 unprotected cron routes (`1706d67`)
  - `stale-leads`, `workflow-scheduler`, `workflow-analysis`, `workflow-notifications`
  - `workflow-delivery-sync`, `score-recalculate`, `refresh-ghl-token`
  - All 16 cron routes now protected (9 were already done)
- Phase 2e webhooks: Added shared-secret verification to 9 unprotected webhook routes (`7b92fbd`)
  - Created `lib/auth/webhook-verify.ts` — checks `x-webhook-secret` header or `?secret=` query param
  - `docusign`, `form-submission`, `ghl`, `ghl-calendar`, `ghl/contacts`
  - `google-meet`, `payment`, `trainual`, `zorakle`
  - `read-ai` left alone (already has per-user HMAC)
  - All 10 webhook routes now protected
- Updated `.env.local.example` with `CRON_SECRET` and `WEBHOOK_SHARED_SECRET`
- Updated `docs/AUTH_AUDIT.md` — all High routes marked done, Phase 2d/2e summaries
- Updated `docs/NAH_OS_BLUEPRINT.md` — Phases 2d/2e marked complete

## What Is Confirmed Working
- `npx tsc --noEmit` clean after every commit
- Smoke test on local dev server:
  - `calls/list` with auth → 200 (returns call data)
  - `calls/list` no auth → 401
  - `scout/session` with auth → 200 (session data returned)
  - `cron/stale-leads` in dev mode → 200 (skips CRON_SECRET check in development)
  - `webhooks/ghl` in dev mode → 200 (skips WEBHOOK_SHARED_SECRET check in development)
- In production: CRON_SECRET and WEBHOOK_SHARED_SECRET must be set in Vercel env vars

## What Is Broken or Incomplete
- ~137 Medium-risk routes still unauthed (Phase 2f — optional, lower priority) — Medium
- CRON_SECRET not yet set in Vercel env vars — Corey needs to add — Medium
- WEBHOOK_SHARED_SECRET not yet set in Vercel env vars — Corey needs to add — Medium
- GHL webhook config needs the shared secret added in GHL settings — Low

## Decisions Made
- Used shared-secret pattern for webhooks (not HMAC) — simpler, works across all webhook providers (GHL, Docusign, Trainual, etc.). GHL doesn't have a standard HMAC signing method across all webhook types. — Claude
- Webhook/cron checks skip in development mode — matches existing pattern from the 9 already-protected cron routes — Claude
- scout/session userId now derived from auth (same pattern as daily-hq Phase 2a) — Claude
- workflows/ab-tests createdBy now derived from auth (same pattern as workflows POST Phase 2a) — Claude

## Files Created
- `lib/auth/webhook-verify.ts`

## Files Modified
- 6 High-risk route files (calls/feedback, calls/list, intelligence/llm-logs, scout/session, pipeline/contacts, workflows/ab-tests)
- 7 cron route files (stale-leads, workflow-scheduler, workflow-analysis, workflow-notifications, workflow-delivery-sync, score-recalculate, refresh-ghl-token)
- 9 webhook route files (docusign, form-submission, ghl, ghl-calendar, ghl/contacts, google-meet, payment, trainual, zorakle)
- `.env.local.example`
- `docs/AUTH_AUDIT.md`
- `docs/NAH_OS_BLUEPRINT.md`

## Files Deleted
- None

## Open Issues Carried Forward
- ~137 Medium-risk routes still unauthed — optional Phase 2f, lower priority — Medium
- Corey must add CRON_SECRET and WEBHOOK_SHARED_SECRET to Vercel env vars — Medium
- Hook script lives in two locations (`.claude/hooks/` and `.claude/skills/`) — Low
- JWT in localStorage vs httpOnly cookies — deferred — Low
- `lib/auth/get-auth-header.ts` is redundant — delete in Session A cleanup — Low

## Exact Next Step
Add CRON_SECRET and WEBHOOK_SHARED_SECRET to Vercel env vars, then begin Tier 0c (data privacy audit) or Phase 2f (Medium-risk routes).

## Copy This To Start Next Session In Claude.ai
---
Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Set CRON_SECRET + WEBHOOK_SHARED_SECRET in Vercel, then start Tier 0c or Phase 2f.
---
