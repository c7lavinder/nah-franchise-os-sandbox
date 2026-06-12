-- SignalHouse per-user sender ownership.
-- Conversations are partitioned by the SignalHouse number assigned to the user.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signalhouse_phone_number text;

ALTER TABLE sms_messages
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_signalhouse_phone_number_unique
  ON users (signalhouse_phone_number)
  WHERE signalhouse_phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_messages_owner_time
  ON sms_messages(owner_user_id, created_at DESC)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_messages_unread_owner
  ON sms_messages(owner_user_id, read_at, created_at DESC)
  WHERE direction = 'inbound';

COMMENT ON COLUMN users.signalhouse_phone_number IS
  'Assigned SignalHouse sender number. Daily HQ SMS inbox and sends are scoped by this number.';

COMMENT ON COLUMN sms_messages.owner_user_id IS
  'User who owns the local SignalHouse number for this message.';

COMMENT ON COLUMN sms_messages.read_at IS
  'Set when the owning user opens the SignalHouse conversation.';

UPDATE users
SET signalhouse_phone_number = '18654215344'
WHERE signalhouse_phone_number IS NULL
  AND (email ILIKE 'chad%@%' OR full_name ILIKE 'chad %' OR full_name ILIKE 'chad');

UPDATE users
SET signalhouse_phone_number = '18654215345'
WHERE signalhouse_phone_number IS NULL
  AND (email ILIKE 'john%@%' OR full_name ILIKE 'john %' OR full_name ILIKE 'john');

UPDATE sms_messages m
SET owner_user_id = u.id
FROM users u
WHERE m.owner_user_id IS NULL
  AND u.signalhouse_phone_number IS NOT NULL
  AND right(regexp_replace(
    CASE WHEN m.direction = 'inbound' THEN coalesce(m.to_number, '') ELSE coalesce(m.from_number, '') END,
    '\D',
    '',
    'g'
  ), 10) = right(regexp_replace(u.signalhouse_phone_number, '\D', '', 'g'), 10);
