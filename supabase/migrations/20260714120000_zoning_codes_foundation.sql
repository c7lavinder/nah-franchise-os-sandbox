-- ══════════════════════════════════════════════
-- Zoning Codes Foundation (land acquisition due diligence)
-- ══════════════════════════════════════════════
-- Territory-level local zoning & planning knowledge, structured for
-- parcel pre-screening of LandPortal land leads (docs/landportal-zoning-integration.md):
--   jurisdictions      — municipalities/counties under a territory (a territory
--                        spans several jurisdictions, each with its own ordinance)
--   zoning_documents   — stored ordinance/plan documents (raw file in storage,
--                        extracted text kept for AI extraction + future RAG)
--   zoning_districts   — the structured per-district rule table (min lot size,
--                        setbacks, frontage…), AI-extracted then human-verified
--
-- Rollback:
--   DROP TABLE IF EXISTS zoning_districts;
--   DROP TABLE IF EXISTS zoning_documents;
--   DROP TABLE IF EXISTS jurisdictions;

CREATE TABLE IF NOT EXISTS jurisdictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ms_slug text NOT NULL REFERENCES territories(ms_slug) ON DELETE RESTRICT,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'city' CHECK (kind IN ('city', 'town', 'county', 'unincorporated')),
  state text,
  fips_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_jurisdiction_per_territory UNIQUE (ms_slug, name)
);

CREATE INDEX IF NOT EXISTS idx_jurisdictions_ms_slug ON jurisdictions(ms_slug);

CREATE TABLE IF NOT EXISTS zoning_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'zoning_ordinance' CHECK (doc_type IN (
    'zoning_ordinance', 'subdivision_regulations', 'comprehensive_plan',
    'zoning_map', 'fee_schedule', 'other')),
  title text NOT NULL,
  source_url text,
  storage_path text,
  -- ordinances get amended: every answer must carry its as-of date
  effective_date date,
  retrieved_at timestamptz,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zoning_documents_jurisdiction ON zoning_documents(jurisdiction_id);

CREATE TABLE IF NOT EXISTS zoning_districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text,
  category text NOT NULL DEFAULT 'residential' CHECK (category IN (
    'residential', 'commercial', 'industrial', 'agricultural', 'mixed', 'overlay', 'other')),

  -- Deal-critical dimensional rules (all optional — extract what the ordinance states)
  min_lot_acres numeric,
  min_lot_width_ft numeric,
  min_road_frontage_ft numeric,
  front_setback_ft numeric,
  side_setback_ft numeric,
  rear_setback_ft numeric,
  max_height_ft numeric,
  max_lot_coverage_percent numeric,
  min_dwelling_sqft numeric,
  adu_allowed boolean,
  septic_allowed boolean,
  notes text,

  -- Provenance + review workflow: AI-extracted rows are not trusted for
  -- pre-screening until a human verifies them (DRC pattern)
  source_document_id uuid REFERENCES zoning_documents(id) ON DELETE SET NULL,
  extraction_status text NOT NULL DEFAULT 'manual' CHECK (extraction_status IN (
    'ai_extracted', 'verified', 'manual')),
  verified_by text,
  verified_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_district_code_per_jurisdiction UNIQUE (jurisdiction_id, code)
);

CREATE INDEX IF NOT EXISTS idx_zoning_districts_jurisdiction ON zoning_districts(jurisdiction_id);

ALTER TABLE jurisdictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_jurisdictions ON jurisdictions;
CREATE POLICY read_jurisdictions ON jurisdictions FOR SELECT TO authenticated USING (true);

ALTER TABLE zoning_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_zoning_documents ON zoning_documents;
CREATE POLICY read_zoning_documents ON zoning_documents FOR SELECT TO authenticated USING (true);

ALTER TABLE zoning_districts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_zoning_districts ON zoning_districts;
CREATE POLICY read_zoning_districts ON zoning_districts FOR SELECT TO authenticated USING (true);
