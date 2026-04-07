-- Sprint 1: Seed the Follow-up pipeline definition per §1.9 of MASTER_PLAN.md
-- 1 pipeline, 3 stages, 1 sub-task (on Re-engaged only)

-- ═══════════════════════════════════════════════════════
-- Follow-up Pipeline
-- ═══════════════════════════════════════════════════════

INSERT INTO pipelines (id, slug, name, description, is_active, sort_order, ghl_field_id)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'followup',
  'Follow-up Pipeline',
  'Long-term re-engagement: Follow-up → Nurture → Re-engaged',
  true,
  4,  -- After Sales (1), Onboarding (2), Coaching (3)
  NULL  -- TODO: Set ghl_field_id for nah_followup_stage_id
)
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- Stage 1: Follow-up (specific reason to resume)
-- ═══════════════════════════════════════════════════════

INSERT INTO pipeline_stages (id, pipeline_id, slug, name, description, sort_order, is_terminal)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'followup',
  'Follow-up',
  'Specific reason to resume — recently dropped from Sales (§1.9)',
  1, false
)
ON CONFLICT DO NOTHING;

-- No sub-tasks on Follow-up stage

-- ═══════════════════════════════════════════════════════
-- Stage 2: Nurture (cold storage)
-- ═══════════════════════════════════════════════════════

INSERT INTO pipeline_stages (id, pipeline_id, slug, name, description, sort_order, is_terminal)
VALUES (
  'c0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000002',
  'nurture',
  'Nurture',
  'Long-term cold storage — no specific resume trigger (§1.9)',
  2, false
)
ON CONFLICT DO NOTHING;

-- No sub-tasks on Nurture stage

-- ═══════════════════════════════════════════════════════
-- Stage 3: Re-engaged (ready to resume Sales)
-- ═══════════════════════════════════════════════════════

INSERT INTO pipeline_stages (id, pipeline_id, slug, name, description, sort_order, is_terminal, auto_spawn_pipeline_id)
VALUES (
  'c0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000002',
  'reengaged',
  'Re-engaged',
  'Ready to resume Sales process — logging this spawns a new Sales entry (§1.13)',
  3, false,
  'a0000000-0000-0000-0000-000000000001'  -- auto-spawn into Sales pipeline
)
ON CONFLICT DO NOTHING;

-- 1 sub-task on Re-engaged: resume_sales
INSERT INTO pipeline_sub_tasks (stage_id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, default_logger_user_id, is_required)
VALUES (
  'c0000000-0000-0000-0000-000000000003',
  'resume_sales',
  'Resume Sales',
  1,
  'single',
  NULL, NULL,
  'user', NULL,  -- TODO: Set to Chad's user ID
  true
);
