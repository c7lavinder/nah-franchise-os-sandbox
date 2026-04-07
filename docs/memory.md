# memory.md — NAH Franchise OS Living Memory

> This file is updated by Claude Code after EVERY session, major update, fix, or important decision.
> This is the first file Claude Code reads at the start of every new session.
> It bridges the gap between GitHub commits and Claude Code's context window.
> If it happened and it matters — it lives here.

---

## Project Identity
- **Name:** NAH Franchise OS
- **Product:** AI-first franchise sales platform for New Again Houses
- **AI Brain:** Scout (powered by Anthropic Claude)
- **CRM Backend:** GoHighLevel (GHL) — source of truth for all contacts
- **Core rule:** Scout drafts → human confirms → executes in GHL

---

## Current Status
- **Phase:** Sprint 0 — Bug Fixes (Autonomous Overnight Run)
- **Last updated:** 2026-04-07
- **Last session:** Overnight autonomous execution — Sprint 0 + Sprint 1
- **Next action:** Sprint 0 bug fixes, then Sprint 1 Supabase schema migration

---

## Sprint 0 — Bug Fixes
**Started:** 2026-04-07
**Branch:** sprint-0-bug-fixes

### Pre-flight
- Repo: c7lavinder/nah-franchise-os-sandbox ✅
- Main branch clean: ✅
- Supabase CLI: v2.84.2 ✅
- npm install: ✅
- npm run build on main: ✅ (no pre-existing TS errors)
- Framework: Next.js 14, App Router, Supabase client in lib/supabase/
- Codebase: 90+ TS/TSX files, 5 existing migrations

### Bug 1 — All scored leads bucketed as "Low"

**SEE:**
- `components/dashboard/ScoreDistribution.tsx` — fetches `/api/intelligence/scores?tier=high|medium|low` and displays High/Medium/Low bar chart
- `app/api/intelligence/scores/route.ts:18-22` — defines tiers: high (70-100), medium (40-69), low (0-39) — thresholds are correct
- `lib/intelligence/scoring.ts` — calculates 100-point score from `candidate_intelligence` table fields (financial, operational, engagement, momentum)
- `lib/profile/lead-scoring.ts` — separate scoring engine for lead cards, uses Hot/Warm/Cool/Cold tiers — this engine works correctly
- `components/pipeline/LeadList.tsx:230-236` — displays Hot/Warm/Cool/Cold from `calculateLeadScore` — this is correct
- `app/api/contacts/batch/route.ts:122-130` — dynamically calculates lead score from GHL fields, returns correct tiers

**DIAGNOSE:**
Root cause D: All `candidate_intelligence.current_score` values are 0 or null because the intelligence bootstrap (`lib/intelligence/bootstrap.ts`) has not been run with real profile data (liquid_capital, funding_path, trainual_completion, etc. are all null). The scoring code in `lib/intelligence/scoring.ts` is correct — with empty data, all scores default to 0, landing every record in the "Low" bucket (0-39). This is a data layer issue, not a logic bug.

Two separate scoring systems exist:
1. `lib/profile/lead-scoring.ts` → Hot/Warm/Cool/Cold (pipeline LeadList) — works dynamically from GHL fields
2. `lib/intelligence/scoring.ts` → High/Medium/Low (ScoreDistribution dashboard) — requires populated `candidate_intelligence` table

**FIX:** ⏭️ SKIPPED — per Sprint 0 instructions, data layer issues are deferred. Do not invent scores.

**AUDIT:** N/A — skipped bug.

**CONFIRM:** ⏭️ SKIPPED — data layer issue, deferred to Sprint 1/2 when intelligence bootstrap runs against real data.

### Bug 2 — Workflow rewrite endpoint returns 500

**SEE:**
- `app/api/workflows/[workflowId]/rewrite/route.ts` — route handler
- `lib/workflows/rewrite-engine.ts` — calls `supabase.from("workflow_steps").select(...)` at line 49
- `supabase/migrations/` — no `workflow_steps` or `workflow_versions` table exists. Only `ghl_workflows` (a lookup table) in `004_ghl_lookup_tables.sql`
- `lib/workflows/types.ts` — defines 7 workflow tables that don't exist in the DB yet

