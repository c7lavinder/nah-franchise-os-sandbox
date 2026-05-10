-- ============================================================
-- MasterSuite Integration — Phase 1: Territory Foundation
-- Renames, new columns, view updates, franchise_owners deprecation
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- STEP 1: Drop views that reference old column names
-- (will recreate after renames)
-- ════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS territory_performance;
DROP VIEW IF EXISTS contact_territory_history;
DROP VIEW IF EXISTS territory_ownership_history;
DROP VIEW IF EXISTS current_territory_owners;

-- ════════════════════════════════════════════════════════════
-- STEP 2: Drop indexes that reference old column names
-- ════════════════════════════════════════════════════════════
DROP INDEX IF EXISTS idx_territories_status;
DROP INDEX IF EXISTS idx_to_ms_slug;
DROP INDEX IF EXISTS idx_to_current;
DROP INDEX IF EXISTS idx_tg_ms_slug;
DROP INDEX IF EXISTS idx_zp_ms_slug;
DROP INDEX IF EXISTS idx_territory_stakeholders_slug;
DROP INDEX IF EXISTS idx_zorakle_slug;
DROP INDEX IF EXISTS idx_calls_territory;
DROP INDEX IF EXISTS idx_call_territories_territory;
DROP INDEX IF EXISTS idx_call_data_extractions_territory;
DROP INDEX IF EXISTS idx_coach_assignments_territory;
DROP INDEX IF EXISTS idx_dus_territory_pending;
DROP INDEX IF EXISTS idx_territory_market_data_slug;
DROP INDEX IF EXISTS idx_eos_territory_goals_slug;
DROP INDEX IF EXISTS idx_eos_territory_scorecard_slug;
DROP INDEX IF EXISTS idx_eos_territory_budgets_slug;
DROP INDEX IF EXISTS idx_eos_territory_lead_channels_slug;
DROP INDEX IF EXISTS idx_eos_territory_habits_slug;
DROP INDEX IF EXISTS idx_eos_territory_rocks_slug;
DROP INDEX IF EXISTS idx_eos_territory_issues_slug;
DROP INDEX IF EXISTS idx_eos_territory_todos_slug;

-- ════════════════════════════════════════════════════════════
-- STEP 3: Drop constraints that will conflict with renames
-- ════════════════════════════════════════════════════════════
ALTER TABLE territory_candidates DROP CONSTRAINT IF EXISTS uq_territory_candidate;
ALTER TABLE territory_grades DROP CONSTRAINT IF EXISTS uq_grade_period;

-- ════════════════════════════════════════════════════════════
-- STEP 4: Rename columns on territories table (PK)
-- ════════════════════════════════════════════════════════════
ALTER TABLE territories RENAME COLUMN ms_slug TO "TerritorySlug";
ALTER TABLE territories RENAME COLUMN territory_name TO "Nickname";
ALTER TABLE territories RENAME COLUMN awarded_date TO "FranchiseAgreementDate";

-- ════════════════════════════════════════════════════════════
-- STEP 5: Rename FK columns on all dependent tables
-- ════════════════════════════════════════════════════════════

-- Tables that use ms_slug
ALTER TABLE territory_owners RENAME COLUMN ms_slug TO "TerritorySlug";
ALTER TABLE territory_candidates RENAME COLUMN ms_slug TO "TerritorySlug";
ALTER TABLE franchise_owners RENAME COLUMN ms_slug TO "TerritorySlug";
ALTER TABLE territory_profile RENAME COLUMN ms_slug TO "TerritorySlug";
ALTER TABLE territory_grades RENAME COLUMN ms_slug TO "TerritorySlug";
ALTER TABLE territory_stakeholders RENAME COLUMN ms_slug TO "TerritorySlug";
ALTER TABLE zorakle_profiles RENAME COLUMN ms_slug TO "TerritorySlug";
ALTER TABLE zorakle_assessments RENAME COLUMN ms_slug TO "TerritorySlug";

