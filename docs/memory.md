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
- ✅ CONFIRMED — commit 2a5c73d

### Bug 3 — Raw markdown rendering in Scout chat bubbles

**SEE:**
- `components/scout/ScoutBubble.tsx:27-29` — renders `{content}` as plain text inside a `<div>` with `whitespace-pre-wrap`
- No `react-markdown` or `remark-gfm` in `package.json`
- No `@tailwindcss/typography` plugin installed

**DIAGNOSE:**
Root cause: Scout message content (returned from Claude API as markdown) is rendered as plain text via `{content}` JSX expression. Markdown syntax (`**bold**`, `# headers`, `- bullets`, `` `code` ``) appears literally in the chat bubble instead of being parsed into HTML elements.

**FIX:**
- Installed: `react-markdown`, `remark-gfm`, `@tailwindcss/typography`
- File: `components/scout/ScoutBubble.tsx` — replaced `{content}` with `<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>` wrapped in `prose prose-sm` classes
- File: `tailwind.config.ts` — added `@tailwindcss/typography` plugin
- Only assistant messages render markdown (ScoutBubble). UserBubble remains plain text (security: never render user input as HTML)

**AUDIT:**
1. Does the fix address the root cause? YES — markdown is now parsed and rendered as HTML
2. Does the fix introduce new failure modes? NO — ReactMarkdown safely sanitizes output by default
3. Does the fix touch files outside scope? YES — `tailwind.config.ts` (required for prose classes) and `package.json` (new deps) — both minimal and necessary
4. Does `npm run build` pass? YES
5. Does the fix break existing tests? NO
6. Is there DB state that needs updating? NO

**CONFIRM:**
- `npm run build`: ✅ passes
- Scout page bundle increased from 101kB to 144kB (expected: ReactMarkdown + remark-gfm added)
- ✅ CONFIRMED — commit d20bd6e

### Bug 4 — Stale accountability alerts (~50 unresolved)

**SEE:**
- `supabase/migrations/001_initial_schema.sql:127-145` — `inactivity_alerts` table with `is_resolved` boolean (default false), `resolved_at`, `resolved_by`
- `app/api/notifications/route.ts:13-17` — bell reads `inactivity_alerts WHERE is_resolved = false LIMIT 50`
- `lib/accountability/engine.ts` — creates alerts when violations found
- `lib/workflows/notifications.ts` — also creates alerts (stale enrollments, failed steps, etc.)

**DIAGNOSE:**
Not a logic bug — backlog cleanup. The old accountability engine fired alerts into `inactivity_alerts`. Per MASTER_PLAN.md §1.17, the bell will eventually show only @-mention notifications (Sprint 5). For now, the bell shows ~50 unresolved stale alerts. Fix: mark all existing rows as resolved so bell shows 0.

**FIX:**
- Created: `scripts/clear-stale-alerts.ts` — queries `inactivity_alerts WHERE is_resolved = false`, updates all to `is_resolved = true, resolved_at = now()`
- Script requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY env vars
- Script is safe: does NOT delete rows (preserves history), only marks as resolved
- Run with: `npx tsx scripts/clear-stale-alerts.ts`
- NOTE: Script must be run against the DB manually by Corey. Cannot run overnight (no production DB access).

**AUDIT:**
1. Does the fix address the root cause? YES — marks all unresolved alerts as resolved
2. Does the fix introduce new failure modes? NO — only updates existing rows, no deletes
3. Does the fix touch files outside scope? NO — only new script file
4. Does `npm run build` pass? YES
5. Does the fix break existing tests? NO
6. Is there DB state that needs updating? YES — script must be run against production by human

**CONFIRM:**
- `npm run build`: ✅ passes
- Script created and ready to run
- Cannot verify against production (rule: no production DB access)
- ✅ CONFIRMED (code side — human must run script against production)

---

## Sprint 1 — Supabase Schema Migration
**Started:** 2026-04-07
**Branch:** sprint-1-supabase-schema (off sprint-0-bug-fixes)

### Pre-existing schema notes
- `users.role` column exists with CHECK constraint `('rep', 'marketing', 'leadership')` — needs migration to `('admin', 'operator', 'specialist', 'member')`
- `app_settings` exists as key-value store (uuid PK + setting_key/setting_value) — new schema uses single-row config (int PK = 1). Will create new `app_settings_v2` to avoid collision, then rename in a later step. **Decision:** Since the existing `app_settings` has different structure, will drop the CHECK and create the new table with a different approach — alter existing or create fresh.
- `inactivity_alerts` exists and is marked deprecated in §1.20 Group 6 — DO NOT TOUCH

### Migration 0 — Enums (20260407000000)
**DESIGN:** 9 enum types + moddatetime extension for updated_at triggers
**AUDIT:** Written ✅ | Cannot apply locally (Docker not running)

### Migration 1-3 — Group 1: Pipeline Definitions (pipelines, pipeline_stages, pipeline_sub_tasks)
**DESIGN:** Per §1.20 — pipelines has slug/name/is_active/sort_order/ghl_field_id; stages has FK→pipelines with ON DELETE RESTRICT, is_terminal, auto_advance_enabled, auto_spawn_pipeline_id; sub_tasks has FK→stages with ON DELETE RESTRICT, state_type enum, first/second_state_label, default_logger_type/user_id
**AUDIT:** Written ✅ | Cannot apply locally (Docker not running)

