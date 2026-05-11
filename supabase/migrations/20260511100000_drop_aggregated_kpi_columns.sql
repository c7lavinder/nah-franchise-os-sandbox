-- Drop aggregated KPI placeholder columns from territory_profile.
-- These were never populated — operational KPIs are calculated at runtime
-- from raw property data (ms_properties, ms_property_inventory).

-- Must drop the view first since it depends on these columns.
DROP VIEW IF EXISTS territory_performance;

ALTER TABLE territory_profile
  DROP COLUMN IF EXISTS houses_purchased_ytd,
  DROP COLUMN IF EXISTS houses_sold_ytd,
  DROP COLUMN IF EXISTS active_deals,
  DROP COLUMN IF EXISTS leads_received_ytd,
  DROP COLUMN IF EXISTS lead_conversion_rate,
  DROP COLUMN IF EXISTS avg_time_to_flip_days,
  DROP COLUMN IF EXISTS avg_profit_per_flip,
  DROP COLUMN IF EXISTS total_invested,
  DROP COLUMN IF EXISTS revenue_ytd,
  DROP COLUMN IF EXISTS projected_purchases,
  DROP COLUMN IF EXISTS actual_purchases;

-- Rebuild territory_performance view without the dropped columns.
-- Now shows only identity + owner — KPIs come from the performance API.
CREATE OR REPLACE VIEW territory_performance AS
SELECT
  t."TerritorySlug",
  t."Nickname",
  t.status,
  cto.ghl_contact_id AS current_owner_contact_id,
  cto.first_name || ' ' || cto.last_name AS current_owner_name
FROM territories t
LEFT JOIN LATERAL (
  SELECT tow.ghl_contact_id, c.first_name, c.last_name
  FROM territory_owners tow
  LEFT JOIN contacts c ON tow.ghl_contact_id = c.ghl_contact_id
  WHERE tow."TerritorySlug" = t."TerritorySlug" AND tow.end_date IS NULL
  LIMIT 1
) cto ON true
WHERE t.status = 'active';
