-- Candidate Intelligence Engine — Database Migration
-- 6 tables: candidate_intelligence, call_logs, candidate_score_history,
-- objection_registry, franchisee_performance, market_signals
--
-- Run via: npx tsx scripts/setup-intelligence-tables.ts
-- Safe to run multiple times — uses IF NOT EXISTS.

-- ═══════════════════════════════════════════════════════
-- 1. CANDIDATE_INTELLIGENCE — growing intelligence profile per candidate
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS candidate_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id VARCHAR NOT NULL UNIQUE,          -- GHL contact ID
  ghl_location_id VARCHAR NOT NULL,

  -- Financial profile
  net_worth_bucket VARCHAR,                    -- under_100k / 100_250k / 250_500k / 500k_plus
  liquid_capital INT,                          -- in dollars
  illiquid_capital INT,
  funding_path VARCHAR,                        -- cash / guidant / sba / combination / unknown
  pfs_received BOOLEAN DEFAULT false,
  pfs_uploaded_url VARCHAR,                    -- stored doc reference
  outstanding_liabilities TEXT,
  financial_red_flags JSONB,                   -- array of auto-surfaced flags

  -- Personality profile
  zorakle_completed BOOLEAN DEFAULT false,
  zorakle_results JSONB,                       -- raw results object
  disc_profile VARCHAR,                        -- D / I / S / C
  risk_tolerance_score INT,                    -- 0-100
  personality_flags JSONB,                     -- array of Scout-generated flags

  -- Candidate profile
  stated_motivation VARCHAR,                   -- buy_job / wealth / escape_corporate / other
  prior_business_owner BOOLEAN,
  prior_business_type TEXT,
  construction_comfort VARCHAR,                -- hands_on / oversight_only / no_experience
  spouse_supportive VARCHAR,                   -- yes / no / unknown
  urgency VARCHAR,                             -- ready_now / 3_6_months / exploring

  -- Engagement signals
  trainual_completion_pct INT DEFAULT 0,
  trainual_last_activity TIMESTAMPTZ,
  avg_response_time_hours FLOAT,
  homework_completion_rate FLOAT,              -- % of assigned homework completed

  -- Computed
  current_score INT DEFAULT 0,
  score_financial INT DEFAULT 0,               -- 0-25
  score_operational INT DEFAULT 0,             -- 0-25
  score_engagement INT DEFAULT 0,              -- 0-25
  score_momentum INT DEFAULT 0,                -- 0-25
  active_flags JSONB,                          -- current flags array

  -- Meta
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ci_contact_id ON candidate_intelligence(contact_id);
CREATE INDEX IF NOT EXISTS idx_ci_ghl_location ON candidate_intelligence(ghl_location_id);
CREATE INDEX IF NOT EXISTS idx_ci_current_score ON candidate_intelligence(current_score);
CREATE INDEX IF NOT EXISTS idx_ci_funding_path ON candidate_intelligence(funding_path);
CREATE INDEX IF NOT EXISTS idx_ci_created_at ON candidate_intelligence(created_at);

-- ═══════════════════════════════════════════════════════
-- 2. CALL_LOGS — structured post-call data, one row per call
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id VARCHAR NOT NULL,
  call_type VARCHAR NOT NULL,                  -- intro / matt / sam / mark
  logged_by VARCHAR NOT NULL,                  -- user id of who logged it
  called_at TIMESTAMPTZ,                       -- when the call happened
  logged_at TIMESTAMPTZ DEFAULT now(),

  -- Structured fields (JSONB — flexible by call type)
  fields JSONB NOT NULL,                       -- call-type specific structured answers

  -- AI assist
  transcript_url VARCHAR,                      -- Google Meet transcript if available
  ai_prefilled BOOLEAN DEFAULT false,          -- did Scout pre-fill from transcript?
  human_confirmed BOOLEAN DEFAULT false,

  -- Rep gut read
  rep_confidence VARCHAR,                      -- high / medium / low
  red_flags_raised TEXT,
  notes TEXT,                                  -- free-form after structured fields

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_contact_id ON call_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_type ON call_logs(call_type);
CREATE INDEX IF NOT EXISTS idx_call_logs_called_at ON call_logs(called_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at);

