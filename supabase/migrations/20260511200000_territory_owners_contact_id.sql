-- ============================================================
-- Add contact_id (UUID) to territory_owners
-- ============================================================
-- territory_owners currently links to contacts via ghl_contact_id (text).
-- This adds a direct contact_id FK so territory lookup doesn't require
-- a GHL ID roundtrip. Supabase is source of truth, not GHL.
-- ============================================================

-- 1. Add the column
ALTER TABLE territory_owners
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- 2. Backfill from existing ghl_contact_id → contacts.ghl_contact_id
UPDATE territory_owners tow
SET contact_id = c.id
FROM contacts c
WHERE tow.ghl_contact_id = c.ghl_contact_id
  AND tow.contact_id IS NULL
  AND c.ghl_contact_id IS NOT NULL;

-- 3. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_territory_owners_contact_id
  ON territory_owners(contact_id) WHERE contact_id IS NOT NULL;
