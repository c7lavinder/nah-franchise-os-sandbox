-- Enable RLS on tasks table and add policies.
-- All authenticated users can read tasks (needed for Daily HQ, contact detail).
-- Admins/operators can write. Members can complete their own assigned tasks.

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- All authenticated roles can read tasks
CREATE POLICY "tasks_read_all" ON tasks FOR SELECT USING (
  current_user_role() IN ('admin', 'operator', 'specialist', 'member')
);

-- Admins and operators can create/update/delete any task
CREATE POLICY "tasks_write_admin_op" ON tasks FOR ALL USING (is_admin_or_operator());

-- Members can update tasks assigned to them (e.g., mark complete)
CREATE POLICY "tasks_update_own" ON tasks FOR UPDATE USING (
  current_user_role() = 'member'
  AND assigned_to_user_id::text = auth.uid()::text
);

-- Service role bypass (for webhook handler and cron jobs)
CREATE POLICY "tasks_service_role" ON tasks FOR ALL USING (
  auth.role() = 'service_role'
);
