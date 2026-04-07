-- Sprint 1: GHL sync queue table (§1.20 Group 5)
-- Outbound writes to GHL custom fields, retried on failure (§1.16)

CREATE TABLE IF NOT EXISTS ghl_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  ghl_field_id text NOT NULL,
  value text NOT NULL,  -- The stage ID being written
  attempts int NOT NULL DEFAULT 0,
  status ghl_sync_status NOT NULL DEFAULT 'pending',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER ghl_sync_queue_updated_at
  BEFORE UPDATE ON ghl_sync_queue
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
