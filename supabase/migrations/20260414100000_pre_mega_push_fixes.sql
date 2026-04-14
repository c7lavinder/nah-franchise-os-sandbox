-- Pre-mega-push fixes: missing call types, franchisee pipeline state, profile persistence

-- ═══════════════════════════════════════════════════
-- 1. SEED MISSING CALL TYPES
-- ═══════════════════════════════════════════════════

INSERT INTO call_types (slug, name, description) VALUES
  ('team_call', 'Team Call', 'Internal NAH headquarters team meeting'),
  ('coaching_call', 'Coaching Call', 'Coaching session with franchise owner'),
  ('group_call', 'Group Call', 'Multi-participant group call (cohort, franchisee weekly, etc.)'),
  ('fdd_review', 'FDD Review', 'Franchise Disclosure Document review call'),
  ('territory_call', 'Territory Call', 'Territory selection and market deep dive call'),
  ('cohort_call', 'Cohort Call', 'Small group cohort call with franchisees'),
  ('onboarding_call', 'Onboarding Call', 'New franchisee onboarding session')
ON CONFLICT (slug) DO NOTHING;

-- Create default rubrics for new call types
INSERT INTO rubrics (call_type_id, name, description, is_active)
SELECT id, name || ' — Default Rubric', 'Admin-configured rubric for ' || name, true
FROM call_types
WHERE slug IN ('team_call', 'coaching_call', 'group_call', 'fdd_review', 'territory_call', 'cohort_call', 'onboarding_call')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════
-- 2. POPULATE FRANCHISEE PIPELINE STATE
-- All territory owners who don't have onboarding pipeline state
-- get placed in onboarding/onboarded (they're active franchisees)
-- ═══════════════════════════════════════════════════

INSERT INTO contact_pipeline_state (contact_id, pipeline_id, current_stage_id, is_active, entered_pipeline_at, entered_current_stage_at)
SELECT DISTINCT
  c.id,
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'd0000000-0000-0000-0000-000000000004'::uuid,
  true,
  COALESCE(tow.start_date::timestamptz, now()),
  COALESCE(tow.start_date::timestamptz, now())
FROM territory_owners tow
INNER JOIN contacts c ON c.ghl_contact_id = tow.ghl_contact_id
WHERE tow.end_date IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM contact_pipeline_state cps
    WHERE cps.contact_id = c.id
      AND cps.pipeline_id = 'a0000000-0000-0000-0000-000000000003'::uuid
      AND cps.is_active = true
  );

-- Also ensure they have runway pipeline state (active franchisees buying houses)
INSERT INTO contact_pipeline_state (contact_id, pipeline_id, current_stage_id, is_active, entered_pipeline_at, entered_current_stage_at)
SELECT DISTINCT
  c.id,
  'a0000000-0000-0000-0000-000000000004'::uuid,
  'f0000000-0000-0000-0000-000000000001'::uuid,
  true,
  COALESCE(tow.start_date::timestamptz, now()),
  COALESCE(tow.start_date::timestamptz, now())
FROM territory_owners tow
INNER JOIN contacts c ON c.ghl_contact_id = tow.ghl_contact_id
WHERE tow.end_date IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM contact_pipeline_state cps
    WHERE cps.contact_id = c.id
      AND cps.pipeline_id = 'a0000000-0000-0000-0000-000000000004'::uuid
      AND cps.is_active = true
  );
