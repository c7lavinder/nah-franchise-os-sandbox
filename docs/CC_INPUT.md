# Claude Code Input — Repo State + Reorganization (2026-04-27)

> Read-only audit. No code changes. Findings are file-path specific.

---

## 1. Current State Snapshot

### What's actually shipped and working

- **Next.js 14 App Router app** with 11 authenticated pages: scout, daily-hq, pipeline, leads, dashboard, knowledge, settings, workflows, onboarding, calls, activity. Auth gated by [app/(auth)/layout.tsx](app/(auth)/layout.tsx).
- **~70 API routes** under [app/api/](app/api/) — all set `export const dynamic = "force-dynamic"`.
- **Scout AI tool-call loop** — [lib/scout/client.ts](lib/scout/client.ts) drives Claude Haiku 4.5 with 15 tools defined in [lib/scout/tools.ts](lib/scout/tools.ts) and dispatched in [lib/scout/tool-executor.ts](lib/scout/tool-executor.ts). Working: get_contact, search_contacts, get_pipeline, get_profile, get_next_action, get_schedule, search_knowledge, draft_message, draft_task, draft_stage_move, draft_profile_update, workflow_analyze, workflow_rewrite, sequence_status, trainual_status.
- **GHL client** — [lib/ghl/client.ts](lib/ghl/client.ts) is solid. OAuth + PIT token fallback, automatic refresh on 401, retry-after-aware backoff for 429s. ~30 typed wrapper functions covering contacts, opportunities, tasks, calendars, conversations, messages, notes, custom fields, workflows.
- **Intelligence engine** — 6 tables ([lib/intelligence/schema.sql](lib/intelligence/schema.sql)), explainable 100-pt scoring at [lib/intelligence/scoring.ts](lib/intelligence/scoring.ts), bootstrap script populated 1,987 profiles ([scripts/bootstrap-intelligence.ts](scripts/bootstrap-intelligence.ts)).
- **Workflow engine** — 7 tables ([lib/workflows/schema.sql](lib/workflows/schema.sql)), enrollment, scheduler, A/B testing, approvals, health scoring, rewrite engine, delivery sync. Backed by 6 cron endpoints under [app/api/cron/](app/api/cron/).
- **Accountability engine** — 5 monitoring checks in [lib/accountability/engine.ts](lib/accountability/engine.ts), single cron at [app/api/cron/stale-leads/route.ts](app/api/cron/stale-leads/route.ts).
- **Call log system** — call_logs table, 4 call types (intro/matt/sam/mark), structured JSONB fields per type, transcript analyzer at [lib/intelligence/transcript-analyzer.ts](lib/intelligence/transcript-analyzer.ts), grading endpoint [app/api/calls/[callId]/grade/route.ts](app/api/calls/[callId]/grade/route.ts).
- **Login flow** — Supabase Auth via [app/api/auth/login/route.ts](app/api/auth/login/route.ts), GHL OAuth via [app/api/auth/crm/](app/api/auth/crm/).
- **TypeScript: 0 errors** (`npx tsc --noEmit` passes).

### Stubbed, half-built, or dead code

