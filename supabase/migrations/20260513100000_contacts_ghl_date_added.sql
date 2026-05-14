-- Add ghl_date_added to contacts so we can query by original GHL creation date.
-- contacts.created_at = when synced into Supabase (unreliable for "when did this lead come in").
-- ghl_date_added = when the contact was actually created in GHL (form submission date).

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ghl_date_added timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_ghl_date_added ON contacts (ghl_date_added);
