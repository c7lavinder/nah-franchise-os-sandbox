# Session Handoff — 2026-05-06 — Session 26

## Status

Phase: Calls page overhaul — classification, detail, mapping, grading, KB / Health: Green / Duration: full session

## What Was Built This Session

- Fixed call misclassification bug — unmatched prospects were classified as "Team Call" (`classifier.ts` checked `externalContacts.length` instead of `external.length`)
- Drag-to-reclassify on calls list page — grab a call card, drop it into a different panel to change its type
- 3-row participant layout on call cards — team (colored) / matched contacts (gray) / unmapped (dashed yellow)
- Contact search API enriched with type labels — search results show "Franchisee — Chattanooga", "Prospect — Suda Journey", etc.
- AI-generated call titles — Scout generates specific titles from transcript content instead of generic "Intro Call w/ Name"
- Fixed platform display — calls from Read.ai now show "Google Meet" instead of "Phone Call" (processors were hardcoding `source: "upload"`)
- Removed duplicate coaching section from call detail — only rubric grade remains (call-type-specific criteria from DB)
- Removed `runCoaching()` from post-call agent — saves one LLM call per processed call
- Refresh button on call detail now runs full re-process pipeline (reclassify participants + re-generate all AI sections with `force=true`)
- Inline participant mapping on call detail page — clickable grey pills in "Also Present" section expand to show Search / New Prospect / Add To Ecosystem / Add To Journey actions
- Only one mapping pill expands at a time (lifted state)
- Editable name + phone fields on expanded mapping pills
- Journey picker for "Add To Journey" action — shows journeys on this call, creates contact without own journey, adds as co_primary
- Mapping error messages now visible (were silently caught)
- Participant matching fix — case-insensitive email/name comparison, fallback for email-in-name field
- Removed mapping modal icon (UserCog) from header — inline mapping replaces it
- KB extraction prompt rewritten for system-level knowledge only — no individual deal notes, generalizes observations into patterns
- KB updater now merges/updates existing entries instead of always appending — prevents unbounded doc growth
- Created migration for missing rubrics + criteria — all call types now have rubric grading (was only working for onboarding)
- Grader prompt adapts persona by call type — onboarding uses "onboarding specialist", coaching uses "performance coach", etc.

## What Is Confirmed Working

- `npx tsc --noEmit` passes clean (0 errors)
- All 8 test files pass (97 tests)
- Classification fix deployed — new calls with unmatched prospects route to sales, not internal
- Drag-to-reclassify works — override API + AI re-generation fires on drop
- Rubric migration applied to production — all call types have rubrics + criteria
- KB prompt changes deployed — new extractions will be system-level
- 10 commits pushed and deployed to Vercel (all showing "Ready" in production)

## What Is Broken or Incomplete

- Larry Hall mapping on Jonathan Suda call — mapping action fires but participant may not persist after refresh; rawParticipant matching improved but needs live verification — High
- Existing KB docs contain individual-level content from before the prompt change — will gradually clean up as calls re-process — Low
- Existing calls still have old generic titles — need refresh (re-generate) to get AI titles — Low
- AddRelatedContactModal "journey" anchor still shows "partner of" language — should be simplified journey picker — Medium
- Scout LLM hallucinating confirmations — Medium (carried forward)

## Decisions Made

- Call classification uses `external.length` (all non-team) not `externalContacts.length` (only matched) for internal detection — Corey approved by context
- Coaching section removed, rubric grade is the single scoring system — Corey approved
- KB should capture system-level patterns only, not individual deal notes — Corey approved
- KB updater merges instead of appending — Corey approved
- Mapping modal removed from header, replaced with inline mapping on the page — Corey approved
- @newagainhouses.com domain is NOT a team indicator — franchisees get these emails too — Corey confirmed

## Files Created

- `supabase/migrations/20260506100000_fix_missing_rubrics_and_criteria.sql`

## Files Modified

- `lib/calls/classifier.ts` — fixed internal classification condition
- `app/(auth)/calls/page.tsx` — drag-to-reclassify, 3-row participant layout, unmapped pills
- `app/api/calls/list/route.ts` — split externalContacts from unmappedParticipants
- `app/(auth)/calls/[callId]/page.tsx` — inline mapping pills, refresh pipeline, editable fields, platform label fix
- `components/calls/CallOverrideControls.tsx` — removed mapping button, journey-centric grouped view, contact type labels in search
- `components/calls/CallOverviewTab.tsx` — removed coaching section, kept rubric grade only
- `app/api/contacts/search/route.ts` — enriched with territory/journey/stakeholder type labels
- `lib/agents/post-call/agent.ts` — removed runCoaching, writes AI title, removed coaching import
- `lib/agents/post-call/prompts/summary.ts` — AI title generation in prompt + parser
- `lib/agents/post-call/types.ts` — added generatedTitle to SummaryResult
- `lib/agents/post-call/prompts/kb-intelligence.ts` — system-level extraction rules
- `lib/agents/post-call/kb-updater.ts` — merge logic instead of append-only
- `lib/calls/grader.ts` — call-type-aware persona in grading prompt
- `lib/calls/processors/prospect-processor.ts` — source: "read_ai"
- `lib/calls/processors/coaching-processor.ts` — source: "read_ai"
- `lib/calls/processors/group-processor.ts` — source: "read_ai"

## Files Deleted

- None

## Open Issues Carried Forward

- Larry Hall mapping persistence — needs live verification after latest fix — High
- AddRelatedContactModal journey anchor UX — "partner of" should be simple journey picker — Medium
- Scout LLM hallucinating confirmations — Medium (prompt work needed)
- Marketing dashboard page not yet built — Medium
- `marketing_spend` table blocked on Matt's input — Medium
- Workflow builder fixes from Session 23 not re-tested — Low

## Exact Next Step

Verify Larry Hall mapping persists on refresh, then test the full call flow end-to-end: new call comes in via Read.ai → correct classification → AI title → rubric grade → inline mapping → KB extraction.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Verify Larry Hall mapping persists on refresh, then test the full call flow end-to-end: new call comes in via Read.ai → correct classification → AI title → rubric grade → inline mapping → KB extraction.

---
