-- Add journey_pipeline_state_id to pipeline_stage_history so per-territory
-- stage moves can record audit trail. contact_pipeline_state_id becomes
-- nullable since per-territory moves write jps directly and bypass cps.
--
-- Existing rows are untouched: contact_pipeline_state_id stays populated
-- for all historical moves (cps-backed). New per-territory moves write
-- journey_pipeline_state_id and leave contact_pipeline_state_id null.
-- At least one of the two must be set (CHECK below).

ALTER TABLE pipeline_stage_history
  ALTER COLUMN contact_pipeline_state_id DROP NOT NULL;

ALTER TABLE pipeline_stage_history
  ADD COLUMN IF NOT EXISTS journey_pipeline_state_id uuid
    REFERENCES journey_pipeline_state(id) ON DELETE CASCADE;

ALTER TABLE pipeline_stage_history
  ADD CONSTRAINT chk_stage_history_has_scope
  CHECK (contact_pipeline_state_id IS NOT NULL OR journey_pipeline_state_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_stage_history_jps
  ON pipeline_stage_history(journey_pipeline_state_id)
  WHERE journey_pipeline_state_id IS NOT NULL;