-- Tables that use territory_slug
ALTER TABLE territory_market_data RENAME COLUMN territory_slug TO "TerritorySlug";
ALTER TABLE eos_territory_goals RENAME COLUMN territory_slug TO "TerritorySlug";
ALTER TABLE eos_territory_rocks RENAME COLUMN territory_slug TO "TerritorySlug";
ALTER TABLE eos_territory_todos RENAME COLUMN territory_slug TO "TerritorySlug";
ALTER TABLE eos_territory_issues RENAME COLUMN territory_slug TO "TerritorySlug";
ALTER TABLE eos_territory_budgets RENAME COLUMN territory_slug TO "TerritorySlug";
ALTER TABLE eos_territory_habits RENAME COLUMN territory_slug TO "TerritorySlug";
ALTER TABLE eos_territory_lead_channels RENAME COLUMN territory_slug TO "TerritorySlug";
ALTER TABLE eos_territory_scorecard RENAME COLUMN territory_slug TO "TerritorySlug";

-- Tables that use territory_ms_slug
ALTER TABLE calls RENAME COLUMN territory_ms_slug TO "TerritorySlug";
ALTER TABLE call_territories RENAME COLUMN territory_ms_slug TO "TerritorySlug";
ALTER TABLE call_data_extractions RENAME COLUMN territory_ms_slug TO "TerritorySlug";
ALTER TABLE journey_pipeline_state RENAME COLUMN territory_ms_slug TO "TerritorySlug";
ALTER TABLE coach_assignments RENAME COLUMN territory_ms_slug TO "TerritorySlug";
ALTER TABLE suggestion_feedback RENAME COLUMN territory_ms_slug TO "TerritorySlug";
ALTER TABLE data_update_suggestions RENAME COLUMN territory_ms_slug TO "TerritorySlug";
ALTER TABLE integration_logs RENAME COLUMN related_ms_slug TO "TerritorySlug";

-- ════════════════════════════════════════════════════════════
-- STEP 6: Rename EOS data columns to match MasterSuite
-- ════════════════════════════════════════════════════════════
ALTER TABLE eos_territory_rocks RENAME COLUMN rock_text TO "Rock";
ALTER TABLE eos_territory_todos RENAME COLUMN todo_text TO "Todo";
ALTER TABLE eos_territory_issues RENAME COLUMN issue_text TO "Issue";

-- ════════════════════════════════════════════════════════════
-- STEP 7: Recreate constraints with new column names
-- ════════════════════════════════════════════════════════════
ALTER TABLE territory_candidates
  ADD CONSTRAINT uq_territory_candidate UNIQUE ("TerritorySlug", ghl_contact_id);

ALTER TABLE territory_grades
  ADD CONSTRAINT uq_grade_period UNIQUE ("TerritorySlug", year, quarter);

-- ════════════════════════════════════════════════════════════
-- STEP 8: Recreate indexes with new column names
-- ════════════════════════════════════════════════════════════
CREATE INDEX idx_territories_status ON territories(status);
CREATE INDEX idx_to_territory_slug ON territory_owners("TerritorySlug");
CREATE INDEX idx_to_current ON territory_owners("TerritorySlug") WHERE end_date IS NULL;
CREATE INDEX idx_tg_territory_slug ON territory_grades("TerritorySlug");
CREATE INDEX idx_zp_territory_slug ON zorakle_profiles("TerritorySlug");
CREATE INDEX idx_territory_stakeholders_slug ON territory_stakeholders("TerritorySlug");
CREATE INDEX idx_zorakle_slug ON zorakle_assessments("TerritorySlug");
CREATE INDEX idx_calls_territory ON calls("TerritorySlug") WHERE "TerritorySlug" IS NOT NULL;
CREATE INDEX idx_call_territories_territory ON call_territories("TerritorySlug");
CREATE INDEX idx_call_data_extractions_territory ON call_data_extractions("TerritorySlug") WHERE "TerritorySlug" IS NOT NULL;
CREATE INDEX idx_coach_assignments_territory ON coach_assignments("TerritorySlug");
CREATE INDEX idx_dus_territory_pending ON data_update_suggestions("TerritorySlug", status) WHERE status = 'pending' AND "TerritorySlug" IS NOT NULL;
CREATE INDEX idx_territory_market_data_slug ON territory_market_data("TerritorySlug");
CREATE INDEX idx_eos_territory_goals_slug ON eos_territory_goals("TerritorySlug");
CREATE INDEX idx_eos_territory_scorecard_slug ON eos_territory_scorecard("TerritorySlug");
CREATE INDEX idx_eos_territory_budgets_slug ON eos_territory_budgets("TerritorySlug");
CREATE INDEX idx_eos_territory_lead_channels_slug ON eos_territory_lead_channels("TerritorySlug");
CREATE INDEX idx_eos_territory_habits_slug ON eos_territory_habits("TerritorySlug");
CREATE INDEX idx_eos_territory_rocks_slug ON eos_territory_rocks("TerritorySlug");
CREATE INDEX idx_eos_territory_issues_slug ON eos_territory_issues("TerritorySlug");
CREATE INDEX idx_eos_territory_todos_slug ON eos_territory_todos("TerritorySlug");

