# Overnight Handoff — 2026-04-07

## What Was Completed

### Sprint 0 — Bug Fixes (branch: `sprint-0-bug-fixes`)

| Bug | Status | Commit | Files |
|---|---|---|---|
| 1. Scoring bucket all Low | ⏭️ SKIPPED — data layer (no intelligence profiles populated) | n/a | n/a |
| 2. Workflow rewrite 500 | ✅ Fixed — proper 400/404/503 status codes | `2a5c73d` | `app/api/workflows/[workflowId]/rewrite/route.ts` |
| 3. Scout markdown rendering | ✅ Fixed — ReactMarkdown + prose styling | `d20bd6e` | `components/scout/ScoutBubble.tsx`, `tailwind.config.ts`, `package.json` |
| 4. Stale alerts cleanup | ✅ Script created (human must run) | `8121d11` | `scripts/clear-stale-alerts.ts` |

### Sprint 1 — Supabase Schema Migration (branch: `sprint-1-supabase-schema`)

**19 migration files written**, organized as:

| Migration | File | Content |
|---|---|---|
| 000 | `20260407000000_create_enums.sql` | 9 enum types + moddatetime extension |
| 001-003 | `*_create_pipelines/stages/sub_tasks.sql` | Group 1: Pipeline definition tables |
| 004 | `*_create_contacts.sql` | Group 2: Contact mirror table |
| 005-007 | `*_create_contact_pipeline_state/sub_task_logs/stage_history.sql` | Group 3: Contact state tables |
| 008-009 | `*_create_contact_activity_messages/notifications.sql` | Group 4: Activity + notifications |
| 010-012 | `*_create_pipeline_app_settings/cron_job_log/ghl_sync_queue.sql` | Group 5: System tables |
| 013 | `*_create_indexes.sql` | All indexes from §1.20 |
| 014 | `*_update_users_role.sql` | Migrates role CHECK to admin/operator/specialist/member |
| 015 | `*_create_rls_policies.sql` | RLS on all 12 tables with 4 role levels |
| 016-017 | `*_seed_sales/followup_pipeline.sql` | Sales (6 stages, 18 sub-tasks) + Follow-up (3 stages, 1 sub-task) |
| 018 | `*_seed_app_settings.sql` | pipeline_app_settings row (yellow=5d, red=10d) |

**Seed data totals:** 2 pipelines, 9 stages, 19 sub-tasks, 1 app_settings row.

## What Was Attempted But Failed

- **Local Supabase test (`supabase db reset`):** Docker daemon not running. Cannot verify migrations apply cleanly from fresh state. Migrations are standard Postgres SQL and should work — but need human verification with Docker running.

## Decisions Made Autonomously (Need Human Review)

1. **Bug 1 skipped (data layer):** The intelligence scoring code is correct. All `candidate_intelligence.current_score` values are 0/null because the bootstrap hasn't populated real data. This will auto-resolve when intelligence profiles are bootstrapped.

2. **Named new settings table `pipeline_app_settings`:** The existing `app_settings` table uses a different structure (UUID PK + key-value pairs). To avoid collision, the new single-row config table from §1.20 is named `pipeline_app_settings`. Consolidation can happen in a future sprint.

3. **Users role migration:** Mapped `leadership`→`admin`, `rep`→`member`, `marketing`→`member`. These are the closest mappings. `operator` and `specialist` roles will need to be manually assigned to Chad, Sam, and Mark.

4. **Sub-task default_logger_user_id all set to NULL:** User IDs for Chad, Matt, Sam, and Mark are not known at migration time. All sub-tasks have `default_logger_type='user'` but `default_logger_user_id=NULL` with TODO comments. These need to be filled once user records are created/identified.

5. **Deterministic UUIDs for seed data:** Used `a0000000-...001/002` for pipelines, `b0000000-...001-006` for Sales stages, `c0000000-...001-003` for Follow-up stages. This makes FK references between seed files predictable.

## What's Ready to Start Next

**Sprint 2 — GHL Sync Layer** (see `SPRINTS_2-9_OUTLINE.md` in NAHosfiles folder)

Before starting Sprint 2:
1. Start Docker and run `supabase db reset` to verify all 19 migrations apply cleanly
2. Run `scripts/clear-stale-alerts.ts` against production to clear the bell
3. Assign `operator` role to Chad, `specialist` to Sam and Mark in the `users` table
4. Fill in `default_logger_user_id` on pipeline_sub_tasks for each team member
5. Merge `sprint-0-bug-fixes` → `main`, then `sprint-1-supabase-schema` → `main` (in that order)

## TODOs Added

| Location | TODO | Why |
|---|---|---|
| `20260407000016_seed_sales_pipeline.sql` | Set default_logger_user_id for all sub-tasks | User IDs not known at migration time |
| `20260407000016_seed_sales_pipeline.sql` | Set ghl_field_id on sales pipeline | GHL custom field nah_sales_stage_id not created yet |
| `20260407000017_seed_followup_pipeline.sql` | Set ghl_field_id on followup pipeline | GHL custom field nah_followup_stage_id not created yet |
| Closed stage | Set auto_spawn_pipeline_id to onboarding pipeline ID | Onboarding pipeline not yet designed |

## Branch State

- `main` — **untouched** ✅
- `sprint-0-bug-fixes` — 4 commits (3 bug fixes + handoff)
- `sprint-1-supabase-schema` — 9 additional commits (19 migration files + memory.md)

## Verification Checklist (for morning)

- [ ] `npm run build` passes on `sprint-1-supabase-schema` — ✅ confirmed during session
- [ ] Start Docker, run `supabase db reset` — verify all 19 migrations apply
- [ ] Query `pipelines` — expect 2 rows (sales + followup)
- [ ] Query `pipeline_stages` — expect 9 rows (6 sales + 3 followup)
- [ ] Query `pipeline_sub_tasks` — expect 19 rows (18 sales + 1 followup)
- [ ] Query `pipeline_app_settings` — expect 1 row with id=1
- [ ] Verify RLS enabled on all 12 new tables
- [ ] Run `scripts/clear-stale-alerts.ts` against production
- [ ] Bell shows 0 alerts
- [ ] Scout chat renders markdown correctly (bold, headers, bullets, code)
- [ ] Workflow rewrite endpoint returns 503 (not 500) when tables don't exist
