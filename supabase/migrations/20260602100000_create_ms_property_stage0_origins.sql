-- ============================================================
-- MasterSuite Property Stage 0 Origins
--
-- Evidence-based original "0 Lead List" dates for full property rows.
-- Many properties enter MasterSuite directly at Stage 1+, so absence of a
-- row here means "unknown/not evidenced", not "same as Stage 1 date".
-- ============================================================

CREATE TABLE IF NOT EXISTS ms_property_stage0_origins (
  "PropertyId" int PRIMARY KEY REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "TerritorySlug" text REFERENCES territories("TerritorySlug") ON DELETE RESTRICT,
  "original_stage0_inserted_at" timestamptz NOT NULL,
  "evidence_source" text NOT NULL CHECK ("evidence_source" IN ('status_history', 'lead_list_properties')),
  "evidence_status" text,
  "ms_synced_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ms_pso_territory ON ms_property_stage0_origins("TerritorySlug");
CREATE INDEX IF NOT EXISTS idx_ms_pso_inserted ON ms_property_stage0_origins("original_stage0_inserted_at");
CREATE INDEX IF NOT EXISTS idx_ms_pso_source ON ms_property_stage0_origins("evidence_source");

-- Backfill evidence from already-synced status history. This is the strongest
-- evidence because it proves the property was explicitly in "0 Lead List".
INSERT INTO ms_property_stage0_origins (
  "PropertyId",
  "TerritorySlug",
  "original_stage0_inserted_at",
  "evidence_source",
  "evidence_status",
  "ms_synced_at"
)
SELECT
  p."PropertyId",
  p."TerritorySlug",
  MIN(h."Inserted") AS "original_stage0_inserted_at",
  'status_history' AS "evidence_source",
  '0 Lead List' AS "evidence_status",
  now() AS "ms_synced_at"
FROM ms_properties p
JOIN ms_property_status_history h ON h."PropertyId" = p."PropertyId"
WHERE h."NewStatus" = '0 Lead List'
GROUP BY p."PropertyId", p."TerritorySlug"
ON CONFLICT ("PropertyId") DO UPDATE SET
  "TerritorySlug" = EXCLUDED."TerritorySlug",
  "original_stage0_inserted_at" = LEAST(
    ms_property_stage0_origins."original_stage0_inserted_at",
    EXCLUDED."original_stage0_inserted_at"
  ),
  "evidence_source" = 'status_history',
  "evidence_status" = EXCLUDED."evidence_status",
  "ms_synced_at" = now();

-- Backfill from lean lead-list rows only for properties that also have a full
-- ms_properties row. This catches properties that were observed in Stage 0 by
-- the new lean sync and later graduated into Stage 1+.
INSERT INTO ms_property_stage0_origins (
  "PropertyId",
  "TerritorySlug",
  "original_stage0_inserted_at",
  "evidence_source",
  "evidence_status",
  "ms_synced_at"
)
SELECT
  p."PropertyId",
  p."TerritorySlug",
  llp."Inserted" AS "original_stage0_inserted_at",
  'lead_list_properties' AS "evidence_source",
  llp."Status" AS "evidence_status",
  now() AS "ms_synced_at"
FROM ms_properties p
JOIN ms_lead_list_properties llp ON llp."PropertyId" = p."PropertyId"
WHERE llp."Inserted" IS NOT NULL
ON CONFLICT ("PropertyId") DO UPDATE SET
  "TerritorySlug" = EXCLUDED."TerritorySlug",
  "original_stage0_inserted_at" = LEAST(
    ms_property_stage0_origins."original_stage0_inserted_at",
    EXCLUDED."original_stage0_inserted_at"
  ),
  "evidence_source" = CASE
    WHEN ms_property_stage0_origins."evidence_source" = 'status_history' THEN 'status_history'
    ELSE EXCLUDED."evidence_source"
  END,
  "evidence_status" = COALESCE(ms_property_stage0_origins."evidence_status", EXCLUDED."evidence_status"),
  "ms_synced_at" = now();
