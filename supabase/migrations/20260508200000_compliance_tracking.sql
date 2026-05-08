-- P1.6: FDD/Compliance tracking for franchise disclosure law.
-- Tracks FDD issue dates, 14-day cooling periods, state registrations,
-- training completion, and agreement status per contact.

CREATE TABLE IF NOT EXISTS compliance_tracking (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- FDD disclosure
  fdd_version           TEXT,                 -- e.g. "2026-v3"
  fdd_issued_at         TIMESTAMPTZ,          -- when FDD was given to prospect
  fdd_acknowledged_at   TIMESTAMPTZ,          -- when prospect confirmed receipt
  fdd_cooling_ends_at   TIMESTAMPTZ,          -- issued_at + 14 days (auto-calculated)
  fdd_state             TEXT,                 -- state where prospect is being disclosed

  -- State registration
  state_registration_status  TEXT DEFAULT 'not_required',  -- not_required, pending, filed, approved, expired
  state_registration_expiry  DATE,

  -- Agreement
  franchise_agreement_sent_at   TIMESTAMPTZ,
  franchise_agreement_signed_at TIMESTAMPTZ,
  franchise_agreement_version   TEXT,
  docusign_envelope_id          TEXT,

  -- Training
  training_started_at   TIMESTAMPTZ,
  training_completed_at TIMESTAMPTZ,
  training_modules_completed  INT DEFAULT 0,
  training_modules_total      INT DEFAULT 0,

  -- Insurance & compliance
  insurance_verified_at TIMESTAMPTZ,
  background_check_status TEXT DEFAULT 'pending',  -- pending, passed, failed, waived
  background_check_at   TIMESTAMPTZ,

  -- Metadata
  notes        TEXT,
  updated_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS uniq_compliance_contact
  ON compliance_tracking (contact_id);

CREATE INDEX IF NOT EXISTS idx_compliance_fdd_cooling
  ON compliance_tracking (fdd_cooling_ends_at)
  WHERE fdd_cooling_ends_at IS NOT NULL AND franchise_agreement_signed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_state_reg
  ON compliance_tracking (state_registration_status)
  WHERE state_registration_status NOT IN ('not_required', 'approved');

CREATE INDEX IF NOT EXISTS idx_compliance_training
  ON compliance_tracking (training_completed_at)
  WHERE training_completed_at IS NULL AND training_started_at IS NOT NULL;

-- Auto-calculate FDD cooling period when FDD is issued
CREATE OR REPLACE FUNCTION calculate_fdd_cooling()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fdd_issued_at IS NOT NULL AND (OLD.fdd_issued_at IS NULL OR NEW.fdd_issued_at != OLD.fdd_issued_at) THEN
    NEW.fdd_cooling_ends_at := NEW.fdd_issued_at + INTERVAL '14 days';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compliance_fdd_cooling
  BEFORE INSERT OR UPDATE ON compliance_tracking
  FOR EACH ROW
  EXECUTE FUNCTION calculate_fdd_cooling();

-- RLS
ALTER TABLE compliance_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_select ON compliance_tracking
  FOR SELECT TO authenticated USING (true);

CREATE POLICY compliance_insert ON compliance_tracking
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY compliance_update ON compliance_tracking
  FOR UPDATE TO authenticated USING (true);
