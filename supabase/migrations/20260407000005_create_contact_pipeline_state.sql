-- Sprint 1: Contact pipeline state table (§1.20 Group 3)
-- One row per (contact, pipeline) — tracks which stage a contact is in
-- Only one active entry per pipeline at a time; historical closed entries allowed

CREATE TABLE IF NOT EXISTS contact_pipeline_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE RESTRICT,
  current_stage_id uuid NOT NULL REFERENCES pipeline_stages(id),
  current_sub_task_id uuid REFERENCES pipeline_sub_tasks(id),  -- The active sub-task driving the timer (§1.14)
  current_sub_task_started_at timestamptz,  -- Timer reset point for §1.14 coloring
  entered_pipeline_at timestamptz NOT NULL DEFAULT now(),
  entered_current_stage_at timestamptz NOT NULL DEFAULT now(),
  assigned_user_id uuid REFERENCES users(id),
  is_active boolean NOT NULL DEFAULT true,
  closed_reason pipeline_close_reason,  -- §1.9: won / dropped_to_followup / dropped_to_nurture
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: only one active entry per contact per pipeline (§1.20)
CREATE UNIQUE INDEX uniq_active_contact_pipeline
  ON contact_pipeline_state (contact_id, pipeline_id)
  WHERE is_active = true;

CREATE TRIGGER contact_pipeline_state_updated_at
  BEFORE UPDATE ON contact_pipeline_state
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
