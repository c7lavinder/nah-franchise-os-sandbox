-- Territory ecosystem: link stakeholders to their contact record.
--
-- territory_stakeholders was free-text name/email with no tie back to the
-- contacts table, which meant an employee added through the ecosystem panel
-- wasn't recognized by the call classifier, the contact page, or anywhere
-- else in the system. This migration:
--
--   1. Adds contact_id as a nullable FK so existing rows keep working and
--      new rows can anchor to a real contact record.
--   2. Backfills contact_id from contacts.email where a single contacts row
--      matches the stakeholder's email. Multi-match cases stay NULL — those
--      need manual cleanup.
--   3. Adds "employee" to the role vocabulary (agent, contractor, family,
--      lawyer, partner, lender, employee, other). role was free-text before
--      so no CHECK constraint to relax, just documenting the set the UI
--      now supports.

ALTER TABLE territory_stakeholders
  ADD COLUMN IF NOT EXISTS contact_id uuid NULL REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_territory_stakeholders_contact
  ON territory_stakeholders(contact_id)
  WHERE contact_id IS NOT NULL;

-- Backfill: match existing stakeholders to contacts by email, only when
-- exactly one contact owns that email. Multi-match rows stay NULL.
-- (Split into two CTEs because Postgres has no min(uuid) aggregate.)
WITH unique_emails AS (
  SELECT lower(email) AS normalized_email
  FROM contacts
  WHERE email IS NOT NULL
  GROUP BY lower(email)
  HAVING count(*) = 1
),
unique_email_contacts AS (
  SELECT c.id, lower(c.email) AS normalized_email
  FROM contacts c
  JOIN unique_emails ue ON lower(c.email) = ue.normalized_email
)
UPDATE territory_stakeholders ts
SET contact_id = uec.id
FROM unique_email_contacts uec
WHERE ts.contact_id IS NULL
  AND ts.email IS NOT NULL
  AND lower(ts.email) = uec.normalized_email;
