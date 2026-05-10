-- ============================================================
-- MasterSuite Integration — Phase 3: Property Supporting Tables
-- ============================================================

-- 1. ms_property_contacts
CREATE TABLE IF NOT EXISTS ms_property_contacts (
  "PropertyId" int PRIMARY KEY REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "Inserted" timestamptz,
  "FirstName" text,
  "LastName" text,
  "Address" text,
  "City" text,
  "State" text,
  "Zip" text,
  "Phone" text,
  "Email" text,
  "SkipTraceMobilePhone1" text,
  "SkipTraceMobilePhone2" text,
  "SkipTraceMobilePhone3" text,
  "SkipTraceMobilePhone4" text,
  "SkipTraceMobilePhone5" text,
  "SkipTraceMobilePhone6" text,
  "SkipTraceLandLinePhone1" text,
  "SkipTraceLandLinePhone2" text,
  "SkipTraceLandLinePhone3" text,
  "SkipTraceLandLinePhone4" text,
  "SkipTraceLandLinePhone5" text,
  "SkipTraceLandLinePhone6" text,
  "SkipTraceVoipPhone1" text,
  "SkipTraceVoipPhone2" text,
  "SkipTraceVoipPhone3" text,
  "SkipTraceVoipPhone4" text,
  "SkipTraceVoipPhone5" text,
  "SkipTraceVoipPhone6" text,
  "GoHighLevelContactId" text,
  "utmCampaign" text,
  "utmMedium" text,
  "utmContent" text,
  "utmSource" text,
  ms_synced_at timestamptz
);

-- 2. ms_property_notes (financing notes)
CREATE TABLE IF NOT EXISTS ms_property_notes (
  "Note_Id" int PRIMARY KEY,
  "PropertyId" int NOT NULL REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "Note_Holder" text,
  "Note_Date" date,
  "Note_AprPercentage" decimal(13,2),
  "Note_MinimumFlatPercentage" decimal(13,2),
  "Note_Principal" decimal(13,2),
  "Note_Type" text,
  "Note_MaturityDate" date,
  "Note_CommittedForDate" date,
  "Note_Fees" decimal(20,4),
  "Note_Points" decimal(20,4),
  "Note_InterestCompounded" boolean,
  "Note_InterestPayable" decimal(20,4),
  "Note_InterestPayableMessage" text,
  "Note_Calculated_NotePayable" decimal(20,4),
  "Note_Calculated_NoteBalance" decimal(20,4),
  ms_synced_at timestamptz
);

CREATE INDEX idx_ms_pn_property ON ms_property_notes("PropertyId");

-- 3. ms_property_mortgages
CREATE TABLE IF NOT EXISTS ms_property_mortgages (
  "PropertyMortgageId" int PRIMARY KEY,
  "PropertyId" int NOT NULL REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "Enabled" boolean,
  "Amount" decimal(13,4),
  "LoanType" text,
  "DeedType" text,
  "Date" date,
  "Term" int,
  "DueDate" date,
  "LenderName" text,
  "RateType" text,
  "DetailsJson" text,
  "KnownInterestRate" decimal(6,4),
  "Calculated_EstimatedPayoff" decimal(20,4),
  ms_synced_at timestamptz
);

CREATE INDEX idx_ms_pm_property ON ms_property_mortgages("PropertyId");

-- 4. ms_property_dispositions
CREATE TABLE IF NOT EXISTS ms_property_dispositions (
  "PropertyId" int NOT NULL REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "Type" text NOT NULL,
  "AlternativeArv" decimal(13,0),
  "AssignmentFeeRevenue" decimal(13,0),
  "AlternateCostOfProperty" decimal(13,0),
  "AlternateCB" decimal(13,0),
  "AlternateCycleMonths" decimal(13,0),
  "AlternateBuyingCosts" decimal(13,0),
  "AlternateClosingCosts" decimal(13,0),
  "AlternateHoldingCosts" decimal(13,0),
  "AlternateCostOfMoney" decimal(13,0),
  "AlternateConcessions" decimal(13,0),
  "AlternateSellingCosts" decimal(13,0),
  "AlternateOtherCosts" decimal(13,0),
  "AlternateAssignmentFeeExpense" decimal(13,0),
  "AlternatePercentSplitOfProfitTo3rdParty" decimal(6,4),
  "Profit" decimal(13,0),
  ms_synced_at timestamptz
);

CREATE INDEX idx_ms_pd_property ON ms_property_dispositions("PropertyId");

