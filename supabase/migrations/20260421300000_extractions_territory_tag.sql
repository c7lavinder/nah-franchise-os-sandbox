-- Sprint: call-mapping-v2 (Phase 7).
-- Tag each data extraction with the territory it applies to. When a call
-- touches multiple territories, the post-call agent uses context to decide
-- which territory a given data point (population, median home price, etc)
-- belongs to; the UI can then route the extraction to the right territory's
-- market snapshot instead of clobbering the primary one.

ALTER TABLE call_data_extractions
  ADD COLUMN IF NOT EXISTS territory_ms_slug text
  REFERENCES territories(ms_slug) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_call_data_extractions_territory
  ON call_data_extractions(territory_ms_slug)
  WHERE territory_ms_slug IS NOT NULL;
