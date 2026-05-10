-- ============================================================
-- MasterSuite Integration — Phase 5+6: Contacts, Reference, Market
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- Phase 5: Contact alignment
-- ════════════════════════════════════════════════════════════

-- Rename contact columns to match MasterSuite PathToOwnershipEntries
ALTER TABLE contacts RENAME COLUMN counties_priority TO "CountiesInterestedIn";
ALTER TABLE contacts RENAME COLUMN franchisee_2_name TO "PartnerName";
ALTER TABLE contacts RENAME COLUMN franchisee_2_phone TO "PartnerPhone";
ALTER TABLE contacts RENAME COLUMN franchisee_2_email TO "PartnerEmail";
ALTER TABLE contacts RENAME COLUMN business_ownership_experience TO "BriefWorkHistory";
ALTER TABLE contacts RENAME COLUMN motivation_clarity TO "WhatInterestsInOpportunity";
ALTER TABLE contacts RENAME COLUMN capital_availability TO "NonRetirementCapitalAvailable";
ALTER TABLE contacts RENAME COLUMN lead_source_detail TO "LeadSource";

-- Add new columns from PathToOwnershipEntries
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS "PreferredName" text,
  ADD COLUMN IF NOT EXISTS "PartnerOccupation" text,
  ADD COLUMN IF NOT EXISTS "PreferredWeeklyHours" int,
  ADD COLUMN IF NOT EXISTS "NonRetirementCapitalAvailableSource" text,
  ADD COLUMN IF NOT EXISTS "RetirementFundsRollingOver" int,
  ADD COLUMN IF NOT EXISTS "ReferredBy" text,
  ADD COLUMN IF NOT EXISTS "PtoSubmissionDate" timestamptz;

-- Add ms_user_id to users for cross-reference
ALTER TABLE users ADD COLUMN IF NOT EXISTS ms_user_id int;

-- User-territory mapping
CREATE TABLE IF NOT EXISTS ms_user_territories (
  "UserId" int NOT NULL,
  "TerritorySlug" text NOT NULL REFERENCES territories("TerritorySlug"),
  PRIMARY KEY ("UserId", "TerritorySlug")
);

-- ════════════════════════════════════════════════════════════
-- Phase 6: Territory Reference Data
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ms_territory_associated_counties (
  "CountyName" text NOT NULL,
  "State" text NOT NULL,
  "TerritorySlug" text NOT NULL REFERENCES territories("TerritorySlug"),
  PRIMARY KEY ("CountyName", "State")
);

CREATE TABLE IF NOT EXISTS ms_territory_associated_zip_codes (
  "ZipCode" text NOT NULL PRIMARY KEY,
  "TerritorySlug" text NOT NULL REFERENCES territories("TerritorySlug")
);

CREATE TABLE IF NOT EXISTS ms_territory_badges (
  "TerritoryBadgeId" int PRIMARY KEY,
  "GroupName" text NOT NULL,
  "DisplayName" text NOT NULL,
  "Levels" int NOT NULL,
  "ImageUrl" text NOT NULL
);

CREATE TABLE IF NOT EXISTS ms_territory_badges_earned (
  "Id" int PRIMARY KEY,
  "TerritorySlug" text NOT NULL REFERENCES territories("TerritorySlug"),
  "TerritoryBadgeId" int NOT NULL,
  "CurrentLevel" int NOT NULL
);

CREATE TABLE IF NOT EXISTS ms_territory_dashboard_links (
  "TerritorySlug" text NOT NULL REFERENCES territories("TerritorySlug"),
  "Name" text,
  "Url" text
);

CREATE TABLE IF NOT EXISTS ms_territory_inbox (
  "TerritoryInboxId" int PRIMARY KEY,
  "TerritorySlug" text REFERENCES territories("TerritorySlug"),
  "Inserted" timestamptz NOT NULL,
  "From" text,
  "FormType" text,
  "Message" text,
  "FormSubmissionId" int,
  "PropertyId" int
);

