-- ══════════════════════════════════════════════
-- GHL Appointments (webhook-fed calendar mirror)
-- ══════════════════════════════════════════════
-- Populated by AppointmentCreate/Update/Delete webhooks
-- (app/api/webhooks/ghl/route.ts) plus a one-time backfill script.
-- Deletes are soft (deleted_at) because the nightly MasterSuite push
-- is an upsert-by-PK and cannot propagate hard deletes.
--
-- Rollback:
--   DROP TABLE IF EXISTS ghl_appointments;

CREATE TABLE IF NOT EXISTS ghl_appointments (
  ghl_appointment_id text PRIMARY KEY,
  calendar_id text,
  ghl_contact_id text,
  title text,
  assigned_user_id text,
  appointment_status text,
  address text,
  source text,
  notes text,
  location_id text,
  group_id text,
  start_time timestamptz,
  end_time timestamptz,
  date_added timestamptz,
  date_updated timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ghl_appointments_contact ON ghl_appointments(ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_ghl_appointments_start ON ghl_appointments(start_time) WHERE deleted_at IS NULL;

ALTER TABLE ghl_appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_ghl_appointments ON ghl_appointments;
CREATE POLICY read_ghl_appointments ON ghl_appointments FOR SELECT TO authenticated USING (true);
