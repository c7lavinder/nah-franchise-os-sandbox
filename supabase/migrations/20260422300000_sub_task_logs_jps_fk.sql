-- Decouple contact_sub_task_logs from contact_pipeline_state so per-territory
-- moves (and eventually the full dual-write drop) can log sub-tasks against
-- journey_pipeline_state directly.
--
-- Design: add an optional journey_pipeline_state_id alongside the existing
-- contact_pipeline_state_id. Make both nullable. Backfill jps_id for every
-- existing row using the (contact, pipeline) mapping — where a cps row fans
-- out to multiple jps rows (Phil Dunbar with 3 runway territories), we pick
-- the canonical NULL-territory jps row if one exists, otherwise the first
-- jps row by id. This is lossy for multi-territory historical logs but
-- that's acceptable: those reps were sharing a single cps row anyway so the
-- logs were already journey-scoped, not territory-scoped.
--
-- Going forward: writers populate whichever FK they operate on (cps path
-- sets cps_id, per-territory path sets jps_id). Readers should check both.

ALTER TABLE contact_sub_task_logs
  ALTER COLUMN contact_pipeline_state_id DROP NOT NULL;

ALTER TABLE contact_sub_task_logs
  ADD COLUMN IF NOT EXISTS journey_pipeline_state_id uuid
    REFERENCES journey_pipeline_state(id) ON DELETE CASCADE;

-- Backfill jps_id for every log. Preferred jps: territory_ms_slug IS NULL
-- (pure journey-level row); fall back to the lowest-id row if none.
UPDATE contact_sub_task_logs l
SET journey_pipeline_state_id = jps.id
FROM (
  SELECT DISTINCT ON (cps.id)
    cps.id AS cps_id,
    jps.id AS id
  FROM contact_pipeline_state cps
  JOIN journeys j ON j.primary_contact_id = cps.contact_id
  JOIN journey_pipeline_state jps
    ON jps.journey_id = j.id AND jps.pipeline_id = cps.pipeline_id
  ORDER BY cps.id, (jps.territory_ms_slug IS NULL) DESC, jps.id ASC
) jps
WHERE l.contact_pipeline_state_id = jps.cps_id
  AND l.journey_pipeline_state_id IS NULL;

ALTER TABLE contact_sub_task_logs
  ADD CONSTRAINT chk_sub_task_log_has_scope
  CHECK (contact_pipeline_state_id IS NOT NULL OR journey_pipeline_state_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_sub_task_logs_jps
  ON contact_sub_task_logs(journey_pipeline_state_id)
  WHERE journey_pipeline_state_id IS NOT NULL;
