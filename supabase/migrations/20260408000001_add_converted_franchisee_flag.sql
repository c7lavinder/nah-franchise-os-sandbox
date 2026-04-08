-- Sprint 8: Add converted franchisee tracking columns to contacts table.
-- Enables tagging contacts who closed/completed a deal (from Client Tether CSV).

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_converted_franchisee boolean NOT NULL DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_converted
  ON contacts(is_converted_franchisee) WHERE is_converted_franchisee = true;
