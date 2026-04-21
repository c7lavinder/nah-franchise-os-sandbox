-- Add journey_pipeline_state_id to calls so the cron and log writers can
-- stop depending on cps ids now that the contact_pipeline_state writers
-- are retired. Existing rows are backfilled using the same canonical
-- mapping (NULL-territory preferred) used for sub_task_logs.
--
-- contact_pipeline_state_id stays (nullable today) for historical rows.

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS journey_pipeline_state_id uuid
    REFERENCES journey_pipeline_state(id) ON DELETE SET NULL;

UPDATE calls c
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
WHERE c.contact_pipeline_state_id = jps.cps_id
  AND c.journey_pipeline_state_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_calls_jps
  ON calls(journey_pipeline_state_id)
  WHERE journey_pipeline_state_id IS NOT NULL;