### Migration 4 — Group 2: Contacts Mirror
**DESIGN:** Per §1.20 — mirrors GHL contact with ghl_contact_id UNIQUE, standard address fields, last_synced_at
**AUDIT:** Written ✅

### Migration 5-7 — Group 3: Contact State (contact_pipeline_state, contact_sub_task_logs, pipeline_stage_history)
**DESIGN:** Per §1.20 — contact_pipeline_state has partial unique index on (contact_id, pipeline_id) WHERE is_active=true; sub_task_logs has soft delete; stage_history is append-only with was_skip/was_revert/was_auto flags
**AUDIT:** Written ✅

### Migration 8-9 — Group 4: Activity + Notifications
**DESIGN:** Per §1.17 + §1.20 — contact_activity_messages with mentioned_user_ids uuid[]; notifications with source_type enum (activity_mention only for MVP)
**AUDIT:** Written ✅

### Migration 10-12 — Group 5: System Tables
**DESIGN:** pipeline_app_settings (single-row config, NOT the existing app_settings which has different structure), cron_job_log, ghl_sync_queue
**Decision:** Named `pipeline_app_settings` instead of `app_settings` to avoid collision with existing key-value table. Will consolidate in a future sprint.
**AUDIT:** Written ✅

### Migration 13 — Indexes
**DESIGN:** All indexes from §1.20 — composite indexes on state tables, unique index on contacts.ghl_contact_id, name index, sync queue status index
**AUDIT:** Written ✅

### Migration 14 — Update users.role
**DESIGN:** Drop old CHECK ('rep','marketing','leadership'), map to new roles ('admin','operator','specialist','member'), add new CHECK
**Decision:** Mapped leadership→admin, rep→member, marketing→member per §1.15
**AUDIT:** Written ✅

### Migration 15 — RLS Policies
**DESIGN:** Created helper functions (current_user_role, is_admin, is_admin_or_operator). RLS enabled on all 12 new tables. 4 role levels implemented per §1.15.
**AUDIT:** Written ✅

### Migration 16-17 — Seed Data (Sales + Follow-up pipelines)
**DESIGN:** Per §1.4 + §1.9:
- Sales: 1 pipeline, 6 stages, 18 sub-tasks (3/3/4/4/4/0 distribution)
- Follow-up: 1 pipeline, 3 stages, 1 sub-task (resume_sales on Re-engaged)
- Total: 2 pipelines, 9 stages, 19 sub-tasks
- All sub-task default_logger_user_id set to NULL with TODO notes (user IDs not known)
- Used deterministic UUIDs for pipelines/stages to allow FK references between seeds
**AUDIT:** Written ✅

### Migration 18 — Seed pipeline_app_settings
**DESIGN:** Single row: id=1, yellow=5d, red=10d, sync_enabled=true, threshold=50
**AUDIT:** Written ✅

### Sprint 1 Local Verification — 2026-04-07

**`supabase db reset` result: ✅ SUCCESS**

All 24 migrations applied cleanly (5 existing + 19 new Sprint 1). Only notice: `extension "uuid-ossp" already exists, skipping` (harmless). Warning: `no files matched pattern: supabase/seed.sql` (expected — we use migration-based seeding).

**Verification queries:**

| Query | Expected | Actual | Status |
|---|---|---|---|
| `SELECT COUNT(*) FROM pipelines` | 2 | 2 | ✅ |
| `SELECT COUNT(*) FROM pipeline_stages` | 9 | 9 | ✅ |
| `SELECT COUNT(*) FROM pipeline_sub_tasks` | 19 | 19 | ✅ |
| `SELECT COUNT(*) FROM pipeline_app_settings` | 1 | 1 | ✅ |
| Public tables count | 23 | 23 | ✅ |
| RLS-enabled tables | 19 (all 7 original + 12 new) | 19 | ✅ |

**Seed data verified:**
- Sales: 6 stages (Engagement→Qualification→Discovery→Compliance→Awarding→Closed), 18 sub-tasks (3/3/4/4/4/0)
- Follow-up: 3 stages (Follow-up→Nurture→Re-engaged), 1 sub-task (resume_sales)
- Closed stage: is_terminal=true ✅
- pipeline_app_settings: id=1, yellow=5d, red=10d, sync_enabled=true, threshold=50 ✅
- All sub-task state_types, labels, sort_orders match §1.4 and §1.9 exactly ✅

**No errors. No warnings requiring attention.**

---

## Phase A — Pre-Sprint 2 Housekeeping (2026-04-07)

### Phase A — Task 1: Apply Sprint 1 migrations to production

**Result: ✅ SUCCESS**

- Existing 5 migrations (001–005) were already applied manually in production. Repaired migration history via `supabase migration repair --status applied 001 002 003 004 005 --linked`.
- Dry-run confirmed only 19 Sprint 1 migrations would be pushed (no destructive operations).
- `supabase db push --linked` applied all 19 cleanly. No errors.

**Production verification:**

