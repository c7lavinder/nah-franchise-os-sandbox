-- Mega Sprint: Seed Onboarding — Path to Launch pipeline (4 stages, 12 sub-tasks)

INSERT INTO pipelines (id, slug, name, description, is_active, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'onboarding', 'Onboarding — Path to Launch', 'Post-award onboarding pipeline for new franchisees', true, 2)
ON CONFLICT (slug) DO NOTHING;

-- Stages
INSERT INTO pipeline_stages (id, pipeline_id, slug, name, sort_order, is_terminal) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'setup', 'Setup', 0, false),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'training', 'Training', 1, false),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'launch-prep', 'Launch Prep', 2, false),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'onboarded', 'Onboarded', 3, true)
ON CONFLICT DO NOTHING;

-- Sub-tasks: Setup (4)
INSERT INTO pipeline_sub_tasks (id, stage_id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, is_required) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'entity-bank', 'Entity & Bank Account', 0, 'two_state', 'started', 'completed', 'user', true),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'insurance-compliance', 'Insurance & Compliance', 1, 'two_state', 'started', 'completed', 'user', true),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'systems-access', 'Systems Access', 2, 'two_state', 'started', 'completed', 'user', true),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'workstation-ready', 'Workstation Ready', 3, 'two_state', 'started', 'completed', 'user', true)
ON CONFLICT DO NOTHING;

-- Sub-tasks: Training (4)
INSERT INTO pipeline_sub_tasks (id, stage_id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, is_required) VALUES
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 'part-1-onboarding', 'Part 1: Onboarding', 0, 'two_state', 'started', 'completed', 'user', true),
  ('e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000002', 'part-2-mastersuite', 'Part 2: MasterSuite', 1, 'two_state', 'started', 'completed', 'user', true),
  ('e0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000002', 'part-3-goals', 'Part 3: Goals & Planning', 2, 'two_state', 'started', 'completed', 'user', true),
  ('e0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000002', 'onboarding-test', 'Onboarding Test', 3, 'two_state', 'started', 'completed', 'user', true)
ON CONFLICT DO NOTHING;

-- Sub-tasks: Launch Prep (4)
INSERT INTO pipeline_sub_tasks (id, stage_id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, is_required) VALUES
  ('e0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000003', 'territory-finalized', 'Territory Finalized', 0, 'two_state', 'started', 'completed', 'user', true),
  ('e0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000003', 'marketing-live', 'Marketing Live', 1, 'two_state', 'started', 'completed', 'user', true),
  ('e0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000003', 'first-lead-pipeline', 'First Lead in Pipeline', 2, 'two_state', 'started', 'completed', 'user', true),
  ('e0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000003', 'first-offer-sent', 'First Offer Sent', 3, 'two_state', 'started', 'completed', 'user', true)
ON CONFLICT DO NOTHING;
