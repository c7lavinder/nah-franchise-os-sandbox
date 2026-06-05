-- Assign each app user to a SignalHouse sending number and track per-user inbox reads.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS assigned_signalhouse_number text;

CREATE INDEX IF NOT EXISTS idx_users_assigned_signalhouse_number
  ON users(assigned_signalhouse_number)
  WHERE assigned_signalhouse_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_messages_numbers_time
  ON sms_messages(from_number, to_number, created_at DESC);

UPDATE sms_messages
SET
  from_number = CASE
    WHEN length(regexp_replace(coalesce(from_number, ''), '\D', '', 'g')) = 10
      THEN '1' || regexp_replace(coalesce(from_number, ''), '\D', '', 'g')
    WHEN length(regexp_replace(coalesce(from_number, ''), '\D', '', 'g')) > 0
      THEN regexp_replace(coalesce(from_number, ''), '\D', '', 'g')
    ELSE from_number
  END,
  to_number = CASE
    WHEN length(regexp_replace(coalesce(to_number, ''), '\D', '', 'g')) = 10
      THEN '1' || regexp_replace(coalesce(to_number, ''), '\D', '', 'g')
    WHEN length(regexp_replace(coalesce(to_number, ''), '\D', '', 'g')) > 0
      THEN regexp_replace(coalesce(to_number, ''), '\D', '', 'g')
    ELSE to_number
  END
WHERE from_number IS NOT NULL OR to_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS sms_conversation_reads (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_key)
);
