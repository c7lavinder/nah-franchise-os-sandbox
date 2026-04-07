-- Sprint 1: Contact activity messages table (§1.20 Group 4)
-- Internal team messenger on each contact (§1.17)
-- @-mentions in these messages drive the notification bell

CREATE TABLE IF NOT EXISTS contact_activity_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  mentioned_user_ids uuid[],  -- Array of @-tagged users
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz  -- Soft delete
);

CREATE TRIGGER contact_activity_messages_updated_at
  BEFORE UPDATE ON contact_activity_messages
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
