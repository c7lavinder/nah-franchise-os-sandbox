-- ══════════════════════════════════════════════
-- Backfill territory_owners from franchise_owners
-- Only inserts where no current owner record exists yet
-- ══════════════════════════════════════════════

INSERT INTO territory_owners (ms_slug, ghl_contact_id, role, start_date)
SELECT
  fo.ms_slug,
  fo.ghl_contact_id,
  'owner',
  COALESCE(fo.created_at::date, CURRENT_DATE)
FROM franchise_owners fo
WHERE fo.ghl_contact_id IS NOT NULL
  AND fo.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM territory_owners tow
    WHERE tow.ms_slug = fo.ms_slug AND tow.end_date IS NULL
  );