CREATE INDEX idx_ms_inbox_territory ON ms_territory_inbox("TerritorySlug");

CREATE TABLE IF NOT EXISTS ms_report_variables (
  "TerritorySlug" text PRIMARY KEY REFERENCES territories("TerritorySlug"),
  "NarRegion" text,
  "DefaultLocationGrade" decimal(13,6),
  "RiskFactorBasePercentage" decimal(13,6),
  "RiskFactorMaxPercentage" decimal(13,6),
  "RiskFactorArvPercentageIncrement" decimal(13,6),
  "RiskFactorArvMaxPercentage" decimal(13,6),
  "RiskFactorLocationPercentageAdjustment" decimal(13,6),
  "RiskFactorIntangibleScoreAdjustment" decimal(13,6),
  "RiskFactorComparableRiskPercentageAdjustment" decimal(13,6),
  "QuietCostsHoldingCost" decimal(5,3),
  "QuietCostsClosingCostPercentage" decimal(5,3),
  "QuietCostsMaxClosingCost" decimal(8,0),
  "QuietCostsEstimatedCycleMonths" int,
  "EstimatedDaysBetweenPurchaseAndConstructionStart" int,
  "EstimatedDaysBetweenConstructionEndAndSell" int,
  "QuietCostsInterestRate" decimal(5,3),
  "QuietCostsMoneyPoints" decimal(5,2),
  "QuietCostsMoneyFees" decimal(8,0),
  "QuietCostsBuyingCost" decimal(8,0),
  "QuietCostsAgentSellCommissions" decimal(5,3),
  "QuietCostsPercentOfConstructionFinanced" decimal(5,2),
  "QuietCostsPercentOfPurchaseFinanced" decimal(5,2),
  "ArvPercentSqFt" decimal(13,6),
  "ArvPercentAuxSqFt" decimal(13,6),
  "ArvPercentUnfinishedSqFt" decimal(13,6),
  "ConstructionBudgetS1" decimal(13,6),
  "ConstructionBudgetDefaultRehabGrade" decimal(13,6),
  "ConstructionBudgetDefaultRehabGradeForeclosure" decimal(20,4),
  "ConstructionBudgetDefaultRehabGradeTax" decimal(20,4),
  "TargetCbSpendPerDay" decimal(10,2),
  "InvRentalPrevailingCapRate" decimal(10,3),
  "InvRentalInterestRate" decimal(10,3),
  "InvRentalMaxLtvPercent" decimal(10,3),
  "InvRentalVacancy" decimal(10,3),
  "InvRentalMaintenance" decimal(10,3),
  "InvRentalCapEx" decimal(10,3),
  "InvRentalManagement" decimal(10,3),
  "InvRentalPropertyTax" decimal(10,3),
  "InvRentalInsurance" decimal(10,3),
  "InvRentalUtilities" decimal(10,3),
  "InvRentalHoa" decimal(10,3),
  "InvRentalMowing" decimal(10,3),
  "InvRentalMisc" decimal(10,3),
  "InvRentalTargetRentAllIn" decimal(10,3),
  "InvRentalNoteTerm" int,
  "InvRentalRentAsf" decimal(10,3),
  "InvRentalMowingMonthsPerYear" int,
  "LeadScoreIdealYearBuilt" int,
  "LeadScoreIdealYearBuiltLow" int,
  "LeadScoreIdealYearBuiltHigh" int,
  "LeadScoreIdealSquareFootage" int,
  "LeadScoreIdealSquareFootageLow" int,
  "LeadScoreIdealSquareFootageHigh" int,
  "RoyaltyVersion" int,
  "RoyaltyPaidAt" text
);

