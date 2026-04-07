-- Sprint 1: RLS policies for all new tables (§1.15 + §1.20)
--
-- Roles per §1.15:
--   admin (Corey, Matt) — full access everywhere
--   operator (Chad) — full access on contact tables, read-only on templates/settings
--   specialist (Sam, Mark) — read all contacts, write sub-task logs + activity messages
--   member (future reps) — own contacts only

-- ═══════════════════════════════════════════════════════
-- Helper functions for role checks
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.users WHERE id::text = auth.uid()::text LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id::text = auth.uid()::text AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin_or_operator()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id::text = auth.uid()::text AND role IN ('admin', 'operator')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ═══════════════════════════════════════════════════════
-- Enable RLS on all new tables
-- ═══════════════════════════════════════════════════════

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_sub_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_pipeline_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_sub_task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_activity_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_job_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_sync_queue ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════
-- Group 1: Pipeline definitions (read: all, write: admin only)
-- ═══════════════════════════════════════════════════════

-- pipelines
CREATE POLICY "pipelines_read_all" ON pipelines FOR SELECT USING (true);
CREATE POLICY "pipelines_write_admin" ON pipelines FOR ALL USING (is_admin());

-- pipeline_stages
CREATE POLICY "pipeline_stages_read_all" ON pipeline_stages FOR SELECT USING (true);
CREATE POLICY "pipeline_stages_write_admin" ON pipeline_stages FOR ALL USING (is_admin());

-- pipeline_sub_tasks
CREATE POLICY "pipeline_sub_tasks_read_all" ON pipeline_sub_tasks FOR SELECT USING (true);
CREATE POLICY "pipeline_sub_tasks_write_admin" ON pipeline_sub_tasks FOR ALL USING (is_admin());

-- ═══════════════════════════════════════════════════════
-- Group 2: Contacts (read: admin/operator/specialist=all, member=own)
-- ═══════════════════════════════════════════════════════

-- contacts: all roles can read all contacts except member (own only)
CREATE POLICY "contacts_read_all" ON contacts FOR SELECT USING (
  current_user_role() IN ('admin', 'operator', 'specialist')
);
CREATE POLICY "contacts_read_own_member" ON contacts FOR SELECT USING (
  current_user_role() = 'member'
  AND EXISTS (
    SELECT 1 FROM contact_pipeline_state cps
    WHERE cps.contact_id = contacts.id
    AND cps.assigned_user_id::text = auth.uid()::text
  )
);
-- contacts: write access for admin + operator
CREATE POLICY "contacts_write" ON contacts FOR ALL USING (is_admin_or_operator());

-- ═══════════════════════════════════════════════════════
-- Group 3: Contact state tables
-- ═══════════════════════════════════════════════════════

-- contact_pipeline_state: read/write patterns by role
CREATE POLICY "cps_read_all" ON contact_pipeline_state FOR SELECT USING (
  current_user_role() IN ('admin', 'operator', 'specialist')
);
CREATE POLICY "cps_read_own" ON contact_pipeline_state FOR SELECT USING (
  current_user_role() = 'member'
  AND assigned_user_id::text = auth.uid()::text
);
CREATE POLICY "cps_write" ON contact_pipeline_state FOR ALL USING (is_admin_or_operator());
CREATE POLICY "cps_update_member" ON contact_pipeline_state FOR UPDATE USING (
  current_user_role() = 'member'
  AND assigned_user_id::text = auth.uid()::text
);

-- contact_sub_task_logs: all can read, specialist can insert own, admin/operator full
CREATE POLICY "sub_task_logs_read_all" ON contact_sub_task_logs FOR SELECT USING (
  current_user_role() IN ('admin', 'operator', 'specialist')
);
CREATE POLICY "sub_task_logs_read_own" ON contact_sub_task_logs FOR SELECT USING (
  current_user_role() = 'member'
  AND EXISTS (
    SELECT 1 FROM contact_pipeline_state cps
    WHERE cps.id = contact_sub_task_logs.contact_pipeline_state_id
    AND cps.assigned_user_id::text = auth.uid()::text
  )
);
CREATE POLICY "sub_task_logs_write_admin_op" ON contact_sub_task_logs FOR ALL USING (is_admin_or_operator());
CREATE POLICY "sub_task_logs_insert_specialist" ON contact_sub_task_logs FOR INSERT WITH CHECK (
  current_user_role() = 'specialist'
  AND logger_user_id::text = auth.uid()::text
);

-- pipeline_stage_history: read all (except member=own), write admin/operator
CREATE POLICY "stage_history_read_all" ON pipeline_stage_history FOR SELECT USING (
  current_user_role() IN ('admin', 'operator', 'specialist')
);
CREATE POLICY "stage_history_read_own" ON pipeline_stage_history FOR SELECT USING (
  current_user_role() = 'member'
  AND EXISTS (
    SELECT 1 FROM contact_pipeline_state cps
    WHERE cps.id = pipeline_stage_history.contact_pipeline_state_id
    AND cps.assigned_user_id::text = auth.uid()::text
  )
);
CREATE POLICY "stage_history_write" ON pipeline_stage_history FOR ALL USING (is_admin_or_operator());

-- ═══════════════════════════════════════════════════════
-- Group 4: Activity + notifications
-- ═══════════════════════════════════════════════════════

-- contact_activity_messages: read all (except member=own contacts), specialist can insert
CREATE POLICY "activity_read_all" ON contact_activity_messages FOR SELECT USING (
  current_user_role() IN ('admin', 'operator', 'specialist')
);
CREATE POLICY "activity_read_own" ON contact_activity_messages FOR SELECT USING (
  current_user_role() = 'member'
  AND EXISTS (
    SELECT 1 FROM contact_pipeline_state cps
    WHERE cps.contact_id = contact_activity_messages.contact_id
    AND cps.assigned_user_id::text = auth.uid()::text
  )
);
CREATE POLICY "activity_write_admin_op" ON contact_activity_messages FOR ALL USING (is_admin_or_operator());
CREATE POLICY "activity_insert_specialist" ON contact_activity_messages FOR INSERT WITH CHECK (
  current_user_role() = 'specialist'
  AND author_user_id::text = auth.uid()::text
);
CREATE POLICY "activity_insert_member" ON contact_activity_messages FOR INSERT WITH CHECK (
  current_user_role() = 'member'
  AND author_user_id::text = auth.uid()::text
);

-- notifications: users can only see their own notifications
CREATE POLICY "notifications_read_own" ON notifications FOR SELECT USING (
  recipient_user_id::text = auth.uid()::text
);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (
  recipient_user_id::text = auth.uid()::text
);
-- System can insert notifications for any user
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);

-- ═══════════════════════════════════════════════════════
-- Group 5: System tables
-- ═══════════════════════════════════════════════════════

-- pipeline_app_settings: read all, write admin only
CREATE POLICY "pipeline_settings_read" ON pipeline_app_settings FOR SELECT USING (true);
CREATE POLICY "pipeline_settings_write" ON pipeline_app_settings FOR ALL USING (is_admin());

-- cron_job_log: read admin/operator, insert all (server writes)
CREATE POLICY "cron_log_read" ON cron_job_log FOR SELECT USING (is_admin_or_operator());
CREATE POLICY "cron_log_insert" ON cron_job_log FOR INSERT WITH CHECK (true);

-- ghl_sync_queue: read admin/operator, insert/update all (server manages)
CREATE POLICY "sync_queue_read" ON ghl_sync_queue FOR SELECT USING (is_admin_or_operator());
CREATE POLICY "sync_queue_write" ON ghl_sync_queue FOR ALL USING (true);
