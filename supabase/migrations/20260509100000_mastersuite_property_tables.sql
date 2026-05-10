-- ============================================================
-- MasterSuite Integration — Phase 2: Property Tables
-- Core property tables synced from MasterSuite MySQL
-- All column names match MasterSuite exactly
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. ms_properties — Master property record
-- Source: PropertySummaries + PropertyDataEntry
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ms_properties (
  "PropertyId" int PRIMARY KEY,
  "Archived" boolean NOT NULL DEFAULT false,
  "ArchivedDate" timestamptz,
  "TerritorySlug" text NOT NULL REFERENCES territories("TerritorySlug") ON DELETE RESTRICT,
  "PropertyType" text,
  "BatchId" text,
  "Inserted" timestamptz NOT NULL DEFAULT now(),
  "InsertedBy" text,
  "LastModified" timestamptz,
  "LastModifiedBy" text,
  "PropertyReviewedDate" timestamptz,
  "PropertyReviewedBy" text,
  "PropertyReviewedByFriendlyName" text,
  "PropertyUrl" text,
  "AddressSlugVerbose" text,
  "AddressSlugShort" text,
  "Address1" text,
  "Streetname" text,
  "Zip" text,
  "City" text,
  "State" text,
  "County" text,
  "GoogleCity" text,
  "GoogleState" text,
  "GoogleCounty" text,
  "Latitude" decimal(9,6),
  "Longitude" decimal(9,6),
  "AutoTerritorySlug" text,
  "ZillowPropertyId" text,
  "OwnerOfferStatus" text,
  "DirectSellerNotes" text,
  "OwnerLeadSource" text,
  "Vacant" text,
  "Septic" text,
  "RoadType" text,
  "LeadCategory" text,
  "LeadType" text,
  "LeadClassification" text,
  "LeadSubType2" text,
  "ComparableSubjectCondition" text,
  "AuctionAdPrice" decimal(20,4),
  "AuctionDate" text,
  "AuctionTime" text,
  "AuctionReserveBid" decimal(20,4),
  "AuctionTrustee" text,
  "AuctionCountyLocation" text,
  "AuctionDriveBy" text,
  "AuctionTitle" text,
  "AuctionStatus" text,
  "Auctioneer" text,
  "TaxOverallGrade" text,
  "FloodRisk" text,
  "MethCheck" text,
  "UsdaQualified" text,
  "GoogleSearch" text,
  "AedQualified" text,
  "Stage1Arv" decimal(20,4),
  "Stage1ManualArv" decimal(20,4),
  "Stage1Price" decimal(20,4),
  "Stage1LocationGrade" decimal(20,4),
  "Stage1RehabLevel" decimal(20,4),
  "Stage1Notes" text,
  "Stage1CostOfMoneyPercent" decimal(20,4),
  "Stage1MaxRiskFactorPercent" decimal(20,4),
  "Stage1MlsSellPercent" decimal(20,4),
  "LowEndPriceSquareFoot" decimal(20,4),
  "HighEndPriceSquareFoot" decimal(20,4),
  "ArvCeiling" decimal(20,4),
  "OfferRange" text,
  "Stage2Arv" decimal(20,4),
  "Stage2Price" decimal(20,4),
  "Stage2LocationGrade" decimal(20,4),
  "Stage2RehabLevel" decimal(20,4),
  "Stage2Notes" text,
  "Stage3ConstructionProfitRatio" decimal(20,4),
  "Stage3MaxOffer" decimal(20,4),
  "Stage3Arv" decimal(20,4),
  "Stage3Price" decimal(20,4),
  "Stage3LocationGrade" decimal(20,4),
  "Stage3RiskFactor" decimal(20,4),
  "Stage3ConstructionBudget" decimal(20,4),
  "Stage3CostOfMoneyPercent" decimal(20,4),
  "Stage3MaxRiskFactorPercent" decimal(20,4),
  "Stage3Notes" text,
  "Stage3MortgageStartDate" date,
  "Stage3MortgageAmount" decimal(20,4),
  "Stage3MortgageTerm" decimal(20,4),
  "Stage3MortgageKnownInterestRate" decimal(6,4),
  "Stage3Mortgage_Calculated_Payoff" decimal(20,4),
  "Stage3Mortgage2StartDate" date,
  "Stage3Mortgage2Amount" decimal(20,4),
  "Stage3Mortgage2Term" decimal(20,4),
  "Stage3Mortgage2KnownInterestRate" decimal(6,4),
  "Stage3Mortgage2_Calculated_Payoff" decimal(20,4),
  "BuyingCost" decimal(20,4),
  "HoldingCost" decimal(20,4),
  "ClosingCost" decimal(20,4),
  "MlsListCost" decimal(20,4),
  "SellDate" date,
  "DirectMailInitiatedDate" date,
  "Status" text,
  "EvaluationStatus" text,
  "BaseGrade" decimal(20,4),
  "Premium" decimal(20,4),
  "Siding" decimal(20,4),
  "Windows" decimal(20,4),
  "Roof" decimal(20,4),
  "ExteriorIndicators" decimal(20,4),
  "SellerGender" text,
  "SellerApproxAge" text,
  "SellerType" text,
  "SellerRole" text,
  "SellerMotivation" text,
  "SellerBlackSwans" text,
  "PropertyAddressDoNotSend" boolean DEFAULT false,
  "OwnerDoNotSend" boolean DEFAULT false,
  "TrusteeDoNotSend" boolean DEFAULT false,
  "ReferralPartnerName" text,
  "HouseCanaryValue" decimal(13,6),
  "utmMedium" text,
  "utmContent" text,
  "utmSource" text,
  "utmCampaign" text,
  -- From PropertyDataEntry
  "MarketRiskFactor" decimal(12,6),
  "DispositionNotes" text,
  -- NAH OS tracking
  ms_synced_at timestamptz
);

