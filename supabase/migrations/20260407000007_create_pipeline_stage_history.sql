-- Sprint 1: Pipeline stage history table (§1.20 Group 3)
-- Every stage move — append-only audit trail (§1.6)

CREATE TABLE IF NOT EXISTS pipeline_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_pipeline_state_id uuid NOT NULL REFERENCES contact_pipeline_state(id) ON DELETE CASCADE,
  from_stage_id uuid REFERENCES pipeline_stages(id),  -- Null on first entry
  to_stage_id uuid NOT NULL REFERENCES pipeline_stages(id),
  moved_by_user_id uuid REFERENCES users(id),
  reason text,
  was_skip boolean NOT NULL DEFAULT false,
  was_revert boolean NOT NULL DEFAULT false,
  was_auto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
