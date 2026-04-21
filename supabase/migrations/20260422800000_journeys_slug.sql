-- Plain-English URLs for journeys. Adds a slug column + unique partial
-- index (slug optional on insert — the app backfills it). Existing rows
-- get populated by scripts/backfill-journey-slugs.ts in a separate pass
-- so we can pre-compute + deduplicate names without holding a long
-- migration lock.

ALTER TABLE journeys ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_journeys_slug ON journeys(slug) WHERE slug IS NOT NULL;
