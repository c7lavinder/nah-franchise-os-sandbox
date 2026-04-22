-- Sprint: call-journey-matching (Phase 1a).
-- Multi-journey support: a single call can advance multiple journeys
-- (e.g. a group call where three franchisees + one prospect all sit on their
-- own journey). calls.journey_pipeline_state_id remains the "primary" pointer
-- for backwards compatibility; this join table carries the full list plus the
-- is_primary flag. Same shape as call_territories (see 20260421200000).

CREATE TABLE IF NOT EXISTS call_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  journey_pipeline_state_id uuid NOT NULL
    REFERENCES journey_pipeline_state(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_id, journey_pipeline_state_id)
);

CREATE INDEX IF NOT EXISTS idx_call_journeys_call
  ON call_journeys(call_id);

CREATE INDEX IF NOT EXISTS idx_call_journeys_journey
  ON call_journeys(journey_id);

CREATE INDEX IF NOT EXISTS idx_call_journeys_jps
  ON call_journeys(journey_pipeline_state_id);

-- At most one primary journey per call.
CREATE UNIQUE INDEX IF NOT EXISTS uq_call_journeys_primary
  ON call_journeys(call_id)
  WHERE is_primary = true;

-- Backfill existing calls: mirror calls.journey_pipeline_state_id into the
-- join table as the primary row.
INSERT INTO call_journeys (call_id, journey_id, journey_pipeline_state_id, is_primary)
SELECT c.id, jps.journey_id, c.journey_pipeline_state_id, true
FROM calls c
JOIN journey_pipeline_state jps ON jps.id = c.journey_pipeline_state_id
WHERE c.journey_pipeline_state_id IS NOT NULL
  AND c.deleted_at IS NULL
ON CONFLICT (call_id, journey_pipeline_state_id) DO NOTHING;
