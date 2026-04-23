-- ═══════════════════════════════════════════════════════════════════
-- Sprint: multi-email on contacts.
--
-- Context: a prospect starts with a personal email (gmail.com, yahoo,
-- etc.), and once they become a franchisee they get an @newagainhouses.com
-- address. Today contacts.email is a single column, so when the second
-- address shows up in GHL it either overwrites the first or creates a
-- duplicate contact. Neither is right — we need to keep all of a person's
-- addresses attached to one contact record.
--
-- Model:
--   contact_emails holds N rows per contact. Exactly one is marked
--   is_primary (enforced by a partial unique index). A trigger keeps
--   contacts.email in sync with whatever row is currently primary, so
--   existing joins that read contacts.email keep working with zero code
--   changes during rollout.
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS contact_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email citext NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  label text,              -- 'personal' | 'franchisee' | 'work' | null
  source text NOT NULL DEFAULT 'manual',
    -- 'ghl' = synced from GHL webhook/API
    -- 'merge' = absorbed from a merged duplicate contact
    -- 'manual' = added through the UI
    -- 'backfill' = inserted by this migration
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Same email can't be added twice to the same contact.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contact_email_per_contact
  ON contact_emails(contact_id, email);

-- At most one primary email per contact.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_primary_email_per_contact
  ON contact_emails(contact_id) WHERE is_primary = true;

-- Lookup by email across all contacts (merge + search).
CREATE INDEX IF NOT EXISTS idx_contact_emails_email
  ON contact_emails(email);

CREATE TRIGGER contact_emails_updated_at
  BEFORE UPDATE ON contact_emails
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ── Keep contacts.email denormalized with whatever row is primary ────
-- On insert/update: if this row is the primary, reflect it to contacts.email.
-- On delete of a primary: promote the oldest remaining row to primary
-- and sync, or null out contacts.email if none remain.
CREATE OR REPLACE FUNCTION sync_primary_email_to_contacts() RETURNS trigger AS $$
DECLARE
  fallback_id   uuid;
  fallback_email text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_primary THEN
      SELECT id, email INTO fallback_id, fallback_email
      FROM contact_emails
      WHERE contact_id = OLD.contact_id
      ORDER BY created_at ASC
      LIMIT 1;
      IF fallback_id IS NOT NULL THEN
        UPDATE contact_emails SET is_primary = true WHERE id = fallback_id;
        UPDATE contacts SET email = fallback_email::text WHERE id = OLD.contact_id;
      ELSE
        UPDATE contacts SET email = NULL WHERE id = OLD.contact_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.is_primary THEN
    UPDATE contacts SET email = NEW.email::text WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_emails_sync_primary
  AFTER INSERT OR UPDATE OR DELETE ON contact_emails
  FOR EACH ROW
  EXECUTE FUNCTION sync_primary_email_to_contacts();

-- ── Backfill from contacts.email ────────────────────────────────────
-- Every contact with a non-empty email gets a primary row. Blank strings
-- are normalized to NULL and skipped. Idempotent via the unique index.
INSERT INTO contact_emails (contact_id, email, is_primary, source)
SELECT id, email::citext, true, 'backfill'
FROM contacts
WHERE email IS NOT NULL AND trim(email) <> ''
ON CONFLICT (contact_id, email) DO NOTHING;
