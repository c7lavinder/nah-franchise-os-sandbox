-- Central Work Queue foundation.
-- Stores normalized queue items fed by source systems such as stale lead
-- alerts and GHL action drafts. Display labels are mapped in app code.

CREATE TABLE IF NOT EXISTS work_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  source_type text NOT NULL
    CHECK (source_type IN ('stale_lead', 'ghl_action_draft')),
  source_table text NOT NULL,
  source_id text NOT NULL,

  status text NOT NULL DEFAULT 'healthy'
    CHECK (status IN ('blocked', 'needs_review', 'due', 'waiting', 'stale', 'healthy', 'done')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  title text NOT NULL,
  description text,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ghl_contact_id text,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,

  due_at timestamptz,
  stale_at timestamptz,
  completed_at timestamptz,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_work_queue_status ON work_queue_items(status);
CREATE INDEX IF NOT EXISTS idx_work_queue_priority ON work_queue_items(priority);
CREATE INDEX IF NOT EXISTS idx_work_queue_assigned_user ON work_queue_items(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_work_queue_contact ON work_queue_items(contact_id);
CREATE INDEX IF NOT EXISTS idx_work_queue_ghl_contact ON work_queue_items(ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_work_queue_source ON work_queue_items(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_work_queue_due_at ON work_queue_items(due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_queue_open ON work_queue_items(status, priority, due_at) WHERE status <> 'done';

CREATE TRIGGER work_queue_items_updated_at
  BEFORE UPDATE ON work_queue_items
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

ALTER TABLE work_queue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_queue_read_authenticated"
  ON work_queue_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "work_queue_write_authenticated"
  ON work_queue_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "work_queue_update_authenticated"
  ON work_queue_items FOR UPDATE TO authenticated USING (true);