CREATE INDEX idx_ms_properties_territory ON ms_properties("TerritorySlug");
CREATE INDEX idx_ms_properties_status ON ms_properties("Status");
CREATE INDEX idx_ms_properties_inserted ON ms_properties("Inserted");
CREATE INDEX idx_ms_properties_lead_category ON ms_properties("LeadCategory");
CREATE INDEX idx_ms_properties_lead_type ON ms_properties("LeadType");
CREATE INDEX idx_ms_properties_last_modified ON ms_properties("LastModified");

-- ════════════════════════════════════════════════════════════
-- 2. ms_property_calculations — Per-property calculated fields
-- Source: PropertyCalculations
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ms_property_calculations (
  "PropertyId" int PRIMARY KEY REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "Modified" timestamptz,
  "StatusSnapshot" text,
  "Calculated_Arv" decimal(9,0) DEFAULT 0,
  "Calculated_Arv_MarketRiskAdjusted" decimal(9,0),
  "Calculated_RiskFactor" decimal(20,6) DEFAULT 0,
  "Calculated_RiskFactor_Original" decimal(20,6),
  "Calculated_RiskFactorStage1" decimal(20,6),
  "Calculated_RiskFactorStage2" decimal(20,6),
  "Calculated_RiskFactorStage3" decimal(8,6),
  "Calculated_ConstructionBudget" decimal(20,6) DEFAULT 0,
  "Calculated_ConstructionEstimatedDays" int,
  "Calculated_ConstructionDaysComplete" int,
  "Calculated_ConstructionDaysRemaining" int,
  "Calculated_ConstructionDaysOver" int,
  "Calculated_MaxOffer" decimal(20,6) DEFAULT 0,
  "Calculated_MaxOffer_Original" decimal(20,6),
  "Calculated_MaxOffer_Price_Ratio" decimal(20,6),
  "Calculated_MaxOffer_Auction_Price_Ratio" decimal(20,6),
  "Calculated_NahProfit" decimal(20,6) DEFAULT 0,
  "Calculated_NahConstructionProfitRatio" decimal(20,6),
  "Calculated_NahProfitMarketAdjusted" decimal(11,2),
  "ConstructionCostPerSquareFoot" decimal(20,6),
  "Calculated_ArvPerAdjustedSqFt" decimal(20,6) DEFAULT 0,
  "Calculated_LocationGrade" decimal(20,6) DEFAULT 0,
  "Calculated_RehabGrade" decimal(20,6) DEFAULT 0,
  "Calculated_Price" decimal(20,6) DEFAULT 0,
  "Calculated_MlsProfit" decimal(20,6) DEFAULT 0,
  "Calculated_MlsConstructionProfitRatio" decimal(20,6),
  "Calculated_MlsProfitMarketAdjusted" decimal(11,2),
  "Calculated_IntangibleScore" int DEFAULT 0,
  "Calculated_ArvRiskFactor" decimal(20,6) DEFAULT 0,
  "Calculated_LocationRiskAdjustment" decimal(20,6) DEFAULT 0,
  "Calculated_IntangibleRiskAdjustment" decimal(20,6) DEFAULT 0,
  "Calculated_StarredCompsAveragePriceSqFt" decimal(20,6),
  "Calculated_StarredCompsMedianPriceSqFt" decimal(20,6),
  "Calculated_CompRiskAdjustment" decimal(20,6) DEFAULT 0,
  "Calculated_AdjustedRiskFactor" decimal(20,6) DEFAULT 0,
  "Calculated_AdjustedSqFt" decimal(20,6) DEFAULT 0,
  "Calculated_AmountFinanced" decimal(20,6) DEFAULT 0,
  "Calculated_BuyingCost" decimal(20,6) DEFAULT 0,
  "Calculated_HoldingCost" decimal(20,6) DEFAULT 0,
  "Calculated_ClosingCost" decimal(20,6) DEFAULT 0,
  "Calculated_MlsListCost" decimal(20,6) DEFAULT 0,
  "Calculated_TotalQuietCosts" decimal(20,6) DEFAULT 0,
  "Calculated_TotalCostOfMoney" decimal(20,6) DEFAULT 0,
  "Calculated_AuctionMinimumPrice" decimal(20,6),
  "Calculated_StageMaturity" int DEFAULT 0,
  "Calculated_FinanceCostCycleTimeDays" int DEFAULT 0,
  "Calculated_FinanceCost" decimal(20,6),
  "Calculated_EstimatedPayoff2" decimal(20,6),
  "Calculated_CashRequired" decimal(20,6) DEFAULT 0,
  "Calculated_ReturnOnInvestment" decimal(20,6) DEFAULT 0,
  "Calculated_SellerType" text,
  "Calculated_SellerName" text,
  "Calculated_SellerFirstName" text,
  "Calculated_SellerLastName" text,
  "Calculated_SellerMailingAddress" text,
  "Calculated_SellerAddress" text,
  "Calculated_SellerCity" text,
  "Calculated_SellerState" text,
  "Calculated_SellerZip" text,
  "Calculated_SellerAddressDistance" decimal(13,6),
  "Calculated_AbsenteeSeller" boolean,
  "Calculated_SellerPhone" text,
  "Calculated_SellerEmail" text,
  "Calculated_SellerMarketingWeek" int DEFAULT 0,
  "Calculated_FullPropertyAddress" text,
  "Calculated_TotalCbGrade" decimal(20,6),
  "Calculated_Stage1ArvSqFt" decimal(20,6),
  "Stage1ArvEstatedCombined" decimal(20,6),
  "Calculated_LowEndTotalPrice" decimal(20,6),
  "Calculated_HighEndTotalPrice" decimal(20,6),
  "Calculated_Stage2Arv" decimal(20,6),
  "Calculated_ConstructionBudgetStage1" decimal(20,6),
  "Calculated_ConstructionBudgetStage2" decimal(20,6),
  "Calculated_ConstructionStage3RehabGrade" decimal(20,6),
  "Calculated_BuiltAge" decimal(20,6),
  "Calculated_EffectiveAge" decimal(20,6),
  "Calculated_ArvCeilingSqFt" decimal(20,6),
  "Calculated_Stage1MaxOfferPriceRatio" int,
  "Calculated_LeadScore" int,
  "LeadScore_MaxOfferPriceScore_Points" decimal(10,4),
  "LeadScore_MaxOfferPriceScore_Percent" decimal(10,4),
  "LeadScore_ConditionScore_Points" decimal(10,4),
  "LeadScore_ConditionScore_Percent" decimal(10,4),
  "LeadScore_AbsenteeOwnerScore_Points" decimal(10,4),
  "LeadScore_AbsenteeOwnerScore_Percent" decimal(10,4),
  "LeadScore_SoldAmountArvScore_Points" decimal(10,4),
  "LeadScore_SoldAmountArvScore_Percent" decimal(10,4),
  "LeadScore_YearBuiltScore_Points" decimal(10,4),
  "LeadScore_YearBuiltScore_Percent" decimal(10,4),
  "LeadScore_SquareFootageScore_Points" decimal(10,4),
  "LeadScore_SquareFootageScore_Percent" decimal(10,4),
  "FollowUpScore" int,
  "FollowUpScore_LeadCategory_Points" decimal(20,6),
  "FollowUpScore_Status_Points" decimal(20,6),
  "FollowUpScore_MarketingWeek_Points" decimal(20,6),
  "Calculated_Inv_DaysOwned" int,
  "Calculated_Inv_MonthsOwned" int,
  "Calculated_Inv_YearsOwned" int,
  "Calculated_Inv_DaysOnMarket" int,
  "Calculated_Inv_ProjectProfit" decimal(20,3),
  "Calculated_Inv_Profit" decimal(20,6),
  "Calculated_Inv_Proceeds" decimal(20,6),
  "Calculated_Inv_TotalNotesPayable" decimal(20,6),
  "Calculated_Inv_OverBudget" decimal(20,6),
  "Calculated_Inv_CashInvested" decimal(20,6),
  "Calculated_Inv_RiskFactor" decimal(20,6),
  "Calculated_Inv_ConstructionProfitRatio" decimal(20,6),
  "Calculated_Inv_CBGrade" decimal(20,6),
  "Calculated_Inv_Item19Year" int,
  "Calculated_Inv_Royalty" decimal(20,6),
  "HasInventory" boolean,
  "HasActiveInventory" boolean,
  "CycleTimePurchaseToSell" int,
  "CycleTimePurchaseToContractedSell" int,
  "CycleTimePurchaseToConstructionStart" int,
  "CycleTimePurchaseToList" int,
  "CycleTimeConstructionStartToConstructionComplete" int,
  "CycleTimeConstructionCompleteToSell" int,
  "CycleTimePurchaseToConstructionComplete" int,
  "CycleTimeListToSell" int,
  "CycleTimeS1ToFinalOutcome" int,
  "ProjectedRoyaltyDate" date,
  "Calculated_LastSoldDate" timestamptz,
  "Calculated_YearsOwned" int,
  "Calculated_ReportingStatus" text,
  ms_synced_at timestamptz
);

