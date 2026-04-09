-- Explicit team member assignments for a contact (manual add/remove)
CREATE TABLE IF NOT EXISTS contact_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contact_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_team_members_contact ON contact_team_members(contact_id);
