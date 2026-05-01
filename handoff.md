# Session Handoff — 2026-05-01 — Session 22

## Status

Phase: Workflows page live, permissions system built, auth hardened, call upload rebuilt. Next: fix call generate→detail data flow. / Health: Yellow (call processing pipeline has data-flow mismatches) / Duration: marathon session

## What Was Built This Session

### Workflows Page (activated — was already built but disconnected)

- Wired Workflows as real nav link in pullout menu (above Knowledge Base)
- Fixed 13 API route handlers missing `requireAuth` calls (security gap)
- Redesigned `WorkflowDetail` — full step timeline with content, trigger, day/time, step type visible at a glance
- Added trigger display to `WorkflowCard` (lightning bolt icon)

### Centralized Permissions System

- `lib/auth/permissions.ts` — single source of truth: 22 actions across 8 groups, mapped to 6 roles
- `requireAuth(request, "calls:delete")` — optional action param enforces role-based 403 automatically
- Settings → Permissions tab — full matrix UI (roles as columns, actions as rows, check/X indicators)
- Migrated calls/delete and calls/override to use permission actions

### Auth Fixes (19 route handlers total)

- 13 workflow API routes missing `requireAuth` entirely
- 6 routes using old `getAuthUser(header)` pattern instead of `requireAuth(cookies)` — broke after httpOnly cookie migration
- Operator role (Chad) now allowed for call delete and override

### Webhook & Call Processing Fixes

- Vercel rewrite: `/api/webhooks/*` → `/frandev/api/webhooks/*` (external services broken by basePath)
- All 3 call processors fixed: internal fetch calls missing `/frandev` basePath prefix
- `call_transcripts` source constraint: `file_upload` and `read_ai` → `upload` (was silently failing)
- Upload form fire-and-forget fix: use raw `fetch()` after navigation so browser doesn't cancel

### Call Upload Form Rebuild

- Replaced 7-field manual entry form with file-first flow
- Drag & drop zone for recordings (mp4/webm/m4a/mp3/wav) or transcripts (txt)
- Paste transcript area
- Only 2 fields: date + hosted by
- AI handles: title, call type, contact match, coaching analysis

### Team

- Ben Harrison added as admin (ben@newagainhouses.com / Demo123)

## What Is Confirmed Working

- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 8 suites, 96 tests passing
- Workflows page live with full step timeline detail view
- Permissions tab in Settings shows role matrix
- Call delete/override working for operator role (Chad)
- Webhook rewrite deployed — Read.ai webhooks flowing again
- Dreyer call manually processed: 52 extractions, coaching score 25
- Upload form creates call + uploads transcript + triggers processing
- Ben Harrison login working

## What Is Broken or Incomplete

- `generate` endpoint writes to `calls.coaching_data` + `calls.summary`, but detail API reads from `call_coaching` + `call_grades` tables — data never shows in UI — High
- `call_data_extractions` written by generate but detail API returns empty (possible table mismatch) — High
- Manual uploads don't match contacts (no participant emails to match from) — Medium
- Rubric grading fails: model ID `claude-sonnet-4-6-20250514` not found on Anthropic account — Medium
- `call_transcripts` DB check constraint still only allows `whisper`, `manual_paste`, `upload` (should add `read_ai`) — Low
- Typed client migration (168 errors, 64 files) — Low
- TaskUpdate webhook not subscribed in GHL portal — Medium

## Decisions Made

- Workflows ship as-is, evolve to agents later — Corey
- Workflows nav stays in pullout menu (not main sidebar) — Corey
- Permissions are code-defined, not database-editable — Corey
- Call upload simplified: file + date + host, AI does the rest — Corey

## Files Created

- `lib/auth/permissions.ts`
- `components/settings/PermissionsPanel.tsx`
- `scripts/add-ben-harrison.ts`
- `scripts/check-webhooks.ts`, `scripts/check-stuck-call.ts`, `scripts/fix-dreyer-transcript.ts`, `scripts/check-uploaded-call.ts`, `scripts/check-call-detail.ts` (diagnostic scripts)

## Files Modified

- `components/layout/Sidebar.tsx` — Workflows nav link
- `components/workflows/WorkflowCard.tsx` — trigger display
- `components/workflows/WorkflowDetail.tsx` — full step timeline redesign
- `components/calls/CallOverviewTab.tsx` — removed "Read.ai" hardcoded text
- `app/(auth)/calls/page.tsx` — upload form rebuild
- `app/(auth)/settings/page.tsx` — Permissions tab added
- `lib/auth/session.ts` — requireAuth accepts action param
- `lib/auth/index.ts` — permissions re-exports
- `lib/calls/processors/prospect-processor.ts` — basePath + source fix
- `lib/calls/processors/coaching-processor.ts` — basePath + source fix
- `lib/calls/processors/group-processor.ts` — basePath + source fix
- `lib/workflows/tracking.ts` — basePath fix
- `app/api/calls/[callId]/upload/route.ts` — source constraint fix
- `app/api/calls/[callId]/delete/route.ts` — permissions migration
- `app/api/calls/[callId]/override/route.ts` — permissions migration
- `app/api/auth/me/route.ts` — cookie auth migration
- `app/api/notifications/route.ts` — cookie auth migration
- `app/api/contacts/[contactId]/messages/route.ts` — cookie auth migration
- `app/api/contacts/[contactId]/messages/[messageId]/route.ts` — cookie auth migration
- 13 workflow API routes — requireAuth added
- `vercel.json` — webhook rewrite rule

## Files Deleted

- None

## Open Issues Carried Forward

- Call generate→detail data flow mismatch (coaching, extractions not showing in UI) — High
- Rubric grading model ID not found — Medium
- TaskUpdate webhook GHL portal subscription — Medium
- Typed client migration (168 fixes) — Low
- DB check constraint on call_transcripts source column needs `read_ai` added — Low

## Exact Next Step

Fix the call processing data flow: `generate` writes to `calls.coaching_data`/`calls.summary` but the detail API reads from `call_coaching`/`call_grades` tables. Reconcile so uploaded and webhook calls show all data (transcript, coaching, extractions, summary) in the UI.

## Copy This To Start Next Session

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/handoff.md
Then: Fix the call processing data flow — generate writes coaching/summary to the calls table but the detail API reads from call_coaching/call_grades tables. Reconcile so all call data (transcript, coaching, extractions, summary) shows in the UI for both webhook and uploaded calls.

---