-- ════════════════════════════════════════════════════════════
-- 3. ms_property_inventory — Full lifecycle, all 5 maturity stages
-- Source: PropertyInventory (130 columns)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ms_property_inventory (
  "PropertyId" int PRIMARY KEY REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "Inv_Status" text,
  "Inv_Type" text,
  "Inv_SalesTeamInfo" text,
  "Inv_FinanceStrategy" text,
  "Inv_ExpectedListPrice" text,
  "Inv_ContractedPurchaseDate" timestamptz,
  "Inv_PurchaseDate" timestamptz,
  "Inv_ConstructionStartDate" timestamptz,
  "Inv_CompletionDate" timestamptz,
  "Inv_ListDate" timestamptz,
  "Inv_ContractedSellDate" timestamptz,
  "Inv_SellDate" timestamptz,
  "Inv_OccupiedDate" timestamptz,
  "Inv_UtilityProviders" text,
  "Inv_Water" text,
  "Inv_Electric" text,
  "Inv_Gas" text,
  "Inv_Septic" text,
  -- ARV: all 5 stages
  "Inv_CurrentArvStage0" decimal(20,4),
  "Inv_CurrentArvOriginal" decimal(20,4),
  "Inv_CurrentArvRevised" decimal(20,4),
  "Inv_CurrentArvActual" decimal(20,4),
  "Inv_CurrentArvMostMature" decimal(20,4),
  "Inv_CurrentArvMostMaturePriceSqFt" decimal(20,4),
  -- Selling Costs
  "Inv_SellingCostsStage0" decimal(20,4),
  "Inv_SellingCostsOriginal" decimal(20,4),
  "Inv_SellingCostsRevised" decimal(20,4),
  "Inv_SellingCostsActual" decimal(20,4),
  "Inv_SellingCostsMostMature" decimal(20,4),
  -- Concessions
  "Inv_ConcessionsStage0" decimal(20,4),
  "Inv_ConcessionsOriginal" decimal(20,4),
  "Inv_ConcessionsRevised" decimal(20,4),
  "Inv_ConcessionsActual" decimal(20,4),
  "Inv_ConcessionsMostMature" decimal(20,4),
  -- Cost of Property
  "Inv_CostOfPropertyStage0" decimal(20,4),
  "Inv_CostOfPropertyOriginal" decimal(20,4),
  "Inv_CostOfPropertyRevised" decimal(20,4),
  "Inv_CostOfPropertyActual" decimal(20,4),
  "Inv_CostOfPropertyMostMature" decimal(20,4),
  -- Construction Budget
  "Inv_ConstructionBudgetStage0" decimal(20,4),
  "Inv_ConstructionBudgetOriginal" decimal(20,4),
  "Inv_ConstructionBudgetRevised" decimal(20,4),
  "Inv_ConstructionBudgetActual" decimal(20,4),
  "Inv_ConstructionBudgetMostMature" decimal(20,4),
  -- Maintenance
  "Inv_MaintenanceStage0" decimal(20,4),
  "Inv_MaintenanceOriginal" decimal(20,4),
  "Inv_MaintenanceRevised" decimal(20,4),
  "Inv_MaintenanceActual" decimal(20,4),
  "Inv_MaintenanceMostMature" decimal(20,4),
  -- Holding Costs
  "Inv_HoldingCostsStage0" decimal(20,4),
  "Inv_HoldingCostsOriginal" decimal(20,4),
  "Inv_HoldingCostsRevised" decimal(20,4),
  "Inv_HoldingCostsActual" decimal(20,4),
  "Inv_HoldingCostsMostMature" decimal(20,4),
  -- Buying Cost
  "Inv_BuyingCostStage0" decimal(20,4),
  "Inv_BuyingCostOriginal" decimal(20,4),
  "Inv_BuyingCostRevised" decimal(20,4),
  "Inv_BuyingCostActual" decimal(20,4),
  "Inv_BuyingCostMostMature" decimal(20,4),
  -- Refi Costs
  "Inv_RefiCostsStage0" decimal(20,4),
  "Inv_RefiCostsOriginal" decimal(20,4),
  "Inv_RefiCostsRevised" decimal(20,4),
  "Inv_RefiCostsActual" decimal(20,4),
  "Inv_RefiCostsMostMature" decimal(20,4),
  -- Interest Payments
  "Inv_InterestPaymentsStage0" decimal(20,4),
  "Inv_InterestPaymentsOriginal" decimal(20,4),
  "Inv_InterestPaymentsRevised" decimal(20,4),
  "Inv_InterestPaymentsActual" decimal(20,4),
  "Inv_InterestPaymentsMostMature" decimal(20,4),
  -- Mortgage Principal
  "Inv_MortgagePrincipalStage0" decimal(20,4),
  "Inv_MortgagePrincipalOriginal" decimal(20,4),
  "Inv_MortgagePrincipalRevised" decimal(20,4),
  "Inv_MortgagePrincipalActual" decimal(20,4),
  "Inv_MortgagePrincipalMostMature" decimal(20,4),
  -- Monthly Mortgage Payment
  "Inv_MonthlyMortgagePaymentStage0" decimal(20,4),
  "Inv_MonthlyMortgagePaymentOriginal" decimal(20,4),
  "Inv_MonthlyMortgagePaymentRevised" decimal(20,4),
  "Inv_MonthlyMortgagePaymentActual" decimal(20,4),
  "Inv_MonthlyMortgagePaymentMostMature" decimal(20,4),
  -- County Taxes
  "Inv_CountyTaxesStage0" decimal(20,4),
  "Inv_CountyTaxesOriginal" decimal(20,4),
  "Inv_CountyTaxesRevised" decimal(20,4),
  "Inv_CountyTaxesActual" decimal(20,4),
  "Inv_CountyTaxesMostMature" decimal(20,4),
  -- City Taxes
  "Inv_CityTaxesStage0" decimal(20,4),
  "Inv_CityTaxesOriginal" decimal(20,4),
  "Inv_CityTaxesRevised" decimal(20,4),
  "Inv_CityTaxesActual" decimal(20,4),
  "Inv_CityTaxesMostMature" decimal(20,4),
  -- Mow Cost
  "Inv_MowCostStage0" decimal(20,4),
  "Inv_MowCostOriginal" decimal(20,4),
  "Inv_MowCostRevised" decimal(20,4),
  "Inv_MowCostActual" decimal(20,4),
  "Inv_MowCostMostMature" decimal(20,4),
  -- Location Grade
  "Inv_LocationGradeStage0" decimal(20,4),
  "Inv_LocationGradeOriginal" decimal(20,4),
  "Inv_LocationGradeRevised" decimal(20,4),
  "Inv_LocationGradeActual" decimal(20,4),
  "Inv_LocationGradeMostMature" decimal(20,4),
  -- Phase 5 Costs
  "Inv_Phase5CostsStage0" decimal(20,4),
  "Inv_Phase5CostsOriginal" decimal(20,4),
  "Inv_Phase5CostsRevised" decimal(20,4),
  "Inv_Phase5CostsActual" decimal(20,4),
  "Inv_Phase5CostsMostMature" decimal(20,4),
  -- Rental Income
  "Inv_RentalIncomeStage0" decimal(20,4),
  "Inv_RentalIncomeOriginal" decimal(20,4),
  "Inv_RentalIncomeRevised" decimal(20,4),
  "Inv_RentalIncomeActual" decimal(20,4),
  "Inv_RentalIncomeMostMature" decimal(20,4),
  -- Price (Sale)
  "Inv_PriceStage0" decimal(20,4),
  "Inv_PriceOriginal" decimal(20,4),
  "Inv_PriceRevised" decimal(20,4),
  "Inv_PriceActual" decimal(20,4),
  "Inv_PriceMostMature" decimal(20,4),
  -- Rental Pro Forma (Actual)
  "Inv_AnnualProForma_RentalRent_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalVacancy_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalMaintenance_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalCapEx_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalManagement_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalPropertyTax_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalInsurance_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalUtilities_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalHoa_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalMowing_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalMisc_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalPrevailingCapRate_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalInterestRate_Actual" decimal(13,6),
  "Inv_AnnualProForma_RentalMaxLoanToValue_Actual" decimal(13,6),
  "Inv_AssignmentFee" decimal(8,2),
  ms_synced_at timestamptz
);

