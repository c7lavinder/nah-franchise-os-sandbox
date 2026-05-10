-- ============================================================
-- EOS Sync Support — add ms_id for MasterSuite row tracking
-- ============================================================

-- Row-for-row tables need ms_id to track which rows came from MasterSuite
-- ms_id NULL = manual/carried-forward, ms_id NOT NULL = synced from MS

ALTER TABLE eos_territory_rocks ADD COLUMN IF NOT EXISTS ms_id int UNIQUE;
ALTER TABLE eos_territory_todos ADD COLUMN IF NOT EXISTS ms_id int UNIQUE;
ALTER TABLE eos_territory_issues ADD COLUMN IF NOT EXISTS ms_id int UNIQUE;
ALTER TABLE eos_territory_budgets ADD COLUMN IF NOT EXISTS ms_id int UNIQUE;

-- Eos_Goals maps to scorecard goal targets (not eos_territory_goals)
-- Add 3 scorecard metrics that MS tracks but we don't seed yet
INSERT INTO eos_territory_scorecard ("TerritorySlug", metric_key, metric_label, sort_order)
SELECT t."TerritorySlug", m.key, m.label, m.sort
FROM territories t
CROSS JOIN (VALUES
  ('t3_incoming_lead_forms', 'T3 Incoming Lead Forms', 8),
  ('t3_outbound_qty', 'T3 Outbound Qty', 9),
  ('percent_unique_content', '% Unique Content', 10)
) AS m(key, label, sort)
WHERE t.status = 'active'
ON CONFLICT ("TerritorySlug", metric_key) DO NOTHING;
