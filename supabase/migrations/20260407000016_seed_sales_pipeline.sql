-- Sprint 1: Seed the Sales pipeline definition per §1.4 of MASTER_PLAN.md
-- 1 pipeline, 6 stages, 18 sub-tasks

-- ═══════════════════════════════════════════════════════
-- Sales Pipeline
-- ═══════════════════════════════════════════════════════

INSERT INTO pipelines (id, slug, name, description, is_active, sort_order, ghl_field_id)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'sales',
  'Sales — Path to Ownership',
  'Lead → signed franchisee. The core sales pipeline.',
  true,
  1,
  NULL  -- TODO: Set ghl_field_id after GHL custom field nah_sales_stage_id is created
)
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- Stage 1: Engagement (3 sub-tasks)
-- ═══════════════════════════════════════════════════════

INSERT INTO pipeline_stages (id, pipeline_id, slug, name, description, sort_order, is_terminal, auto_advance_enabled)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'engagement',
  'Engagement',
  'Initial contact and introduction phase',
  1, false, false
)
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_sub_tasks (stage_id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, default_logger_user_id, is_required)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'outreach', 'Outreach', 1, 'two_state', 'attempted', 'contact made', 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000001', 'intro_call', 'Intro Call', 2, 'two_state', 'scheduled', 'completed', 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000001', 'pto', 'PTO', 3, 'two_state', 'invite sent', 'accepted', 'user', NULL, true);
-- TODO: Set default_logger_user_id to Chad's user ID once known

-- ═══════════════════════════════════════════════════════
-- Stage 2: Qualification (3 sub-tasks)
-- ═══════════════════════════════════════════════════════

INSERT INTO pipeline_stages (id, pipeline_id, slug, name, description, sort_order, is_terminal, auto_advance_enabled)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'qualification',
  'Qualification',
  'NDA, Matt introduction call, Zorakle assessment',
  2, false, false
)
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_sub_tasks (stage_id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, default_logger_user_id, is_required)
VALUES
  ('b0000000-0000-0000-0000-000000000002', 'nda', 'NDA', 1, 'two_state', 'sent', 'signed', 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000002', 'matt_call', 'Matt Call', 2, 'two_state', 'scheduled', 'completed', 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000002', 'zorakle', 'Zorakle', 3, 'two_state', 'sent', 'completed', 'api', NULL, true);
-- TODO: Set matt_call default_logger_user_id to Matt's user ID
-- TODO: Zorakle default_logger_type is 'api' (Zorakle webhook fires)

-- ═══════════════════════════════════════════════════════
-- Stage 3: Discovery (4 sub-tasks)
-- ═══════════════════════════════════════════════════════

INSERT INTO pipeline_stages (id, pipeline_id, slug, name, description, sort_order, is_terminal, auto_advance_enabled)
VALUES (
  'b0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'discovery',
  'Discovery',
  'Sam call, PFS, background check, Mark call',
  3, false, false
)
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_sub_tasks (stage_id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, default_logger_user_id, is_required)
VALUES
  ('b0000000-0000-0000-0000-000000000003', 'sam_call', 'Sam Call', 1, 'two_state', 'scheduled', 'completed', 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000003', 'pfs', 'PFS', 2, 'two_state', 'sent', 'received', 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000003', 'background', 'Background', 3, 'single', NULL, NULL, 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000003', 'mark_call', 'Mark Call', 4, 'two_state', 'scheduled', 'completed', 'user', NULL, true);
-- TODO: sam_call → Sam's user ID, mark_call → Mark's user ID

-- ═══════════════════════════════════════════════════════
-- Stage 4: Compliance (4 sub-tasks)
-- ═══════════════════════════════════════════════════════

INSERT INTO pipeline_stages (id, pipeline_id, slug, name, description, sort_order, is_terminal, auto_advance_enabled)
VALUES (
  'b0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000001',
  'compliance',
  'Compliance',
  'FDD, review call, territory call, FA info gathering',
  4, false, false
)
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_sub_tasks (stage_id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, default_logger_user_id, is_required)
VALUES
  ('b0000000-0000-0000-0000-000000000004', 'fdd', 'FDD', 1, 'two_state', 'sent', 'item 23 receipt signed', 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000004', 'fdd_review_call', 'FDD Review Call', 2, 'two_state', 'scheduled', 'completed', 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000004', 'territory_call', 'Territory Call', 3, 'two_state', 'scheduled', 'completed', 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000004', 'fa_info_gathering', 'FA Info Gathering', 4, 'single', NULL, NULL, 'user', NULL, true);
-- TODO: All default to Chad's user ID

-- ═══════════════════════════════════════════════════════
-- Stage 5: Awarding (4 sub-tasks)
-- ═══════════════════════════════════════════════════════

INSERT INTO pipeline_stages (id, pipeline_id, slug, name, description, sort_order, is_terminal, auto_advance_enabled)
VALUES (
  'b0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000001',
  'awarding',
  'Awarding',
  'Matt final call, franchise award letter, FA, franchise fee',
  5, false, false
)
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_sub_tasks (stage_id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, default_logger_user_id, is_required)
VALUES
  ('b0000000-0000-0000-0000-000000000005', 'matt_final_call', 'Matt Final Call', 1, 'two_state', 'scheduled', 'completed', 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000005', 'franchise_award_letter', 'Franchise Award Letter', 2, 'two_state', 'sent', 'accepted', 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000005', 'fa', 'FA', 3, 'two_state', 'sent', 'signed', 'user', NULL, true),
  ('b0000000-0000-0000-0000-000000000005', 'ff', 'FF', 4, 'two_state', 'invoiced', 'paid', 'user', NULL, true);
-- TODO: matt_final_call → Matt's user ID, rest → Chad's user ID

-- ═══════════════════════════════════════════════════════
-- Stage 6: Closed (terminal, no sub-tasks)
-- ═══════════════════════════════════════════════════════

INSERT INTO pipeline_stages (id, pipeline_id, slug, name, description, sort_order, is_terminal, auto_advance_enabled, auto_spawn_pipeline_id)
VALUES (
  'b0000000-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000001',
  'closed',
  'Closed',
  'Terminal stage — triggers Onboarding handoff',
  6, true, false,
  NULL  -- TODO: Set to onboarding pipeline ID when it exists
)
ON CONFLICT DO NOTHING;
