---
Last verified: 2026-04-28
Source: session (Tier 1 #7 form webhook)
---

# Master Plan — NAH Franchise OS

This is the source of truth for project state, roadmap, and decisions.
Replaces `docs/NAH_OS_BLUEPRINT.md` (retired to `docs/archive/blueprint-v1.md`).

---

## What this is

Internal AI-first platform for **New Again Houses** (house-flipping franchise).
Backbone for franchise sales + ongoing coaching at scale.
Goal: support hundreds of franchisees who each buy 10+ houses/year.

---

## Where we are now

### What's shipped

- Next.js 14 App Router, 14 authenticated pages, 216 API routes (all protected)
- Scout AI tool-call loop with 24 tools, Claude Haiku 4.5
- GHL client with OAuth + PIT fallback, retry logic, ~30 wrappers
- Intelligence engine (6 tables, 100-pt scoring, 1,987 profiles bootstrapped)
- Workflow engine (7 tables, A/B testing, approvals, health scoring)
- Accountability engine (5 monitoring checks, node-cron scheduler)
- Call log system (14 call types, transcript analyzer, grading)
- Journey/pipeline system (4 pipelines: sales, follow-up, onboarding, runway)
- EOS integration (goals, rocks, habits, todos, scorecard per territory + contact)
- TypeScript strict, 0 tsc errors
- 27 critical-path smoke tests (auth, webhook, cron, admin role)
- Full auth retrofit: requireAuth on 209 routes, CRON_SECRET on 16 cron routes, webhook secret on 9 webhooks
- Git guardrails hook blocking destructive commands
- Customer data scrubbed from git history

### What's parked

- MasterSuite integration (not in scope until v1 complete)
- Vonage (dropped — GHL handles SMS)
- Per-rep RLS row filtering (separate ADR)
- JWT localStorage to httpOnly cookies migration

---

## Execution roadmap

### Tier 0 — Existential fixes (COMPLETE)

| Phase                           | Status | Date       |
| ------------------------------- | ------ | ---------- |
| 0a — Git guardrails             | Done   | 2026-04-27 |
| 0b — Auth retrofit (2a-2f)      | Done   | 2026-04-27 |
| 0c — Data privacy audit + scrub | Done   | 2026-04-27 |

### Session A — Doc reorg (COMPLETE 2026-04-27)

- Deleted 28 dead files (~8,300 lines of stale content)
- Consolidated 2 schema SQL files into numbered migrations
- Created 8 new docs (master-plan, system-shape, runbook, scout, scout-tools, integrations, team, data-model)
- Rewrote README.md and CLAUDE.md, created CONTRIBUTING.md
- Created 10 ADRs in docs/adr/
- Reconciled .env.local.example (added 6 missing vars)
- Archived blueprint to docs/archive/blueprint-v1.md

### Session B — Foundation tooling (COMPLETE 2026-04-27)

- Generated Supabase schema types (4,330 lines — reference only, full client typing needs Supabase login)
- Husky pre-commit hooks: lint-staged (Prettier) + tsc --noEmit + npm test
- GitHub Actions CI: tsc + lint + test on push/PR to main
- PR template with pre-merge checklist
- .claude/settings.json verified and documented

### Session C — Custom skills + hooks + agents (COMPLETE 2026-04-28)

- 8 skills (7 new + git-guardrails): migration-safety-check, nah-context-load, verify-claims, new-adr, ghl-boundary-check, scout-tool-add, deploy-readiness
- 2 review agents as slash commands: /review-code (NAH rubric), /review-migration (SQL review)
- 3 hook scripts: block-dangerous-git (Bash), migration-safety-reminder (Edit), ghl-boundary-check (Edit)
- 7 slash commands: wrap-session, load-context, verify-claims, audit-docs, draft-adr, review-code, review-migration

### Tier 1 — Feature gaps

> **GHL role (confirmed 2026-04-28):** Chad does not use the GHL UI directly. NAH OS is the daily driver. GHL is a backend system NAH OS pushes to (contacts, tasks, calendar, notes, comms). See `docs/INTEGRATION_MAP.md`.

| #   | Gap                                                     | Effort    | Blocker / Status             |
| --- | ------------------------------------------------------- | --------- | ---------------------------- |
| 2   | Chad/Matt/Corey have correct ghl_user_id mapped         | 1-2 days  | **START HERE** — unblocks #1 |
| 1   | Daily HQ shows real GHL data per-user                   | 1 week    | Blocked on #2                |
| 3   | Scout daily-conversation depth (LLM enhancement)        | 1-2 weeks | Blocked on #2                |
| 4   | Multi-contact and multi-territory call tracking         | 2 weeks   | Independent                  |
| 5   | Per-call-type grading (rubrics per call type)           | 1-2 weeks | Blocked on #4                |
| 7   | Scoring consolidation (lib/profile vs lib/intelligence) | 1 week    | Independent                  |
| 6   | MasterSuite data connection                             | 3-4 weeks | Scoping conversation first   |

**Form webhook / prospect intake — SHELVED.** Marketing site backend not editable. Prospect creation is manual via NAH OS UI. Ed25519 webhook verification ready for future use.

---

### Tier 1 Execution Plans

#### #2 — ghl_user_id mapping (START HERE)

**Problem:** The `users` table has a `ghl_user_id` column but values are likely null or placeholder. Daily HQ, task filtering, and Scout all need the real GHL user IDs to show per-user data.

**Steps:**

1. Query Supabase `users` table — list all users, their current `ghl_user_id` values
2. Call `GET /users/?locationId=X` via GHL API (or use `scripts/list-ghl-webhooks.ts` pattern) to list all GHL users in the location
3. Match by name/email: Chad Arnold, Matt Lavinder, Corey Lavinder, Sam, Mark, Ryland, John
4. Update `users` table with correct `ghl_user_id` for each
5. Verify: `fetchScorecard()` in `/api/daily-hq` already reads `ghl_user_id` — confirm it filters correctly

**Key files:** `lib/auth/session.ts` (reads ghl_user_id into AuthUser), `app/api/daily-hq/route.ts` (uses it)
**Acceptance:** Each user logs in, sees only their tasks/appointments/scorecard. Admin "view as" still works.
**Corey action needed:** Confirm the name-to-GHL-user mapping is correct before we write to DB.

#### #1 — Daily HQ per-user wiring

**Problem:** Daily HQ (`/api/daily-hq`) fetches GHL data but some queries are org-wide instead of per-user. Chad sees everyone's tasks/appointments.

**Steps:**

1. Audit `fetchTasks()` — does it pass `ghlUserId` to `ghl.searchTasks({assignedTo: [ghlUserId]})`?
2. Audit `fetchUpcoming()` — does it filter appointments by user's calendar or assignedUserId?
3. Audit `fetchPipelineSnapshot()` — currently reads GHL opportunities (but pipelines are in Supabase now; this needs rethinking)
4. Audit `fetchScorecard()` — already reads `ghl_user_id`, counts from `scout_action_logs`
5. Fix each function to filter by the logged-in user's `ghlUserId`
6. For pipeline snapshot: switch from GHL opportunities to Supabase `journey_pipeline_state` (matches corrected mental model)

**Key files:** `app/api/daily-hq/route.ts`, `lib/ghl/client.ts` (searchTasks, getAllAppointments)
**Acceptance:** Chad sees only his tasks, his appointments, his scorecard. Pipeline shows Supabase data. Admin can "view as" any user.

#### #3 — Scout LLM depth

**Problem:** Scout uses Claude Haiku 4.5 with 24 tools but conversations are shallow — it answers questions but doesn't proactively surface insights or maintain conversation context across sessions.

**Steps:**

1. Audit `lib/scout/client.ts` — current system prompt, tool selection, context window usage
2. Audit `lib/scout/tool-executor.ts` — which tools are actually called in practice (check `llm_call_logs`)
3. Enhance system prompt: add user role context, current pipeline state, recent activity summary
4. Add "daily brief" tool: Scout can pull Daily HQ data and summarize what needs attention
5. Consider session memory: store last N exchanges per user in Supabase for continuity
6. Evaluate model upgrade path (Haiku → Sonnet for complex queries)

**Key files:** `lib/scout/client.ts`, `lib/scout/tools.ts`, `lib/scout/tool-executor.ts`
**Acceptance:** Scout can answer "what should I focus on today?" with specific, data-backed recommendations.

#### #4 — Multi-contact and multi-territory call tracking

**Problem:** `calls` table has a single `contact_id` FK. Some calls involve multiple prospects (e.g., husband + wife) or span multiple territories.

**Steps:**

1. Audit `calls` table schema and `call_participants` table — participants already exist but only one links to contacts
2. Design: add `call_contacts` junction table (call_id + contact_id) or use `call_participants.contact_id` more fully
3. Audit `lib/calls/classifier.ts` — how are participants resolved to contacts today?
4. Add territory linkage: `call_territories` junction or derive from contact's territory
5. Update call detail API routes to return all linked contacts
6. Update frontend call detail page to show multiple contacts

**Key files:** `supabase/migrations/`, `lib/calls/classifier.ts`, `lib/calls/resolve-participants.test.ts`, `app/api/calls/`
**Acceptance:** A call with John + Jane (different contacts, same territory) shows both contacts and the territory.

#### #5 — Per-call-type grading

**Problem:** All calls use the same grading rubric. Prospect calls, coaching calls, and onboarding calls need different criteria.

**Steps:**

1. Audit existing rubric system: `app/api/settings/rubrics/`, `app/api/calls/[callId]/grade-rubric/`
2. Check `call_types` table — 14 types exist, each could map to a rubric
3. Design: `rubrics` table already exists with criteria. Wire `call_types.rubric_id` FK.
4. Update grading routes to select rubric based on call type
5. Seed default rubrics for each call type (prospect, coaching, onboarding, group, internal)
6. Update grade display to show which rubric was used

**Key files:** `app/api/calls/[callId]/grade-rubric/route.ts`, `app/api/settings/rubrics/`, `supabase/migrations/`
**Acceptance:** A prospect call grades on "discovery questions, objection handling, next steps." A coaching call grades on "accountability, goal progress, action items."

#### #7 — Scoring consolidation

**Problem:** Two parallel scoring systems exist: `lib/profile/lead-scoring.ts` and `lib/intelligence/scoring.ts`. Unclear which is canonical.

**Steps:**

1. Read both files end-to-end — what does each score, what inputs, what output?
2. Check callers: which routes/crons use which system?
3. Check DB: do `candidate_profiles` and `intelligence_scores` (or similar) tables overlap?
4. Decide: merge into one, or clarify distinct purposes (lead score vs intelligence score)
5. If merging: consolidate into `lib/intelligence/scoring.ts` (the more mature system per master-plan)
6. Remove dead module, update all callers

**Key files:** `lib/profile/lead-scoring.ts`, `lib/intelligence/scoring.ts`, `lib/profile/profile-fields.ts`, `lib/intelligence/index.ts`
**Acceptance:** One scoring system, one source of truth, no duplicate calculations.

#### #6 — MasterSuite data connection

**Problem:** MasterSuite integration is parked. Needs a scoping conversation to determine data direction (push vs pull), what data, and authentication model.

**Steps:**

1. Corey provides: what is MasterSuite, what data does it have, what does NAH OS need from it?
2. Determine: API available? Webhook support? CSV export? Manual sync?
3. Design integration architecture (ADR)
4. Build connector

**Status:** Blocked on scoping conversation. Not started.

---

### Tier 2 — Scout Retrieval Brain (ADR-0013)

The retrieval architecture that makes Scout's intelligence scale to 900K properties, hundreds of territories, and thousands of prospects. Full plan: `docs/adr/0013-retrieval-brain-architecture.md`

| Phase | What                                                                                       | Status  | Effort       | New Cost |
| ----- | ------------------------------------------------------------------------------------------ | ------- | ------------ | -------- |
| 0     | **Fix what's broken** — wire transcripts→embedder, Scout→profile fields, GHL token logging | Planned | 2-3 sessions | $0       |
| 1     | Auto-populate profiles from call extractions (confidence-based)                            | Planned | 2 sessions   | $0       |
| 2     | Pre-computed contact & territory briefs                                                    | Planned | 2-3 sessions | ~$10/mo  |
| 3     | Smart retrieval chaining (auto follow relationships)                                       | Planned | 2 sessions   | $0       |
| 4     | Voyage AI embeddings + contextual retrieval + reranking                                    | Planned | 3-4 sessions | ~$30/mo  |
| 5     | Wire RAG into Scout chat tools + search_transcripts                                        | Planned | 2-3 sessions | $0       |
| 6     | Retrieval planner + quality logging                                                        | Planned | 2-3 sessions | $0       |

**Audit findings (2026-05-22):** Significant infrastructure already built but not wired together. RAG embedder/retriever exist but only journal embeddings active — transcripts never embedded. 199-field profile table (`contact_profile_fields`) invisible to all Scout tools. Post-call extraction captures 30-60 fields per call but requires manual rep approval. Phase 0 fixes these wiring gaps with zero new code — just connecting what exists. Full audit: `docs/adr/0013-retrieval-brain-architecture.md`.

---

## Decisions log

See `docs/adr/` for individual decision records. Key decisions:

- GHL is contacts + messaging only — app owns all pipeline logic (ADR-0001)
- Supabase is app state source of truth (ADR-0002)
- Draft-Review-Confirm pattern is sacred (ADR-0003)
- requireAuth returns Response, not throws (ADR-0008)
- Schema lives in supabase/migrations/ only (ADR-0009)
- GHL is a backend comms channel — NAH OS pushes to it, not the reverse (confirmed 2026-04-28)
- Ed25519 signature verification ready for GHL webhooks when needed; shared-secret for non-GHL providers
- Tier 1 #7 (form webhook) shelved — marketing site backend not editable
- Scout Retrieval Brain architecture — 6-phase plan for scalable data retrieval (ADR-0013)

---

## Open questions

- ~~JWT in localStorage vs httpOnly cookies~~ — DONE (Tier 2 #4, httpOnly cookies shipped)
- Per-rep RLS row filtering — SHELVED (small team, everyone collaborates on prospects/franchisees; revisit when team grows)
- OAuth token storage cleanup (JSON in app_settings) — cleanup pass later
- MasterSuite data direction (push vs pull) — needs scoping conversation
- GitHub API cache: old commit SHAs accessible up to 90 days post-scrub (private repo)
