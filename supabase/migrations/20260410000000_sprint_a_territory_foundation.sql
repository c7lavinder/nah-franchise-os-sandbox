-- ============================================================
-- Sprint A — Territory Foundation
-- 10 tables, entity_type on pipelines, 4 views
-- ============================================================

-- Add entity_type to pipelines (contact vs territory binding)
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'contact'
  CHECK (entity_type IN ('contact', 'territory'));

-- ════════════════════════════════════════════════
-- 1. TERRITORIES — the business unit (never deleted)
-- ════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS territories (
  ms_slug text PRIMARY KEY,
  territory_name text NOT NULL,
  region text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'available')),
  awarded_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_territories_status ON territories(status);

-- ════════════════════════════════════════════════
-- 2. TERRITORY_OWNERS — transfer record (append-only)
-- ════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS territory_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ms_slug text NOT NULL REFERENCES territories(ms_slug) ON DELETE RESTRICT,
  ghl_contact_id text REFERENCES contacts(ghl_contact_id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'co-owner')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  transfer_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_to_ms_slug ON territory_owners(ms_slug);
CREATE INDEX idx_to_contact ON territory_owners(ghl_contact_id);
CREATE INDEX idx_to_current ON territory_owners(ms_slug) WHERE end_date IS NULL;

-- ════════════════════════════════════════════════
-- 3. TERRITORY_CANDIDATES — prospect → territory matching
-- ════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS territory_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ms_slug text NOT NULL REFERENCES territories(ms_slug) ON DELETE RESTRICT,
  ghl_contact_id text NOT NULL REFERENCES contacts(ghl_contact_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'considering' CHECK (status IN ('considering', 'presented', 'declined', 'awarded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_territory_candidate UNIQUE (ms_slug, ghl_contact_id)
);

-- ════════════════════════════════════════════════
-- 4. FRANCHISE_OWNERS — master record from Client Tether
-- ════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS franchise_owners (
  ms_slug text PRIMARY KEY REFERENCES territories(ms_slug) ON DELETE RESTRICT,
  full_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  ghl_contact_id text REFERENCES contacts(ghl_contact_id) ON DELETE SET NULL,
  ct_id text,
  ct_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════
-- 5. ZORAKLE_PROFILES — personality data (owner or prospect)
-- ════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS zorakle_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ms_slug text REFERENCES territories(ms_slug) ON DELETE SET NULL,
  full_name text NOT NULL,
  batch text,
  eclipse_overall int,
  values_score int,
  stages_score int,
  cultural_score int,
  sales_score int,
  biz_path_score int,
  values_type text,
  culture text,
  work_style text,
  eclipse_drive_id text,
  spoton_drive_id text,
  fit_score int,
  risk_flag text CHECK (risk_flag IN ('green', 'yellow', 'red') OR risk_flag IS NULL),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_zp_ms_slug ON zorakle_profiles(ms_slug);
CREATE INDEX idx_zp_risk ON zorakle_profiles(risk_flag);

-- ════════════════════════════════════════════════
-- 6. CONTACT_ZORAKLE_DATA — prospect personality data
-- ════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contact_zorakle_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id text UNIQUE NOT NULL REFERENCES contacts(ghl_contact_id) ON DELETE CASCADE,
  eclipse_overall int,
  values_type text,
  work_style text,
  culture text,
  eclipse_drive_id text,
  spoton_drive_id text,
  fit_score int,
  risk_flag text CHECK (risk_flag IN ('green', 'yellow', 'red') OR risk_flag IS NULL),
  zorakle_completed_at timestamptz,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'webhook', 'api')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════
-- 7. TERRITORY_PROFILE — market, ops, financial, coaching
-- ════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS territory_profile (
  ms_slug text PRIMARY KEY REFERENCES territories(ms_slug) ON DELETE RESTRICT,
  -- Market
  territory_value_est numeric,
  market_type text,
  stage3_pct numeric,
  stage5_pct numeric,
  flip_activity_score numeric,
  competitor_presence text,
  local_market_notes text,
  -- Operations
  leads_received_ytd int DEFAULT 0,
  lead_conversion_rate numeric,
  active_deals int DEFAULT 0,
  houses_purchased_ytd int DEFAULT 0,
  houses_sold_ytd int DEFAULT 0,
  avg_time_to_flip_days int,
  avg_profit_per_flip numeric,
  -- Financial
  total_invested numeric,
  revenue_ytd numeric,
  projected_purchases int,
  actual_purchases int,
  -- Coaching
  last_checkin_date date,
  coaching_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════
-- 8. TERRITORY_GRADES — quarterly grading history
-- ════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS territory_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ms_slug text NOT NULL REFERENCES territories(ms_slug) ON DELETE RESTRICT,
  year int NOT NULL,
  quarter int NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  self_grade int CHECK (self_grade BETWEEN 1 AND 5),
  john_grade int CHECK (john_grade BETWEEN 1 AND 5),
  houses_purchased int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_grade_period UNIQUE (ms_slug, year, quarter)
);

CREATE INDEX idx_tg_ms_slug ON territory_grades(ms_slug);

-- ════════════════════════════════════════════════
-- 9. CONTACT_PROFILE_DATA — sales intel per contact
-- ════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contact_profile_data (
  ghl_contact_id text PRIMARY KEY REFERENCES contacts(ghl_contact_id) ON DELETE CASCADE,
  -- Financial capacity
  liquid_capital numeric,
  financing_type text,
  net_worth_estimate numeric,
  guidant_robs_active boolean,
  pfs_received boolean,
  -- Territory preferences
  desired_territory text,
  market_area text,
  secondary_territory text,
  territory_value_est numeric,
  zip_codes_of_interest text,
  local_market_notes text,
  competitor_notes text,
  -- Sales call intel
  primary_motivation text,
  definition_of_success text,
  objections_raised text,
  decision_style text,
  prior_re_experience text,
  skill_set_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════
-- 10. Already exists: contacts — just note ghl_contact_id is PK equivalent
-- ════════════════════════════════════════════════

-- ════════════════════════════════════════════════
-- VIEWS
-- ════════════════════════════════════════════════

-- Current territory owners (active ownership)
CREATE OR REPLACE VIEW current_territory_owners AS
SELECT
  t.ms_slug,
  t.territory_name,
  t.status AS territory_status,
  t.region,
  tow.id AS owner_record_id,
  tow.ghl_contact_id,
  tow.role,
  tow.start_date,
  c.first_name,
  c.last_name,
  c.email,
  c.phone
FROM territories t
LEFT JOIN territory_owners tow ON t.ms_slug = tow.ms_slug AND tow.end_date IS NULL
LEFT JOIN contacts c ON tow.ghl_contact_id = c.ghl_contact_id;

-- Full ownership history timeline
CREATE OR REPLACE VIEW territory_ownership_history AS
SELECT
  t.ms_slug,
  t.territory_name,
  tow.ghl_contact_id,
  c.first_name || ' ' || c.last_name AS owner_name,
  tow.role,
  tow.start_date,
  tow.end_date,
  tow.end_date - tow.start_date AS days_owned,
  tow.transfer_notes
FROM territories t
JOIN territory_owners tow ON t.ms_slug = tow.ms_slug
LEFT JOIN contacts c ON tow.ghl_contact_id = c.ghl_contact_id
ORDER BY t.ms_slug, tow.start_date;

-- All territories a contact has owned
CREATE OR REPLACE VIEW contact_territory_history AS
SELECT
  tow.ghl_contact_id,
  c.first_name || ' ' || c.last_name AS contact_name,
  t.ms_slug,
  t.territory_name,
  tow.role,
  tow.start_date,
  tow.end_date,
  tow.end_date IS NULL AS is_current,
  tow.transfer_notes
FROM territory_owners tow
JOIN territories t ON tow.ms_slug = t.ms_slug
LEFT JOIN contacts c ON tow.ghl_contact_id = c.ghl_contact_id
ORDER BY tow.ghl_contact_id, tow.start_date;

-- Territory performance (active territories + velocity)
CREATE OR REPLACE VIEW territory_performance AS
SELECT
  t.ms_slug,
  t.territory_name,
  t.status,
  tp.houses_purchased_ytd,
  tp.houses_sold_ytd,
  tp.avg_profit_per_flip,
  tp.active_deals,
  tp.lead_conversion_rate,
  CASE
    WHEN tp.houses_purchased_ytd >= 10 THEN 'on_track'
    WHEN tp.houses_purchased_ytd >= 5 THEN 'building'
    ELSE 'at_risk'
  END AS velocity_status,
  cto.ghl_contact_id AS current_owner_contact_id,
  cto.first_name || ' ' || cto.last_name AS current_owner_name
FROM territories t
LEFT JOIN territory_profile tp ON t.ms_slug = tp.ms_slug
LEFT JOIN LATERAL (
  SELECT tow.ghl_contact_id, c.first_name, c.last_name
  FROM territory_owners tow
  LEFT JOIN contacts c ON tow.ghl_contact_id = c.ghl_contact_id
  WHERE tow.ms_slug = t.ms_slug AND tow.end_date IS NULL
  LIMIT 1
) cto ON true
WHERE t.status = 'active';

-- RLS on new tables
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchise_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE zorakle_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_zorakle_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_profile_data ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. Authenticated read on all.
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'territories', 'territory_owners', 'territory_candidates',
    'franchise_owners', 'zorakle_profiles', 'contact_zorakle_data',
    'territory_profile', 'territory_grades', 'contact_profile_data'
  ] LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      'read_' || tbl, tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)',
      'write_' || tbl, tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true)',
      'update_' || tbl, tbl);
  END LOOP;
