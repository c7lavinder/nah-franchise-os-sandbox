-- Sprint: call-mapping-v2 (Phase 3).
-- Let a related-people row point at a full contacts row so "Add Contact" in
-- the mapping UI can create both records and keep them linked.

ALTER TABLE contact_related_people
  ADD COLUMN IF NOT EXISTS linked_contact_id uuid NULL REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_related_people_linked_contact
  ON contact_related_people(linked_contact_id)
  WHERE linked_contact_id IS NOT NULL;
