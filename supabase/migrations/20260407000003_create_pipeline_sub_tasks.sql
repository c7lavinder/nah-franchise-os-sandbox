-- Sprint 1: Pipeline sub-tasks table (§1.20 Group 1)
-- Sub-task definitions within a stage (§1.5)

CREATE TABLE IF NOT EXISTS pipeline_sub_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  state_type sub_task_state_type NOT NULL DEFAULT 'two_state',
  first_state_label text,   -- e.g. "scheduled", "sent"
  second_state_label text,  -- e.g. "completed", "signed"
  default_logger_type sub_task_logger_type NOT NULL DEFAULT 'null',
  default_logger_user_id uuid REFERENCES users(id),  -- nullable: set when default_logger_type = 'user'
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER pipeline_sub_tasks_updated_at
  BEFORE UPDATE ON pipeline_sub_tasks
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