CREATE INDEX idx_ms_inv_status ON ms_property_inventory("Inv_Status");
CREATE INDEX idx_ms_inv_purchase_date ON ms_property_inventory("Inv_PurchaseDate");
CREATE INDEX idx_ms_inv_sell_date ON ms_property_inventory("Inv_SellDate");

-- ════════════════════════════════════════════════════════════
-- 4. ms_property_status_history — Funnel transition timestamps
-- Source: PropertyStatusHistory
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ms_property_status_history (
  "PropertyId" int NOT NULL REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "Inserted" timestamptz NOT NULL,
  "PreviousStatus" text,
  "NewStatus" text
);

CREATE INDEX idx_ms_psh_property ON ms_property_status_history("PropertyId");
CREATE INDEX idx_ms_psh_inserted ON ms_property_status_history("Inserted");
CREATE INDEX idx_ms_psh_new_status ON ms_property_status_history("NewStatus");

-- ════════════════════════════════════════════════════════════
-- 5. ms_property_stage0 — Raw lead data from data providers
-- Source: PropertyStage0
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ms_property_stage0 (
  "Stage0Type" text NOT NULL,
  "PropertyId" int NOT NULL REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "PropertyType" text,
  "YearBuilt" text,
  "EffectiveYear" text,
  "Bedrooms" decimal(20,4),
  "Bathrooms" decimal(20,4),
  "LotSizeAcres" decimal(20,4),
  "SqFtBase" decimal(20,4),
  "AuxFinishedSqFt" decimal(20,4),
  "UnfinishedSqFt" decimal(20,4),
  "TaxValue" decimal(20,4),
  "CensusTract" text,
  "OwnerName" text,
  "OwnerAddress" text,
  "OwnerCity" text,
  "OwnerState" text,
  "OwnerZip" text,
  "OwnerPhone" text,
  "OwnerPhoneNormalized" text,
  "OwnerEmail" text,
  "TrusteeName" text,
  "TrusteeAddress" text,
  "TrusteeCity" text,
  "TrusteeState" text,
  "TrusteeZip" text,
  "TrusteeEmail" text,
  "TrusteePhone" text,
  "LastSoldPrice" decimal(20,4),
  "LastSoldDate" timestamptz,
  "Latitude" text,
  "Longitude" text,
  "LatLongSource" text,
  "Valuation" decimal(20,4),
  "ValuationLow" decimal(20,4),
  "ValuationHigh" decimal(20,4),
  PRIMARY KEY ("Stage0Type", "PropertyId")
);