**DIAGNOSE:**
Root cause E+F: The `generateRewrites` function queries `workflow_steps` (joined to `workflow_versions` and `workflows`), but these tables don't exist in Supabase yet. Postgres returns a "relation does not exist" error. The route handler caught this as a generic 500 instead of returning a meaningful status code. Additionally, the handler did `await params` without destructuring `workflowId`, wasting the route parameter.

**FIX:**
- File: `app/api/workflows/[workflowId]/rewrite/route.ts`
- Added: proper `workflowId` destructuring from params
- Added: 400 for missing workflowId
- Added: 503 for missing ANTHROPIC_API_KEY
- Added: 404 for "not found" errors (step doesn't exist)
- Added: 503 for "relation does not exist" errors (workflow tables not deployed)
- Preserved: existing business logic untouched

**AUDIT:**
1. Does the fix address the root cause? YES — returns structured errors (400/404/503) instead of generic 500
2. Does the fix introduce new failure modes? NO — error handling is additive; existing flow unchanged
3. Does the fix touch files outside scope? NO — only the route handler
4. Does `npm run build` pass? YES
5. Does the fix break existing tests? NO — no tests in repo
6. Is there DB state that needs updating? NO — code fix only, tables will be created in Sprint 1

**CONFIRM:**
- `npm run build`: ✅ passes
- Missing workflow tables → now returns 503 with message "Workflow tables not yet deployed" instead of raw 500
- Missing workflowId → returns 400
- Missing ANTHROPIC_API_KEY → returns 503
- ✅ CONFIRMED

---

## Tech Stack (Locked)
- Frontend: Next.js 14, TypeScript strict, App Router
- Styling: Tailwind CSS 3 with NAH design system
- Backend: Next.js API routes (not separate Express — simpler for MVP)
- Database: Supabase (Postgres) — untyped client until schema deployed
- AI: Anthropic Claude API (claude-sonnet-4-5-20250514)
- Voice: OpenAI Whisper API via MediaRecorder
- Auth: Supabase Auth with JWT in localStorage
- Icons: Lucide React

---

## Folder Structure
```
app/                     — Next.js App Router pages + API routes
  (auth)/                — Protected route group (redirects to /login if not authed)
  api/                   — 9 API routes (auth, scout, daily-hq, voice, accountability, health)
  login/                 — Public login page
components/
  layout/                — AppShell, Sidebar, TopBar
  scout/                 — ScoutBubble, UserBubble, ThinkingIndicator, DraftedActionCard, VoiceRecorder
lib/
  auth/                  — AuthContext (React), session.ts (server JWT verification)
  ghl/                   — GHL API client (16 functions)
  scout/                 — Scout client (tool-call loop), tools.ts, tool-executor.ts
  supabase/              — Browser + server Supabase clients
  accountability/        — 5 monitoring check functions
types/                   — database.ts, ghl.ts, scout.ts
supabase/migrations/     — 001_initial_schema.sql, 002_seed_data.sql
docs/                    — Architecture, design, pipeline, features, integrations, build-plan, stack, PROGRESS.md
services/
  ghl-mcp/               — Custom GHL MCP server (Phase 0)
```

---

## Environment Variables Needed
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server only) |
| `ANTHROPIC_API_KEY` | Claude API key for Scout |
| `GHL_API_KEY` | GoHighLevel API key |
| `GHL_LOCATION_ID` | GHL location/sub-account ID |
| `OPENAI_API_KEY` | Whisper voice transcription (optional) |
| `NEXT_PUBLIC_APP_URL` | App URL (http://localhost:3000 for dev) |

---

## Decisions Made
> Every time Claude Code makes an architectural or design decision, it logs it here.

- **2026-03-23** — Used Next.js API routes instead of separate Express backend — simpler for MVP, fewer moving parts
- **2026-03-23** — Used Supabase Auth instead of JWT + bcrypt — as specified by owner, less custom auth code
- **2026-03-23** — Used untyped Supabase client — schema not deployed yet, will generate types with `supabase gen types typescript` after migration
- **2026-03-23** — Used `claude-sonnet-4-5-20250514` model ID — latest available Sonnet model at build time
- **2026-03-23** — Auth tokens stored in localStorage (not HTTP-only cookies) — simpler for MVP, can upgrade to cookies later
- **2026-03-23** — Tailwind v3 (not v4) — v4 incompatible with Next.js 14 config approach
- **2026-03-23** — Pipeline upgraded from 9 stages to 11 active stages + 4 exit stages
- **2026-03-23** — Added Stage 6.5 compliance gate — hard block enforced by Scout
- **2026-03-23** — Stage 7 Application flagged as pending attorney review
- **2026-03-23** — Three pipelines confirmed: Active, Long-term, Closed
- **2026-03-23** — Pipeline philosophy: mutual vetting process, not traditional sales funnel
- **2026-03-23** — Chad owns full journey, orchestrates team member involvement at each stage
- **2026-03-23** — Workflows live entirely in NAH OS database — GHL is execution layer only
- **2026-03-23** — Admin-only approval required to push any workflow change live
- **2026-03-23** — Two update modes per change: new enrollees only OR full overwrite
- **2026-03-23** — A/B testing built into workflow engine from day one
- **2026-03-23** — Scout grades workflows A–F and rewrites underperforming steps
- **2026-03-23** — 30-day new lead sequence defined with day-by-day content plan
- **2026-03-23** — Chad personal calls required at days 3, 10, 14, 20, 30
- **2026-03-23** — AI scheduling agent books calls if no call booked by day 7
- **2026-03-23** — Lead card must show: Trainual %, days in stage, last activity, pipeline stage, sequence day number
- **2026-03-23** — One territory per franchisee confirmed
- **2026-03-23** — Average deal length: several months
- **2026-03-23** — Top loss reasons: capital, timing, competitors, territory, non-committal, bad fit
- **2026-03-23** — 84% of prospects never opened Trainual when invite fired cold
- **2026-03-23** — Fix: Chad framing call must be logged before Trainual invite fires
- **2026-03-23** — Building custom GHL MCP server — not using open source directly
- **2026-03-23** — basicmachines-co avoided: AGPL-3.0 viral license risk
- **2026-03-23** — hridayshah7 avoided as direct copy: no draft→confirm safety layer
- **2026-03-23** — Both repos used as reference only for API patterns and type definitions
- **2026-03-23** — Scout wired to GHL via MCP — Scout calls GHL tools natively
- **2026-03-23** — Every MCP write tool uses draft→confirm before execution
- **2026-03-23** — MCP server location: /services/ghl-mcp/
- **2026-03-23** — Phase 0 MCP tools: contact_get, contact_search, contact_history, pipeline_get_stages
- **2026-03-24** — Chad is orchestrator throughout entire journey — never hands off, schedules all calls, logs all outcomes
- **2026-03-24** — Matt runs Discovery (Matt Call) — prospect meets the franchisor, vision/culture/fit assessment
- **2026-03-24** — Sam runs Validation (Sam Call) — prospect vets operations with VP, day-to-day reality check
- **2026-03-24** — Mark runs capital conversation (Mark Call) — #1 objection handler, dedicated lending/funding call
- **2026-03-24** — GHL stage names mapped to our pipeline stage names (see docs/pipeline.md GHL Stage Name Mapping)
- **2026-03-24** — Mark Call given dedicated pipeline stage — not buried in Validation, capital is #1 blocker
- **2026-03-24** — Product goal: keep all team members OUT of GHL — Scout is the interface, GHL is the backend database
- **2026-03-24** — Pipeline 3 "Closed" NOT needed — Won/Lost are opportunity statuses in GHL, not a separate pipeline
- **2026-03-24** — GHL OAuth connected — tokens stored in app_settings, auto-refresh on expiry
- **2026-03-24** — Two NAH pipelines live: Active (11 stages) + Long-Term (3 stages), synced to Supabase

---

## What Has Been Built

### Phase 0 — Foundation
- [x] Next.js project initialized
- [x] Tailwind + design system configured
- [x] App shell (sidebar, top bar, responsive layout) built
- [x] Supabase client (browser + server) set up
- [x] GHL API client built (16 typed functions)
- [x] Scout API client built (tool-call loop + 8 tools)
- [x] Auth system (AuthContext, login API, session verification)
- [x] Login page wired to Supabase Auth
- [x] Protected route group with redirect
- [x] Database migrations (7 tables, indexes, RLS, triggers)
- [x] Seed data (admin user, 10 settings, 4 knowledge docs)
- [x] .env.local template created
- [x] Health check API endpoint

### Phase 1a — Scout AI Page
- [x] POST /api/scout/chat — full Claude tool-call loop
- [x] POST /api/scout/action — execute confirmed GHL actions
- [x] Chat UI (Scout bubbles, user bubbles, thinking indicator)
- [x] DraftedActionCard (Edit/Confirm/Cancel with inline editing)
- [x] Voice input (MediaRecorder + Whisper transcription)
- [x] Session persistence to Supabase
- [x] Action logging to scout_action_logs
- [x] Suggestion buttons, new session, auto-scroll

### Phase 1b — Daily HQ
- [x] GET /api/daily-hq — alerts, pipeline snapshot, upcoming events
- [x] Wired dashboard (scorecard, alerts, tasks, pipeline chart, upcoming)
- [x] Auto-refresh every 5 minutes
- [ ] Real activity counting from GHL (currently returns 0s)
- [ ] Real task pulling from GHL

### Phase 1c — Accountability Engine
- [x] 5 monitoring checks defined (speed-to-lead, stale, validation, closing, FDD)
- [x] POST /api/accountability/run — manual trigger
- [ ] Cron scheduling (Railway Cron or node-cron)

### Phase 2a — Pipeline Board
- [x] Placeholder page with Kanban column layout
- [ ] Not started — Phase 2

### Phase 2b — Leadership Dashboard
- [ ] Not started — Phase 2

---

## Known Issues & Bugs

- **[low]** — ESLint v8 is deprecated but required for Next.js 14 compatibility — upgrade when moving to Next.js 15
- **[low]** — Supabase client is untyped — generate types after schema deployment with `supabase gen types typescript`
- **[med]** — Daily HQ scorecard returns 0s — needs real GHL activity counting implementation
- **[med]** — No GHL OAuth token refresh — currently uses static API key, OAuth flow needed for production
- **[low]** — Auth uses localStorage — consider HTTP-only cookies for production security
- **[high]** — Stage 7 BLOCKED — pending franchise attorney review on application fee, deposit, background check, financial verification requirements
- **[med]** — Trainual framing call enforcement not yet in GHL automations — must configure GHL to wait for Chad call log before firing Trainual invite
- **[med]** — Workflow engine database tables not yet created — required before Phase 2 workflow features can be built

---

## Audit Log

- **2026-03-23** — Full project audit — `npx tsc --noEmit` returns 0 errors, `npx next build` succeeds with 19 pages and 9 API routes, no warnings

---

## Files Changed This Session

All files were created this session (initial build). See `git log` for the full list of 66 files.

---

## What Claude Code Must Do Every Session

### On START of every session:
1. Read memory.md FIRST
2. Read CLAUDE.md second
3. Check "Current Status" to know exactly where we are
4. Check "Known Issues" before writing new code
5. Check "What Has Been Built" before assuming anything exists

### On END of every session (or after any major change):
1. Update "Current Status" with new phase + last action
2. Update "What Has Been Built" checkboxes
3. Log any new decisions in "Decisions Made"
4. Log any bugs found in "Known Issues"
5. Log audit results in "Audit Log"
6. Update "Files Changed This Session"
7. Write a one-line "Last session" summary at the top

---

## Self-Audit Protocol
> Claude Code follows this 4-step process for every function, component, and API call.

### Step 1 — Write
Write the initial version of the code.

### Step 2 — Question
Ask these questions about every piece of code:
- Is this the simplest way to do this?
- Are there any edge cases not handled?
- Could this break under load or with bad data?
- Is the TypeScript typing correct and strict?
- Does this follow the patterns already established in the codebase?
- Is the error handling sufficient?
- Does this expose any security risk?
- Is this readable by another developer in 6 months?

### Step 3 — Improve
Apply improvements based on Step 2 findings.
Log what was changed and why.

### Step 4 — Validate
- Does it still do what it was supposed to do?
- Does it match the spec in the relevant doc?
- Does it follow the rules in CLAUDE.md?
- If it touches GHL — does it go through /lib/ghl only?
- If it touches Scout — is there a confirmation step before action?

Only after Step 4 passes does the code get written to the file.

---

## Claude Code Session Starter Prompt
> Copy this exact prompt at the start of every new Claude Code session.

```
Read memory.md first. Then read CLAUDE.md.
Tell me:
1. Current project phase
2. What was last built
3. Any known issues to be aware of
4. What we are building this session

Then proceed with: [describe what you want to build this session]

Remember: follow the 4-step self-audit protocol on every piece of
code before finalizing it. Update memory.md when the session ends.
```
