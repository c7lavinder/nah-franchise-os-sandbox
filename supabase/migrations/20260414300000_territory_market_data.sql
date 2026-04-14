-- ═══════════════════════════════════════════════════════════════════
-- Territory Market Data — EAV table for 120+ market data fields
-- Population sources: census, zillow, attom, bls, manual, scout,
--                     mastersuite, calculated
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS territory_market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_slug TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_value TEXT,
  source TEXT DEFAULT 'manual',
  source_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  UNIQUE (territory_slug, field_name)
);

CREATE INDEX IF NOT EXISTS idx_territory_market_data_slug
  ON territory_market_data(territory_slug);

CREATE INDEX IF NOT EXISTS idx_territory_market_data_field
  ON territory_market_data(field_name);