-- ════════════════════════════════════════════════════════════
-- 6. ms_property_stage1 — Stage 1 evaluation snapshot
-- Source: PropertyStage1
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ms_property_stage1 (
  "PropertyId" int PRIMARY KEY REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "S1_LastSoldPrice" decimal(20,4),
  "S1_LastSoldDate" timestamptz,
  "S1_SqFtBase" decimal(20,4),
  "S1_TaxValue" decimal(20,4),
  "S1_PropertyType" text,
  "S1_YearBuilt" text,
  "S1_EffectiveYear" text,
  "S1_Bedrooms" decimal(20,4),
  "S1_Bathrooms" decimal(20,4),
  "S1_LotSizeAcres" decimal(20,4),
  "S1_AuxFinishedSqFt" decimal(20,4),
  "S1_UnfinishedSqFt" decimal(20,4),
  "S1_CensusTract" text,
  "S1_OwnerName" text,
  "S1_OwnerAddress" text,
  "S1_OwnerCity" text,
  "S1_OwnerState" text,
  "S1_OwnerZip" text,
  "S1_OwnerPhone" text,
  "S1_OwnerPhoneNormalized" text,
  "S1_OwnerEmail" text,
  "S1_TrusteeName" text,
  "S1_TrusteeAddress" text,
  "S1_TrusteeCity" text,
  "S1_TrusteeState" text,
  "S1_TrusteeZip" text,
  "S1_TrusteeEmail" text,
  "S1_TrusteePhone" text
);