-- 5. ms_property_comparables
CREATE TABLE IF NOT EXISTS ms_property_comparables (
  "ComparableId" text,
  "PropertyId" int NOT NULL REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "Inserted" timestamptz,
  "Updated" timestamptz,
  "ModifiedBy" text,
  "Starred" boolean NOT NULL DEFAULT false,
  "SortOrder" int DEFAULT 99,
  "Category" text,
  "Description" text,
  "UrlLink" text,
  "Notes" text,
  "AgentSelected" boolean DEFAULT false,
  "AgentNotes" text,
  "ListDate" date,
  "SoldDate" date,
  "Value" decimal(9,0),
  "SqFt" decimal(5,0),
  "AuxSqFt" decimal(5,0),
  "UnfinishedSqFt" decimal(5,0),
  "BasementAtticPercentage" decimal(3,2),
  "UnfinishedSqFtPercentage" decimal(3,2),
  "AdjustedSqFt" decimal(13,6),
  "AdjustedPricePerSqFt" decimal(8,2),
  "Calculated_DaysOnMarket" int,
  "DaysOnMarket" int,
  "Condition" text,
  "ConditionScore" text,
  "Location" text,
  "LocationScore" text,
  "Bedrooms" decimal(3,1),
  "Bathrooms" decimal(3,1),
  "ConfidenceScore" decimal(3,2),
  "Latitude" decimal(13,8),
  "Longitude" decimal(13,8),
  "Distance" decimal(7,2),
  "RestbScore" decimal(4,2),
  "YearBuilt" text,
  "LotSizeAcres" decimal(20,4),
  ms_synced_at timestamptz
);

CREATE INDEX idx_ms_pc_property ON ms_property_comparables("PropertyId");

-- 6. ms_property_agent_feedback
CREATE TABLE IF NOT EXISTS ms_property_agent_feedback (
  "PropertyId" int PRIMARY KEY REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "AgentFeedback" text,
  "NoteToAgent" text,
  "AgentRecommendedArvLow" decimal(10,0),
  "AgentRecommendedArvHigh" decimal(10,0),
  "AgentRecommendedFinalValuation" decimal(10,0),
  ms_synced_at timestamptz
);

-- 7. ms_property_royalty
CREATE TABLE IF NOT EXISTS ms_property_royalty (
  "PropertyId" int PRIMARY KEY REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "LockedInMedianSalePriceMax" decimal(10,2),
  "LockedInMedianSalePriceMaxSetDate" timestamptz,
  "RoyaltyVersionOverride" int,
  "RoyaltyPaidAtOverride" text,
  "Calculated_AcquisitionRoyalty" decimal(8,2),
  "AcquisitionRoyaltyOverride" decimal(8,2),
  "AcquisitionRoyaltyPaid" decimal(8,2),
  "Calculated_AcquisitionRoyaltyDueDate" date,
  "AcquisitionRoyaltyPaidDate" date,
  "Calculated_AcquisitionRoyaltyDue" decimal(8,2),
  "Calculated_DispositionRoyalty" decimal(8,2),
  "DispositionRoyaltyOverride" decimal(8,2),
  "DispositionRoyaltyPaid" decimal(8,2),
  "Calculated_DispositionRoyaltyDueDate" date,
  "DispositionRoyaltyPaidDate" date,
  "Calculated_DispositionRoyaltyDue" decimal(8,2),
  "Calculated_DelayedRoyaltyFee" decimal(8,2),
  "DelayedRoyaltyFeeOverride" decimal(8,2),
  "DelayedRoyaltyFeePaid" decimal(8,2),
  "Calculated_DelayedRoyaltyFeeDueDate" date,
  "DelayedRoyaltyFeePaidDate" date,
  "Calculated_DelayedRoyaltyFeeDue" decimal(8,2),
  "Calculated_RoyaltyTrueUp" decimal(8,2),
  "RoyaltyTrueUpOverride" decimal(8,2),
  "RoyaltyTrueUpPaid" decimal(8,2),
  "Calculated_RoyaltyTrueUpDueDate" date,
  "RoyaltyTrueUpPaidDate" date,
  "Calculated_RoyaltyTrueUpDue" decimal(8,2),
  ms_synced_at timestamptz
);

-- 8. ms_property_media
CREATE TABLE IF NOT EXISTS ms_property_media (
  "PropertyId" int NOT NULL REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "Url" text NOT NULL,
  "ThumbnailUrl" text,
  "YoutubeUrl" text,
  "Type" text,
  "MediaCategory" text,
  "Inserted" timestamptz,
  "Error" boolean DEFAULT false,
  "OriginalFileName" text,
  "FileExtension" text
);

CREATE INDEX idx_ms_pmedia_property ON ms_property_media("PropertyId");

-- 9. ms_property_corporate_notes
CREATE TABLE IF NOT EXISTS ms_property_corporate_notes (
  "Id" int PRIMARY KEY,
  "PropertyId" int NOT NULL REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "Inserted" timestamptz,
  "Updated" timestamptz,
  "Message" text NOT NULL,
  "Name" text,
  "Username" text
);

CREATE INDEX idx_ms_pcn_property ON ms_property_corporate_notes("PropertyId");

-- RLS
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ms_property_contacts', 'ms_property_notes', 'ms_property_mortgages',
    'ms_property_dispositions', 'ms_property_comparables', 'ms_property_agent_feedback',
    'ms_property_royalty', 'ms_property_media', 'ms_property_corporate_notes'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      'read_' || tbl, tbl);
  END LOOP;
END $$;
