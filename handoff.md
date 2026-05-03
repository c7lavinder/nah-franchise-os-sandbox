# Session Handoff — 2026-05-03 — Session 23

## Status

Phase: Call processing pipeline fixed — all AI analysis now writes and reads correctly. / Health: Green (model IDs fixed, AI processing confirmed working, 0 type errors, 96 tests passing) / Duration: short session

## What Was Built This Session

- Traced full call data flow: write path (post-call agent → calls table + child tables) and read path (detail API → UI)
- Discovered root cause: agent.ts used invalid model ID `"claude-4-sonnet-20250514"` — all 5 AI sections silently failed, nothing was ever written
- Fixed model ID in `lib/agents/post-call/agent.ts` — `"claude-4-sonnet-20250514"` → `"claude-haiku-4-5-20251001"`
- Fixed model ID fallback in `lib/calls/grader.ts` — `"claude-sonnet-4-6-20250514"` → `"claude-haiku-4-5-20251001"`
- Fixed model ID fallback in `lib/calls/coach.ts` — same fix
- Fixed model ID fallback in `app/api/contacts/[contactId]/pre-call-brief/route.ts` — same fix
- Removed dead `call_coaching` table query from `app/api/calls/[callId]/detail/route.ts` (UI never used this data — coaching reads from `calls.coaching_data`)
- Fixed 8 additional standalone callers with invalid `"claude-sonnet-4-5-20250514"` model IDs: profile-extractor, brief-generator, next-steps-generator, grade route, action rewrite, single-action generate, rep-journal, contact-journal
- Re-generated Dreyer call: coaching score 62 (was 25), 61 extractions (was 52), 4 actions, 9 KB docs
- Re-generated Corey coaching call: coaching score 25, 5 actions, 4 KB docs

## What Is Confirmed Working

- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 8 suites, 96 tests passing
- Post-call agent generates summary, coaching, actions, extractions, KB intel (verified via API)
- Dreyer call fully reprocessed with correct data
- Corey coaching call fully reprocessed with correct data
- Detail API returns all call data (summary, coaching_data, coaching_score, action items, transcript)
- Zero invalid model IDs remain in the codebase

## What Is Broken or Incomplete

- Manual uploads don't match contacts (no participant emails to match from) — Medium
- `call_transcripts` DB check constraint still only allows `whisper`, `manual_paste`, `upload` (should add `read_ai`) — Low
- Typed client migration (168 errors, 64 files) — Low
- TaskUpdate webhook not subscribed in GHL portal — Medium
- Rubric grading returns null when no rubric criteria configured for the call type — Low (expected behavior, needs criteria setup)

## Decisions Made

- All AI callers standardized on `claude-haiku-4-5-20251001` (matches CLAUDE.md "Scout powered by Haiku 4.5") — Claude
- Removed dead `call_coaching` table read from detail API (old standalone coach path, UI never used it) — Claude

## Files Created

- None

## Files Modified

- `lib/agents/post-call/agent.ts` — model ID fix
- `lib/calls/grader.ts` — model ID fallback fix
- `lib/calls/coach.ts` — model ID fallback fix
- `app/api/contacts/[contactId]/pre-call-brief/route.ts` — model ID fallback fix
- `app/api/calls/[callId]/detail/route.ts` — removed dead call_coaching query
- `lib/calls/profile-extractor.ts` — model ID fix
- `lib/calls/brief-generator.ts` — model ID fix
- `lib/calls/next-steps-generator.ts` — model ID fix
- `app/api/calls/[callId]/grade/route.ts` — model ID fix
- `app/api/calls/[callId]/actions/generate-single/route.ts` — model ID fix
- `app/api/calls/[callId]/actions/[actionId]/rewrite/route.ts` — model ID fix
- `lib/journals/rep-journal.ts` — model ID fix
- `lib/journals/contact-journal.ts` — model ID fix

## Files Deleted

- None

## Open Issues Carried Forward

- Manual uploads don't match contacts (no participant emails) — Medium
- TaskUpdate webhook GHL portal subscription — Medium
- `call_transcripts` source constraint needs `read_ai` added — Low
- Typed client migration (168 fixes) — Low
- Rubric criteria need to be configured per call type for grading to work — Low

## Exact Next Step

Set up rubric criteria for each call type (intro_call, matt_call, coaching_call, etc.) so rubric grading produces results, then test a full end-to-end webhook call from Read.ai through processing to UI display.

## Copy This To Start Next Session

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/handoff.md
Then: Set up rubric criteria for each call type so rubric grading works, then test a full end-to-end webhook call from Read.ai through processing to UI display.

---
