-- Tasks table — local storage for GHL tasks with two-way sync.
-- Tasks are created in Supabase first, then pushed to GHL.
-- GHL TaskUpdate webhooks sync back completions/updates.

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_task_id text UNIQUE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ghl_contact_id text,
  title text NOT NULL,
  body text,
  due_date timestamptz,
  assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_ghl_user_id text,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  source text NOT NULL DEFAULT 'nah_os',
  ghl_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to_user_id);
CREATE INDEX idx_tasks_ghl_task_id ON tasks(ghl_task_id);
CREATE INDEX idx_tasks_completed ON tasks(completed) WHERE NOT completed;
