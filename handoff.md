# Sprint 0 Handoff

**Date:** 2026-04-07
**Branch:** sprint-0-bug-fixes
**Status:** Partial (3 fixed, 1 skipped)

## Bugs

| Bug | Status | Commit |
|---|---|---|
| 1. Scoring bucket all Low | ⏭️ SKIPPED (data layer — no intelligence data populated) | n/a |
| 2. Workflow rewrite 500 | ✅ Fixed | 2a5c73d |
| 3. Scout markdown rendering | ✅ Fixed | d20bd6e |
| 4. Stale alerts cleanup | ✅ Script created (human must run) | 8121d11 |

## Files touched

- `app/api/workflows/[workflowId]/rewrite/route.ts` — proper error status codes (400/404/503 instead of 500)
- `components/scout/ScoutBubble.tsx` — ReactMarkdown rendering for assistant messages
- `tailwind.config.ts` — added @tailwindcss/typography plugin
- `package.json` / `package-lock.json` — added react-markdown, remark-gfm, @tailwindcss/typography
- `scripts/clear-stale-alerts.ts` — NEW script to mark all inactivity_alerts as resolved
- `docs/memory.md` — full 5-step protocol logged for all 4 bugs

## Decisions made autonomously

1. **Bug 1 skipped as data layer issue (root cause D):** The intelligence scoring code is correct, but `candidate_intelligence.current_score` is 0/null for all records because the bootstrap hasn't populated real profile data. Per Sprint 0 spec, do not invent scores — defer to Sprint 1/2.
2. **Bug 2 — workflow tables don't exist yet:** The `workflow_steps`, `workflow_versions`, and `workflows` tables referenced by the rewrite engine don't exist in the Supabase migrations. The route handler now returns 503 "Workflow tables not yet deployed" instead of a raw 500. The tables will be created when the workflow schema is migrated.
3. **Bug 4 — script-only fix:** Cannot run the cleanup script against production DB (hard rule: no production operations). Script is ready for Corey to run manually.

## Open issues for human review

1. **Run `scripts/clear-stale-alerts.ts`** against production Supabase to clear the ~50 stale alerts
2. **Bug 1** will auto-resolve when intelligence profiles are bootstrapped with real data (run `scripts/bootstrap-intelligence.ts`)
3. **Workflow tables** need to be created — either migrate `scripts/setup-workflow-tables.ts` or wait for Sprint 1/2

## Next sprint

Sprint 1 — Supabase Schema Migration. See SPRINT_1_SUPABASE_SCHEMA.md.
