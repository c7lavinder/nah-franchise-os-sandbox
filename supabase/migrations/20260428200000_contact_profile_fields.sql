-- Tier 1 #3: Migrate GHL custom fields to contacts table.
-- These fields were stored as GHL custom fields. Now Supabase is the source of truth.
-- GHL custom field definitions will be deleted after data is migrated.

-- Franchise fit / qualification
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS territory_interest text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS territory_status text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS territory_email text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS counties_priority text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS nda_status text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS framing_call_logged boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS business_ownership_experience text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS capital_availability text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS investment_timeline text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS motivation_clarity text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS number_of_franchisees integer;

-- Trainual
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS trainual_access_sent boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS trainual_completion_pct numeric;

-- Lead source
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_source_detail text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS incoming_lead_email text;

-- Scoring (denormalized from candidate_intelligence for quick access)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS scout_lead_score numeric;

-- Franchisee operational
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS franchise_start_date date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS onboarding_completion_date date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS property_submission_status text;

-- Contact info extensions
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS marketing_phone text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS nexa_phone text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS return_mail_address text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fb_url text;

-- Partner/ecosystem (flat on contacts — not using related_people per Corey)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS franchisee_2_name text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS franchisee_2_email text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS franchisee_2_phone text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS real_estate_partner text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS real_estate_agent_broker text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS real_estate_agent_email text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS real_estate_phone text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ecosystem_partners text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_manager_name text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_manager_email text;

-- Service integrations
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS happyfox_url text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS clickx_package text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS openclaw_enriched boolean DEFAULT false;
