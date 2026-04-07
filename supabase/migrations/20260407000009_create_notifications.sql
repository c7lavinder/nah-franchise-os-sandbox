-- Sprint 1: Notifications table (§1.20 Group 4)
-- Bell icon feed — @-mentions only for MVP (§1.17)

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES users(id),
  source_type notification_source_type NOT NULL DEFAULT 'activity_mention',
  source_id uuid NOT NULL,  -- The activity message ID
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,  -- For deep-link
  read_at timestamptz,  -- Null = unread
  created_at timestamptz NOT NULL DEFAULT now()
);