- **`triggerWorkflow()` in [lib/ghl/client.ts:751](lib/ghl/client.ts#L751)** — depends on `ghl_workflows.webhook_url` lookup. Schema for that table exists in migration 004 but only a few rows are seeded. Most callers will throw 404.
- **`fetchScorecard()` in [app/api/daily-hq/route.ts:128](app/api/daily-hq/route.ts#L128)** — counts only from `scout_action_logs`, not real GHL activity. So Daily HQ scorecards are accurate only for actions taken *through Scout*. Manual reps using GHL UI directly will appear as zeroes. Direct contradiction with handoff.md claim that Daily HQ scorecard is real.
- **`task` action_type → calls counter** ([app/api/daily-hq/route.ts:181](app/api/daily-hq/route.ts#L181)) — call counter increments on task creation, not actual calls. Misleading metric.
- **`fetchTasks()` in [app/api/daily-hq/route.ts:242](app/api/daily-hq/route.ts#L242)** — limited to first 10 contacts to avoid rate limits, so a rep with 20 active leads sees only half their tasks.
- **`node-cron` package** in [package.json](package.json#L21) — included but never imported. Crons actually run via Vercel/Railway HTTP cron hitting `/api/cron/*` routes. Dead dep.
- **`data/` directory** at repo root — exists, contents unclear, not referenced from the code surface I read.
- **`migration/` directory** at repo root — separate from supabase/migrations/, looks orphaned.
- **`SESSION_START.md` + `CLAUDE.md` + `docs/memory.md` + `handoff.md`** — four overlapping memory files. Only `handoff.md` is current.

### Wired but not actually used / contradicts docs

- **[app/api/webhooks/ghl/route.ts](app/api/webhooks/ghl/route.ts)** — full webhook handler for ContactCreate, OutboundMessage, InboundMessage, OpportunityStageUpdate. **But [CLAUDE.md and memory clearly say "No GHL webhooks — all data via PIT/OAuth polling".** Either the handler should be deleted, or the directive should be relaxed. Right now this is dead code unless some external system is posting to it.
- **[lib/profile/lead-scoring.ts](lib/profile/lead-scoring.ts)** AND **[lib/intelligence/scoring.ts](lib/intelligence/scoring.ts)** — two parallel scoring systems. The Scout system prompt at [lib/scout/client.ts:82-112](lib/scout/client.ts#L82-L112) describes both schemas and tells Scout to reference both. Confusing for the model and for humans.
- **Architecture doc claims Express backend** ([docs/architecture.md](docs/architecture.md)) — actual code is Next.js API routes only. No `services/ghl-mcp/` directory exists despite memory.md claiming Phase 0 built one.
- **README.md MVP section** says "MVP consists of two pages: Scout AI + Daily HQ" — actual app has 11 protected pages. Onboarding/Coaching/Workflows/Activity/Calls/Knowledge/Settings/Pipeline/Leads/Dashboard are all built and shipped.
- **Stack docs name `claude-sonnet-4-5-20250514`** ([docs/memory.md:32](docs/memory.md#L32)) — actual model is `claude-haiku-4-5-20251001` ([lib/scout/client.ts:21](lib/scout/client.ts#L21)).
- **No `services/ghl-mcp/`** — memory.md and CLAUDE.md describe a custom MCP server that was never built. GHL is called directly via HTTP from `lib/ghl/client.ts`.

---

## 2. Doc Drift Report

| Doc | Last meaningful update | Reality | Drift severity |
|-----|------------------------|---------|----------------|
| [README.md](README.md) | 2026-03-24 | Says MVP = 2 pages; says Express backend; says JWT+bcrypt auth | **High** |
| [docs/architecture.md](docs/architecture.md) | 2026-03-24 | Express backend diagram, 7-table schema. Reality: Next.js routes, 13+ tables. | **High** |
| [docs/memory.md](docs/memory.md) | 2026-03-23 | "Phase 0 — Ready to build", "Daily HQ scorecard returns 0s", "Workflow engine database tables not yet created" — all 100% wrong now | **Critical** |
| [CLAUDE.md](CLAUDE.md) | 2026-03-24 | Says no webhooks, but webhook handler exists. Otherwise reasonable. | **Medium** |
| [docs/build-plan.md](docs/build-plan.md) | 2026-03-24 | Phase plan that's been overtaken by handoff.md | **High** |
| [docs/integrations.md](docs/integrations.md) | 2026-03-24 | No mention of Vonage, MasterSuite, Read.ai despite being in CLAUDE.md | **Medium** |
| [docs/PROGRESS.md](docs/PROGRESS.md) | 2026-03-24 | Frozen, superseded by handoff.md | **High** |
| [docs/pipeline.md](docs/pipeline.md) | 2026-03-24 | Pipeline stage names map closely to current GHL stages — generally correct | **Low** |
| [docs/design.md](docs/design.md) | 2026-03-24 | Light-mode rules match reality | **Low** |
| [docs/workflows.md](docs/workflows.md) | 2026-03-24 | Workflow architecture doc — broadly correct, table count off | **Low** |
| [docs/NAH-FO-INTELLIGENCE-PLAN.md](docs/NAH-FO-INTELLIGENCE-PLAN.md) | 2026-03-25 | Mostly current — drives Phase 3+ work | **Low** |
| [SESSION_START.md](SESSION_START.md) | 2026-03-25 | Mostly current. Folder structure misses `lib/intelligence/`, `lib/accountability/`, `lib/profile/`. | **Medium** |
| [handoff.md](handoff.md) | 2026-03-27 | Most accurate. **One month stale** vs today (2026-04-27). | **Low** |

### Specific contradictions
- **README** + **architecture.md** describe Express; everything is Next.js.
- **CLAUDE.md** says no webhooks; webhook route is live.
- **memory.md** says Phase 0; reality is Phase 4 complete.
- **README** says JWT+bcrypt; code uses Supabase Auth.
- **memory.md** says 7 DB tables; reality is 13+ (7 initial + 6 intelligence + 7 workflow).
- **CLAUDE.md** lists `workflow_ab_create` as a Scout tool; tool registry doesn't include it (only `workflow_analyze` and `workflow_rewrite`).

### Missing docs that should exist
- **runbook.md** — what to do when Scout 500s, when GHL OAuth refresh breaks, when cron stops firing, how to roll back a Vercel deploy.
- **security.md** — the auth model is currently undocumented (see §3 below — it has gaps).
- **data-model.md or schema.md** — actual current DB schema (not the stale architecture.md version). The intelligence + workflow tables are documented only inside their `.sql` files.
- **scout-tools.md** — current tool catalog, what each does, what they don't do, how to add a tool.
- **CONTRIBUTING.md** — how a new contributor sets up the environment, what `npx tsc --noEmit` matters, the deploy flow.

---

## 3. Engineering Health Check

### TypeScript strictness
- `strict: true` in [tsconfig.json](tsconfig.json) ✓
- `npx tsc --noEmit` passes with 0 errors ✓
- `: any` / `as any` / `<any>` count: **10 occurrences across 7 files** (mostly in scripts and audit docs, 1 in `app/api/leads/priority/route.ts`, 1 in `components/daily-hq/PriorityLeads.tsx`). This is excellent.
- Supabase client is **untyped** — [lib/supabase/server.ts:5](lib/supabase/server.ts#L5) admits this. Every `.from('table')` returns `any` in practice. The biggest hidden source of type unsafety in the codebase. Run `supabase gen types typescript` and feed the result into `createClient<Database>()`.

### Test coverage
- **Zero tests.** No `tests/` directory. No `*.test.ts` files. No `*.spec.ts`. No vitest, jest, playwright, or any test runner in [package.json](package.json).
- Critical untested paths: Scout tool-call loop, GHL client retry/auth logic, scoring engine, accountability rules, webhook handler.

### CI/CD
- **No `.github/workflows/`** — CI is manual.
- Vercel auto-deploys on push to main (per CLAUDE.md global) — that's the entire pipeline.
- No type-check gate, no lint gate, no smoke test gate.

### Error handling — gaps
- **[app/api/webhooks/ghl/route.ts:286](app/api/webhooks/ghl/route.ts#L286)** — handler swallows all errors and returns 200. No alerting. A silently broken webhook will look healthy.
- **`logLLMCall` swallowed** in [lib/scout/client.ts:272](lib/scout/client.ts#L272) — `.catch(() => {})`. Reasonable for fire-and-forget but means logging breakage is invisible.
- **GHL token refresh** silently falls back to PIT key on failure ([lib/ghl/client.ts:75](lib/ghl/client.ts#L75)) — production on a stale PIT will show no error until quota hits.
- **Session persistence** is "non-critical" ([app/api/scout/chat/route.ts:81](app/api/scout/chat/route.ts#L81)) — Scout will reply but the conversation is lost. Acceptable for MVP, surprising in a "production" claim.
- **`fetchTasks`** caps at 10 contacts ([app/api/daily-hq/route.ts:240](app/api/daily-hq/route.ts#L240)) — a rep with more contacts gets a partial view with no indicator.
- **No global error boundary** in `app/(auth)/layout.tsx` — a thrown component error will white-screen the page.

### Security — multiple critical issues
- **API auth gap.** Only **3 files** reference `requireAuth`/`getAuthUser`: [lib/auth/session.ts](lib/auth/session.ts), [lib/auth/index.ts](lib/auth/index.ts), [app/api/auth/me/route.ts](app/api/auth/me/route.ts). The other ~70 API routes are **unauthenticated server-side**. Anyone who can reach the deployment URL can hit `/api/scout/chat` directly with a `userId` of their choice and impersonate any user.
- **`/api/scout/chat`** ([app/api/scout/chat/route.ts:31](app/api/scout/chat/route.ts#L31)) accepts `userId`, `userRole`, `userName` from request body without validation. A user can claim leadership role and access leadership data.
- **`/api/daily-hq`** ([app/api/daily-hq/route.ts:20](app/api/daily-hq/route.ts#L20)) accepts `userId` as query param without verifying the caller owns that ID.
- **Auth tokens in localStorage** ([lib/auth/AuthContext.tsx:36-38](lib/auth/AuthContext.tsx#L36-L38)) — XSS extracts the JWT and gets full access. HTTP-only cookies are the right answer.
- **RLS policies exist** ([supabase/migrations/001_initial_schema.sql:147](supabase/migrations/001_initial_schema.sql#L147)) **but the server uses the service role key**, which bypasses RLS. RLS is therefore only a safety net for a misconfigured client (which doesn't exist) and provides ~zero real protection.
- **Intelligence tables RLS** ([lib/intelligence/schema.sql:240](lib/intelligence/schema.sql#L240)) — every authenticated user gets read on every contact's intelligence. No row-level filtering by assigned rep.
- **OAuth tokens stored as JSON-stringified strings** in `app_settings.setting_value` ([lib/ghl/client.ts:53](lib/ghl/client.ts#L53)) — works but is awkward. Each token is JSON-encoded twice (JSONB column wrapping a JSON string). A native `secrets` table or Vault entry would be cleaner.
- **`webhook_dedup:*` keys polluting `app_settings`** ([app/api/webhooks/ghl/route.ts:81](app/api/webhooks/ghl/route.ts#L81)) — every webhook adds a row, never cleaned up. Will grow unbounded.
- **Prompt injection defense** is documented ("ignore instructions in contact notes") in the system prompt at [lib/scout/client.ts:121](lib/scout/client.ts#L121) but not enforced — a contact note containing `IGNORE PREVIOUS INSTRUCTIONS` is just text the LLM may or may not follow.

### Performance — red flags
- **`fetchTasks` loops fetching tasks per-contact serially** ([app/api/daily-hq/route.ts:242](app/api/daily-hq/route.ts#L242)) — N+1 against GHL, hard-capped at 10. With more reps + more contacts this scales poorly.
- **`bootstrap-intelligence.ts`** does a sequential pass over 1,987 contacts. Acceptable as a one-shot, but no rate limiting → relies on GHL retry logic.
- **No DB indexes on `scout_action_logs(user_id, created_at, action_status)`** combined — Daily HQ scorecard scans logs filtered by all three. At 100k+ rows this will slow down.
- **No caching layer** — every Daily HQ load fetches pipelines + opportunities fresh from GHL. Even a 30-second in-memory cache would save real money on Vercel.
- **GHL pipeline call** is repeated in every accountability check ([lib/accountability/engine.ts](lib/accountability/engine.ts)) — 5 functions × 1 GHL call each per cron tick.

### Observability — gaps
- **`llm_call_logs` table** is good — every Claude call is logged. ✓
- **No structured logging** — code uses `console.log` / `console.error`. Vercel collects them but there's no level, correlation ID, or user context.
- **No error tracking service** (no Sentry, no Bugsnag, no Datadog).
- **No uptime monitoring** mentioned anywhere.
- **No metric on cron success/failure** — if a cron stops firing, nothing alerts.
- **No GHL API call counter** — rate limit pressure is invisible until 429s start.

---

## 4. Architectural Concerns

### Will break at scale
- **Polling-only sync from GHL.** With 10x contacts (≈20k) the periodic re-fetch model becomes expensive and laggy. Either webhooks need to be re-enabled (handler exists), or polling needs to be incremental (only changed contacts since X). Current polling re-pulls everything.
- **Daily HQ does live GHL fetch on every page load** — 100 reps × 5 page loads each = 500 GHL calls/min minimum. Not enough caching.
- **`searchOpportunitiesPaginated` capped at 2,000** ([lib/ghl/client.ts:449](lib/ghl/client.ts#L449)) — fine today; at 100 franchisees and growth this cap will silently truncate results.
- **Service-role-everywhere model** — when you onboard the rest of the team, every API route bypasses RLS. Permission checks happen *only* in app code, and that code currently doesn't check at all (see §3).
- **`scout_action_logs` and `llm_call_logs` are never archived** — these tables grow forever.
- **`app_settings` as a junk-drawer** — webhook dedup, OAuth tokens, ad-hoc config. Will become unauditable.

### Coupling that should be loosened
- **Scout system prompt is hardcoded** in [lib/scout/client.ts:39](lib/scout/client.ts#L39). Any prompt change is a code deploy. Consider moving identity/rules to `knowledge_documents` or a `scout_prompts` table so non-engineers (Corey) can iterate.
- **`tool-executor.ts` is one giant switch** ([lib/scout/tool-executor.ts](lib/scout/tool-executor.ts), 1,200+ lines). Each tool should be its own file.
- **`app_settings` row keys are stringly-typed** across the codebase — `ghl_access_token`, `ghl_refresh_token`, `webhook_dedup:*`. No central registry; renames are brittle.
- **GHL stage names live in three places**: `ghl_pipeline_stages` table, hardcoded keyword lists in [lib/accountability/engine.ts:22](lib/accountability/engine.ts#L22), and pipeline.md. They drift.

### Migrations I'd revisit
- **`001_initial_schema.sql`** — only has 7 tables. Intelligence (6) and workflow (7) tables were added via separate `.sql` files in `lib/*/schema.sql` and a setup script, not as numbered migrations. **Right now there is no single source of truth for "what is the DB schema right now."** Every new table should be a numbered migration in `supabase/migrations/`.
- **No down migrations.** Rollback is manual SQL.
- **`scout_action_logs.action_type` is a free-form VARCHAR** — `webhook_event`, `inbound_message`, `stage_move`, `task`, `message`, `email`. No enum. Easy to typo.
- **`ghl_contact_id` as VARCHAR(255)** instead of dedicated FK to a contacts cache table — every join requires a string match against GHL data.

### Schema decisions to reconsider
- **`candidate_intelligence.contact_id` is `VARCHAR NOT NULL UNIQUE`** — fine, but not joined to a `contacts` cache table. There's no app-side mirror of GHL contacts; everything is fetched live. If you ever want to do a cross-contact analytic query in SQL, you'll need that mirror.
- **`call_logs.fields JSONB`** — no schema validation. A typo in a key (`construction_comfort` vs `construction_experience`) silently changes the data model. Either define call-type-specific TypeScript schemas with a parser at the API boundary, or add Postgres CHECK constraints.
- **Single `contact_id` per call_log** — gap #4 (multi-contact / multi-territory) has no schema for it yet.

---

## 5. Reorganization Ideas

### 5a. Structure feedback

**What's right:**
- Single source of truth in `/docs/MASTER_PLAN.md` is exactly what's missing today.
- `/docs/adr/` is great — your "Decisions Made" list in `docs/memory.md` is screaming to be ADRs.
- `/docs/runbook.md` is overdue.
- `/docs/security.md` is overdue.
- Splitting `system-shape.md` from `scout.md` from `integrations.md` matches actual mental model.
- `.env.example` (drop the `.local`) is the canonical convention.

**What's missing:**
- **`/docs/data-model.md`** — current DB schema. Don't just rely on `/supabase/migrations/`. Humans need a flat table-by-table reference.
- **`/supabase/migrations/`** must become the actual single source of schema. Move `lib/intelligence/schema.sql` and `lib/workflows/schema.sql` into numbered migrations (006, 007). Then delete the originals. Right now there's ambiguity about which file ran when.
- **`/scripts/README.md`** — eight scripts in `scripts/` with no index, no "run this once" vs "run this regularly" distinction. Bootstrap, setup, import, seed are all mashed together.
- **`/docs/scout-tools.md`** — explicit catalog of every tool: name, input schema, what it returns, what it does NOT do, when to add a new one.
- **`/types/` README** — `types/database.ts` vs `types/supabase.ts` vs `types/ghl.ts` vs `types/scout.ts` is confusing; `database.ts` and `supabase.ts` overlap.

**What's overkill for a small team (you + occasional contributors):**
- **`/sprints/` directory with status front-matter** — for a one-person team this is process for process's sake. Replace with a single `docs/ROADMAP.md` with checkboxes and rough quarters. Sprints make sense at 5+ contributors, not 1.
- **`/commands/`** as a top-level dir — Claude Code already reads from `.claude/commands/`. The duplication in `commands/` and `.claude/commands/` is a footgun (see existing `audit.md`/`status.md`/`next.md`/`wrap-session.md` duplicated in both directories). Pick one. The `.claude/commands/` location is the de-facto standard.
- **`memory.md` at the root** as a "Claude Code working memory" — you already have `~/.claude/projects/.../memory/` (the user-level memory directory). A repo-level `memory.md` adds yet another fourth source of truth. Either delete it or define it crisply as "human-readable reflections, refreshed monthly". Right now `docs/memory.md` is none of those things and is severely stale.

**Naming conventions I'd change:**
- `MASTER_PLAN.md` (all-caps, underscored) reads loud. `docs/master-plan.md` matches the `kebab-case` rest of `/docs/`. Be consistent.
- `handoff.md` is good — keep.
- Drop `SESSION_START.md` entirely. It's a duplicate of README + handoff. The `Session Start` instructions belong inside `CLAUDE.md` or `README.md` § "Starting a session".
- `CT Contact Master - Sheet1.csv` (579KB!) sitting in repo root is gitignored but visible in `ls`. Move to `data/raw/` or delete.

### 5b. Drift prevention ideas

**What would actually keep docs fresh given how Claude Code sessions work:**

1. **Make `wrap-session` mandatory and lightweight.** It's already a slash command. Add it to a session-end hook in `.claude/settings.json` so it runs automatically when the session is winding down, not when Claude remembers to invoke it. (Hooks run reliably; "remember to" doesn't.)

2. **`refresh-docs` should diff doc claims against code.** Useful prompts to encode:
   - Does README's MVP page count match `app/(auth)/*/page.tsx` count?
   - Does `docs/architecture.md` schema list match `supabase/migrations/*.sql`?
   - Does `lib/scout/tools.ts` tool count match `CLAUDE.md` Scout tool list?
   - Does the model name in `lib/scout/client.ts` match `SESSION_START.md`?
   - Each of those is a one-liner check Claude Code can run. Make `refresh-docs` flag mismatches, not auto-rewrite — author gets to decide.

3. **`verify-master-plan` should actually run a checklist.** Today's audit-style command is good but its output is too long to be read end-to-end. Aim for a "✓ / ✗ / ⚠ — 12 lines" output, not a 200-line report.

4. **`new-sprint` and `new-adr`** — `new-adr` is high-value (your `docs/memory.md` Decisions Made section is 50+ entries that should be ADRs). `new-sprint` is overkill at this team size.

5. **Add a `verify-claims` hook** — scan `README.md` and `CLAUDE.md` for sentences like "X tables", "Y pages", "Z tools" and verify the numbers. This is the single highest-ROI drift defense given how docs actually drift here (count claims that go stale).

6. **What I noticed about memory/handoff patterns:**
   - **`handoff.md` regenerates well** because `wrap-session.md` has explicit structure. ✓
   - **`docs/memory.md` rotted because nobody owns it** — no command updates it, no template enforces it. It became a graveyard of phase 0 notes. **Delete it.** Move its "Decisions Made" section to `/docs/adr/` (one ADR per decision) and let everything else live in `handoff.md` or `MEMORY.md` (auto-memory) or in code comments.
   - **Auto-memory in `~/.claude/projects/.../memory/`** is working — the index has 8 entries that are roughly accurate. Don't duplicate this in the repo. The repo should have project-state docs (handoff, master plan); the user-level memory should hold preferences and judgment calls.
   - **Three "instructions" files (`CLAUDE.md`, `SESSION_START.md`, `README.md`)** all describe how to start a session. Pick one canonical entry-point. I'd vote `README.md` for new humans + `CLAUDE.md` for Claude. Delete `SESSION_START.md`.

### 5c. Onboarding test

**If a new team member opens this repo today, what confuses them first:**

1. **"Is this Express or Next.js?"** README + architecture.md say Express. Code is Next.js. Five minutes lost.
2. **"What's the auth model?"** README says JWT+bcrypt. Code uses Supabase Auth. Login route uses Supabase. AuthContext stores JWT-shaped tokens in localStorage. Confusion.
3. **"Why are there four memory/state files?"** `CLAUDE.md`, `SESSION_START.md`, `handoff.md`, `docs/memory.md`, plus README. Which is current? (Answer: only `handoff.md`.)
4. **"What's actually in the DB?"** `supabase/migrations/` has 5 files. Then there are two more `.sql` files in `lib/intelligence/` and `lib/workflows/` that also create tables. No single index.
5. **"What's webhooks/ghl/ for if we don't use webhooks?"** Real question. CLAUDE.md says no webhooks; the directory is wired up.
6. **"Where's the test suite?"** There isn't one.
7. **"What's `commands/` vs `.claude/commands/`?"** Same content, different paths. Why?
8. **"Why is there a 579KB CSV in the repo root?"** It's gitignored, but it's visible.

**README rewrite priority:** the very first heading should answer (1)-(5) in a single paragraph each. Skip the marketing copy ("Every rep should feel..."). New devs need: what stack, what auth, where state lives, where schema lives, how to run it, what's actually built, what's pending.

**Ideal first 30 minutes of reading order:**

1. **README.md** (5 min) — what this is, what stack, how to run it
2. **CLAUDE.md** (5 min) — Scout's identity + non-negotiable rules + GHL rules
3. **handoff.md** (3 min) — what's done, what's broken, what's next
4. **docs/master-plan.md** (10 min) — current state + roadmap (this doesn't exist yet — create from this doc + handoff)
5. **docs/system-shape.md** (5 min) — the 1-page mental model: Next.js → Supabase + Anthropic + GHL; 11 pages; ~70 routes; 13 DB tables; 5 cron jobs (this also doesn't exist)
6. **docs/runbook.md** (2 min) — what to do when X breaks (also doesn't exist)

Roughly: invest in (4)-(6); they don't exist yet and would replace the bulk of currently-stale `/docs/`.

---

## 6. The 7 Open Gaps + Vonage

### 1. LLM enhancement for day-to-day conversation depth
- **Foundation in place?** Yes. Tool-call loop works, knowledge base injection works, intelligence context injection works ([lib/scout/client.ts:154](lib/scout/client.ts#L154)). LLM logging exists.
- **Code blockers:** System prompt is hardcoded — fast iteration requires a redeploy. Knowledge docs are fetched but only top 10 by priority — anything outside those 10 is invisible. No conversation summarization on long sessions (will hit context limits).
- **Effort:** **M** (1-2 weeks) — move prompt to DB-backed templates, add "what Scout learned about this user" memory writes (table exists, only used read-side currently), expand knowledge retrieval beyond top-10.
- **Sequencing:** Do this **after** #3 (real users in GHL) so per-user memory has real users to attach to.

### 2. GHL tasks/calendars/notes wiring → accurate per-user Daily HQ
- **Foundation in place?** Tasks: yes ([lib/ghl/client.ts:526](lib/ghl/client.ts#L526)). Calendars: yes (getAppointments, free-slots, createAppointment). Notes: yes (getNotes, addNote). All wrapped, all typed.
- **Code blockers:** [app/api/daily-hq/route.ts](app/api/daily-hq/route.ts) `fetchScorecard()` only reads `scout_action_logs`. `fetchTasks()` caps at 10 contacts. Per-user filtering relies on `users.ghl_user_id` mapping which is sparse. No call-activity counter at all (calls counter currently aliases task creation).
- **Effort:** **M** (1 week) — fetch real GHL activity per-user-per-day with proper pagination + 30s cache. Block on #3.
- **Sequencing:** Do this **with** #3.

### 3. All team members in GHL account (real users, real auth)
- **Foundation in place?** Schema yes — `users.ghl_user_id` exists. Login wired. RLS exists.
- **Code blockers:** No admin UI to invite/manage team members. No `users` row creation flow outside `setup-ghl-account.ts` script. Critically: the **API auth gap** (§3) means until you actually enforce auth on every route, "real users" gets you nothing.
- **Effort:** **S-M** (3-5 days) for invite UI + user CRUD; **M** (1 week) to retrofit `requireAuth` across all ~70 routes.
- **Sequencing:** **Do auth retrofit FIRST.** Before #1 and before adding new users. Every day this drags adds risk.

### 4. Call data extraction tab — multi-contact and multi-territory support
- **Foundation in place?** Single-contact call_logs work. Transcript analyzer works ([lib/intelligence/transcript-analyzer.ts](lib/intelligence/transcript-analyzer.ts)). Call type selector works. UI is at [components/calls/](components/calls/).
- **Code blockers:** Schema is `contact_id VARCHAR NOT NULL` — single-contact only. Multi-contact requires a join table (`call_log_contacts`). No territory column on `call_logs`. Transcript analyzer doesn't yet route different call types to different rubrics (#5 dependency).
- **Effort:** **M-L** (2 weeks) — schema migration + analyzer refactor + UI.

### 5. Per-call-type scoring/grading/coaching output
- **Foundation in place?** Call types tagged. `/api/calls/[callId]/grade` route exists. `CoachingTab.tsx` exists. Scoring engine at [lib/intelligence/scoring.ts](lib/intelligence/scoring.ts) is profile-level, not call-level.
- **Code blockers:** Need a `call_grading_rubrics` table or constants file mapping call_type → rubric → score axes. Need different prompts per type. Grade storage schema unclear.
- **Effort:** **M** (1-2 weeks). Less if you use a flat constants file vs DB-backed rubrics.
- **Sequencing:** Do **after** #4 (multi-contact) so the rubric is applied to the right call shape.

### 6. MasterSuite data connection
- **Foundation in place?** None. Zero MasterSuite code in repo. Only mentioned in CLAUDE.md and pipeline.md as objection-handling content.
- **Code blockers:** No API spec, no auth flow, no schema for what data MasterSuite holds, no decision on push vs pull, no connection map (the `ghl-masterclass` equivalent for MasterSuite doesn't exist).
- **Effort:** **L** (3-4 weeks) once spec exists. Spec gathering itself is its own task.
- **Sequencing:** Last among the gaps. Needs a written integration plan first — this is a writing task, not a coding task.

### 7. Form submission webhook for new prospects
- **Foundation in place?** **Yes — already wired.** [app/api/webhooks/ghl/route.ts:99](app/api/webhooks/ghl/route.ts#L99) handles `ContactCreate` events: dedup, alert creation, action log. Form-fill in GHL → ContactCreate fires → webhook handler runs.
- **Code blockers:** Two issues:
  1. **CLAUDE.md says no webhooks.** Either lift that rule or polish the polling path. Right now we have both.
  2. The webhook URL needs to be configured in GHL (verify in GHL Settings → Webhooks).
- **Effort:** **S** (1-2 days) — verify GHL config, end-to-end test, decide on webhook policy.
- **Sequencing:** Quick win. Do early to unblock other GHL data flows.

### Vonage (per memory: "missing entirely" — confirmed)
- **Foundation in place?** None. `grep -i vonage` returns zero matches. No env vars, no client, no docs.
- **Priority assessment:** Vonage is a phone-call provider — relevant for capturing actual call audio + delivering SMS at scale. Today GHL handles SMS. The question is whether Vonage replaces GHL messaging or supplements it (call recording → transcript pipeline). If it's the former, big rebuild. If it's the latter, it's a transcript-input source for #4/#5.
- **Effort:** **L** for full integration. **M** if scoped to "Vonage call recordings → transcript pipeline → existing transcript analyzer".
- **Recommended priority:** Below MasterSuite if MasterSuite is the active operational data system. Above MasterSuite if call-recording quality is the current bottleneck. **Need Corey to clarify scope** before committing.

### Suggested sequencing
1. **Auth retrofit** (silent prereq for #3 and everything else with users) — **start here**
2. **Form webhook** (#7) — quick win, unblocks lead-flow data
3. **Real users in GHL** (#3) — depends on auth retrofit
4. **GHL tasks/calendars/notes per-user Daily HQ** (#2) — depends on #3
5. **LLM enhancement** (#1) — depends on #3 for per-user context
6. **Multi-contact calls** (#4) — independent
7. **Per-call-type grading** (#5) — depends on #4
8. **MasterSuite OR Vonage** — needs scoping conversation first

---

## 7. What I'd Do Differently

In rough priority order:

1. **Fix the auth gap before doing anything else.** ~70 unauthenticated API routes is an existential issue, not a backlog item. A determined visitor with browser dev tools can trigger Scout chats as anyone, read any contact's intelligence, send messages through GHL, and so on. It blocks every other thing in the gap list because real users + real data + no auth = real liability. **One day's work**, retrofitting `requireAuth` + replacing body-passed `userId/userRole` with `auth-derived` ones. Do it before adding team members to the system.

2. **Pick one source of truth for memory/state.** Today's mix of `CLAUDE.md` + `SESSION_START.md` + `handoff.md` + `docs/memory.md` + `docs/PROGRESS.md` + user-level auto-memory is six places. Three (`SESSION_START.md`, `docs/memory.md`, `docs/PROGRESS.md`) are pure liability — stale, contradictory, no owner. Delete them. Keep: `README.md` (humans, fresh), `CLAUDE.md` (Claude rules, fresh), `handoff.md` (session-to-session, regenerated), `MEMORY.md` index (auto-memory, automatic). That's it.

3. **Move all DB schema into numbered migrations.** `lib/intelligence/schema.sql` and `lib/workflows/schema.sql` should be `006_intelligence_tables.sql` and `007_workflow_tables.sql` in `supabase/migrations/`. The current setup means there's no single way to know what's in the DB.

4. **Generate Supabase types.** `npx supabase gen types typescript` and use `createClient<Database>()`. The untyped client is the single biggest type-safety hole in an otherwise strict-typed codebase. Half a day of work.

5. **Decide on webhooks once and stick to it.** Either delete `app/api/webhooks/ghl/` and live with polling, or update CLAUDE.md/memory to drop the no-webhooks rule and rely on the (already-built) handler. The current contradiction is exactly the kind of state that produces bugs — someone reads the docs and assumes one thing, the system does another.

6. **Add minimum viable CI.** A single `.github/workflows/ci.yml` that runs `npm install && npx tsc --noEmit && npm run lint` on PR. Two hours. Catches the "TypeScript broke on push to main" class of issues, which is currently caught only when Vercel deploy fails.

7. **Add 5-10 critical-path smoke tests** before scaling features. Highest-value targets: the GHL retry/auth logic in `lib/ghl/client.ts`, the Scout tool-call loop in `lib/scout/client.ts`, the scoring engine in `lib/intelligence/scoring.ts`, the webhook handler. Even hand-written contract tests with a mocked fetch would catch most regressions.

8. **Consolidate the two scoring systems.** [lib/profile/lead-scoring.ts](lib/profile/lead-scoring.ts) and [lib/intelligence/scoring.ts](lib/intelligence/scoring.ts) are parallel implementations. The Scout system prompt currently teaches Scout both, which is confusing for the model and a maintenance hazard for humans. Pick one (intelligence is newer + explainable + has score history); migrate the other; delete it.

9. **Stop committing the CSV and the migration/ folder.** `CT Contact Master - Sheet1.csv` (579KB) and the orphaned `migration/` directory are clutter that confuses readers. Even gitignored, they show up in `ls` and IDE file trees.

10. **Build a "config registry" type-safe wrapper for `app_settings`.** Today every `setting_key` is a magic string scattered across 15+ files. A single `lib/settings.ts` exporting `getGHLAccessToken()`, `getGHLRefreshToken()`, `getWebhookDedup(id)`, `setX(...)` would eliminate a class of typos and make rename refactors trivial.

11. **Right-size the doc system to 1 person.** The proposed reorganization has a lot of structure (sprints, ADRs, runbook, security, integrations, system-shape, scout, team) — about right for a 5-person team but heavy for one operator + Claude. Aim for: README, CLAUDE, handoff, master-plan, system-shape, runbook (when it hurts), ADRs (when a decision is sticky). Anything else is overhead Corey will pay for in maintenance time.

12. **Consider archiving `docs/architecture.md` rather than rewriting.** It's 1,055 lines, mostly aspirational, partially wrong. A 100-line `system-shape.md` that documents what actually exists today is more useful than a 1,055-line rewrite.

---

## 8. Claude Code Tooling Stack

> Read what's already there, then opinion-stress-test the proposed stack. Bias: pushback, not compliance. The most expensive mistake here would be installing 30 things and using 3.

### 8.1 Current `.claude/` State

- **`.claude/` directory** exists. It contains exactly one subdirectory: `.claude/commands/`.
- **No `settings.json`, no `settings.local.json`** — no hooks, no permission rules, no env config.
- **No `.claude/agents/`** — zero subagents.
- **No `.claude/skills/`** — zero skills.
- **No `.claude/hooks/`** — zero hooks.
- **No `.claude/plugins/`** — nothing installed.

**Existing slash commands** (4 total, in [.claude/commands/](.claude/commands/)):

| Command | What it does | Health |
|---------|---|---|
| [`/audit`](.claude/commands/audit.md) (20 KB) | 9-section, 200+ line code-audit protocol covering structure, types, GHL boundary, Scout safety, errors, security, etc. | **Functional but heavy** — outputs walls of text. Rarely run end-to-end. |
| [`/next`](.claude/commands/next.md) (12 KB) | Reads `docs/memory.md` + `docs/build-plan.md`, cross-references, recommends next task with copy-paste prompt. | **Broken in practice** — depends on `docs/memory.md` (severely stale, see §2) and `docs/build-plan.md` (also stale). Output will be wrong. |
| [`/status`](.claude/commands/status.md) (1.4 KB) | Reads `memory.md`, prints fixed-format status report including phase, build health, recent decisions. | **Broken** — same root cause. Will report Phase 0 because that's what `memory.md` says. |
| [`/wrap-session`](.claude/commands/wrap-session.md) (1 KB, simplified v2) | Defines the `handoff.md` structure for end-of-session writeup. | **Working** — this is the one that actually shipped value. handoff.md is the only fresh state doc in the repo. |

**Duplicate `commands/` directory at repo root** — same 4 filenames. The root `commands/wrap-session.md` is the older 13-step v1 (4.3 KB) referencing memory.md heavily; `.claude/commands/wrap-session.md` is the v2 simplification. The other three (`audit.md`, `next.md`, `status.md`) are byte-identical duplicates. **This is a footgun**: if you edit one, the other doesn't update, and Claude Code reads from `.claude/commands/` (so the root copies are dead).

**What we'd be overwriting / conflicting with:**
- Nothing in `.claude/agents/` or `.claude/skills/` (those don't exist) — clean install.
- The proposed `/wrap-session` skill collides with the existing `/wrap-session` slash command. Pick one mechanism. Slash command is fine — keep it.
- The proposed `verify-master-plan` would functionally replace `/next` and `/status`. Plan to delete those when the new infrastructure exists, not before.
- `docs/memory.md` and `docs/build-plan.md` need to be deleted or rebuilt before `/next` and `/status` (or any replacement) can produce correct output. The slash commands are downstream of the doc cleanup, not parallel to it.

### 8.2 Stack Recommendations

**Layer 1 — Public installs**

| Item | Recommendation | Reason |
|------|---|---|
| **`obra/superpowers` full plugin** | **Modify — cherry-pick, don't install whole** | This is heavy: SessionStart hook + ~15 skills + mandatory brainstorm→plan→worktree→TDD→review flow. Big problems for *this* repo: (a) zero existing tests means TDD enforcement is friction, not signal; (b) single-operator team means subagent-driven-development overhead is overhead; (c) the Vercel-deploys-on-push-to-main flow is incompatible with `using-git-worktrees` as a default; (d) Scout's draft→review→confirm pattern is the project's sacred flow and adding another mandatory workflow on top will conflict in confusing ways. **Cherry-pick `code-reviewer` agent and `writing-plans` skill. Skip the rest.** |
| **`mattpocock/skills/git-guardrails-claude-code`** | **Keep — install** | This is the highest-ROI install on the list. Today nothing prevents `git push --force` to main, and main = production via Vercel. One bad command = downtime. Pattern-matches §3 security gaps. |
| **`mattpocock/skills/setup-pre-commit`** | **Keep — install** | Closes the CI gap from §3 (no type-check gate, no lint gate). Husky + lint-staged + Prettier + tsc + tests on commit catches the "pushed broken TS" class of bug. Note: tests gate is a no-op until tests exist (gap from §3). |
| **`mattpocock/skills/grill-me`** | **Modify — install but rarely use** | Useful for designing new features (especially the Vonage/MasterSuite scoping calls flagged in §6). For day-to-day work it's overkill. Don't make it auto-trigger. |
| **`mattpocock/skills/improve-codebase-architecture`** | **Drop — defer until ADR/CONTEXT exist** | This skill explicitly reads from `CONTEXT.md` and `docs/adr/`. Both files don't exist yet. Without them, the skill grades "missing infrastructure" instead of analyzing real architectural smells. Install after the doc reorg lands and 3-5 ADRs exist. |
| **`mattpocock/skills/triage-issue`** | **Drop** | Workflow is "investigate bug → file GitHub issue with TDD plan." This repo doesn't use GitHub Issues (commits go straight to main). The TDD plan output dies on contact with reality (no test infra). Skip. |

**Layer 2 — Custom NAH skills**

| Skill | Recommendation | Notes |
|-------|---|---|
| `nah-context-load` | **Modify — make it a SessionStart hook reading handoff.md only** | Don't read MASTER_PLAN.md / sprints / pipeline state at session start. handoff.md is *the* state doc. Loading more = noise + slower context warmup. If user asks "where are we", *then* expand. |
| `wrap-session-nah` | **Drop — keep slash command** | `/wrap-session` already exists, works, and is well-defined. Skill version is duplication. The "create session log if a major decision was made" addition belongs in a separate `/draft-adr` command, not bolted into wrap. |
| `verify-master-plan` | **Keep — high value** | But: needs MASTER_PLAN.md to exist first. Build the doc, then build this skill. Not the reverse. |
| `draft-review-confirm-check` | **Modify — make it a code-reviewer agent rule, not a skill** | Scout's tool-executor already enforces DRC structurally (`draft_*` tools return drafts, `/api/scout/action` executes after confirmation). A skill that re-checks this on Edit is belt-and-suspenders friction. Better: code-reviewer agent has a "Does this preserve DRC?" check in its rubric. |
| `new-sprint-from-plan` | **Drop** | Already pushed back on `/sprints/` in §5a. One-person team doesn't need sprint files. ROADMAP.md with checkboxes does the job. |
| `new-adr` | **Keep — high value** | The "Decisions Made" section of `docs/memory.md` has 50+ decisions that should have been ADRs. Pattern that's overdue. |
| `migration-safety-check` | **Keep — highest-ROI custom skill** | Schema currently lives across `supabase/migrations/`, `lib/intelligence/schema.sql`, `lib/workflows/schema.sql`, plus setup scripts. Any of these could deploy a destructive ALTER. PreToolUse(Edit) on `*.sql` is exactly the right hook. |
| `scout-prompt-review` | **Defer until prompt is externalized** | Today Scout's prompt is hardcoded in [lib/scout/client.ts:39](lib/scout/client.ts#L39). A "review the prompt" skill that triggers on `client.ts` edits will fire on unrelated changes. After §4 work moves prompt to DB or `prompts/` folder, build this skill against that path. |

**Layer 3 — Hooks**

| Hook | Recommendation | Notes |
|------|---|---|
| `SessionStart → nah-context-load` | **Keep, but trim** | Read handoff.md + last 5 `git log` lines. That's it. Don't read the whole `docs/` tree. |
| `PreToolUse(Bash) → block dangerous commands` | **Keep — covered by git-guardrails install** | Don't custom-build; install the package. |
| `PreToolUse(Edit) → migration-safety-check on *.sql` | **Keep — highest ROI custom hook** | Schema lives in 3+ places. This is the one hook that prevents a real production-data class of bug. |
| `UserPromptSubmit → DRC reminder when prompt mentions Scout + verbs` | **Drop — friction noise** | Pattern-matching on prompts to inject reminders is the kind of "helpful nag" that becomes invisible after 10 sessions. The DRC pattern is enforced in code (tool-executor) and documented in CLAUDE.md (which is system-loaded). Adding a third reminder layer is diminishing returns + breaks flow. |

**Layer 3 — Agents**

| Agent | Recommendation | Skill or Agent? |
|-------|---|---|
| `code-reviewer` (Superpowers default, NAH-customized) | **Keep — use Superpowers' agent + add NAH rubric** | Agent. Reviews are parallelizable while you keep working. Add NAH rules: GHL boundary, DRC pattern, no hardcoded secrets, RLS-aware. |
| `migration-reviewer` | **Keep** | Agent. Schema review benefits from running in parallel during migration write. Should check: idempotency, RLS policies on new tables, indexes, FK integrity, no breaking ALTER. |
| `pr-summarizer` | **Defer until you start using PRs** | Today everything goes direct to main (per CLAUDE.md). PR summaries are output without input. Build when PR workflow exists. |
| `prompt-reviewer` | **Skill, not agent — and defer** | Single-file analysis is linear. Skill is fine. Defer until prompt is externalized (§4). |

**Layer 3 — Slash commands**

| Command | Recommendation | Notes |
|---------|---|---|
| `/wrap-session` | **Keep — already exists** | The v2 in `.claude/commands/` is the right one. Delete the v1 in `commands/`. |
| `/load-nah` | **Drop** | If SessionStart hook works, manual trigger is redundant. If it doesn't work, fix the hook. |
| `/sprint-from-plan` | **Drop** | Per §5a — sprints are overkill for this team. |
| `/verify-claims` | **Keep — highest-ROI custom command** | Drift defense. See 8.3 Q5 for the exact draft. |
| `/draft-adr` | **Keep** | Use when a sticky decision happens. Replaces the "Decisions Made" graveyard in `docs/memory.md`. |
| `/audit-docs` | **Keep, but replace `/audit`** | The existing `/audit` command (20 KB!) is over-engineered and rarely used. `/audit-docs` should be smaller and focused on doc-vs-code drift specifically. Delete the old `/audit` when replacement lands. |

### 8.3 Specific Answers

**1. Conflict check.** Yes, several:
- Superpowers ships its own `SessionStart` hook ("You have Superpowers" injection). Proposed `nah-context-load` SessionStart hook will compete or stack — last-write-wins behavior is undefined. Pick one. If installing Superpowers full, drop the custom SessionStart and let Superpowers' code-reviewer + plan workflow handle it. If keeping NAH-only, skip Superpowers.
- Superpowers' `using-git-worktrees` skill assumes work-on-branch-then-merge. NAH workflow is push-to-main → Vercel deploy. Worktrees + main-only means your worktree work never deploys. Friction.
- Superpowers' `subagent-driven-development` runs subagents in parallel. The current handoff.md / wrap-session pattern assumes a single linear narrative per session. Subagents will fragment the narrative and break wrap-session's structure. Disable that skill if installing.
- The existing `/audit` (200+ lines), `/wrap-session` (13 steps in v1), and `/next` (4-step cross-reference) are already heavy procedural commands. Layering Superpowers' methodology on top creates compound process — the user spends more time running protocols than building features. Watch for this.

**2. Skill `description` drafts for the 3 most important.**

Skill descriptions are how Claude Code decides whether to invoke. Specific phrasing > generic. Each one below uses the action verb + concrete trigger pattern style.

- **`migration-safety-check`** — *"Use when editing or creating any `.sql` file under `supabase/migrations/`, `lib/*/schema.sql`, or any file matching `*migration*.ts`. Forces a checklist before write: (1) is this idempotent (`IF NOT EXISTS` or guard clauses)? (2) does it have a documented rollback path? (3) if it creates a table, are RLS policies defined? (4) if it adds a column with `NOT NULL`, is there a default or backfill? (5) does it touch a table with >10k rows in production? Output: ✓ for each + warnings. Skill returns BLOCK if any is unanswered."*

- **`verify-claims`** — *"Use when the user asks to verify the docs, before publishing a doc change, or whenever the user mentions 'drift', 'is the doc current', or 'check claims'. Scans `README.md`, `CLAUDE.md`, `docs/master-plan.md`, `handoff.md` for claim-numbers (page count, table count, Scout tool count, model name, env var count) and verifies them against the code. Reports each claim as ✓ matches / ✗ stale / ⚠ ambiguous. Output is a bullet list under 20 lines, never auto-rewrites."*

- **`nah-context-load`** — *"Use at session start (via SessionStart hook) or when the user asks 'where are we?', 'what's the status?', 'what did I last do?', or types `/load-nah`. Reads `handoff.md` and the last 5 git commit messages. Outputs a 5-line briefing: phase, last build, open issues, exact next step, today's date. Does not read MASTER_PLAN, build-plan, or sprints — those are too verbose for session start."*

**3. Missing skills — pain points I'd add:**

- **`ghl-boundary-check`** — when a file under `lib/` or `app/api/` is edited and adds a `fetch(...leadconnectorhq...)` or imports `@anthropic-ai/sdk` outside `lib/scout/`, flag it. CLAUDE.md says GHL must go through `lib/ghl/client.ts` and Claude must go through `lib/scout/client.ts`. Today there's no enforcement. Easy to violate, easy to detect.
- **`scout-tool-add`** — adding a Scout tool requires three coordinated edits: define in [lib/scout/tools.ts](lib/scout/tools.ts), implement in [lib/scout/tool-executor.ts](lib/scout/tool-executor.ts), and (per CLAUDE.md) update the Scout Tools section in `CLAUDE.md`. Today these can drift (CLAUDE.md lists `workflow_ab_create` which doesn't exist in tools.ts — see §2). Skill: when `tools.ts` changes, prompt to verify the other two and offer the diff.
- **`supabase-types-regen`** — when any `.sql` file changes, prompt: "Run `npx supabase gen types typescript`?" The untyped Supabase client is the largest type-safety hole (§3) and types-regen is the fix that nobody remembers to do.
- **`deploy-readiness`** — pre-push checklist as an explicit skill: `npx tsc --noEmit` clean, no `console.log` in changed files, no hardcoded keys, env vars match `.env.example`, current branch is `main`. CLAUDE.md says "0 errors required before every push" but nothing checks. Skill makes the check actionable.
- **`call-rubric-validator`** — once Phase 5 multi-call grading lands (gap #4/#5 in §6), call_logs.fields is a free-form JSONB. Skill validates structure by call_type before insert. Defer until Phase 5.

**4. Hook annoyance risk.** Three of the proposed four are wins; one is friction.

- **SessionStart → nah-context-load** — useful *if* it stays under 5 lines of output. Allow it.
- **PreToolUse(Bash) blocking dangerous commands** — pure win. Already a real risk (production = main). git-guardrails covers it.
- **PreToolUse(Edit) on migrations** — highest-value hook proposed. The `lib/intelligence/schema.sql` and `lib/workflows/schema.sql` files are the kind of thing Claude could "improve" with a destructive change and the user wouldn't notice until production data is gone. This hook is the safety net that's missing today.
- **UserPromptSubmit DRC reminder** — friction noise. Don't install.

**Patterns where a hook would have prevented a real problem in this repo:**
- The webhook handler exists despite "no webhooks" rule (§1) — a `PreToolUse(Edit)` hook that flagged "you're editing a webhook handler but CLAUDE.md says no webhooks; resolve which is true" would have caught the contradiction at write time.
- The duplicate `commands/` and `.claude/commands/` directories drifted (wrap-session.md differs) — a hook on either dir warning "the other dir has the same file with different content" would have caught this.
- The two scoring systems (§1) — a hook that refused new top-level `lib/*/scoring.ts` files when one already exists would have stopped the duplication.

**5. Agent vs skill (per agent):**

- `code-reviewer` → **agent**. Review while you keep working. Parallelizable. Output is a structured report. Classic agent shape.
- `migration-reviewer` → **agent**. Schema analysis benefits from focused, fresh-context review. Migrations are infrequent enough that the cost of spawning an agent is fine.
- `pr-summarizer` → **skill**. Linear, single-output, end-of-task. Doesn't benefit from parallel exploration.
- `prompt-reviewer` → **skill**. Single file, focused review, no codebase exploration needed once prompt is externalized.

**6. If I could only have 3 slash commands.**

1. **`/wrap-session`** — the only thing that's actually maintained the project state file (handoff.md). Keep.
2. **`/verify-claims`** — addresses the single biggest doc-rot risk in this repo. Five docs claim things that aren't true. Run before publishing any doc change.
3. **`/audit-docs`** — the cyclical version of `/verify-claims`. Run monthly to catch drift before docs become five-piece liabilities.

I'd cut: `/load-nah` (SessionStart hook), `/sprint-from-plan` (sprints overkill), `/draft-adr` (rare enough that template-in-docs/adr/ works), `/next` and `/status` (broken until docs reorg).

**7. Existing workflow honest read.**

- **`/wrap-session` works** because it has a clean output target (handoff.md) and the structure is short enough to follow. The fact that handoff.md is the only fresh state doc in the repo is direct evidence.
- **`/next` and `/status` rotted** because they read upstream from `docs/memory.md` and `docs/build-plan.md`, both of which have rotted catastrophically (§2). The commands are well-written, the inputs are dead. Until the inputs are fixed, the commands are worse than nothing — they confidently produce wrong output. **Burn `/next` and `/status` down. Rebuild after MASTER_PLAN.md exists, against MASTER_PLAN as the input source. Don't leave the broken versions in place.**
- **`/audit` is too large to be invoked.** 20 KB of instructions, 9 sections, hundreds of checks. In practice, it gets run rarely if ever. The lesson: a slash command's value is bounded by how often it actually gets used. A 50-line `/quick-audit` would deliver more value than a 200-line `/audit` because it would actually run.
- **The duplication between `commands/` and `.claude/commands/`** is the kind of thing that suggests organic growth without a deliberate decision. Pick one location (`.claude/commands/`), delete the other, and move on.

**Warning based on observed usage:** the existing slash commands skew toward "do everything thoroughly" rather than "do the most important thing fast." Every new command added makes this worse — there's a temptation to add "and check X, and also Y, and also Z." Resist. The right move for new commands is one focused job each, output under 20 lines.

**8. Superpowers fit.** Mixed at best. Honest read:

- **What works**: code-reviewer agent (clean fit), writing-plans skill (good for new feature design), verification-before-completion (would catch the "shipped but untested" pattern from §3).
- **What doesn't**: TDD enforcement (no tests exist, retrofit is months of work), git-worktrees (incompatible with main-only deploys), subagent-driven-development (single operator, no team coordination value), brainstorming-as-mandatory (Corey already brainstorms in chat — adding a procedural layer slows him down).
- **Compounding bureaucracy risk**: this repo already has heavy procedural commands (`/audit` 20 KB, `/wrap-session` v1 13 steps, `/next` 4-step cross-reference). Adding Superpowers' mandatory workflows on top creates "process to manage process." Watch for this. The signal that you've over-installed: when the instruction-reading time exceeds the building time.

**Recommendation: cherry-pick.** Install Superpowers but disable the methodology-enforcing pieces (no mandatory TDD, no mandatory worktrees, no mandatory brainstorm). Keep the agent + a few skills. If that's not how Superpowers can be installed (full plugin only), pass entirely.

**9. Test coverage realistic path.**

Current state: 0 tests, no test runner, no CI test gate. Superpowers' TDD enforcement on a zero-test codebase is pure friction.

Realistic three-step path:
1. **Add 5-10 contract tests** for the highest-stakes paths: GHL retry/auth ([lib/ghl/client.ts:188](lib/ghl/client.ts#L188)), Scout tool-call loop ([lib/scout/client.ts:241](lib/scout/client.ts#L241)), scoring engine ([lib/intelligence/scoring.ts:37](lib/intelligence/scoring.ts#L37)), webhook dedup ([app/api/webhooks/ghl/route.ts:78](app/api/webhooks/ghl/route.ts#L78)). Use vitest. ~1 day's work.
2. **Add CI gate** that runs `npx tsc --noEmit` and `npm test` on PR. ~1 hour. (Setup-pre-commit will help locally; CI catches what local skipped.)
3. **TDD new features only.** Don't retrofit. Going forward, "every new feature ships with at least one test" is a sustainable norm. "Every existing line gets a test" is not.

After step 3, *then* Superpowers' TDD skill makes sense. Trying to enable it sooner means it screams about untested code on every edit, which trains the user to ignore it.

**10. Phase 2 sequencing — too much for one session?**

**Yes. Split.** Three sessions minimum:

- **Session A — Doc reorg (this is its own bear).** Delete `SESSION_START.md`, `docs/memory.md`, `docs/PROGRESS.md`. Rewrite `README.md` and `docs/architecture.md` (or replace with `docs/system-shape.md`). Create `docs/master-plan.md` and `docs/runbook.md`. Move `lib/*/schema.sql` into numbered migrations. Estimated: 4-6 hours of focused work.
- **Session B — Foundation tooling install.** git-guardrails, setup-pre-commit, generate Supabase types, add `.github/workflows/ci.yml`, add 5-10 contract tests. Estimated: 4-6 hours.
- **Session C — Custom skills.** `migration-safety-check`, `verify-claims`, `nah-context-load`, `new-adr`, `ghl-boundary-check`, `scout-tool-add`, `deploy-readiness`. Plus delete `/next`, `/status`, `commands/` duplicate, and the old `/audit`. Estimated: 4-6 hours.

Trying to do all three in one session means each gets the shallow version. The doc reorg alone is a session — the rest is built on top of it and doesn't make sense without it. Specifically: most custom skills depend on docs/master-plan.md existing as a reference target. Build the target first.

**Hard rule**: don't install Superpowers in Session B. Decide in Session C, after the foundation is in place and you can see whether the methodology fits. Defer-to-decide is cheaper than uninstall.

### 8.4 Final Recommendation

**Install order (high → low confidence):**

1. **`mattpocock/skills/git-guardrails-claude-code`** — install first. Highest ROI, smallest blast radius. Closes a real risk (production = main).
2. **`mattpocock/skills/setup-pre-commit`** — install second. Pairs with #1 to give a real local quality gate before push.
3. **Generate Supabase types** — `npx supabase gen types typescript`. Not a plugin; a one-shot fix to the largest type-safety hole.
4. **`.github/workflows/ci.yml`** — `tsc --noEmit + npm test` on PR.
5. **Hold on Superpowers.** Decide after Session A + Session B land. If by then you have 5+ tests, an ADR or two, and a working MASTER_PLAN, Superpowers might fit. If you don't, it won't.

**Build order for custom items (depend → independent):**

1. **`migration-safety-check` + PreToolUse(Edit) hook** — depends on numbered-migrations reorg from Session A. Highest-stakes custom.
2. **`nah-context-load` + SessionStart hook** — depends on `handoff.md` staying authoritative (which it already is). Build second.
3. **`verify-claims` skill + `/audit-docs` slash command** — depends on `docs/master-plan.md` existing as a reference target. Build after Session A.
4. **`code-reviewer` agent (NAH-customized)** — depends on having ADRs and a clean MASTER_PLAN to review against. Build third.
5. **`new-adr` skill** — independent. Build whenever the first sticky decision happens. Don't pre-build.
6. **`ghl-boundary-check` skill** — independent. Build alongside #1.
7. **`scout-tool-add` skill** — independent but lower-frequency. Build when next adding a Scout tool.
8. **`deploy-readiness` skill** — independent. Build after CI is in place (overlaps with CI checks; reuse the same logic).
9. **`migration-reviewer` agent** — independent. Build after #1's hook is proven.

**Defer / skip:**

- **Defer**: `prompt-reviewer` (until prompt is externalized), `improve-codebase-architecture` (until ADRs exist), `pr-summarizer` (until PR workflow exists), `call-rubric-validator` (until Phase 5).
- **Skip entirely**: `/sprint-from-plan`, `wrap-session-nah` skill (slash command works), `/load-nah` slash command (SessionStart covers), UserPromptSubmit DRC reminder (friction noise), `triage-issue` (workflow doesn't fit).

**What I'd add that wasn't proposed:**

- **A single `.claude/settings.json`** — none exists today. Should at minimum: declare hook list, set permission allowlist for safe Bash commands (`git status`, `git log`, `git diff`, `npx tsc --noEmit`, `npm test`, `ls`, `cat`), document the env var contract. The `fewer-permission-prompts` skill the user has access to globally would be the right tool to bootstrap this.
- **A `.claude/skills/README.md`** — index of installed skills, what each does, last-reviewed date. Skills rot like docs. An index forces awareness of what's installed.
- **A "delete dead infrastructure" pass** — `commands/` (root duplicate dir), `data/` (unclear purpose), `migration/` (orphaned), `CT Contact Master - Sheet1.csv` (579 KB), `next-env.d.ts.tsbuildinfo`, the old `/audit` and `/next` and `/status`. Half a kilogram of dead weight in the repo. Single PR, big psychological clarity.
- **An honest `CONTRIBUTING.md`** — what's the deploy flow (push to main → Vercel), what gates exist (tsc, soon CI), what doesn't (no PR review, no QA), what's the rollback path. Right now this is undocumented and lives in CLAUDE.md global preferences.

**The single most important thing in this section, if you only do one thing**: **install git-guardrails, then split the rest into separate sessions.** Everything else can wait. Nothing else can recover from `git push --force` to main.

---

*Section 8 added 2026-04-27 in response to tooling-stack scoping question. Sources: read of [.claude/](.claude/), `obra/superpowers` README, `mattpocock/skills` README, [blog.fsck.com/2025/10/09/superpowers/](https://blog.fsck.com/2025/10/09/superpowers/).*

---

*Generated by Claude Code on 2026-04-27. Source: read-through of repo HEAD on `main` (commit 277d6b6).*
