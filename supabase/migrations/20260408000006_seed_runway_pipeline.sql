-- Mega Sprint: Seed Runway — First Purchases pipeline (4 stages, 9 sub-tasks)
-- Hidden from nav via is_visible_in_nav = false

-- Add is_visible_in_nav column if not exists
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS is_visible_in_nav boolean NOT NULL DEFAULT true;

INSERT INTO pipelines (id, slug, name, description, is_active, sort_order, is_visible_in_nav) VALUES
  ('a0000000-0000-0000-0000-000000000004', 'runway', 'Runway — First Purchases', 'Post-onboarding first purchases pipeline', true, 4, false)
ON CONFLICT (slug) DO NOTHING;

-- Stages
INSERT INTO pipeline_stages (id, pipeline_id, slug, name, sort_order, is_terminal) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'first-offers', 'First Offers', 0, false),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'first-acquisition', 'First Acquisition', 1, false),
  ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'inventory-building', 'Inventory Building', 2, false),
  ('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'runway-complete', 'Runway Complete', 3, true)
ON CONFLICT DO NOTHING;

-- Sub-tasks: First Offers (3)
INSERT INTO pipeline_sub_tasks (id, stage_id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, is_required) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'marketing-optimized', 'Marketing Optimized', 0, 'two_state', 'started', 'completed', 'user', true),
  ('f1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'offers-sent-10', '10 Offers Sent', 1, 'two_state', 'started', 'completed', 'user', true),
  ('f1000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 'first-property-contract', 'First Property Under Contract', 2, 'two_state', 'started', 'completed', 'user', true)
ON CONFLICT DO NOTHING;

-- Sub-tasks: First Acquisition (3)
INSERT INTO pipeline_sub_tasks (id, stage_id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, is_required) VALUES
  ('f1000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002', 'first-property-closed', 'First Property Closed', 0, 'two_state', 'started', 'completed', 'user', true),
  ('f1000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000002', 'rehab-started', 'Rehab Started', 1, 'two_state', 'started', 'completed', 'user', true),
  ('f1000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000002', 'second-property-contract', 'Second Property Under Contract', 2, 'two_state', 'started', 'completed', 'user', true)
ON CONFLICT DO NOTHING;

-- Sub-tasks: Inventory Building (3)
INSERT INTO pipeline_sub_tasks (id, stage_id, slug, name, sort_order, state_type, first_state_label, second_state_label, default_logger_type, is_required) VALUES
  ('f1000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000003', 'two-properties-inventory', '2+ Properties in Inventory', 0, 'two_state', 'started', 'completed', 'user', true),
  ('f1000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000003', 'first-sale-closed', 'First Sale Closed', 1, 'two_state', 'started', 'completed', 'user', true),
  ('f1000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000003', 'graduate-independent', 'Graduate to Independent', 2, 'two_state', 'started', 'completed', 'user', true)
ON CONFLICT DO NOTHING;
