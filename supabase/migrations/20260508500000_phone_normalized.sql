-- FIX-4: Add normalized phone column for fast duplicate detection.
-- Stores last 10 digits of phone (no formatting). Indexed for lookups.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

-- Backfill from existing phone data
UPDATE contacts
SET phone_normalized = RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10)
WHERE phone IS NOT NULL AND phone_normalized IS NULL;

-- Index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_contacts_phone_normalized
  ON contacts (phone_normalized)
  WHERE phone_normalized IS NOT NULL;

-- Trigger to auto-populate on insert/update
CREATE OR REPLACE FUNCTION normalize_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone_normalized := RIGHT(REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g'), 10);
  ELSE
    NEW.phone_normalized := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contacts_normalize_phone
  BEFORE INSERT OR UPDATE OF phone ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION normalize_phone();
