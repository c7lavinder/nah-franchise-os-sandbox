-- ═══════════════════════════════════════════════════════════════════
-- Contact merge columns.
--
-- When a duplicate contact gets merged into a keeper, we don't delete
-- the duplicate row (foreign keys + audit trail would suffer). Instead
-- we mark it merged and point at the keeper. The merge endpoint
-- reassigns the most user-visible references (calls, contact_emails,
-- journey_contacts) so they show up under the keeper.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS merged_into_contact_id uuid
    REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_merged_into
  ON contacts(merged_into_contact_id)
  WHERE merged_into_contact_id IS NOT NULL;

COMMENT ON COLUMN contacts.merged_into_contact_id IS
  'When set, this contact has been merged into the referenced contact. UI should hide merged contacts from default lists.';