-- ════════════════════════════════════════════════════════════
-- STEP 9: Recreate views with new column names
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW current_territory_owners AS
SELECT
  t."TerritorySlug",
  t."Nickname",
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
LEFT JOIN territory_owners tow ON t."TerritorySlug" = tow."TerritorySlug" AND tow.end_date IS NULL
LEFT JOIN contacts c ON tow.ghl_contact_id = c.ghl_contact_id;

CREATE OR REPLACE VIEW territory_ownership_history AS
SELECT
  t."TerritorySlug",
  t."Nickname",
  tow.ghl_contact_id,
  c.first_name || ' ' || c.last_name AS owner_name,
  tow.role,
  tow.start_date,
  tow.end_date,
  tow.end_date - tow.start_date AS days_owned,
  tow.transfer_notes
FROM territories t
JOIN territory_owners tow ON t."TerritorySlug" = tow."TerritorySlug"
LEFT JOIN contacts c ON tow.ghl_contact_id = c.ghl_contact_id
ORDER BY t."TerritorySlug", tow.start_date;

CREATE OR REPLACE VIEW contact_territory_history AS
SELECT
  tow.ghl_contact_id,
  c.first_name || ' ' || c.last_name AS contact_name,
  t."TerritorySlug",
  t."Nickname",
  tow.role,
  tow.start_date,
  tow.end_date,
  tow.end_date IS NULL AS is_current,
  tow.transfer_notes
FROM territory_owners tow
JOIN territories t ON tow."TerritorySlug" = t."TerritorySlug"
LEFT JOIN contacts c ON tow.ghl_contact_id = c.ghl_contact_id
ORDER BY tow.ghl_contact_id, tow.start_date;

CREATE OR REPLACE VIEW territory_performance AS
SELECT
  t."TerritorySlug",
  t."Nickname",
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
LEFT JOIN territory_profile tp ON t."TerritorySlug" = tp."TerritorySlug"
LEFT JOIN LATERAL (
  SELECT tow.ghl_contact_id, c.first_name, c.last_name
  FROM territory_owners tow
  LEFT JOIN contacts c ON tow.ghl_contact_id = c.ghl_contact_id
  WHERE tow."TerritorySlug" = t."TerritorySlug" AND tow.end_date IS NULL
  LIMIT 1
) cto ON true
WHERE t.status = 'active';

-- ════════════════════════════════════════════════════════════
-- STEP 10: Add new columns from MasterSuite Territories table
-- ════════════════════════════════════════════════════════════

