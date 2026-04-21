-- Sprint: call-classification-consolidation (Phase 6).
-- After backfill, every row in calls has a call_type_id. Lock it in so new
-- rows cannot regress and so downstream code (grader, rubric loader) can stop
-- null-guarding.

ALTER TABLE calls
  ALTER COLUMN call_type_id SET NOT NULL;