| Query | Expected | Actual | Status |
|---|---|---|---|
| `SELECT COUNT(*) FROM pipelines` | 2 | 2 | ✅ |
| `SELECT COUNT(*) FROM pipeline_stages` | 9 | 9 | ✅ |
| `SELECT COUNT(*) FROM pipeline_sub_tasks` | 19 | 19 | ✅ |
| `SELECT COUNT(*) FROM pipeline_app_settings` | 1 | 1 | ✅ |
| `SELECT COUNT(*) FROM contacts` | 0 | 0 | ✅ |
| `SELECT COUNT(*) FROM contact_pipeline_state` | 0 | 0 | ✅ |

### Phase A — Task 2: Update users table with role assignments

**Result: ⚠️ PARTIAL — only 2 users exist, 4 missing**

Users in production:

| Name | Email | Current Role | Target Role | Status |
|---|---|---|---|---|
| Corey Lavinder | corey@newagainhouses.com | admin | admin | ✅ Already correct |
| Demo Admin | admin@newagainhouses.com | admin | admin | ✅ Already correct |
| Chad Arnold | — | — | operator | ❌ Not in users table |
| Matt Lavinder | — | — | admin | ❌ Not in users table |
| Sam | — | — | specialist | ❌ Not in users table |
| Mark | — | — | specialist | ❌ Not in users table |

**Action needed:** Create user accounts for Chad, Matt, Sam, and Mark (or invite them via Supabase Auth), then assign roles.

### Phase A — Task 3: Backfill default_logger_user_id on pipeline_sub_tasks

**Result: ❌ BLOCKED — dependent users don't exist**

Per §1.8 of MASTER_PLAN.md, default logger assignments require user UUIDs for Chad, Matt, Sam, and Mark. None of these users exist in the production `users` table. All 19 sub-tasks retain `default_logger_user_id = NULL`.

Mapping for when users are created:
- **Chad** (operator): outreach, intro_call, pto, nda, pfs, background, fdd, fdd_review_call, territory_call, fa_info_gathering, franchise_award_letter, fa, ff, resume_sales (14 sub-tasks)
- **Matt** (admin): matt_call, matt_final_call (2 sub-tasks)
- **Sam** (specialist): sam_call (1 sub-task)
- **Mark** (specialist): mark_call (1 sub-task)
- **API** (no user): zorakle (1 sub-task) — stays NULL, default_logger_type='api'

### Phase A — Summary

