-- Sprint 1: Contact sub-task logs table (§1.20 Group 3)
-- Append-only log of every sub-task attempt (§1.5)
-- Logs persist forever even when stages revert

CREATE TABLE IF NOT EXISTS contact_sub_task_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_pipeline_state_id uuid NOT NULL REFERENCES contact_pipeline_state(id) ON DELETE CASCADE,
  sub_task_id uuid NOT NULL REFERENCES pipeline_sub_tasks(id),
  logger_user_id uuid REFERENCES users(id),
  source log_source NOT NULL DEFAULT 'manual',
  state_advance log_state_advance,  -- For 2-state subs: which state this log advances to
  content_type log_content_type NOT NULL DEFAULT 'note',
  content_text text,
  content_file_url text,
  content_link_url text,
  metadata jsonb,  -- Source-specific extras
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz  -- Soft delete
);

CREATE TRIGGER contact_sub_task_logs_updated_at
  BEFORE UPDATE ON contact_sub_task_logs
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
