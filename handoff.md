# Session Handoff — 2026-04-30 — Session 20

## Status

Phase: Tier 1 COMPLETE (except #6 MasterSuite). Tier 2 planned. / Health: Green / Duration: marathon session

## What Was Built This Session

### Universal DraftedAction Card System

- 8 editable action form types: SMS, Email, Task, Stage Move, Appointment, Note, Profile Update, Sub-Task Log
- All fields editable — searchable dropdowns, date pickers, nothing static
- SMS/Email: from/to addresses, sender dropdown, scheduled send (now/future)
- Stage move: cross-pipeline support with live pipeline/stage dropdowns from DB
- Sub-task log: brand new drafted action type (tool + executor + form + API handler)
- Profile update: editable field names, add/remove fields, reasons shown
- SearchableDropdown reusable component (async search, keyboard nav, debounce)
- All draft executors pre-populate every field from Supabase (no blank fields)
- 4 executors migrated from ghl.getContact() to Supabase getContactInfo() helper

### DraftedActionProvider — Universal Action System

- Context provider wraps entire auth layout
- Any button site-wide shows action card via hooks: useShowSMS, useShowEmail, useShowTask, useShowNote, useShowAppointment, useShowStageMove
- All actions route through /api/scout/action (LLM + UI + next steps = one execution path)
- ActionButtons.tsx provides hook functions for site-wide use

### Call Detail Per-Contact/Territory Tabs (Tier 1 #4)

- Dynamic tabs: per-contact (blue cards) + per-territory (amber cards)
- Contact tabs show that contact's action items + data extractions
- Territory tabs show territory-specific data extractions
- Headers with avatars, counts, empty states
- Post-call agent already attributes per contact_id + territory_ms_slug
- Multi-contact extraction prompt: forces LLM to extract for EACH contact individually
- Multi-contact next-steps prompt: forces actions for EACH contact (note + pipeline minimum)
- Regenerated test calls: Ken Tolbert (3 contacts, 62 extractions), Dona & Todd (2 contacts, 51 extractions)

### Per-Call-Type Rubric Grading (Tier 1 #5)

- Seeded rubric criteria for 9 call types: intro, matt, sam, mark, territory, fdd_review, matt_final, coaching, onboarding, group/cohort
- Post-call agent runs gradeCall() in parallel with existing 5 sections
- Gracefully skips grading when no criteria configured (team_call, internal, unclassified)
- Overview tab shows rubric grade section: overall grade + per-criterion bars with rationale
- Strengths/improvements panels + suggested next action

### Scoring Consolidation (Tier 1 #7)

- Full audit of both systems — determined they are intentionally separate
- Lead Scoring = "Is this a hot lead?" (sales prioritization, early pipeline)
- Intelligence Scoring = "Can this person succeed?" (franchise viability, deep profiling)
- Created ADR-0011 documenting the decision
- Added cross-reference comments to both scoring files

### New API Routes

- /api/team/members — team member dropdown data
- /api/pipelines/stages — pipeline + stage dropdown data

## What Is Confirmed Working

- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 8 suites, 96 tests, all passing
- Action cards render with all fields pre-populated
- Per-contact call tabs show correctly on multi-contact calls
- Cross-pipeline stage moves work in action route
- Sub-task log drafted action flows end-to-end
- Multi-contact extraction produces data for each participant who spoke

## Decisions Made

- SMS and Email are separate action card types (not a toggle) — Corey
- Nothing static in action cards — every field editable with searchable dropdowns — Corey
- Stage move supports cross-pipeline (Sales → Follow-up, etc.) — Corey
- Journeys drive pipeline movement for sales; territories drive onboarding/coaching — Corey
- Two scoring systems stay separate: lead score + intelligence score (ADR-0011) — Corey + Claude
- `/frandev` basePath prefix for MasterSuite domain integration — Corey
- Tier 2 scoped with 9 items, priority order agreed — Corey

## Files Created

- `components/ui/SearchableDropdown.tsx`
- `components/scout/DraftedActionProvider.tsx`
- `components/scout/action-forms/` (9 files: index + 8 form components)
- `components/contact/ActionButtons.tsx`
- `app/api/team/members/route.ts`
- `app/api/pipelines/stages/route.ts`
- `supabase/migrations/20260429100000_seed_rubric_criteria.sql`
- `docs/adr/0011-two-scoring-systems.md`

## Files Modified

- `app/(auth)/layout.tsx` (DraftedActionProvider wrapping)
- `app/(auth)/calls/[callId]/page.tsx` (rubricGrade state + pass-through)
- `app/api/scout/action/route.ts` (cross-pipeline moves, sub-task log handler)
- `components/calls/CallDetailTabs.tsx` (per-contact/territory tabs, card-style UI)
- `components/calls/CallOverviewTab.tsx` (rubric grade breakdown display)
- `components/scout/DraftedActionCard.tsx` (modular form system, contact change support)
- `components/scout/index.ts` (exports for provider + hooks)
- `lib/agents/post-call/agent.ts` (gradeCall() parallel step)
- `lib/agents/post-call/prompts/extraction.ts` (multi-contact extraction block)
- `lib/agents/post-call/prompts/next-steps.ts` (multi-contact actions block)
- `lib/scout/tool-executor.ts` (pre-populate all fields, getContactInfo helper, getUserName)
- `lib/scout/tools.ts` (draft_sub_task_log tool definition)
- `lib/profile/lead-scoring.ts` (cross-reference comment)
- `lib/intelligence/scoring.ts` (cross-reference comment)
- `types/scout.ts` (sub_task_log type, message scheduling fields, stage move pipeline fields)

## Tier 1 Final Status

| #   | Gap                                   | Status                                      |
| --- | ------------------------------------- | ------------------------------------------- |
| 2   | ghl_user_id mapping                   | DONE (Session 19)                           |
| 1   | Daily HQ per-user wiring              | DONE (Session 19)                           |
| 3   | Scout LLM depth                       | DONE — action cards shipped, team observing |
| 4   | Multi-contact/territory call tracking | DONE — per-contact tabs + extraction        |
| 5   | Per-call-type grading                 | DONE — rubric criteria for 9 types          |
| 7   | Scoring consolidation                 | DONE — audited, ADR-0011                    |
| 6   | MasterSuite data connection           | Moved to Tier 2 #9 (basePath prefix)        |

## Tier 2 Plan (Approved)

| #   | Gap                                        | Priority                          |
| --- | ------------------------------------------ | --------------------------------- |
| 9   | `/frandev` basePath prefix                 | First — everything builds on this |
| 7   | Grader fallback to raw_transcript          | Quick win                         |
| 5   | Dead GHL function cleanup                  | Quick win                         |
| 1   | Wire action card hooks to all site buttons | High                              |
| 6   | Lead scores to Supabase                    | Medium                            |
| 3   | Supabase typed client                      | Medium                            |
| 2   | GHL webhook activation                     | Medium                            |
| 8   | Per-rep RLS                                | Medium                            |
| 4   | JWT httpOnly cookies                       | Low                               |

## Exact Next Step

Start Tier 2. First: add `/frandev` basePath to next.config.ts, update all internal fetch calls, update apiFetch, update auth redirects, update webhook/cron URLs.

## Copy This To Start Next Session

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/handoff.md
Then: Start Tier 2 — `/frandev` basePath prefix first, then work down the list.

---