END $$;

-- Update entity_type on existing pipelines
UPDATE pipelines SET entity_type = 'contact' WHERE slug IN ('sales', 'followup');
UPDATE pipelines SET entity_type = 'territory' WHERE slug IN ('onboarding', 'runway');

-- Update Runway stages to match spec
UPDATE pipeline_stages SET slug = 'first-offer', name = 'First Offer' WHERE slug = 'first-offers';
UPDATE pipeline_stages SET slug = 'first-purchase', name = 'First Purchase' WHERE slug = 'first-acquisition';
UPDATE pipeline_stages SET slug = 'running', name = 'Running', is_terminal = true WHERE slug = 'runway-complete';

-- Fix Runway sort_order (was 4, same as followup)
UPDATE pipelines SET sort_order = 3 WHERE slug = 'runway';

-- Update updated_at triggers for new tables
CREATE TRIGGER territories_updated_at BEFORE UPDATE ON territories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER territory_profile_updated_at BEFORE UPDATE ON territory_profile FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER contact_profile_data_updated_at BEFORE UPDATE ON contact_profile_data FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER contact_zorakle_data_updated_at BEFORE UPDATE ON contact_zorakle_data FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER franchise_owners_updated_at BEFORE UPDATE ON franchise_owners FOR EACH ROW EXECUTE FUNCTION update_updated_at();
