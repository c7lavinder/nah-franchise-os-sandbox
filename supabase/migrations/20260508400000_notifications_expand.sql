-- P4.2: Expand notifications table to support multiple notification types.
-- Original schema only supported @-mention notifications (source_type, source_id, contact_id).
-- New types: daily_brief, new_lead, compliance_alert, workflow_pending.

-- Add new columns for rich notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Make source_id and contact_id nullable (not needed for daily_brief, new_lead types)
ALTER TABLE notifications
  ALTER COLUMN source_id DROP NOT NULL,
  ALTER COLUMN contact_id DROP NOT NULL;

-- Backfill type from source_type for existing rows
UPDATE notifications SET type = source_type::text WHERE type IS NULL;

-- Index on type + recipient for filtering
CREATE INDEX IF NOT EXISTS idx_notifications_type_recipient
  ON notifications (recipient_user_id, type, created_at DESC);

-- Index for unread count queries
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;