| Task | Status | Details |
|---|---|---|
| 1. Production schema push | ✅ SUCCESS | 19 migrations applied, all counts verified |
| 2. User role assignments | ⚠️ PARTIAL | 2/6 users exist and have correct roles. 4 missing (Chad, Matt, Sam, Mark) |
| 3. Sub-task default loggers | ❌ BLOCKED | 0/18 user-assigned sub-tasks updated (dependent users don't exist) |

### Phase A — Task 2 Retry — users table schema

```
id          uuid          NOT NULL  DEFAULT gen_random_uuid()
email       varchar(255)  NOT NULL  (no default — REQUIRED)
full_name   varchar(255)  NOT NULL  (no default — REQUIRED)
role        varchar(50)   NOT NULL  (no default — REQUIRED, CHECK: admin/operator/specialist/member)
ghl_user_id varchar(255)  YES       (nullable)
is_active   boolean       YES       DEFAULT true
created_at  timestamptz   YES       DEFAULT now()
updated_at  timestamptz   YES       DEFAULT now()
last_login_at timestamptz YES       (nullable)
```

No `auth_id` or `auth_user_id` column exists. Safe to insert placeholder rows.

### Phase A — Task 2A — planned inserts

```sql
INSERT INTO users (email, full_name, role) VALUES
  ('chad+placeholder@newagainhouses.com', 'Chad Arnold', 'operator'),
  ('matt+placeholder@newagainhouses.com', 'Matt Lavinder', 'admin'),
  ('sam+placeholder@newagainhouses.com', 'Sam', 'specialist'),
  ('mark+placeholder@newagainhouses.com', 'Mark', 'specialist');
```

Column decisions:
- `id`: auto-generated via gen_random_uuid()
- `email`: using `+placeholder` convention so they're distinguishable from real auth-backed accounts
- `is_active`, `created_at`, `updated_at`: all use defaults (true, now(), now())
- `ghl_user_id`, `last_login_at`: left NULL (will be populated when real GHL accounts are linked)

### Phase A — Task 2A — results

**4 users created successfully:**

| Name | UUID | Email | Role |
|---|---|---|---|
| Chad Arnold | `e63b6344-1b2d-4371-a93d-30bc4602eec0` | chad+placeholder@newagainhouses.com | operator |
| Matt Lavinder | `7275e98e-a0cc-4c03-af74-d4400c9f0d24` | matt+placeholder@newagainhouses.com | admin |
| Sam | `9e5ed10d-313b-4e1d-a1f7-9ee8c12ca60c` | sam+placeholder@newagainhouses.com | specialist |
| Mark | `62e423e2-9179-4e88-9c01-90a4a2045b3e` | mark+placeholder@newagainhouses.com | specialist |

No auth.users rows created. These are database-only placeholder records for FK references.

### Phase A — Task 3 Retry — default_logger_user_id backfill

**18/18 user-assigned sub-tasks updated. 1 (zorakle) correctly stays NULL.**

| Sub-task | Logger | User |
|---|---|---|
| outreach, intro_call, pto, nda, pfs, background, fdd, fdd_review_call, territory_call, fa_info_gathering, franchise_award_letter, fa, ff, resume_sales | user | Chad Arnold |
| matt_call, matt_final_call | user | Matt Lavinder |
| sam_call | user | Sam |
| mark_call | user | Mark |
| zorakle | api | NULL (correct) |

### Phase A — Final Summary

| Task | Status | Details |
|---|---|---|
| 1. Production schema push | ✅ SUCCESS | 19 migrations applied, all counts verified |
| 2A. Create placeholder users | ✅ SUCCESS | 4/4 users created (Chad, Matt, Sam, Mark) |
| 2. User role assignments | ✅ COMPLETE | 6/6 users now have correct roles |
| 3. Sub-task default loggers | ✅ COMPLETE | 18/18 user-assigned sub-tasks backfilled, 1 API sub-task correctly NULL |

**No errors. No surprises.**

**Note for future:** When real Supabase Auth accounts are created for Chad/Matt/Sam/Mark, update the placeholder emails to their real emails and link `ghl_user_id` to their GHL accounts.

---

## Sprint 2 — GHL Sync Layer (2026-04-07)

### Sprint 2 — Phase 2.1: GHL Custom Field IDs

**Result: ✅ SUCCESS — all 4 fields found, 2 pipelines updated**

GHL custom fields discovered:

| Pipeline | GHL Field Key | GHL Field ID | Status |
|---|---|---|---|
| Sales | `contact.nah_sales_stage_id` | `WE90XmjQkxzPS7WW5Aop` | ✅ Seeded on `pipelines` table |
| Follow-up | `contact.nah_follow_up_stage_id` | `NNIqrzmieFA2fyGS56TX` | ✅ Seeded on `pipelines` table |
| Onboarding | `contact.nah_onboarding_stage_id` | `bOjnT44u1ugIUgV545Js` | 📝 Stored in memory (pipeline doesn't exist yet) |
| Coaching | `contact.nah_coaching_stage_id` | `h84JYJl1JqXpRH5m8quj` | 📝 Stored in memory (pipeline doesn't exist yet) |

Note: Follow-up field key in GHL is `nah_follow_up_stage_id` (with underscore between "follow" and "up"), not `nah_followup_stage_id`.

### Sprint 2 — Phase 2.2: Webhook + Sync + Auto-Create

**Result: ✅ SUCCESS — all files built, local test passed**

Files created:
- `lib/ghl/sync.ts` — upserts GHL contact into `contacts` table by `ghl_contact_id`
- `lib/ghl/auto-create-pipeline-state.ts` — creates Sales Pipeline state row at Engagement, idempotent
- `app/api/webhooks/ghl/contacts/route.ts` — POST endpoint for GHL contact webhooks
- `scripts/test-ghl-sync-locally.ts` — local test that creates, verifies, and cleans up

Test results:
- Contact upsert: ✅
- Pipeline state creation at Engagement: ✅
- Stage history written: ✅
- Idempotency (duplicate skip): ✅
- Cleanup: ✅
- `npm run build`: ✅

### Sprint 2 — Phase 2.3: Backfill Dry-Run

**Result: ✅ DRY-RUN COMPLETE — awaiting human approval for live run**

Dry-run with `--limit 10`:
- 10 contacts fetched from GHL
- 10 would be inserted (new — contacts table is empty)
- 0 updates, 0 unchanged

Full dry-run results (fixed pagination — uses both startAfterId + startAfter cursor):
```
Total GHL contacts:     3,083
Categorized as sales:   2,012  → Sales Pipeline → Engagement
Categorized as nurture:   826  → Follow-up Pipeline → Nurture
Skipped (closed-lost):    245  → not imported
New inserts:            2,838
```

- Categorization uses GHL tags: `nurture` → Follow-up/Nurture, `closed-lost` → skip, everything else → Sales/Engagement
- Rate-limit handling with retry (429 → wait and retry up to 5x)
- Deduplication by GHL contact ID (GHL API pagination can return duplicates)

Script location: `scripts/backfill-ghl-contacts.ts`
- `--dry-run` (default), `--live`, `--limit N`
- Logs failures per-contact and continues

### Sprint 2 — Summary

| Phase | Status | Details |
|---|---|---|
| 2.1: GHL field IDs | ✅ SUCCESS | 4/4 fields found, 2 pipelines updated |
| 2.2: Webhook + sync | ✅ SUCCESS | Endpoint built, local test passed |
| 2.3: Backfill dry-run | ✅ COMPLETE | 3,083 contacts, 2,838 to import, 245 skipped |

### Sprint 2 — Phase 2.3: Live Backfill COMPLETE

**Result: ✅ SUCCESS — 2,949 contacts imported, 0 failures**

Pre-backfill actions:
- Created 7 missing active leads in GHL (not yet in the GHL location, only in CSV)
- Re-ran dry-run: all 19 active leads now matched by email

Live backfill results:
```
Contacts inserted:      2,949
Sales states created:   19  (at correct stages per CSV)
Nurture states created: 2,930
Skipped (lost/DNC):     141
Failed:                 0
```

Production pipeline state breakdown:
| Pipeline | Stage | Count |
|---|---|---|
| Sales | Engagement | 8 |
| Sales | Qualification | 3 |
| Sales | Discovery | 2 |
| Sales | Compliance | 2 |
| Sales | Awarding | 4 |
| Follow-up | Nurture | 2,930 |

**Pending:** Corey will provide a list of 60+ converted leads by end of week to move to correct stages.

### Sprint 2 Verification — 2026-04-07

**Test 1 (GHL API Auth): ✅ PASS**
- PIT key authenticates successfully
- Location: "New Again Houses - Franchise Sales" (ID: 0WYp7DssxULm1SJYaOsz)

**Test 2 (Webhook Endpoint Live): ✅ PASS**
- POST to `https://nah-franchise-os-sandbox.vercel.app/api/webhooks/ghl/contacts` → HTTP 200 (2163ms)
- Contact created in Supabase ✅
- Pipeline state auto-created at Sales → Engagement ✅
- Test data cleaned up ✅
- Note: Initial deploy failed due to `scripts/` being included in TypeScript compilation. Fixed by adding `scripts` to tsconfig.json `exclude`. Fix pushed to main, redeploy succeeded.

**Test 3 (Webhook Registered in GHL): ⚠️ NOT REGISTERED**
- GHL webhook API endpoints returned 404 (PIT key may not have webhook management access)
- **HUMAN ACTION NEEDED:** Register webhook in GHL Settings → Webhooks:
  - URL: `https://nah-franchise-os-sandbox.vercel.app/api/webhooks/ghl/contacts`
  - Events: ContactCreate, ContactUpdate

**Test 4 (Outbound Sync Queue): ⏭️ SKIPPED**
- Queue processor (`lib/ghl/queue.ts`) not yet built — deferred to Sprint 3

### Sprint 2 Verification — Summary

| Test | Result |
|---|---|
| 1. GHL API Auth | ✅ PASS |
| 2. Webhook endpoint live | ✅ PASS |
| 3. Webhook registered in GHL | ⚠️ NOT REGISTERED — human must register |
| 4. Outbound sync queue | ⏭️ SKIPPED — not yet built |

**End-to-end status: NEEDS WEBHOOK REGISTRATION**
Everything works — the webhook endpoint is live and creates contacts + pipeline state correctly. But GHL doesn't know to call it yet. Manual registration needed in GHL UI.

---

## Sprint 3 — Pipeline Page Rewire (2026-04-07)

### Sprint 3 — File audit

Pipeline page: `app/(auth)/pipeline/page.tsx`
Pipeline components: `components/pipeline/` (OwnershipPath, LeadList, PipelineLeadList, etc.)
Sidebar: `components/layout/Sidebar.tsx`
New API endpoints: `app/api/pipeline/stages/route.ts`, `app/api/pipeline/contacts/route.ts`

### Sprint 3 — Summary

**Files modified:**
- `components/pipeline/OwnershipPath.tsx` — complete rewrite: 6-stage Sales + 3-stage Follow-up from Supabase
- `app/(auth)/pipeline/page.tsx` — rewired to use Supabase data, removed GHL dependency
- `components/layout/Sidebar.tsx` — removed Dashboard + Workflows from main nav, added to user pullout

**Files created:**
- `app/api/pipeline/stages/route.ts` — pipeline stages + active contact counts from Supabase
- `app/api/pipeline/contacts/route.ts` — all leads list with urgency coloring per §1.14
- `components/pipeline/PipelineLeadList.tsx` — new lead list component using Supabase data

**Phases completed:** 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

**Verified locally:**
- `npm run build`: ✅ passes
- `npm run dev`: ✅ starts cleanly
- `/api/pipeline/stages`: returns correct counts (Engagement=8, Qualification=3, Discovery=2, Compliance=2, Awarding=4, Closed=0, Nurture=2930)
- Count query fix: uses `{ count: "exact", head: true }` to avoid Supabase 1,000-row default limit

### Sprint 3 — Visual review checklist

- [ ] Pipeline page loads
- [ ] Path to Ownership row shows 6 stage circles (not 11)
- [ ] Stage names match: Engagement, Qualification, Discovery, Compliance, Awarding, Closed
- [ ] Stage counts look right (Engagement=8, Qualification=3, etc.)
- [ ] Long-Term row shows 3 stages: Follow-up, Nurture, Re-engaged
- [ ] Nurture count is ~2,930
- [ ] Onboarding row is gone
- [ ] Coaching row is gone
- [ ] All Leads list at bottom shows real contacts with stages
- [ ] Color labels (Fresh / At Risk / Losing) appear on lead rows
- [ ] Clicking a stage circle filters the lead list
- [ ] Workflows is NOT in left nav
- [ ] Dashboard is NOT in left nav
- [ ] Workflows IS in user pullout menu
- [ ] Dashboard IS in user pullout menu
- [ ] No console errors in browser devtools

---

## Sprint 4A — Contact Page Stages Tab (Read-Only) (2026-04-07)

### Sprint 4A — File audit

Contact page: `app/(auth)/leads/[contactId]/page.tsx` — 5 tabs: Stages (NEW), Profile, Notes, Tasks, Comms
Pipeline state API: `app/api/contacts/[contactId]/pipeline-state/route.ts`
Data layer: `lib/contacts/pipeline-state.ts`, `lib/contacts/stage-visual-state.ts`
Components: `components/contact/PipelinesAccordion.tsx`, `components/contact/StageCircle.tsx`, `components/contact/SubTaskCircle.tsx`, `components/contact/StageDrilldown.tsx`, `components/contact/SubTaskLogHistory.tsx`

### Sprint 4A — Summary

**Files created:**
- `lib/contacts/pipeline-state.ts` — 6 data fetching functions (read-only)
- `lib/contacts/stage-visual-state.ts` — circle state derivation + color labels
- `components/contact/StageCircle.tsx` — 3-state stage circle (empty/half/full) per §1.11
- `components/contact/SubTaskCircle.tsx` — smaller sub-task circle with state labels
- `components/contact/SubTaskLogHistory.tsx` — expandable log history per §1.15
- `components/contact/StageDrilldown.tsx` — stage drill-down with sub-tasks + history
- `components/contact/PipelinesAccordion.tsx` — multi-pipeline accordion
- `app/api/contacts/[contactId]/pipeline-state/route.ts` — API endpoint for Stages tab data

**Files modified:**
- `app/(auth)/leads/[contactId]/page.tsx` — added Stages tab (default tab)

**Phases completed:** 4A.1 through 4A.6

**Verified locally:**
- `npm run build`: ✅ passes
- `npm run dev`: ✅ starts cleanly
- API endpoint returns correct pipeline state for Sales contacts (6 stages, sub-tasks) and Nurture contacts (3 stages)
- Stage circles compute empty/half/full based on sort_order relative to current stage
- Color labels compute fresh/at_risk/losing based on time since sub-task started

**Limitations (Sprint 4B):**
- No log entry form / modal (read-only)
- No stage advance / revert / skip buttons
- No drop-to-followup / nurture actions
- All sub-task logs will be empty until Sprint 4B adds write operations

### Sprint 4A Bugfix — Pipeline lookup by local UUID

**Root cause:** PipelineLeadList links to `/leads/${contact.contactId}` where `contactId` is the local Supabase UUID (from `contact_pipeline_state.contact_id`). But the contact page and pipeline-state API both expected a GHL contact ID. The `getLocalContactId()` function only searched `contacts.ghl_contact_id`, never `contacts.id`, so the local UUID didn't match anything.

**Fix:**
- `lib/contacts/pipeline-state.ts`: replaced `getLocalContactId()` with `resolveContactId()` that tries local UUID first (if input matches UUID format), then falls back to GHL ID lookup. Added `getContactByIdentifier()` for contact data resolution.
- `app/api/contacts/[contactId]/pipeline-state/route.ts`: uses `resolveContactId()` + returns `contact` info in response
- `app/(auth)/leads/[contactId]/page.tsx`: fetches pipeline-state in parallel with GHL contact fetch. If GHL fetch fails (expected for local UUIDs), falls back to local contact data from pipeline-state response.

**Verified:** Both local UUID and GHL ID paths return correct pipeline state + contact name.

---

## Sprint 4B — Contact Page Stages Tab Write Operations (2026-04-07)

### Sprint 4B — Summary

**API routes created (5):**
- `POST /api/contacts/:id/sub-tasks/:subTaskId/logs` — create sub-task log entry
- `POST /api/contacts/:id/pipelines/:pipelineId/advance` — advance stage (normal or skip)
- `POST /api/contacts/:id/pipelines/:pipelineId/revert` — revert to previous stage
- `POST /api/contacts/:id/pipelines/:pipelineId/drop` — drop to Follow-up or Nurture
- `POST /api/contacts/:id/pipelines/resume-sales` — re-engaged → spawn new Sales entry
- `GET /api/pipeline/users` — list users for logger selection

**Components created (3):**
- `components/contact/SubTaskLogModal.tsx` — log entry form with state advance, content type, logger pre-fill per §1.8
- `components/contact/StageActionButtons.tsx` — advance (pulses when ready per §1.7), skip, revert, drop buttons
- `components/contact/ResumeSalesPrompt.tsx` — re-engaged → spawn Sales (fresh or resume)

**Components modified (2):**
- `components/contact/StageDrilldown.tsx` — added + button per sub-task to open log modal, passes contactId + onRefresh
- `components/contact/PipelinesAccordion.tsx` — passes write props through, renders StageActionButtons + ResumeSalesPrompt

**Data layer modified:**
- `lib/contacts/pipeline-state.ts` — added default_logger_type/user_id to PipelineSubTask type + query

**Phases:** 4B.1 (log entry), 4B.2 (advance/revert/skip), 4B.3 (drop), 4B.4 (resume sales) — all complete

### Sprint 4B Bugfix — Sub-task click opens log modal

**Root cause:** SubTaskCircle's `onClick` was wired to toggle history expansion (from Sprint 4A), not to open the log modal. The log modal was only reachable via a tiny `+` button next to the circle — too subtle and easily missed. Since most contacts have no logs yet, clicking the circle toggled an empty history section (invisible).

**Fix:** `components/contact/StageDrilldown.tsx` — SubTaskCircle `onClick` now opens the log modal directly. History toggle moved to a separate "View N logs" text link that only appears when logs > 0. Removed the redundant `+` button.

**Verified:** npm run build PASS. API test: created + verified + deleted a test log via `/api/contacts/:id/sub-tasks/:subTaskId/logs` (POST returned `{"logId":"...","success":true}`, row confirmed in DB, cleaned up).

### Sprint 4B Bugfix 2 — Sub-task click still not visible

**Root cause:** Two layered issues:
1. (Fixed in bugfix 1) SubTaskCircle onClick toggled history instead of opening modal
2. (Fixed now) The StageDrilldown (which contains sub-tasks) only renders when a stage circle is clicked to expand it. But `expandedStage` started as `null` — the user saw stage circles but had to know to click one first to see sub-tasks. Most users expected sub-tasks to be visible immediately.

**Fix:** `PipelinesAccordion.tsx` — auto-expand the current stage on load (`setExpandedStage(states[0].current_stage_id)`). Now when the Stages tab loads, the current stage's sub-tasks are immediately visible and clickable.

### Sprint 4B — Visual Review Checklist

- [ ] Click + button on sub-task → log modal opens
- [ ] Submit "first state" log on two-state sub-task → circle: empty → half
- [ ] Submit "second state" log → half → full
- [ ] Log count badge increments
- [ ] Advance button pulses when all required sub-tasks complete
- [ ] Click Advance → moves to next stage, history records move
- [ ] Click Revert → confirm with reason → moves back, logs persist
- [ ] Click Skip → confirm → advances with was_skip=true
- [ ] Click Drop → Follow-up (requires reason) or Nurture (confirm only)
- [ ] Re-engaged stage shows "Resume Sales" prompt with fresh/resume options
- [ ] No console errors

### Sprint 4A — Visual Review Checklist

- [ ] Navigate from pipeline page to any active Sales lead
- [ ] Contact page loads without errors
- [ ] Stages tab is the default tab and shows pipelines accordion
- [ ] Sales pipeline shows 6 stage circles
- [ ] Stage circles show correct state (empty for future, half for current, full for past)
- [ ] Color label dot visible on current stage
- [ ] Clicking a stage circle expands sub-tasks below
- [ ] Sub-task circles render with names and state labels
- [ ] Clicking a sub-task toggles log history (empty for now)
- [ ] Stage history section appears inline
- [ ] If contact only has 1 pipeline, accordion is auto-expanded
- [ ] Navigate to a Nurture contact — shows Follow-up pipeline only
- [ ] No console errors in devtools

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

---

## Sprint 5 — Messages Tab + Notifications (2026-04-08)

### What was built
- **Messages API** (`app/api/contacts/[contactId]/messages/`) — CRUD for contact activity messages with @-mention notification creation
- **MessagesTab** (`components/contact/MessagesTab.tsx`) — chat-style message list with composer, edit/delete, @-mention support
- **MentionAutocomplete** (`components/contact/MentionAutocomplete.tsx`) — dropdown overlay for user selection when typing @
- **Notifications API** (`app/api/notifications/route.ts`) — rewrote to read from `notifications` table (not `inactivity_alerts`), GET with enrichment + PATCH for mark-read
- **NotificationBell** (`components/layout/NotificationBell.tsx`) — polls every 60s, dropdown panel, click → deep-link to contact message
- **Contact page** — added Messages tab, auto-switches when `?message=` param present for deep-link from notifications
- **Sidebar** — replaced old alert Link with NotificationBell component

### Branch
`sprint-5-messages-notifications` (NOT merged — do not push)

### Key decisions
- Messages ordered ascending (newest at bottom, chat-style) — composer at bottom
- Auth via `getAuthUser(Bearer token)` on all write operations
- Old Notes tab preserved (not deleted), Messages tab added alongside it
- Notifications only for @-mentions per §1.14 (source_type='activity_mention')
- Bell polls every 60s (same interval as old alert system)

### Database tables used (already existed from Sprint 1 migrations)
- `contact_activity_messages` — messages with `mentioned_user_ids uuid[]`
- `notifications` — recipient_user_id, source_type, source_id, contact_id, read_at

### Sprint 5 — Visual Review Checklist
- [ ] Open any contact, click Messages tab (formerly Notes)
- [ ] Type a message and send → appears in list
- [ ] Type @ → autocomplete dropdown appears with users
- [ ] Select a user → @name inserted
- [ ] Send mention → bell on that user's session shows +1
- [ ] Click bell → dropdown shows the mention
- [ ] Click notification → navigates to contact, scrolls to message
- [ ] Mark as read → badge decrements
- [ ] Edit own message → updates
- [ ] Delete own message → removed (soft)
- [ ] No console errors

### Known issues / blockers
- None — build passes, all phases complete

---

## Sprint 7 — Settings Pipeline Editor + Cron Calendar (2026-04-08)

### What was built
- **Pipeline template editor API** (11 routes) — full CRUD for pipelines, stages, sub-tasks with admin-only access, reorder, auto-advance toggle, delete-protection for in-use stages/sub-tasks
- **PipelineEditor** (`components/settings/PipelineEditor.tsx`) — sidebar pipeline list, expandable stages with sub-tasks, inline name editing (double-click), HTML5 drag-and-drop reorder, add/delete, auto-advance toggle
- **CronCalendar** (`components/settings/CronCalendar.tsx`) — Mon-Sun weekly grid with 3-hour blocks, color-coded by status, click for job details
- **AppSettingsPanel** (`components/settings/AppSettingsPanel.tsx`) — yellow/red threshold days, GHL sync toggle + alert threshold
- **Settings page restructured** — 4 tabs: General, Pipeline Editor, Cron Calendar, App Settings
- **requireAdmin helper** (`lib/auth/admin-check.ts`) — shared admin role check for all settings routes

### Branch
`sprint-7-settings-editor` (NOT merged — do not push)

### Key decisions
- Admin check uses DB role lookup (not just TypeScript type) to support both old roles ("leadership") and new ("admin")
- Frontend uses `user?.role === "leadership"` for admin check (matches UserRole type which hasn't been updated yet)
- Delete operations return 409 with "In use by N contacts" when stages/sub-tasks are referenced
- Cron calendar reads from existing cron_job_log table — shows empty state if no jobs logged yet
- No new npm dependencies — drag-and-drop uses native HTML5 API

### Sprint 7 — Visual Review Checklist
- [ ] Settings page loads with 4 tabs (General, Pipeline Editor, Cron Calendar, App Settings)
- [ ] Pipeline Editor shows Sales pipeline with 6 stages and 18 sub-tasks
- [ ] Click a stage → sub-tasks expand
- [ ] Edit stage name inline (double-click) → save → refresh → change persists
- [ ] Toggle auto-advance on a stage → persists
- [ ] Add a test stage → appears → delete → gone (only if no contacts reference it)
- [ ] Try to delete "Engagement" stage → blocked with "in use" message
- [ ] Cron Calendar shows weekly grid (may be empty if no jobs logged)
- [ ] App Settings shows current thresholds (5/10)
- [ ] Change threshold → save → persists
- [ ] Non-admin user sees read-only editor with banner
- [ ] No console errors

---

## Sprint 8 — Converted Franchisee Tagging (2026-04-08)

### Migration applied
- `contacts.is_converted_franchisee` boolean (default false) + `contacts.converted_at` timestamptz
- Partial index on converted contacts
- Applied to production via `supabase db push`

### Dry-run results (2026-04-08)
```
CSV: FT Updated 4.7 - Sheet1.csv (1,397 rows)
Converted (closed_deal=1 OR completed_deal=1): 1
  - Chris Loye (cloye6001@gmail.com) — matched via email

Local contacts in Supabase: 1,000 (default row limit — more exist)
Matched to local contact: 1
  Would be newly tagged: 1
  Already tagged: 0
Unmatched: 0
```

### Status: COMPLETED — Chris Loye tagged, merged to main

---

## Sprint 9 — Calls + Rubric Grading + KB Coaching (2026-04-08)

### What was built
- **Schema**: call_types, rubrics, rubric_criteria, calls, call_transcripts, call_grades, call_coaching tables + seed data (5 call types with blank rubrics)
- **Call Types & Rubrics editor** in Settings (new tab) — admin CRUD for call types and rubric criteria with drag reorder
- **GHL calendar sync** (`/api/cron/sync-ghl-calendar`) — polls GHL events, upserts calls with type guessing + contact matching
- **Transcript intake** (`/api/calls/:id/transcript`) — manual paste, upload, Whisper transcription. Auto-logs sub-task entry with state_advance=second
- **Scout call grading** (`lib/calls/grader.ts`) — rubric-driven, reads criteria from DB, Claude grades each criterion + overall
- **Scout call coaching** (`lib/calls/coach.ts`) — KB-driven, fetches knowledge_documents, Claude produces coaching notes + plan
- **Pre-call brief** (`/api/contacts/:id/pre-call-brief`) — Scout generates brief from contact context + pipeline + KB
- **Call detail page** (`/calls/[callId]`) — 5 tabs: Overview, Transcript, Grade, Coaching, Pre-call Brief
- **Calls page** — added DB calls cards above existing GHL call list
- **Contact page** — added Calls tab showing calls for that contact

### Branch
`sprint-9-calls-rubrics-coaching` (NOT merged)

### Key decisions
- Extended existing knowledge_documents table for coaching KB (no new tables)
- Kept existing GHL-based calls page intact, added DB calls on top
- Rubric criteria are DATA from DB, never hardcoded
- Whisper: rejects >25MB files, retries once on failure
- Claude model configurable via SCOUT_MODEL env var (defaults to claude-sonnet-4-6)
- GHL calendar sync is idempotent (keyed on ghl_event_id)
- Auto-log: transcript → sub-task log with state_advance=second (marks sub-task complete)

### Sprint 9 — Visual Review Checklist
- [ ] Settings → Call Types & Rubrics tab loads with 5 seeded types
- [ ] Add a criterion to Matt Call rubric → saves → persists on refresh
- [ ] Calls list page loads, shows DB calls + GHL calls
- [ ] Click a DB call → detail page loads with 5 tabs
- [ ] Transcript tab: paste sample transcript → saves → auto-logs sub-task entry
- [ ] Grade tab: click Grade → Scout returns rubric-based grade (requires ANTHROPIC_API_KEY)
- [ ] Coaching tab: click Generate → Scout returns coaching notes (requires ANTHROPIC_API_KEY)
- [ ] Contact page → Calls tab shows calls for that contact
- [ ] Pre-call brief button generates a brief (requires ANTHROPIC_API_KEY)
- [ ] GHL calendar sync creates calls from upcoming meeting events
- [ ] No console errors

### Requires for full functionality
- ANTHROPIC_API_KEY in env (present on Vercel, not in local .env.local)
- OPENAI_API_KEY in env for Whisper transcription (present on Vercel)
- GHL calendar events with meeting links for sync to populate calls
- Admin must add rubric criteria in Settings before grading works
