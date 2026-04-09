-- Bug + Design Sprint: Related people for a contact (spouse, attorney, etc.)

CREATE TABLE IF NOT EXISTS contact_related_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  phone text,
  role text NOT NULL DEFAULT 'other' CHECK (role IN ('spouse','family','attorney','accountant','financial_advisor','business_partner','other')),
  relationship_notes text,
  is_primary_decision_maker boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_contact_related_people_contact ON contact_related_people(contact_id);