-- ════════════════════════════════════════════════════════════
-- 7. ms_lead_list_counts — Aggregates for 0 Lead List
-- Source: Computed from PropertySummaries WHERE Status = '0 Lead List'
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ms_lead_list_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TerritorySlug" text NOT NULL REFERENCES territories("TerritorySlug") ON DELETE RESTRICT,
  month date NOT NULL,
  "LeadCategory" text,
  "LeadType" text,
  count int NOT NULL DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  UNIQUE ("TerritorySlug", month, "LeadCategory", "LeadType")
);

CREATE INDEX idx_ms_llc_territory ON ms_lead_list_counts("TerritorySlug");

-- ════════════════════════════════════════════════════════════
-- 8. ms_property_status_timelines — Funnel timing summary
-- Source: PropertyStatusTimelines
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ms_property_status_timelines (
  "PropertyId" int PRIMARY KEY REFERENCES ms_properties("PropertyId") ON DELETE CASCADE,
  "DaysBetweenInsertedToFirstStage" int,
  "FirstStageDate" timestamptz,
  "DaysBetweenFirstStageToStage4" int,
  "Stage4Date" timestamptz
);

-- ════════════════════════════════════════════════════════════
-- RLS — all ms_* tables use service role for sync, authenticated for read
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ms_properties', 'ms_property_calculations', 'ms_property_inventory',
    'ms_property_status_history', 'ms_property_stage0', 'ms_property_stage1',
    'ms_lead_list_counts', 'ms_property_status_timelines'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      'read_' || tbl, tbl);
  END LOOP;
END $$;
