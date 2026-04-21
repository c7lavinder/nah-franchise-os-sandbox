-- Final cps retirement. By this point every reader/writer in the app has
-- moved to journey_pipeline_state (see 20260422200000, 20260422300000,
-- 20260422400000 for FK additions, plus the write-path cutover). The only
-- remaining cps references are historical migration files and one-shot
-- scripts; nothing in the runtime path touches it.
--
-- Order:
--   1. Drop RLS policies that key off cps (otherwise the DROP TABLE fails).
--   2. Drop the legacy FK columns + their scope-CHECK constraints +
--      per-column indexes on contact_sub_task_logs, pipeline_stage_history,
--      and calls. Make journey_pipeline_state_id NOT NULL where every row
--      is now populated (sub_task_logs, stage_history).
--   3. Drop the contact_pipeline_state table.

-- ── 1. RLS policies ──────────────────────────────────────────
-- Step 1a: drop the four cps-only policies on contact_pipeline_state.
DROP POLICY IF EXISTS "cps_read_all" ON contact_pipeline_state;
DROP POLICY IF EXISTS "cps_read_own" ON contact_pipeline_state;
DROP POLICY IF EXISTS "cps_write" ON contact_pipeline_state;
DROP POLICY IF EXISTS "cps_update_member" ON contact_pipeline_state;

-- Step 1b: the four member-role policies on related tables currently gate
-- access via a cps sub-query. Drop them and re-create equivalents keyed
-- off journey_pipeline_state. Logic is preserved: a member can read a
-- contact / log / history row / activity message when they are the
-- assigned_user_id on some jps row that links to it.

DROP POLICY IF EXISTS "contacts_read_own_member" ON contacts;
CREATE POLICY "contacts_read_own_member" ON contacts FOR SELECT USING (
  current_user_role() = 'member'
  AND EXISTS (
    SELECT 1 FROM journey_pipeline_state jps
    JOIN journeys j ON j.id = jps.journey_id
    WHERE j.primary_contact_id = contacts.id
      AND jps.assigned_user_id::text = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "sub_task_logs_read_own" ON contact_sub_task_logs;
CREATE POLICY "sub_task_logs_read_own" ON contact_sub_task_logs FOR SELECT USING (
  current_user_role() = 'member'
  AND EXISTS (
    SELECT 1 FROM journey_pipeline_state jps
    WHERE jps.id = contact_sub_task_logs.journey_pipeline_state_id
      AND jps.assigned_user_id::text = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "stage_history_read_own" ON pipeline_stage_history;
CREATE POLICY "stage_history_read_own" ON pipeline_stage_history FOR SELECT USING (
  current_user_role() = 'member'
  AND EXISTS (
    SELECT 1 FROM journey_pipeline_state jps
    WHERE jps.id = pipeline_stage_history.journey_pipeline_state_id
      AND jps.assigned_user_id::text = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "activity_read_own" ON contact_activity_messages;
CREATE POLICY "activity_read_own" ON contact_activity_messages FOR SELECT USING (
  current_user_role() = 'member'
  AND EXISTS (
    SELECT 1 FROM journey_pipeline_state jps
    JOIN journeys j ON j.id = jps.journey_id
    WHERE j.primary_contact_id = contact_activity_messages.contact_id
      AND jps.assigned_user_id::text = auth.uid()::text
  )
);

-- ── 2. FK columns on dependent tables ────────────────────────

-- contact_sub_task_logs: drop the dual-scope CHECK, drop cps FK column,
-- drop the cps-keyed index, then require jps FK on every row.
ALTER TABLE contact_sub_task_logs DROP CONSTRAINT IF EXISTS chk_sub_task_log_has_scope;
DROP INDEX IF EXISTS idx_sub_task_logs_state_time;
ALTER TABLE contact_sub_task_logs DROP COLUMN IF EXISTS contact_pipeline_state_id;
ALTER TABLE contact_sub_task_logs
  ALTER COLUMN journey_pipeline_state_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sub_task_logs_jps_time
  ON contact_sub_task_logs (journey_pipeline_state_id, created_at DESC);

-- pipeline_stage_history: same shape.
ALTER TABLE pipeline_stage_history DROP CONSTRAINT IF EXISTS chk_stage_history_has_scope;
DROP INDEX IF EXISTS idx_stage_history_state_time;
ALTER TABLE pipeline_stage_history DROP COLUMN IF EXISTS contact_pipeline_state_id;
ALTER TABLE pipeline_stage_history
  ALTER COLUMN journey_pipeline_state_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stage_history_jps_time
  ON pipeline_stage_history (journey_pipeline_state_id, created_at DESC);

-- calls: contact_pipeline_state_id was already nullable with no index of
-- its own. Some historical call rows may have a NULL journey_pipeline_state_id
-- if the original cps was already closed at backfill time, so keep jps_id
-- nullable here.
ALTER TABLE calls DROP COLUMN IF EXISTS contact_pipeline_state_id;

-- ── 3. Drop the table ────────────────────────────────────────
DROP TABLE IF EXISTS contact_pipeline_state;