CREATE TABLE IF NOT EXISTS ms_report_variable_configuration (
  "Name" text PRIMARY KEY,
  "UserFriendlyName" text,
  "Description" text,
  "TutorialTextToken" text,
  "UserInterfaceFormatter" text,
  "UserInterfaceFormatterArgument1" text,
  "SortOrder" int DEFAULT 0,
  "Hidden" boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS ms_territory_variables (
  "TerritorySlug" text PRIMARY KEY REFERENCES territories("TerritorySlug"),
  "PropertyId" int,
  "InvRentalVacancy" decimal(10,3),
  "InvRentalMaintenance" decimal(10,3),
  "InvRentalCapEx" decimal(10,3),
  "InvRentalManagement" decimal(10,3),
  "InvRentalPropertyTax" decimal(10,3),
  "InvRentalInsurance" decimal(10,3),
  "InvRentalUtilities" decimal(10,3),
  "InvRentalHoa" decimal(10,3),
  "InvRentalMowing" decimal(10,3),
  "InvRentalMisc" decimal(10,3),
  "InvRentalPrevailingCapRate" decimal(10,3),
  "InvRentalInterestRate" decimal(10,3),
  "InvRentalMaxLtvPercent" decimal(10,3),
  "InvRentalTargetRentAllIn" decimal(10,3),
  "InvRentalNoteTerm" int,
  "InvRentalRentAsf" decimal(10,3),
  "InvRentalMowingMonthsPerYear" int,
  "LeadScoreIdealYearBuilt" int,
  "LeadScoreIdealYearBuiltLow" int,
  "LeadScoreIdealYearBuiltHigh" int,
  "LeadScoreIdealSquareFootage" int,
  "LeadScoreIdealSquareFootageLow" int,
  "LeadScoreIdealSquareFootageHigh" int,
  "RoyaltyVersion" int,
  "RoyaltyPaidAt" text
);

-- Reference tables
CREATE TABLE IF NOT EXISTS ms_lead_types (
  "LeadTypeId" int PRIMARY KEY,
  "LeadType" text NOT NULL UNIQUE,
  "LeadCategoryId" int NOT NULL
);

CREATE TABLE IF NOT EXISTS ms_lead_type_categories (
  "LeadCategoryId" int PRIMARY KEY,
  "LeadCategory" text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ms_stage0_types (
  "Type" text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS ms_master_list_intangibles (
  "Token" text PRIMARY KEY,
  "FriendlyName" text NOT NULL
);

CREATE TABLE IF NOT EXISTS ms_note_holders (
  "Token" text PRIMARY KEY,
  "Name" text,
  "TotalFunds" decimal(13,2),
  "CommittedProjects" decimal(13,2),
  "NextFundingDate" date
);

CREATE TABLE IF NOT EXISTS ms_construction_default_rooms (
  "RoomToken" text PRIMARY KEY,
  "Name" text NOT NULL,
  "Description" text NOT NULL,
  "IconUrl" text NOT NULL
);

CREATE TABLE IF NOT EXISTS ms_construction_property_rooms (
  "ConstructionPropertyRoomId" text PRIMARY KEY,
  "PropertyId" int NOT NULL,
  "RoomToken" text NOT NULL
);

-- ════════════════════════════════════════════════════════════
-- Market Data (Zillow)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ms_zillow_home_value_forecast_county (
  "State" text NOT NULL,
  "County" text NOT NULL,
  "ForecastYoYPctChange" decimal(20,4),
  PRIMARY KEY ("State", "County")
);

CREATE TABLE IF NOT EXISTS ms_zillow_home_value_forecast_zip (
  "Zip" text PRIMARY KEY,
  "ForecastYoYPctChange" decimal(20,4)
);

CREATE TABLE IF NOT EXISTS ms_zillow_median_sales_price_county (
  "State" text NOT NULL,
  "County" text NOT NULL,
  "SizeRank" int,
  "MedianSalesPrice" decimal(20,4),
  PRIMARY KEY ("State", "County")
);

CREATE TABLE IF NOT EXISTS ms_zillow_median_sales_price_zip (
  "Zip" text PRIMARY KEY,
  "SizeRank" int,
  "MedianSalesPrice" decimal(20,4)
);

CREATE TABLE IF NOT EXISTS ms_zillow_sfh_time_series_county (
  "State" text NOT NULL,
  "County" text NOT NULL,
  "SizeRank" int,
  "HomeValueIndex" decimal(20,4),
  PRIMARY KEY ("State", "County")
);

CREATE TABLE IF NOT EXISTS ms_zillow_sfh_time_series_zip (
  "Zip" text PRIMARY KEY,
  "SizeRank" int,
  "HomeValueIndex" decimal(20,4)
);

CREATE TABLE IF NOT EXISTS ms_zip_code_avg_price_sqft (
  "ZipCode" text PRIMARY KEY,
  "LastUpdatedUtc" timestamptz,
  "PriceSqFt" decimal(13,6),
  "R1" decimal(10,2), "R1Count" decimal(10,2),
  "R1DaysOnMarket" decimal(10,2), "R1DaysOnMarketCount" decimal(10,2),
  "R1n" decimal(10,2), "R1nCount" decimal(10,2),
  "R1nDaysOnMarket" decimal(10,2), "R1nDaysOnMarketCount" decimal(10,2),
  "R2" decimal(10,2), "R2Count" decimal(10,2),
  "R2DaysOnMarket" decimal(10,2), "R2DaysOnMarketCount" decimal(10,2),
  "R2n" decimal(10,2), "R2nCount" decimal(10,2),
  "R2nDaysOnMarket" decimal(10,2), "R2nDaysOnMarketCount" decimal(10,2),
  "R3" decimal(10,2), "R3Count" decimal(10,2),
  "R3DaysOnMarket" decimal(10,2), "R3DaysOnMarketCount" decimal(10,2),
  "R3n" decimal(10,2), "R3nCount" decimal(10,2),
  "R3nDaysOnMarket" decimal(10,2), "R3nDaysOnMarketCount" decimal(10,2),
  "R4" decimal(10,2), "R4Count" decimal(10,2),
  "R4DaysOnMarket" decimal(10,2), "R4DaysOnMarketCount" decimal(10,2),
  "R4n" decimal(10,2), "R4nCount" decimal(10,2),
  "R4nDaysOnMarket" decimal(10,2), "R4nDaysOnMarketCount" decimal(10,2),
  "R5" decimal(10,2), "R5Count" decimal(10,2),
  "R5DaysOnMarket" decimal(10,2), "R5DaysOnMarketCount" decimal(10,2),
  "R5n" decimal(10,2), "R5nCount" decimal(10,2),
  "R5nDaysOnMarket" decimal(10,2), "R5nDaysOnMarketCount" decimal(10,2),
  "R6" decimal(10,2), "R6Count" decimal(10,2),
  "R6DaysOnMarket" decimal(10,2), "R6DaysOnMarketCount" decimal(10,2),
  "R6n" decimal(10,2), "R6nCount" decimal(10,2),
  "R6nDaysOnMarket" decimal(10,2), "R6nDaysOnMarketCount" decimal(10,2)
);

CREATE TABLE IF NOT EXISTS ms_zip_code_locations (
  "ZipCode" text PRIMARY KEY,
  "City" text,
  "State" text,
  "Metro" text,
  "CountyName" text
);

-- RLS on all new tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ms_user_territories',
    'ms_territory_associated_counties', 'ms_territory_associated_zip_codes',
    'ms_territory_badges', 'ms_territory_badges_earned',
    'ms_territory_dashboard_links', 'ms_territory_inbox',
    'ms_report_variables', 'ms_report_variable_configuration',
    'ms_territory_variables',
    'ms_lead_types', 'ms_lead_type_categories', 'ms_stage0_types',
    'ms_master_list_intangibles', 'ms_note_holders',
    'ms_construction_default_rooms', 'ms_construction_property_rooms',
    'ms_zillow_home_value_forecast_county', 'ms_zillow_home_value_forecast_zip',
    'ms_zillow_median_sales_price_county', 'ms_zillow_median_sales_price_zip',
    'ms_zillow_sfh_time_series_county', 'ms_zillow_sfh_time_series_zip',
    'ms_zip_code_avg_price_sqft', 'ms_zip_code_locations'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      'read_' || tbl, tbl);
  END LOOP;
END $$;
