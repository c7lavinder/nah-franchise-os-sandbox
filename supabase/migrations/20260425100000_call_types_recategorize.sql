-- Sprint: call-classification-by-journey (Phase 1).
-- Layer 1 of the new classifier is category; layer 2 (specific call_types row)
-- only subdivides inside the sales bucket today. Move the two rows that were
-- misfiled under `other` into their proper top-level categories so the
-- Reclassify modal groups them correctly.
--
-- Categories after this migration:
--   sales        → intro_call, matt_call, sam_call, mark_call, matt_final_call
--   onboarding   → onboarding_call
--   coaching     → coaching_call
--   group        → group_call
--   internal     → team_call
--   other        → everything else (cohort, fdd, territory, unclassified)

UPDATE call_types SET category = 'onboarding' WHERE slug = 'onboarding_call';
UPDATE call_types SET category = 'group'      WHERE slug = 'group_call';

-- The read_ai_sessions.call_type CHECK constraint predates the Onboarding
-- category. Expand it to accept `onboarding` so the webhook handler can
-- classify new calls under the new rule without violating the check.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'read_ai_sessions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%call_type%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE read_ai_sessions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE read_ai_sessions
  ADD CONSTRAINT read_ai_sessions_call_type_check
  CHECK (call_type IN ('prospect', 'onboarding', 'coaching', 'group', 'internal', 'unknown'));
