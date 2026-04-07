-- Sprint 1: Indexes for the new pipeline schema (§1.20)

-- contact_pipeline_state
CREATE INDEX IF NOT EXISTS idx_contact_pipeline_state_lookup
  ON contact_pipeline_state (contact_id, pipeline_id);
CREATE INDEX IF NOT EXISTS idx_contact_pipeline_state_active
  ON contact_pipeline_state (is_active, pipeline_id);
CREATE INDEX IF NOT EXISTS idx_contact_pipeline_state_assigned
  ON contact_pipeline_state (assigned_user_id);

-- contact_sub_task_logs
CREATE INDEX IF NOT EXISTS idx_sub_task_logs_state_time
  ON contact_sub_task_logs (contact_pipeline_state_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_task_logs_subtask
  ON contact_sub_task_logs (sub_task_id);

-- pipeline_stage_history
CREATE INDEX IF NOT EXISTS idx_stage_history_state_time
  ON pipeline_stage_history (contact_pipeline_state_id, created_at DESC);

-- contact_activity_messages
CREATE INDEX IF NOT EXISTS idx_activity_messages_contact_time
  ON contact_activity_messages (contact_id, created_at DESC);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications (recipient_user_id, read_at, created_at DESC);

-- contacts
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contacts_ghl_id
  ON contacts (ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name
  ON contacts (last_name, first_name);

-- ghl_sync_queue
CREATE INDEX IF NOT EXISTS idx_ghl_sync_queue_status
  ON ghl_sync_queue (status, created_at);

-- cron_job_log
CREATE INDEX IF NOT EXISTS idx_cron_job_log_name_time
  ON cron_job_log (job_name, started_at DESC);