-- ═══════════════════════════════════════════════════════
-- 3. CANDIDATE_SCORE_HISTORY — every score change, timestamped
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS candidate_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id VARCHAR NOT NULL,
  triggered_by VARCHAR NOT NULL,               -- call_log / stage_move / trainual / manual
  trigger_id UUID,                             -- reference to the thing that triggered it

  score_before INT,
  score_after INT,
  financial_before INT,
  financial_after INT,
  operational_before INT,
  operational_after INT,
  engagement_before INT,
  engagement_after INT,
  momentum_before INT,
  momentum_after INT,

  changes_explained JSONB,                     -- array: [{field, delta, reason}]
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csh_contact_id ON candidate_score_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_csh_triggered_by ON candidate_score_history(triggered_by);
CREATE INDEX IF NOT EXISTS idx_csh_created_at ON candidate_score_history(created_at);

-- ═══════════════════════════════════════════════════════
-- 4. OBJECTION_REGISTRY — every objection raised, per candidate, per stage
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS objection_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id VARCHAR NOT NULL,
  stage_at_time VARCHAR NOT NULL,
  call_log_id UUID,

  objection_type VARCHAR NOT NULL,             -- capital / value / timing / territory / going_cold / royalty / other
  objection_detail TEXT,
  resolved BOOLEAN DEFAULT false,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,

  score_impact INT,                            -- negative number
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_or_contact_id ON objection_registry(contact_id);
CREATE INDEX IF NOT EXISTS idx_or_objection_type ON objection_registry(objection_type);
CREATE INDEX IF NOT EXISTS idx_or_resolved ON objection_registry(resolved);
CREATE INDEX IF NOT EXISTS idx_or_created_at ON objection_registry(created_at);

-- ═══════════════════════════════════════════════════════
-- 5. FRANCHISEE_PERFORMANCE — post-close performance data
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS franchisee_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id VARCHAR NOT NULL,
  franchisee_name VARCHAR NOT NULL,
  territory VARCHAR,

  -- Deal close data
  signed_at TIMESTAMPTZ,
  funds_received_at TIMESTAMPTZ,
  franchise_agreement_signed BOOLEAN DEFAULT false,

  -- Performance metrics (updated quarterly)
  houses_purchased_year1 INT,
  houses_purchased_year2 INT,
  houses_purchased_year3 INT,
  houses_purchased_total INT,
  revenue_year1 INT,
  revenue_year2 INT,
  revenue_year3 INT,
  time_to_first_flip_days INT,
  staff_hired INT,
  royalty_payment_consistent BOOLEAN,
  territory_utilization_pct INT,
  nps_score INT,
  support_calls_year1 INT,
  active_status VARCHAR,                       -- active / churned / paused

  -- Source of data
  franchise_software_id VARCHAR,               -- ID in FO management system
  last_synced_at TIMESTAMPTZ,
  data_source VARCHAR,                         -- automated / manual / partial

  -- Meta
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fp_contact_id ON franchisee_performance(contact_id);
CREATE INDEX IF NOT EXISTS idx_fp_active_status ON franchisee_performance(active_status);
CREATE INDEX IF NOT EXISTS idx_fp_territory ON franchisee_performance(territory);
CREATE INDEX IF NOT EXISTS idx_fp_created_at ON franchisee_performance(created_at);

-- ═══════════════════════════════════════════════════════
-- 6. MARKET_SIGNALS — industry and territory signals
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS market_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type VARCHAR NOT NULL,                -- territory / lead_source / objection_trend / industry
  signal_key VARCHAR NOT NULL,                 -- e.g. territory name, lead source name
  signal_value JSONB NOT NULL,                 -- flexible data payload
  observed_at TIMESTAMPTZ DEFAULT now(),
  source VARCHAR                               -- manual / automated / api
);

CREATE INDEX IF NOT EXISTS idx_ms_signal_type ON market_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_ms_signal_key ON market_signals(signal_key);
CREATE INDEX IF NOT EXISTS idx_ms_observed_at ON market_signals(observed_at);

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — enabled on all 6 tables
-- ═══════════════════════════════════════════════════════

ALTER TABLE candidate_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchisee_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_signals ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- Authenticated users get read access to all intelligence data (role filtering done at app level).

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'candidate_intelligence', 'call_logs', 'candidate_score_history',
    'objection_registry', 'franchisee_performance', 'market_signals'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = 'allow_authenticated_read_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
        'allow_authenticated_read_' || tbl, tbl
      );
    END IF;
  END LOOP;
END $$;
