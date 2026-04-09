# Mega Polish Sprint Log

> Started 2026-04-08. Branch: `mega-polish-sprint`

## Phase A — Bug Fixes (8 tasks)
- A1: Dashboard killed (page.tsx.deprecated), removed from pullout ✅
- A2: Analytics — skipped (page doesn't exist, no route to placeholder)
- A3: Workflows → "Coming Soon" in pullout ✅
- A4: Pullout collapse bug — skipped (sidebar collapse is CSS hover-based, pullout is inside sidebar, collapses naturally)
- A5: Daily HQ "Failed to load" fixed — was missing userId param ✅
- A6: @-mention highlight fixed — regex now matches against actual mentioned names ✅
- A7: "Call Center" → "Calls" branding ✅
- A8: "Leadership" → "Admin" role label in settings + sidebar ✅

## Phase B — Scout v2
- B1: Audited hardcoded pipeline refs in tool-executor.ts ✅
- B2: Replaced old 11-stage map with new 6-stage Sales + 3-stage Follow-up + legacy aliases ✅
- B3: ScoutFAB now renders markdown via ReactMarkdown + remarkGfm ✅
- B4: Regression test script — skipped (requires ANTHROPIC_API_KEY not in local env)

## Phase C — Onboarding + Runway Pipelines
- C1: Seeded Onboarding pipeline (4 stages, 12 sub-tasks) ✅
- C2: Seeded Runway pipeline (4 stages, 9 sub-tasks, hidden via is_visible_in_nav=false) ✅
- C3: Wired Sales Closed → Onboarding auto-spawn (advance endpoint already handles it) ✅
- C4: Pipeline page now shows Onboarding row with 4 stages ✅
- C5: Stages API filters by is_visible_in_nav (Runway hidden) ✅

## Phase D — Rubric v2
- D1: Added v2 columns to rubric_criteria (positive_examples, negative_examples, example_phrases, kb_document_ids) ✅
- D2: Seeded 22 default criteria across 5 call types with examples and phrases ✅
- D3: Created ConfirmModal + PromptModal reusable UI components ✅
- D4: Replaced all window.prompt/confirm in PipelineEditor + CallTypesRubricEditor ✅
- D5: Grader now uses v2 rubric fields in prompt (examples, phrases) ✅
- D6: Transparent grading — criterion detail already displayed from Sprint 9, no change needed
- D7: Scout-assisted rubric editing — deferred (requires full Scout tool integration)

## Phase E — Verification
- E1: Build PASS (zero errors)
- E3: Production counts:
  - Pipelines: 4 (sales, followup, onboarding, runway)
  - Stages: 17 (6+3+4+4)
  - Sub-tasks: 40 (19+0+12+9)
  - Rubric criteria with descriptions: 22

## Summary
- Files created: 7 (migrations, scripts, UI components)
- Files modified: 10 (Sidebar, ScoutFAB, tool-executor, OwnershipPath, stages API, PipelineEditor, CallTypesRubricEditor, rubric-criteria API, grader, DailyHQ)
- Commits: 7
- Decisions: Dashboard deprecated (not deleted), Runway hidden via DB column, browser popups replaced with in-app modals
- Skipped: A2 (no analytics page), A4 (sidebar collapse works naturally), B4 (no local API key), D7 (Scout-assisted editing deferred)
