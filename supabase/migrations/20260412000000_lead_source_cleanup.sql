-- Lead Source cleanup: add sub_source column, reference tables, standardize existing data.

-- 1. Add sub_source column to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sub_source text;

-- 2. Create reference tables for lead sources
CREATE TABLE IF NOT EXISTS lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_sub_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_source_id uuid NOT NULL REFERENCES lead_sources(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_source_id, name)
);

-- 3. Seed standard lead sources
INSERT INTO lead_sources (name, sort_order) VALUES
  ('Paid Ad', 1),
  ('Organic', 2),
  ('Referral', 3),
  ('Event', 4),
  ('Outbound', 5)
ON CONFLICT (name) DO NOTHING;

-- 4. Seed sub-sources
INSERT INTO lead_sub_sources (lead_source_id, name, sort_order) VALUES
  ((SELECT id FROM lead_sources WHERE name = 'Paid Ad'), 'Facebook', 1),
  ((SELECT id FROM lead_sources WHERE name = 'Paid Ad'), 'Google', 2),
  ((SELECT id FROM lead_sources WHERE name = 'Paid Ad'), 'Instagram', 3),
  ((SELECT id FROM lead_sources WHERE name = 'Paid Ad'), 'YouTube', 4),
  ((SELECT id FROM lead_sources WHERE name = 'Organic'), 'Website', 1),
  ((SELECT id FROM lead_sources WHERE name = 'Organic'), 'SEO', 2),
  ((SELECT id FROM lead_sources WHERE name = 'Organic'), 'Social Media', 3),
  ((SELECT id FROM lead_sources WHERE name = 'Organic'), 'Direct', 4),
  ((SELECT id FROM lead_sources WHERE name = 'Referral'), 'Tres Pigg', 1),
  ((SELECT id FROM lead_sources WHERE name = 'Referral'), 'Chad Arnold', 2),
  ((SELECT id FROM lead_sources WHERE name = 'Referral'), 'Will', 3),
  ((SELECT id FROM lead_sources WHERE name = 'Event'), 'Conference', 1),
  ((SELECT id FROM lead_sources WHERE name = 'Event'), 'Webinar', 2),
  ((SELECT id FROM lead_sources WHERE name = 'Outbound'), 'Cold Call', 1),
  ((SELECT id FROM lead_sources WHERE name = 'Outbound'), 'Email Campaign', 2),
  ((SELECT id FROM lead_sources WHERE name = 'Outbound'), 'LinkedIn', 3)
ON CONFLICT (lead_source_id, name) DO NOTHING;

-- 5. Standardize existing data

-- Website form variants → Organic / Website
UPDATE contacts SET opportunity_source = 'Organic', sub_source = 'Website'
WHERE lower(opportunity_source) IN (
  'franchise inquiry form',
  'newagainhouses.com franchise form'
);

-- Person names → Referral / <name>
UPDATE contacts SET sub_source = 'Tres Pigg', opportunity_source = 'Referral'
WHERE lower(opportunity_source) IN ('tres pigg');

UPDATE contacts SET sub_source = 'Chad Arnold', opportunity_source = 'Referral'
WHERE opportunity_source = 'Chad Arnold';

UPDATE contacts SET sub_source = 'Will', opportunity_source = 'Referral'
WHERE opportunity_source = 'Will - Franchise Sale Call Calendar';

-- Clean junk values
UPDATE contacts SET opportunity_source = NULL
WHERE opportunity_source IN ('undefined', 'Unknown', '');
