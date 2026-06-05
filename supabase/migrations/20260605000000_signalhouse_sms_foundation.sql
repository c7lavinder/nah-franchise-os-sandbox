-- SignalHouse SMS foundation.
-- Stores outbound sends, inbound replies, and delivery callbacks without making
-- SignalHouse the source of truth for contacts.

CREATE TABLE IF NOT EXISTS sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'signalhouse',
  provider_message_id text NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ghl_contact_id text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type text NOT NULL DEFAULT 'SMS',
  from_number text,
  to_number text,
  body text,
  status text,
  segment_count int,
  carrier text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  received_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_message_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_contact_time
  ON sms_messages(contact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_messages_ghl_contact_time
  ON sms_messages(ghl_contact_id, created_at DESC)
  WHERE ghl_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_messages_status
  ON sms_messages(provider, status, updated_at DESC);

CREATE TRIGGER sms_messages_updated_at
  BEFORE UPDATE ON sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
