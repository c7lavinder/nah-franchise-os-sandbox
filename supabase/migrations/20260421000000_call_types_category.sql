-- Sprint: call-participant-mapping-ui (Phase 1).
-- Group call types by category so the Reclassify modal can render grouped
-- panels instead of a flat list. Admins can regroup from Settings later.

ALTER TABLE call_types
  ADD COLUMN IF NOT EXISTS category text NULL;

-- Seed categories for the slugs in use today.
UPDATE call_types SET category = 'sales'
  WHERE slug IN ('intro_call', 'matt_call', 'matt_final_call', 'sam_call', 'mark_call')
    AND category IS NULL;

UPDATE call_types SET category = 'coaching'
  WHERE slug = 'coaching_call' AND category IS NULL;

UPDATE call_types SET category = 'internal'
  WHERE slug = 'team_call' AND category IS NULL;

UPDATE call_types SET category = 'other'
  WHERE slug = 'unclassified' AND category IS NULL;

-- Anything else that wasn't seeded above falls into 'other' so the UI never
-- orphans a call type.
UPDATE call_types SET category = 'other' WHERE category IS NULL;
