-- ══════════════════════════════════════════════
-- Session 4 Part 1: Reseed Onboarding Sub-Tasks
--
-- Replaces old two_state sub-tasks with single-state definitions.
-- These are rough definitions — will be refined as the team uses the system.
-- Schema supports renaming without breaking history.
-- ══════════════════════════════════════════════

-- Stage IDs (from 20260408000005):
--   Setup:      d0000000-0000-0000-0000-000000000001
--   Training:   d0000000-0000-0000-0000-000000000002
--   Launch Prep: d0000000-0000-0000-0000-000000000003
--   Onboarded:  d0000000-0000-0000-0000-000000000004 (terminal, no sub-tasks)

-- Delete old sub-tasks that have no logs referencing them
DELETE FROM pipeline_sub_tasks
WHERE id IN (
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000004',
  'e0000000-0000-0000-0000-000000000005',
  'e0000000-0000-0000-0000-000000000006',
  'e0000000-0000-0000-0000-000000000007',
  'e0000000-0000-0000-0000-000000000008',
  'e0000000-0000-0000-0000-000000000009',
  'e0000000-0000-0000-0000-000000000010',
  'e0000000-0000-0000-0000-000000000011',
  'e0000000-0000-0000-0000-000000000012'
)
AND id NOT IN (SELECT DISTINCT sub_task_id FROM contact_sub_task_logs WHERE sub_task_id IS NOT NULL);

-- ─── Setup (4 sub-tasks) ───────────────────────
INSERT INTO pipeline_sub_tasks
  (stage_id, slug, name, description, sort_order, state_type, default_logger_type, is_required)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'legal-entity', 'Legal Entity',
   'Business entity formed (LLC or equivalent)', 1, 'single', 'user', true),
  ('d0000000-0000-0000-0000-000000000001', 'nah-website', 'NAH Website',
   'Territory website set up under NAH domain', 2, 'single', 'user', true),
  ('d0000000-0000-0000-0000-000000000001', 'google-workspace', 'Google Workspace',
   'Google Workspace account created for territory', 3, 'single', 'user', true),
  ('d0000000-0000-0000-0000-000000000001', 'bank-account', 'Bank Account',
   'Business bank account opened', 4, 'single', 'user', true)
ON CONFLICT DO NOTHING;

-- ─── Training (5 sub-tasks) ────────────────────
INSERT INTO pipeline_sub_tasks
  (stage_id, slug, name, description, sort_order, state_type, default_logger_type, is_required)
VALUES
  ('d0000000-0000-0000-0000-000000000002', 'trainual-part-1', 'Trainual Part 1',
   'Trainual module 1 completed', 1, 'single', 'api', true),
  ('d0000000-0000-0000-0000-000000000002', 'trainual-part-2', 'Trainual Part 2',
   'Trainual module 2 completed', 2, 'single', 'api', true),
  ('d0000000-0000-0000-0000-000000000002', 'trainual-part-3', 'Trainual Part 3',
   'Trainual module 3 completed', 3, 'single', 'api', true),
  ('d0000000-0000-0000-0000-000000000002', 'trainual-part-4', 'Trainual Part 4',
   'Trainual module 4 completed', 4, 'single', 'api', true),
  ('d0000000-0000-0000-0000-000000000002', 'trainual-part-5', 'Trainual Part 5',
   'Trainual module 5 completed', 5, 'single', 'api', true)
ON CONFLICT DO NOTHING;

-- ─── Launch Prep (3 sub-tasks) ─────────────────
INSERT INTO pipeline_sub_tasks
  (stage_id, slug, name, description, sort_order, state_type, default_logger_type, is_required)
VALUES
  ('d0000000-0000-0000-0000-000000000003', 'accounts', 'Accounts',
   'Buyer/seller platform accounts set up', 1, 'single', 'user', true),
  ('d0000000-0000-0000-0000-000000000003', 'insurance', 'Insurance',
   'Business insurance obtained', 2, 'single', 'user', true),
  ('d0000000-0000-0000-0000-000000000003', 'workstation', 'Workstation',
   'Office or home workstation configured', 3, 'single', 'user', true)
ON CONFLICT DO NOTHING;

-- Onboarded = terminal stage, no sub-tasks needed.