ALTER TABLE territories
  ADD COLUMN IF NOT EXISTS "TerritoryId" int,
  ADD COLUMN IF NOT EXISTS "Broker" text,
  ADD COLUMN IF NOT EXISTS "IsFranchise" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "IsFullTime" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "FullTimeOperator" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "ExcludeFromGlobalCalculations" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "PrimaryCoach" text,
  ADD COLUMN IF NOT EXISTS "PersonalName" text,
  ADD COLUMN IF NOT EXISTS "Owner2" text,
  ADD COLUMN IF NOT EXISTS "Owner3" text,
  ADD COLUMN IF NOT EXISTS "EmergencyContact" text,
  ADD COLUMN IF NOT EXISTS "FranchiseEmail" text,
  ADD COLUMN IF NOT EXISTS "PersonalPhoneNumber" text,
  ADD COLUMN IF NOT EXISTS "StreetAddress" text,
  ADD COLUMN IF NOT EXISTS "NahCity" text,
  ADD COLUMN IF NOT EXISTS "NahState" text,
  ADD COLUMN IF NOT EXISTS "NahZip" text,
  ADD COLUMN IF NOT EXISTS "RealEstateLicensee" text,
  ADD COLUMN IF NOT EXISTS "LicenseeBroker" text,
  ADD COLUMN IF NOT EXISTS "LicenseeBrokerNumber" text,
  ADD COLUMN IF NOT EXISTS "MarketingName" text,
  ADD COLUMN IF NOT EXISTS "MarketingPhoneNumber" text,
  ADD COLUMN IF NOT EXISTS "MarketingReturnAddress" text,
  ADD COLUMN IF NOT EXISTS "MarketingLeadGenPhoneNumber" text,
  ADD COLUMN IF NOT EXISTS "MarketingCallCenterForwardingNumber" text,
  ADD COLUMN IF NOT EXISTS "MarketingEmailAddress" text,
  ADD COLUMN IF NOT EXISTS "MarketingInstagramProfile" text,
  ADD COLUMN IF NOT EXISTS "MarketingFacebookPage" text,
  ADD COLUMN IF NOT EXISTS "DocumentUrlFranchiseAgreement" text,
  ADD COLUMN IF NOT EXISTS "DocumentUrlCOILiabilityInsurance" text,
  ADD COLUMN IF NOT EXISTS "DocumentUrlCOIProfessionalLiability" text,
  ADD COLUMN IF NOT EXISTS "DocumentUrlCOIOther" text,
  ADD COLUMN IF NOT EXISTS "DocumentUrlBusinessLicense" text,
  ADD COLUMN IF NOT EXISTS "DocumentUrlRealEstateLicense" text,
  ADD COLUMN IF NOT EXISTS "DocumentUrlOther" text,
  ADD COLUMN IF NOT EXISTS "DocumentUrlOther2" text,
  ADD COLUMN IF NOT EXISTS "ComplianceScore" decimal(5,2),
  ADD COLUMN IF NOT EXISTS "ComplianceScoreManualDescription" text,
  ADD COLUMN IF NOT EXISTS "LegalEntityName" text,
  ADD COLUMN IF NOT EXISTS "InitialApplicationDate" date,
  ADD COLUMN IF NOT EXISTS "TrainingCompleteDate" date,
  ADD COLUMN IF NOT EXISTS "FirstPurchaseDate" date,
  ADD COLUMN IF NOT EXISTS "FranchiseClosedDate" date,
  ADD COLUMN IF NOT EXISTS "GoHighLevelLocationId" text,
  ADD COLUMN IF NOT EXISTS "NexaActive" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "NexaAccount" text,
  ADD COLUMN IF NOT EXISTS "Vonage1Active" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "Vonage1Account" text,
  ADD COLUMN IF NOT EXISTS "Vonage2Active" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "Vonage2Account" text,
  ADD COLUMN IF NOT EXISTS "GoogleLicense1Active" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "GoogleLicense1Account" text,
  ADD COLUMN IF NOT EXISTS "GoogleLicense2Active" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "GoogleLicense2Account" text,
  ADD COLUMN IF NOT EXISTS "GoogleLicense3Active" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "GoogleLicense3Account" text,
  ADD COLUMN IF NOT EXISTS "GoogleLicense4Active" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "GoogleLicense4Account" text,
  ADD COLUMN IF NOT EXISTS "Notes" text;

