# Session Handoff — 2026-05-22 — Session 54

## Status

Phase: Retrieval Brain Phase 9 complete / Health: Green / Duration: full session

## What Was Built This Session

- **Commitment tracker** — new `commitments` table with status tracking, due dates, commitment types, source linking
- **Commitment extraction category** — added `commitments` to `call_data_extractions` field_category constraint
- **Extraction prompt update** — new COMMITMENTS section in `lib/agents/post-call/prompts/extraction.ts` with 4 field keys (commitment_text, commitment_due_date, commitment_type, committed_by_role), examples of what counts/doesn't count
- **Commitment processor** — `lib/agents/post-call/process-commitments.ts` groups sequential extraction rows, parses due dates (ISO + relative like "next Tuesday"), validates types, idempotent re-run
- **Agent pipeline wiring** — `commitments` added to validCategories, processCommitments() called after auto-save in post-call agent
- **Commitments in get_next_action** — overdue commitments override the recommendation as top-priority, upcoming commitments listed with due dates
- **Cross-call analytics in get_entity(contact)** — grade trends (improving/flat/declining), recurring objection detection (same type 2+ calls), total call count + minutes, open commitments (overdue + upcoming)
- **Cross-rep signals in contact briefs** — low-graded calls (D/F) and overdue commitments surface in `CROSS-REP SIGNALS` section of brief summary, flows into Scout pre-fetch context
- **Backfill script** — `scripts/backfill-commitments.ts` extracts commitments from all transcripts via Haiku, supports --dry-run, rate-limited, idempotent
- **Backfill executed** — 562 commitments extracted from 70 transcripts and saved to production

## What Is Confirmed Working

- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 13 files, 129 tests, all passing
- `npx next build` — clean build, no ESLint errors
- Both migrations applied on Supabase (`commitments` table + `commitments` extraction category)
- Backfill completed: 562 commitments from 70 calls, zero insert errors
- All commits pushed to main, Vercel auto-deployed
- Eval baseline captured: classification 94.4%, retrieval metrics need live Supabase connection

## What Is Broken or Incomplete

- **Eval baseline retrieval metrics at 0%** — eval runs locally without Supabase connection so chunks/similarity are zero. Need to run against live DB or add Supabase connection to eval script — Medium
- **Retrieval quality dashboard deferred** — query `scout_retrieval_logs` directly for now — Low
- **`get_entity(journey)` enrichment deferred** — member scores + documents + call summary not added yet — Low

## Decisions Made

- Commitments write directly to `commitments` table (not through call_data_extractions for backfill) — efficiency over consistency, Corey approved
- Due date parsing handles ISO + common relative phrases, returns null for unparseable — pragmatic approach
- Cross-rep signals surface in brief summary text (not separate structured field) so they flow through existing pre-fetch — simplest path
- 562 commitments backfilled from 70 transcripts at ~$2 Haiku cost — Corey approved

## Files Created

- `lib/agents/post-call/process-commitments.ts` — commitment extraction processor
- `supabase/migrations/20260524100000_create_commitments.sql` — commitments table
- `supabase/migrations/20260524200000_add_commitments_extraction_category.sql` — field_category constraint update
- `scripts/backfill-commitments.ts` — backfill script for existing transcripts

## Files Modified

- `lib/agents/post-call/agent.ts` — added commitments to validCategories, wired processCommitments into pipeline
- `lib/agents/post-call/prompts/extraction.ts` — new COMMITMENTS section + JSON output examples
- `lib/briefs/contact-brief-generator.ts` — cross-rep signals (low grades + overdue commitments) in brief summary
- `lib/scout/data-tools.ts` — cross-call analytics (grade trends, recurring objections, total time, commitments) in get_entity(contact)
- `lib/scout/tool-executor.ts` — commitments query + display in get_next_action, overdue override recommendation

## Files Deleted

- None

## Open Issues Carried Forward

- Mauricio Anaya needs manual creation or intake source identified — Medium
- GHL calendar + SMS setup checklist for Chad (no code fix, needs GHL config) — Medium
- L10 metrics dashboard feature request (parked) — Low
- `get_entity(journey)` enrichment — Low
- Eval script needs live Supabase connection for retrieval metrics — Medium

## Exact Next Step

Phase 10 — Predictive Lookalike Models. Start with the pre-flight data audit (GATE): count converted contacts with full profiles (need >= 30), count lost contacts (need >= 30), count franchisees with T12 metrics per tier (need >= 10 each). Document in `docs/phase-10-data-audit.md`. If gate fails, build rule-based scoring instead.

## Copy This To Start Next Session In Claude.ai

---

Read this file then tell me: current status, last session summary, open issues, what we build today.
GitHub: https://github.com/c7lavinder/nah-franchise-os-sandbox/blob/main/SESSION_START.md
Then: Phase 10 — Predictive Lookalike Models. Run the pre-flight data audit gate before writing any code.

---
