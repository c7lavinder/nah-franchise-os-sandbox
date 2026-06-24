-- Vonage SMS: per-user sending number assignment.
-- Mirrors assigned_signalhouse_number. The shared sms_messages table already
-- carries a `provider` column, so Vonage rows reuse it with provider='vonage'.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS assigned_vonage_number text;

CREATE INDEX IF NOT EXISTS idx_users_assigned_vonage_number
  ON users(assigned_vonage_number)
  WHERE assigned_vonage_number IS NOT NULL;