-- ════════════════════════════════════════════════════════════
-- STEP 11: Deprecate franchise_owners — migrate useful columns
-- ════════════════════════════════════════════════════════════

-- Add the 3 useful columns from franchise_owners to territories
ALTER TABLE territories
  ADD COLUMN IF NOT EXISTS ghl_contact_id text,
  ADD COLUMN IF NOT EXISTS ct_id text,
  ADD COLUMN IF NOT EXISTS ct_email text;

-- Migrate data from franchise_owners to territories
UPDATE territories t
SET
  ghl_contact_id = fo.ghl_contact_id,
  ct_id = fo.ct_id,
  ct_email = fo.ct_email
FROM franchise_owners fo
WHERE t."TerritorySlug" = fo."TerritorySlug";

-- ════════════════════════════════════════════════════════════
-- STEP 12: Add ms_synced_at tracking column
-- ════════════════════════════════════════════════════════════
ALTER TABLE territories
  ADD COLUMN IF NOT EXISTS ms_synced_at timestamptz;

-- ════════════════════════════════════════════════════════════
-- STEP 13: Update unique constraints on EOS tables
-- ════════════════════════════════════════════════════════════
-- These had territory_slug in their unique constraints
ALTER TABLE eos_territory_goals DROP CONSTRAINT IF EXISTS eos_territory_goals_territory_slug_goal_type_key;
ALTER TABLE eos_territory_goals ADD CONSTRAINT eos_territory_goals_slug_goal_type_key UNIQUE ("TerritorySlug", goal_type);

ALTER TABLE eos_territory_habits DROP CONSTRAINT IF EXISTS eos_territory_habits_territory_slug_habit_key_key;
ALTER TABLE eos_territory_habits ADD CONSTRAINT eos_territory_habits_slug_habit_key_key UNIQUE ("TerritorySlug", habit_key);

ALTER TABLE eos_territory_lead_channels DROP CONSTRAINT IF EXISTS eos_territory_lead_channels_territory_slug_channel_name_key;
ALTER TABLE eos_territory_lead_channels ADD CONSTRAINT eos_territory_lead_channels_slug_channel_key UNIQUE ("TerritorySlug", channel_name);

ALTER TABLE eos_territory_scorecard DROP CONSTRAINT IF EXISTS eos_territory_scorecard_territory_slug_metric_key_key;
ALTER TABLE eos_territory_scorecard ADD CONSTRAINT eos_territory_scorecard_slug_metric_key UNIQUE ("TerritorySlug", metric_key);

ALTER TABLE territory_market_data DROP CONSTRAINT IF EXISTS territory_market_data_territory_slug_field_name_key;
ALTER TABLE territory_market_data ADD CONSTRAINT territory_market_data_slug_field_key UNIQUE ("TerritorySlug", field_name);

-- Update coach_assignments unique constraint
ALTER TABLE coach_assignments DROP CONSTRAINT IF EXISTS coach_assignments_coach_user_id_territory_ms_slug_key;
ALTER TABLE coach_assignments ADD CONSTRAINT coach_assignments_coach_territory_key UNIQUE (coach_user_id, "TerritorySlug");

-- Update call_territories unique constraint
ALTER TABLE call_territories DROP CONSTRAINT IF EXISTS call_territories_call_id_territory_ms_slug_key;
ALTER TABLE call_territories ADD CONSTRAINT call_territories_call_territory_key UNIQUE (call_id, "TerritorySlug");

-- Update journey_pipeline_state indexes
DROP INDEX IF EXISTS idx_jps_active_territory;
DROP INDEX IF EXISTS idx_jps_active_no_territory;
CREATE INDEX idx_jps_active_territory ON journey_pipeline_state(journey_id, "TerritorySlug", pipeline_id)
  WHERE is_active = true AND "TerritorySlug" IS NOT NULL;
CREATE INDEX idx_jps_active_no_territory ON journey_pipeline_state(journey_id, pipeline_id)
  WHERE is_active = true AND "TerritorySlug" IS NULL;
