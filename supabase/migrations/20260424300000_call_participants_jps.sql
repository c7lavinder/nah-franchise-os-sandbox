-- Sprint: call-journey-matching (Phase 1b).
-- Add journey_pipeline_state_id to call_participants so each participant on
-- a call carries their own journey link. Enables group calls to advance
-- multiple journeys from one transcript without losing per-seat attribution.
--
-- Backfill uses the same canonical mapping the 20260422400000 migration
-- applied to calls.journey_pipeline_state_id: map via participant's contact_id
-- → primary journey → jps row preferring matching territory, then NULL
-- territory (pre-award), then most-recent.

ALTER TABLE call_participants
  ADD COLUMN IF NOT EXISTS journey_pipeline_state_id uuid
    REFERENCES journey_pipeline_state(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_call_participants_jps
  ON call_participants(journey_pipeline_state_id)
  WHERE journey_pipeline_state_id IS NOT NULL;

-- Backfill: for each participant with a contact_id, pick the participant's
-- matching journey_pipeline_state row.
UPDATE call_participants cp
SET journey_pipeline_state_id = jps.id
FROM (
  SELECT DISTINCT ON (cp_inner.id)
    cp_inner.id AS cp_id,
    jps.id AS id
  FROM call_participants cp_inner
  JOIN calls c ON c.id = cp_inner.call_id
  JOIN journeys j ON j.primary_contact_id = cp_inner.contact_id
  JOIN journey_pipeline_state jps ON jps.journey_id = j.id
  WHERE cp_inner.contact_id IS NOT NULL
    AND cp_inner.journey_pipeline_state_id IS NULL
    AND j.status = 'active'
  ORDER BY
    cp_inner.id,
    -- Prefer territory match when the call has a territory
    (jps.territory_ms_slug IS NOT DISTINCT FROM c.territory_ms_slug) DESC,
    -- Then pre-award (NULL territory)
    (jps.territory_ms_slug IS NULL) DESC,
    -- Then most-recent active row
    jps.updated_at DESC
) jps
WHERE cp.id = jps.cp_id
  AND cp.journey_pipeline_state_id IS NULL;
