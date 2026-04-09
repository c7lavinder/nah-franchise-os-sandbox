-- Bug + Design Sprint: Add territory and deal detail fields to contacts table

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS territory text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS territory_slug text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS legal_entity text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS franchise_fee numeric;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS royalty_pct numeric;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS term_months int;

CREATE INDEX IF NOT EXISTS idx_contacts_territory_slug ON contacts(territory_slug) WHERE territory_slug IS NOT NULL;
