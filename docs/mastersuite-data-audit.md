# MasterSuite x NAH OS Data Integration Audit

> Infrastructure plan for merging MasterSuite's 10-year production database into NAH Franchise OS.
> MasterSuite is source of truth. All naming aligns to MasterSuite conventions.
> Generated: 2026-05-08

---

## Executive Summary

| Metric                                  | Value                                               |
| --------------------------------------- | --------------------------------------------------- |
| MasterSuite tables audited              | 79                                                  |
| MasterSuite columns cataloged           | 1,528                                               |
| NAH OS tables audited                   | 87                                                  |
| NAH OS columns cataloged                | ~1,020                                              |
| New tables to create                    | 42                                                  |
| New columns to add (on existing tables) | 63                                                  |
| Column renames required                 | 37                                                  |
| Files affected by renames               | 164+                                                |
| Rows to sync (initial load)             | ~240K (excluding Lead List aggregates)              |
| Sync frequency                          | Every 15 min (properties), daily (reference/market) |

**Guiding principles:**

1. MasterSuite column names are used exactly — no renaming MasterSuite's data
2. Per-property data is synced (raw + per-property calculated fields)
3. Territory-level aggregated KPIs are NOT synced — we compute our own from raw property data
4. All synced data is read-only in NAH OS (non-editable)
5. NAH OS-only data (coaching, calls, pipeline, Scout intel) remains in our tables

---

## Part 1: Territory Alignment

### 1.1 All 88 MasterSuite Territories

64 active, 24 inactive/closed. Every one must exist in our `territories` table.

**Active (64):**
ALCHUA, ALTA, ATHENS, BLLNGS, BTNRGE, BUCKMT, CHARSC, CHATT, CHLTNE, CLTW, DALCAR, DELACO, DESMIA, DOVRDE, FREDVA, GLOBAL, GREENB, GRNVSC, HENDTN, HOTSAR, HUNTVL, HUSTNE, INDYNW, JACKMS, KITHWK, KNOXTN, KSSMEE, LAFALA, LEECOF, LEXKY, LOWELL, MIAMIV, MIDLVA, MONMTH, MONRLA, MORRTN, MURFTN, MYTBCH, NAPVLL, NASHC, NASHSW, NORVMI, NOVAVA, NOWTNJ, NWOHIO, OAKRTN, PALAIL, PASCOF, PIELLA, RALHNC, RALHSE, RICHMN, SANANT, SASOTA, SPARSC, STLNW, TAMPAW, TOLEDO, TRAIN, TRI, VABCH, VOCOFL, WHLING, WICHTA

**Inactive/Closed (24):**
ANDRSN, ARAPCO, AUSTXE, BRAZTX, CLRKTN, FSNCAE, FTWTEX, FULTGA, HJRVTX, JVLLES, KANEIL, KISSFL, LEHIGH, MESAAZ, MONMOH, NHRTCT, NSHOMA, ODENAL, OMAHAW, RACNWI, RENONV, SLTLKN, WORCMA, YORKPA

### 1.2 Territory Table Renames

| Current NAH OS   | New (MasterSuite)        | Referenced in            |
| ---------------- | ------------------------ | ------------------------ |
| `ms_slug`        | `TerritorySlug`          | 102 files (PK + all FKs) |
| `territory_name` | `Nickname`               | 36 files                 |
| `awarded_date`   | `FranchiseAgreementDate` | ~5 files                 |

### 1.3 FK Columns to Rename → `TerritorySlug`

Every table referencing territories must rename its FK column:

| Table                         | Current Column      | Files Affected |
| ----------------------------- | ------------------- | -------------- |
| `territory_owners`            | `ms_slug`           |                |
| `territory_candidates`        | `ms_slug`           |                |
| `franchise_owners`            | `ms_slug`           |                |
| `territory_profile`           | `ms_slug`           |                |
| `territory_grades`            | `ms_slug`           |                |
| `territory_stakeholders`      | `ms_slug`           |                |
| `zorakle_profiles`            | `ms_slug`           |                |
| `territory_market_data`       | `territory_slug`    | 23 files       |
| `eos_territory_goals`         | `territory_slug`    | 23 files       |
| `eos_territory_rocks`         | `territory_slug`    |                |
| `eos_territory_todos`         | `territory_slug`    |                |
| `eos_territory_issues`        | `territory_slug`    |                |
| `eos_territory_budgets`       | `territory_slug`    |                |
| `eos_territory_habits`        | `territory_slug`    |                |
| `eos_territory_lead_channels` | `territory_slug`    |                |
| `eos_territory_scorecard`     | `territory_slug`    |                |
| `calls`                       | `territory_ms_slug` | 66 files       |
| `call_territories`            | `territory_ms_slug` |                |
| `call_data_extractions`       | `territory_ms_slug` |                |
| `journey_pipeline_state`      | `territory_ms_slug` |                |
| `coach_assignments`           | `territory_ms_slug` |                |
| `suggestion_feedback`         | `territory_ms_slug` |                |
| `data_update_suggestions`     | `territory_ms_slug` |                |
| `integration_logs`            | `related_ms_slug`   |                |

**URL route rename:** `app/(auth)/territories/[msSlug]` → `app/(auth)/territories/[TerritorySlug]` (37 files reference `msSlug`)

**Total rename blast radius:** 164+ TypeScript/TSX files

### 1.4 New Columns on `territories` Table

57 columns from MasterSuite `Territories` (65 columns) minus the 3 we already have (after rename) minus 5 we skip (GoHighLevelApiKey = sensitive, Obsolete fields, DashboardWelcomeMessage = MS-UI-only):

| Column                                | Type         | Category       |
| ------------------------------------- | ------------ | -------------- |
| `TerritoryId`                         | int          | Identity       |
| `Broker`                              | text         | Ops            |
| `IsFranchise`                         | boolean      | Classification |
| `IsFullTime`                          | boolean      | Classification |
| `FullTimeOperator`                    | boolean      | Classification |
| `ExcludeFromGlobalCalculations`       | boolean      | Classification |
| `PrimaryCoach`                        | text         | Coaching       |
| `PersonalName`                        | text         | Owner          |
| `Owner2`                              | text         | Owner          |
| `Owner3`                              | text         | Owner          |
| `EmergencyContact`                    | text         | Owner          |
| `FranchiseEmail`                      | text         | Contact        |
| `PersonalPhoneNumber`                 | text         | Contact        |
| `StreetAddress`                       | text         | Address        |
| `NahCity`                             | text         | Address        |
| `NahState`                            | text         | Address        |
| `NahZip`                              | text         | Address        |
| `RealEstateLicensee`                  | text         | Licensing      |
| `LicenseeBroker`                      | text         | Licensing      |
| `LicenseeBrokerNumber`                | text         | Licensing      |
| `MarketingName`                       | text         | Marketing      |
| `MarketingPhoneNumber`                | text         | Marketing      |
| `MarketingReturnAddress`              | text         | Marketing      |
| `MarketingLeadGenPhoneNumber`         | text         | Marketing      |
| `MarketingCallCenterForwardingNumber` | text         | Marketing      |
| `MarketingEmailAddress`               | text         | Marketing      |
| `MarketingInstagramProfile`           | text         | Marketing      |
| `MarketingFacebookPage`               | text         | Marketing      |
| `DocumentUrlFranchiseAgreement`       | text         | Compliance     |
| `DocumentUrlCOILiabilityInsurance`    | text         | Compliance     |
| `DocumentUrlCOIProfessionalLiability` | text         | Compliance     |
| `DocumentUrlCOIOther`                 | text         | Compliance     |
| `DocumentUrlBusinessLicense`          | text         | Compliance     |
| `DocumentUrlRealEstateLicense`        | text         | Compliance     |
| `DocumentUrlOther`                    | text         | Compliance     |
| `DocumentUrlOther2`                   | text         | Compliance     |
| `ComplianceScore`                     | decimal(5,2) | Compliance     |
| `ComplianceScoreManualDescription`    | text         | Compliance     |
| `LegalEntityName`                     | text         | Legal          |
| `InitialApplicationDate`              | date         | Dates          |
| `TrainingCompleteDate`                | date         | Dates          |
| `FirstPurchaseDate`                   | date         | Dates          |
| `FranchiseClosedDate`                 | date         | Dates          |
| `GoHighLevelLocationId`               | text         | Integration    |
| `NexaActive`                          | boolean      | Vendor         |
| `NexaAccount`                         | text         | Vendor         |
| `Vonage1Active`                       | boolean      | Vendor         |
| `Vonage1Account`                      | text         | Vendor         |
| `Vonage2Active`                       | boolean      | Vendor         |
| `Vonage2Account`                      | text         | Vendor         |
| `GoogleLicense1Active`                | boolean      | Vendor         |
| `GoogleLicense1Account`               | text         | Vendor         |
| `GoogleLicense2Active`                | boolean      | Vendor         |
| `GoogleLicense2Account`               | text         | Vendor         |
| `GoogleLicense3Active`                | boolean      | Vendor         |
| `GoogleLicense3Account`               | text         | Vendor         |
| `GoogleLicense4Active`                | boolean      | Vendor         |
| `GoogleLicense4Account`               | text         | Vendor         |
| `Notes`                               | text         | General        |

### 1.5 `franchise_owners` Table Decision

**Recommendation: Add `ghl_contact_id` and `ct_id`/`ct_email` to `territories`, then deprecate `franchise_owners`.** It's a 1:1 relationship and `territory_owners` already handles ownership history. The `franchise_owners` table is a redundant middle layer.

### 1.6 `territory_profile` Table Decision

**Keep it.** Fields like `competitor_presence`, `local_market_notes`, `market_type`, `flip_activity_score`, `coaching_notes`, `last_checkin_date` are NAH OS research/qualitative data not in MasterSuite. Operational metrics (`houses_purchased_ytd`, `avg_profit_per_flip`, etc.) become auto-populated from synced property data rather than manually entered.

---

## Part 2: Property Tables

These are entirely new in NAH OS. Every table uses MasterSuite column names exactly.

**Sync scope:** All properties with Status != '0 Lead List' (~50K rows). Lead List gets aggregate counts only.

### 2.1 `ms_properties` — Master Property Record

**Source:** PropertySummaries (122 columns) + relevant PropertyDataEntry fields

**Sync:** All non-Lead-List properties (~50K rows)

| Column                              | Type         | Source                                                                 |
| ----------------------------------- | ------------ | ---------------------------------------------------------------------- |
| `PropertyId`                        | int          | **PK**                                                                 |
| `Archived`                          | boolean      |                                                                        |
| `ArchivedDate`                      | timestamptz  |                                                                        |
| `TerritorySlug`                     | text         | FK territories                                                         |
| `PropertyType`                      | text         |                                                                        |
| `BatchId`                           | text         |                                                                        |
| `Inserted`                          | timestamptz  | When lead entered system                                               |
| `InsertedBy`                        | text         |                                                                        |
| `LastModified`                      | timestamptz  |                                                                        |
| `LastModifiedBy`                    | text         |                                                                        |
| `PropertyReviewedDate`              | timestamptz  |                                                                        |
| `PropertyReviewedBy`                | text         |                                                                        |
| `PropertyReviewedByFriendlyName`    | text         |                                                                        |
| `PropertyUrl`                       | text         |                                                                        |
| `AddressSlugVerbose`                | text         |                                                                        |
| `AddressSlugShort`                  | text         |                                                                        |
| `Address1`                          | text         |                                                                        |
| `Streetname`                        | text         |                                                                        |
| `Zip`                               | text         |                                                                        |
| `City`                              | text         |                                                                        |
| `State`                             | text         |                                                                        |
| `County`                            | text         |                                                                        |
| `GoogleCity`                        | text         |                                                                        |
| `GoogleState`                       | text         |                                                                        |
| `GoogleCounty`                      | text         |                                                                        |
| `Latitude`                          | decimal(9,6) |                                                                        |
| `Longitude`                         | decimal(9,6) |                                                                        |
| `AutoTerritorySlug`                 | text         |                                                                        |
| `ZillowPropertyId`                  | text         |                                                                        |
| `OwnerOfferStatus`                  | text         |                                                                        |
| `DirectSellerNotes`                 | text         |                                                                        |
| `OwnerLeadSource`                   | text         |                                                                        |
| `Vacant`                            | text         |                                                                        |
| `Septic`                            | text         |                                                                        |
| `RoadType`                          | text         |                                                                        |
| `LeadCategory`                      | text         | Lists, Direct Seller, Referral Partners, etc.                          |
| `LeadType`                          | text         | ProspectNow, PPL, Agent Listed, etc. (~40 types)                       |
| `LeadClassification`                | text         |                                                                        |
| `LeadSubType2`                      | text         |                                                                        |
| `ComparableSubjectCondition`        | text         |                                                                        |
| `AuctionAdPrice`                    | decimal      |                                                                        |
| `AuctionDate`                       | text         |                                                                        |
| `AuctionTime`                       | text         |                                                                        |
| `AuctionReserveBid`                 | decimal      |                                                                        |
| `AuctionTrustee`                    | text         |                                                                        |
| `AuctionCountyLocation`             | text         |                                                                        |
| `AuctionDriveBy`                    | text         |                                                                        |
| `AuctionTitle`                      | text         |                                                                        |
| `AuctionStatus`                     | text         |                                                                        |
| `Auctioneer`                        | text         |                                                                        |
| `TaxOverallGrade`                   | text         |                                                                        |
| `FloodRisk`                         | text         |                                                                        |
| `MethCheck`                         | text         |                                                                        |
| `UsdaQualified`                     | text         |                                                                        |
| `GoogleSearch`                      | text         |                                                                        |
| `AedQualified`                      | text         |                                                                        |
| `Stage1Arv`                         | decimal      |                                                                        |
| `Stage1ManualArv`                   | decimal      |                                                                        |
| `Stage1Price`                       | decimal      |                                                                        |
| `Stage1LocationGrade`               | decimal      |                                                                        |
| `Stage1RehabLevel`                  | decimal      |                                                                        |
| `Stage1Notes`                       | text         |                                                                        |
| `Stage1CostOfMoneyPercent`          | decimal      |                                                                        |
| `Stage1MaxRiskFactorPercent`        | decimal      |                                                                        |
| `Stage1MlsSellPercent`              | decimal      |                                                                        |
| `LowEndPriceSquareFoot`             | decimal      |                                                                        |
| `HighEndPriceSquareFoot`            | decimal      |                                                                        |
| `ArvCeiling`                        | decimal      |                                                                        |
| `OfferRange`                        | text         |                                                                        |
| `Stage2Arv`                         | decimal      |                                                                        |
| `Stage2Price`                       | decimal      |                                                                        |
| `Stage2LocationGrade`               | decimal      |                                                                        |
| `Stage2RehabLevel`                  | decimal      |                                                                        |
| `Stage2Notes`                       | text         |                                                                        |
| `Stage3ConstructionProfitRatio`     | decimal      |                                                                        |
| `Stage3MaxOffer`                    | decimal      |                                                                        |
| `Stage3Arv`                         | decimal      |                                                                        |
| `Stage3Price`                       | decimal      |                                                                        |
| `Stage3LocationGrade`               | decimal      |                                                                        |
| `Stage3RiskFactor`                  | decimal      |                                                                        |
| `Stage3ConstructionBudget`          | decimal      |                                                                        |
| `Stage3CostOfMoneyPercent`          | decimal      |                                                                        |
| `Stage3MaxRiskFactorPercent`        | decimal      |                                                                        |
| `Stage3Notes`                       | text         |                                                                        |
| `Stage3MortgageStartDate`           | date         |                                                                        |
| `Stage3MortgageAmount`              | decimal      |                                                                        |
| `Stage3MortgageTerm`                | decimal      |                                                                        |
| `Stage3MortgageKnownInterestRate`   | decimal      |                                                                        |
| `Stage3Mortgage_Calculated_Payoff`  | decimal      |                                                                        |
| `Stage3Mortgage2StartDate`          | date         |                                                                        |
| `Stage3Mortgage2Amount`             | decimal      |                                                                        |
| `Stage3Mortgage2Term`               | decimal      |                                                                        |
| `Stage3Mortgage2KnownInterestRate`  | decimal      |                                                                        |
| `Stage3Mortgage2_Calculated_Payoff` | decimal      |                                                                        |
| `BuyingCost`                        | decimal      |                                                                        |
| `HoldingCost`                       | decimal      |                                                                        |
| `ClosingCost`                       | decimal      |                                                                        |
| `MlsListCost`                       | decimal      |                                                                        |
| `SellDate`                          | date         |                                                                        |
| `DirectMailInitiatedDate`           | date         |                                                                        |
| `Status`                            | text         | Funnel: 0 Lead List, 1, 2, 3, 4, 5 Contract, 6 Purchase + dispositions |
| `EvaluationStatus`                  | text         |                                                                        |
| `BaseGrade`                         | decimal      |                                                                        |
| `Premium`                           | decimal      |                                                                        |
| `Siding`                            | decimal      |                                                                        |
| `Windows`                           | decimal      |                                                                        |
| `Roof`                              | decimal      |                                                                        |
| `ExteriorIndicators`                | decimal      |                                                                        |
| `SellerGender`                      | text         |                                                                        |
| `SellerApproxAge`                   | text         |                                                                        |
| `SellerType`                        | text         |                                                                        |
| `SellerRole`                        | text         |                                                                        |
| `SellerMotivation`                  | text         |                                                                        |
| `SellerBlackSwans`                  | text         |                                                                        |
| `PropertyAddressDoNotSend`          | boolean      |                                                                        |
| `OwnerDoNotSend`                    | boolean      |                                                                        |
| `TrusteeDoNotSend`                  | boolean      |                                                                        |
| `ReferralPartnerName`               | text         |                                                                        |
| `HouseCanaryValue`                  | decimal      |                                                                        |
| `utmMedium`                         | text         |                                                                        |
| `utmContent`                        | text         |                                                                        |
| `utmSource`                         | text         |                                                                        |
| `utmCampaign`                       | text         |                                                                        |
| `MarketRiskFactor`                  | decimal      | From PropertyDataEntry                                                 |
| `DispositionNotes`                  | text         | From PropertyDataEntry                                                 |
| `ms_synced_at`                      | timestamptz  | NAH OS tracking                                                        |

**~115 columns**

### 2.2 `ms_property_calculations` — Per-Property Calculated Fields

**Source:** PropertyCalculations (209 columns — we take all meaningful ones, skip Logs and description text)

**Sync:** Same scope as ms_properties

| Column                                             | Type        | Notes                    |
| -------------------------------------------------- | ----------- | ------------------------ |
| `PropertyId`                                       | int         | **PK**, FK ms_properties |
| `Modified`                                         | timestamptz |                          |
| `StatusSnapshot`                                   | text        |                          |
| `Calculated_Arv`                                   | decimal     | After-repair value       |
| `Calculated_Arv_MarketRiskAdjusted`                | decimal     |                          |
| `Calculated_RiskFactor`                            | decimal     |                          |
| `Calculated_RiskFactor_Original`                   | decimal     |                          |
| `Calculated_RiskFactorStage1`                      | decimal     |                          |
| `Calculated_RiskFactorStage2`                      | decimal     |                          |
| `Calculated_RiskFactorStage3`                      | decimal     |                          |
| `Calculated_ConstructionBudget`                    | decimal     |                          |
| `Calculated_ConstructionEstimatedDays`             | int         |                          |
| `Calculated_ConstructionDaysComplete`              | int         |                          |
| `Calculated_ConstructionDaysRemaining`             | int         |                          |
| `Calculated_ConstructionDaysOver`                  | int         |                          |
| `Calculated_MaxOffer`                              | decimal     |                          |
| `Calculated_MaxOffer_Original`                     | decimal     |                          |
| `Calculated_MaxOffer_Price_Ratio`                  | decimal     |                          |
| `Calculated_MaxOffer_Auction_Price_Ratio`          | decimal     |                          |
| `Calculated_NahProfit`                             | decimal     |                          |
| `Calculated_NahConstructionProfitRatio`            | decimal     |                          |
| `Calculated_NahProfitMarketAdjusted`               | decimal     |                          |
| `ConstructionCostPerSquareFoot`                    | decimal     |                          |
| `Calculated_ArvPerAdjustedSqFt`                    | decimal     |                          |
| `Calculated_LocationGrade`                         | decimal     |                          |
| `Calculated_RehabGrade`                            | decimal     |                          |
| `Calculated_Price`                                 | decimal     |                          |
| `Calculated_MlsProfit`                             | decimal     |                          |
| `Calculated_MlsConstructionProfitRatio`            | decimal     |                          |
| `Calculated_MlsProfitMarketAdjusted`               | decimal     |                          |
| `Calculated_IntangibleScore`                       | int         |                          |
| `Calculated_ArvRiskFactor`                         | decimal     |                          |
| `Calculated_LocationRiskAdjustment`                | decimal     |                          |
| `Calculated_IntangibleRiskAdjustment`              | decimal     |                          |
| `Calculated_StarredCompsAveragePriceSqFt`          | decimal     |                          |
| `Calculated_StarredCompsMedianPriceSqFt`           | decimal     |                          |
| `Calculated_CompRiskAdjustment`                    | decimal     |                          |
| `Calculated_AdjustedRiskFactor`                    | decimal     |                          |
| `Calculated_AdjustedSqFt`                          | decimal     |                          |
| `Calculated_AmountFinanced`                        | decimal     |                          |
| `Calculated_BuyingCost`                            | decimal     |                          |
| `Calculated_HoldingCost`                           | decimal     |                          |
| `Calculated_ClosingCost`                           | decimal     |                          |
| `Calculated_MlsListCost`                           | decimal     |                          |
| `Calculated_TotalQuietCosts`                       | decimal     |                          |
| `Calculated_TotalCostOfMoney`                      | decimal     |                          |
| `Calculated_AuctionMinimumPrice`                   | decimal     |                          |
| `Calculated_StageMaturity`                         | int         |                          |
| `Calculated_FinanceCostCycleTimeDays`              | int         |                          |
| `Calculated_FinanceCost`                           | decimal     |                          |
| `Calculated_CashRequired`                          | decimal     |                          |
| `Calculated_ReturnOnInvestment`                    | decimal     |                          |
| `Calculated_SellerType`                            | text        |                          |
| `Calculated_SellerName`                            | text        |                          |
| `Calculated_SellerFirstName`                       | text        |                          |
| `Calculated_SellerLastName`                        | text        |                          |
| `Calculated_SellerMailingAddress`                  | text        |                          |
| `Calculated_SellerAddress`                         | text        |                          |
| `Calculated_SellerCity`                            | text        |                          |
| `Calculated_SellerState`                           | text        |                          |
| `Calculated_SellerZip`                             | text        |                          |
| `Calculated_SellerAddressDistance`                 | decimal     |                          |
| `Calculated_AbsenteeSeller`                        | boolean     |                          |
| `Calculated_SellerPhone`                           | text        |                          |
| `Calculated_SellerEmail`                           | text        |                          |
| `Calculated_SellerMarketingWeek`                   | int         |                          |
| `Calculated_FullPropertyAddress`                   | text        |                          |
| `Calculated_TotalCbGrade`                          | decimal     |                          |
| `Calculated_Stage1ArvSqFt`                         | decimal     |                          |
| `Stage1ArvEstatedCombined`                         | decimal     |                          |
| `Calculated_LowEndTotalPrice`                      | decimal     |                          |
| `Calculated_HighEndTotalPrice`                     | decimal     |                          |
| `Calculated_Stage2Arv`                             | decimal     |                          |
| `Calculated_ConstructionBudgetStage1`              | decimal     |                          |
| `Calculated_ConstructionBudgetStage2`              | decimal     |                          |
| `Calculated_ConstructionStage3RehabGrade`          | decimal     |                          |
| `Calculated_BuiltAge`                              | decimal     |                          |
| `Calculated_EffectiveAge`                          | decimal     |                          |
| `Calculated_ArvCeilingSqFt`                        | decimal     |                          |
| `Calculated_Stage1MaxOfferPriceRatio`              | int         |                          |
| `Calculated_LeadScore`                             | int         |                          |
| `LeadScore_MaxOfferPriceScore_Points`              | decimal     |                          |
| `LeadScore_MaxOfferPriceScore_Percent`             | decimal     |                          |
| `LeadScore_ConditionScore_Points`                  | decimal     |                          |
| `LeadScore_ConditionScore_Percent`                 | decimal     |                          |
| `LeadScore_AbsenteeOwnerScore_Points`              | decimal     |                          |
| `LeadScore_AbsenteeOwnerScore_Percent`             | decimal     |                          |
| `LeadScore_SoldAmountArvScore_Points`              | decimal     |                          |
| `LeadScore_SoldAmountArvScore_Percent`             | decimal     |                          |
| `LeadScore_YearBuiltScore_Points`                  | decimal     |                          |
| `LeadScore_YearBuiltScore_Percent`                 | decimal     |                          |
| `LeadScore_SquareFootageScore_Points`              | decimal     |                          |
| `LeadScore_SquareFootageScore_Percent`             | decimal     |                          |
| `FollowUpScore`                                    | int         |                          |
| `FollowUpScore_LeadCategory_Points`                | decimal     |                          |
| `FollowUpScore_Status_Points`                      | decimal     |                          |
| `FollowUpScore_MarketingWeek_Points`               | decimal     |                          |
| `Calculated_Inv_DaysOwned`                         | int         |                          |
| `Calculated_Inv_MonthsOwned`                       | int         |                          |
| `Calculated_Inv_YearsOwned`                        | int         |                          |
| `Calculated_Inv_DaysOnMarket`                      | int         |                          |
| `Calculated_Inv_ProjectProfit`                     | decimal     |                          |
| `Calculated_Inv_Profit`                            | decimal     |                          |
| `Calculated_Inv_Proceeds`                          | decimal     |                          |
| `Calculated_Inv_TotalNotesPayable`                 | decimal     |                          |
| `Calculated_Inv_OverBudget`                        | decimal     |                          |
| `Calculated_Inv_CashInvested`                      | decimal     |                          |
| `Calculated_Inv_RiskFactor`                        | decimal     |                          |
| `Calculated_Inv_ConstructionProfitRatio`           | decimal     |                          |
| `Calculated_Inv_CBGrade`                           | decimal     |                          |
| `Calculated_Inv_Item19Year`                        | int         |                          |
| `Calculated_Inv_Royalty`                           | decimal     |                          |
| `HasInventory`                                     | boolean     |                          |
| `HasActiveInventory`                               | boolean     |                          |
| `CycleTimePurchaseToSell`                          | int         |                          |
| `CycleTimePurchaseToContractedSell`                | int         |                          |
| `CycleTimePurchaseToConstructionStart`             | int         |                          |
| `CycleTimePurchaseToList`                          | int         |                          |
| `CycleTimeConstructionStartToConstructionComplete` | int         |                          |
| `CycleTimeConstructionCompleteToSell`              | int         |                          |
| `CycleTimePurchaseToConstructionComplete`          | int         |                          |
| `CycleTimeListToSell`                              | int         |                          |
| `CycleTimeS1ToFinalOutcome`                        | int         |                          |
| `ProjectedRoyaltyDate`                             | date        |                          |
| `Calculated_LastSoldDate`                          | timestamptz |                          |
| `Calculated_YearsOwned`                            | int         |                          |
| `Calculated_ReportingStatus`                       | text        |                          |
| `ms_synced_at`                                     | timestamptz | NAH OS tracking          |

**~122 columns** (skipping Logs text blob, duplicate \_Description fields, campaign rank fields, rental pro forma — those go in dedicated tables)

### 2.3 `ms_property_inventory` — Full Lifecycle with All 5 Maturity Stages

**Source:** PropertyInventory (130 columns — ALL included)

| Section             | Columns                                                            | Pattern |
| ------------------- | ------------------------------------------------------------------ | ------- |
| Identity            | PropertyId (PK, FK), Inv_Status, Inv_Type                          | 3       |
| Dates               | ContractedPurchaseDate through OccupiedDate                        | 8       |
| Info                | SalesTeamInfo, FinanceStrategy, ExpectedListPrice, Utilities       | 7       |
| ARV                 | Stage0, Original, Revised, Actual, MostMature, MostMaturePriceSqFt | 6       |
| Selling Costs       | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Concessions         | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Cost of Property    | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Construction Budget | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Maintenance         | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Holding Costs       | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Buying Cost         | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Refi Costs          | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Interest Payments   | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Mortgage Principal  | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Monthly Mortgage    | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| County Taxes        | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| City Taxes          | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Mow Cost            | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Location Grade      | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Phase 5 Costs       | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Rental Income       | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Price (Sale)        | Stage0, Original, Revised, Actual, MostMature                      | 5       |
| Rental Pro Forma    | Actual × 14 line items                                             | 14      |
| Assignment Fee      | 1                                                                  | 1       |

**~130 columns** — exact mirror of MasterSuite

### 2.4 `ms_property_stage0` — Raw Lead Data

**Source:** PropertyStage0 (36 columns)

Sync scope: Only for properties NOT in Lead List (i.e., properties we already have in ms_properties). The Stage0 data for 826K Lead List entries stays in MasterSuite — we just count those.

**36 columns** — exact mirror

### 2.5 `ms_property_stage1` — Stage 1 Evaluation Snapshot

**Source:** PropertyStage1 (29 columns)

**29 columns** — exact mirror

### 2.6 `ms_property_status_history` — Funnel Transition Timestamps

**Source:** PropertyStatusHistory (877K rows, 4 columns)

Sync scope: Only for non-Lead-List properties. Critical for computing funnel velocity and conversion.

| Column           | Type                  |
| ---------------- | --------------------- |
| `PropertyId`     | int, FK ms_properties |
| `Inserted`       | timestamptz           |
| `PreviousStatus` | text                  |
| `NewStatus`      | text                  |

### 2.7 `ms_property_contacts` — Seller/Buyer Contact Per Property

**Source:** PropertyContacts (33 columns, 896K rows)

Includes skip trace phone numbers (6 mobile, 6 landline, 6 VoIP), address, GHL contact link.

**33 columns** — exact mirror

### 2.8 `ms_property_notes` — Financing Notes Per Property

**Source:** PropertyNotes (17 columns)

Note holder, date, APR, principal, type, maturity date, fees, points, calculated payoff/balance.

**17 columns** — exact mirror

### 2.9 `ms_property_mortgages` — Mortgage Details

**Source:** PropertyMortgages (14 columns, 802K rows)

Loan type, deed type, amount, term, rate, lender, estimated payoff.

**14 columns** — exact mirror

### 2.10 `ms_property_dispositions` — How Properties Were Disposed

**Source:** PropertyDispositions (17 columns, 1.38M rows)

Alternative ARV, costs, profit per disposition type.

**17 columns** — exact mirror

### 2.11 `ms_property_comparables` — Comp Data

**Source:** PropertyComparables (47 columns, 91K rows across 18K properties)

Full comp details: value, sqft, condition scores, location scores, confidence, distance.

**47 columns** — exact mirror

### 2.12 `ms_property_agent_feedback` — Agent ARV Recommendations

**Source:** PropertyAgentFeedback (6 columns, 894K rows)

| Column                           | Type                      |
| -------------------------------- | ------------------------- |
| `PropertyId`                     | int, PK, FK ms_properties |
| `AgentFeedback`                  | text                      |
| `NoteToAgent`                    | text                      |
| `AgentRecommendedArvLow`         | decimal                   |
| `AgentRecommendedArvHigh`        | decimal                   |
| `AgentRecommendedFinalValuation` | decimal                   |

### 2.13 `ms_property_inventory_rental` — Rental Pro Forma Detail

**Source:** PropertyInventoryRental (87 columns, 333K rows)

Full rental analysis per property: rent, vacancy, maintenance, CapEx, management, taxes, insurance, utilities, HOA, mowing, misc, cap rate, interest rate, LTV — each with Override, SystemSuggested, AnnualProForma, AnnualActual, MostMature variants.

**87 columns** — exact mirror

### 2.14 `ms_property_royalty` — Royalty Tracking

**Source:** PropertyRoyalty (29 columns, 376K rows)

Acquisition royalty, disposition royalty, delayed fees, true-ups — calculated, overrides, paid, due dates.

**29 columns** — exact mirror

### 2.15 `ms_property_media` — Photos/Media

**Source:** PropertyMedia (10 columns, 14K rows)

URL, thumbnail, YouTube URL, type, category.

**10 columns** — exact mirror

### 2.16 `ms_property_intangibles` — Intangible Scoring

**Source:** PropertyIntangibles (3 columns, 5.4M rows — EAV)

| Column       | Type            |
| ------------ | --------------- |
| `PropertyId` | int, PK part 1  |
| `Token`      | text, PK part 2 |
| `Value`      | int             |

### 2.17 `ms_property_rental_configuration` — Per-Property Rental Config

**Source:** PropertyRentalConfiguration (27 columns, 43K rows)

Per-property rental assumptions overriding territory defaults.

**27 columns** — exact mirror

### 2.18 `ms_property_status_timelines` — Funnel Timing Summary

**Source:** PropertyStatusTimelines (5 columns, 370K rows)

| Column                            | Type        |
| --------------------------------- | ----------- |
| `PropertyId`                      | int, PK     |
| `DaysBetweenInsertedToFirstStage` | int         |
| `FirstStageDate`                  | timestamptz |
| `DaysBetweenFirstStageToStage4`   | int         |
| `Stage4Date`                      | timestamptz |

### 2.19 `ms_property_corporate_notes` — Internal Notes

**Source:** Property_CorporateNotes (7 columns, 859 rows)

| Column       | Type        |
| ------------ | ----------- |
| `Id`         | int, PK     |
| `PropertyId` | int, FK     |
| `Inserted`   | timestamptz |
| `Updated`    | timestamptz |
| `Message`    | text        |
| `Name`       | text        |
| `Username`   | text        |

### 2.20 `ms_lead_list_counts` — Aggregate for 0 Lead List

**Purpose:** Monthly counts for 826K+ Lead List entries. We don't store individual rows.

| Column          | Type                 |
| --------------- | -------------------- | -------------- |
| `id`            | uuid, PK             |
| `TerritorySlug` | text, FK territories |
| `month`         | date                 | First of month |
| `LeadCategory`  | text                 |
| `LeadType`      | text                 |
| `count`         | int                  |
| `synced_at`     | timestamptz          |

---

## Part 3: EOS Sync

### 3.1 Column Renames on Existing EOS Tables

| Table                         | Current          | New (MasterSuite) |
| ----------------------------- | ---------------- | ----------------- |
| `eos_territory_rocks`         | `rock_text`      | `Rock`            |
| `eos_territory_rocks`         | `territory_slug` | `TerritorySlug`   |
| `eos_territory_todos`         | `todo_text`      | `Todo`            |
| `eos_territory_todos`         | `is_done`        | `Done`            |
| `eos_territory_todos`         | `territory_slug` | `TerritorySlug`   |
| `eos_territory_issues`        | `issue_text`     | `Issue`           |
| `eos_territory_issues`        | `is_done`        | `Done`            |
| `eos_territory_issues`        | `territory_slug` | `TerritorySlug`   |
| `eos_territory_budgets`       | `territory_slug` | `TerritorySlug`   |
| `eos_territory_goals`         | `territory_slug` | `TerritorySlug`   |
| `eos_territory_habits`        | `territory_slug` | `TerritorySlug`   |
| `eos_territory_lead_channels` | `territory_slug` | `TerritorySlug`   |
| `eos_territory_scorecard`     | `territory_slug` | `TerritorySlug`   |

### 3.2 EOS Sync Strategy

MasterSuite stores EOS data as **wide tables** (one row per territory, columns for each metric). NAH OS uses **EAV** (one row per metric per territory). Our EAV is more flexible — keep it. Convert MS columns to rows on sync.

| MasterSuite Table               | NAH OS Table                | Sync Pattern                                                                       |
| ------------------------------- | --------------------------- | ---------------------------------------------------------------------------------- |
| Eos_Goals (11 cols)             | eos_territory_goals         | 10 goal columns → 10 rows per territory                                            |
| Eos_GoalCheckpoints (12 cols)   | eos_territory_goals         | 12 checkpoint columns → rows (rental, gross profit, QoL × actual/current/5yr/25yr) |
| Eos_Rocks (4 cols)              | eos_territory_rocks         | Direct row-for-row                                                                 |
| Eos_Todos (4 cols)              | eos_territory_todos         | Direct row-for-row                                                                 |
| Eos_Issues (4 cols)             | eos_territory_issues        | Direct row-for-row                                                                 |
| Eos_Budgets (4 cols)            | eos_territory_budgets       | Direct row-for-row                                                                 |
| Eos_Habits (6 cols)             | eos_territory_habits        | 5 habit columns → 5 rows per territory                                             |
| Eos_MarketingChannels (33 cols) | eos_territory_lead_channels | 32 channel columns → 32 rows per territory                                         |

### 3.3 New Construction EOS Tables

| New Table                             | Source                          | Rows  | Columns |
| ------------------------------------- | ------------------------------- | ----- | ------- |
| `ms_eos_construction_habits`          | Eos_Construction_Habits         | 26    | 6       |
| `ms_eos_construction_issues`          | Eos_Construction_Issues         | 20    | 4       |
| `ms_eos_construction_rocks`           | Eos_Construction_Rocks          | 21    | 4       |
| `ms_eos_construction_todos`           | Eos_Construction_Todos          | 29    | 4       |
| `ms_eos_construction_tasks`           | Eos_Construction_Tasks          | 1,826 | 5       |
| `ms_eos_construction_task_history`    | Eos_Construction_TaskHistory    | 2,010 | 6       |
| `ms_eos_construction_task_notes`      | Eos_Construction_TaskNotes      | 110   | 5       |
| `ms_eos_construction_master_statuses` | Eos_Construction_MasterStatuses | 5     | 3       |
| `ms_eos_construction_master_tasks`    | Eos_Construction_MasterTasks    | 16    | 5       |

### 3.4 New Project Management Tables

| New Table                               | Source                                  | Rows   | Columns |
| --------------------------------------- | --------------------------------------- | ------ | ------- |
| `ms_project_management_tasks`           | ProjectManagement_Tasks                 | 16,013 | 5       |
| `ms_project_management_task_notes`      | ProjectManagement_TaskNotes             | 509    | 5       |
| `ms_project_management_master_statuses` | ProjectManagement_Config_MasterStatuses | 5      | 2       |
| `ms_project_management_master_tasks`    | ProjectManagement_Config_MasterTasks    | 2,223  | 6       |

---

## Part 4: Contact/Franchise Candidate Alignment

### 4.1 `contacts` Table Renames

| Current NAH OS                  | New (MasterSuite — from PathToOwnershipEntries) |
| ------------------------------- | ----------------------------------------------- |
| `counties_priority`             | `CountiesInterestedIn`                          |
| `franchisee_2_name`             | `PartnerName`                                   |
| `franchisee_2_phone`            | `PartnerPhone`                                  |
| `franchisee_2_email`            | `PartnerEmail`                                  |
| `business_ownership_experience` | `BriefWorkHistory`                              |
| `motivation_clarity`            | `WhatInterestsInOpportunity`                    |
| `capital_availability`          | `NonRetirementCapitalAvailable`                 |
| `lead_source_detail`            | `LeadSource`                                    |

### 4.2 New Columns on `contacts`

| Column                                | Type        | Source                 |
| ------------------------------------- | ----------- | ---------------------- |
| `PreferredName`                       | text        | PathToOwnershipEntries |
| `PartnerOccupation`                   | text        | PathToOwnershipEntries |
| `PreferredWeeklyHours`                | int         | PathToOwnershipEntries |
| `NonRetirementCapitalAvailableSource` | text        | PathToOwnershipEntries |
| `RetirementFundsRollingOver`          | int         | PathToOwnershipEntries |
| `ReferredBy`                          | text        | PathToOwnershipEntries |
| `PtoSubmissionDate`                   | timestamptz | PathToOwnershipEntries |

**Sync:** 2,707 PTO entries → match to contacts by email/name

---

## Part 5: User Cross-Reference

### 5.1 New Column on `users`

Add `ms_user_id` (int) to cross-reference MasterSuite users.

### 5.2 New Table: `ms_user_territories`

| Column          | Type                 |
| --------------- | -------------------- |
| `UserId`        | int                  |
| `TerritorySlug` | text, FK territories |

372 rows — which MS users can access which territories.

---

## Part 6: Territory Reference Data

| New Table                                   | Source                              | Rows  | Columns | Purpose                                                               |
| ------------------------------------------- | ----------------------------------- | ----- | ------- | --------------------------------------------------------------------- |
| `ms_territory_associated_counties`          | TerritoryAssociatedCounties         | 235   | 3       | Counties in each territory                                            |
| `ms_territory_associated_zip_codes`         | TerritoryAssociatedZipCodes         | 787   | 2       | Zip codes in each territory                                           |
| `ms_territory_badges`                       | TerritoryBadges                     | 4     | 5       | Badge definitions                                                     |
| `ms_territory_badges_earned`                | TerritoryBadgesEarned               | 148   | 4       | Which territories earned which                                        |
| `ms_territory_dashboard_links`              | TerritoryDashboardLinks             | 233   | 3       | Per-territory resource links                                          |
| `ms_territory_inbox`                        | TerritoryInbox                      | 7,453 | 8       | Territory inbox messages                                              |
| `ms_report_variables`                       | ReportVariables                     | 88    | 56      | Territory calculation config (risk factors, quiet costs, CB formulas) |
| `ms_report_variable_configuration`          | ReportVariableConfiguration         | 32    | 8       | Variable definitions                                                  |
| `ms_territory_variables`                    | TerritoryVariables                  | 80    | 27      | Territory rental/lead score config                                    |
| `ms_property_territory_variables_overrides` | PropertyTerritoryVariablesOverrides | 897K  | 27      | Per-property overrides of territory vars                              |

---

## Part 7: Market Data

| New Table                              | Source                                   | Rows   | Columns |
| -------------------------------------- | ---------------------------------------- | ------ | ------- |
| `ms_zillow_home_value_forecast_county` | Zillow_HomeValueForecast_County          | 2,844  | 3       |
| `ms_zillow_home_value_forecast_zip`    | Zillow_HomeValueForecast_Zip             | 30,494 | 2       |
| `ms_zillow_median_sales_price_county`  | Zillow_MedianSalesPrice_County           | 1,275  | 4       |
| `ms_zillow_median_sales_price_zip`     | Zillow_MedianSalesPrice_Zip              | 6,430  | 3       |
| `ms_zillow_sfh_time_series_county`     | Zillow_SingleFamilyHomeTimeSeries_County | 2,843  | 4       |
| `ms_zillow_sfh_time_series_zip`        | Zillow_SingleFamilyHomeTimeSeries_Zip    | 30,464 | 3       |
| `ms_zip_code_avg_price_sqft`           | ZipCodeAveragePriceSqFt                  | 30,545 | 51      |
| `ms_zip_code_locations`                | ZipCodeLocations                         | 24,191 | 5       |

---

## Part 8: Reference Tables

| New Table                        | Source                     | Rows | Columns |
| -------------------------------- | -------------------------- | ---- | ------- |
| `ms_lead_types`                  | LeadTypes                  | 35   | 3       |
| `ms_lead_type_categories`        | LeadTypesCategories        | 6    | 2       |
| `ms_stage0_types`                | Stage0Types                | 4    | 1       |
| `ms_master_list_intangibles`     | MasterListIntangibles      | 7    | 2       |
| `ms_note_holders`                | NoteHolders                | 1    | 5       |
| `ms_construction_default_rooms`  | Construction_DefaultRooms  | 5    | 4       |
| `ms_construction_property_rooms` | Construction_PropertyRooms | 20   | 3       |

---

## Part 9: Implementation Plan

### Phase 1: Territory Foundation (Week 1)

**Why first:** Every other table references TerritorySlug. This must be solid before anything else.

1. Write migration: rename `ms_slug` → `TerritorySlug` on `territories` + all 24 FK columns
2. Rename `territory_name` → `Nickname`, `awarded_date` → `FranchiseAgreementDate`
3. Add 57 new columns to `territories`
4. Update all API routes, TypeScript types, components (164+ files)
5. Update URL routes: `[msSlug]` → `[TerritorySlug]`
6. Sync all 88 territories from MasterSuite
7. Add `ghl_contact_id`, `ct_id`, `ct_email` to territories (from franchise_owners)
8. Deprecate `franchise_owners` table
9. Validate: every territory in MS exists in NAH OS with correct data

**Dependencies:** None — this is the foundation.

### Phase 2: Property Core Tables (Week 2-3)

**Why second:** Properties are the highest-value data for Scout and territory pages.

1. Create `ms_properties` (~115 columns)
2. Create `ms_property_calculations` (~122 columns)
3. Create `ms_property_inventory` (~130 columns, all 5 maturity stages)
4. Create `ms_property_status_history` (4 columns)
5. Create `ms_property_stage0` (36 columns)
6. Create `ms_property_stage1` (29 columns)
7. Create `ms_lead_list_counts` aggregate table
8. Build MySQL → Supabase sync cron (incremental by LastModified)
9. Build Lead List aggregate cron
10. Add indexes: TerritorySlug, Status, Inserted, Inv_Status, Inv_PurchaseDate, Inv_SellDate

**Dependencies:** Phase 1 (TerritorySlug FK)

### Phase 3: Property Supporting Tables (Week 3-4)

1. Create `ms_property_contacts` (33 columns)
2. Create `ms_property_notes` (17 columns)
3. Create `ms_property_mortgages` (14 columns)
4. Create `ms_property_dispositions` (17 columns)
5. Create `ms_property_comparables` (47 columns)
6. Create `ms_property_agent_feedback` (6 columns)
7. Create `ms_property_inventory_rental` (87 columns)
8. Create `ms_property_royalty` (29 columns)
9. Create `ms_property_media` (10 columns)
10. Create `ms_property_intangibles` (3 columns)
11. Create `ms_property_rental_configuration` (27 columns)
12. Create `ms_property_status_timelines` (5 columns)
13. Create `ms_property_corporate_notes` (7 columns)
14. Extend sync cron to cover all property tables

**Dependencies:** Phase 2 (ms_properties PK for FKs)

### Phase 4: EOS & Construction (Week 4)

1. Rename EOS columns (13 renames across 8 tables)
2. Build EOS sync: wide-to-EAV conversion for Goals, GoalCheckpoints, Habits, MarketingChannels
3. Build EOS sync: direct row sync for Rocks, Todos, Issues, Budgets
4. Create 9 Construction EOS tables + sync
5. Create 4 Project Management tables + sync

**Dependencies:** Phase 1 (TerritorySlug)

### Phase 5: Contact Alignment (Week 4-5)

1. Rename 8 columns on `contacts`
2. Add 7 new columns on `contacts`
3. Build PTO sync: PathToOwnershipEntries → contacts (match by email)
4. Add `ms_user_id` to `users`
5. Create `ms_user_territories` table + sync

**Dependencies:** Phase 1

### Phase 6: Reference & Market Data (Week 5)

1. Create 10 territory reference tables + sync
2. Create 8 market data (Zillow) tables + sync
3. Create 7 reference tables + sync

**Dependencies:** Phase 1

### Phase 7: Territory Page Enrichment (Week 5-6)

1. Property lists on territory page: Active Prospects, Active Inventory, Sold
2. Enrich Operations panel with computed metrics from real property data
3. Wire Scout to query ms\_\* tables for coaching intelligence
4. Update `territory_profile` operational fields to auto-populate from property data

**Dependencies:** Phases 2-6

---

## Appendix A: Complete New Table Inventory

| #   | Table                                     | Columns | Rows   | Phase |
| --- | ----------------------------------------- | ------- | ------ | ----- |
| 1   | ms_properties                             | 115     | 50K    | 2     |
| 2   | ms_property_calculations                  | 122     | 50K    | 2     |
| 3   | ms_property_inventory                     | 130     | 50K    | 2     |
| 4   | ms_property_status_history                | 4       | 50K+   | 2     |
| 5   | ms_property_stage0                        | 36      | 50K    | 2     |
| 6   | ms_property_stage1                        | 29      | 50K    | 2     |
| 7   | ms_lead_list_counts                       | 7       | ~5K    | 2     |
| 8   | ms_property_contacts                      | 33      | 50K    | 3     |
| 9   | ms_property_notes                         | 17      | small  | 3     |
| 10  | ms_property_mortgages                     | 14      | 50K    | 3     |
| 11  | ms_property_dispositions                  | 17      | 50K+   | 3     |
| 12  | ms_property_comparables                   | 47      | 18K    | 3     |
| 13  | ms_property_agent_feedback                | 6       | 50K    | 3     |
| 14  | ms_property_inventory_rental              | 87      | 50K    | 3     |
| 15  | ms_property_royalty                       | 29      | 50K    | 3     |
| 16  | ms_property_media                         | 10      | 14K    | 3     |
| 17  | ms_property_intangibles                   | 3       | varies | 3     |
| 18  | ms_property_rental_configuration          | 27      | varies | 3     |
| 19  | ms_property_status_timelines              | 5       | 50K    | 3     |
| 20  | ms_property_corporate_notes               | 7       | 859    | 3     |
| 21  | ms_eos_construction_habits                | 6       | 26     | 4     |
| 22  | ms_eos_construction_issues                | 4       | 20     | 4     |
| 23  | ms_eos_construction_rocks                 | 4       | 21     | 4     |
| 24  | ms_eos_construction_todos                 | 4       | 29     | 4     |
| 25  | ms_eos_construction_tasks                 | 5       | 1,826  | 4     |
| 26  | ms_eos_construction_task_history          | 6       | 2,010  | 4     |
| 27  | ms_eos_construction_task_notes            | 5       | 110    | 4     |
| 28  | ms_eos_construction_master_statuses       | 3       | 5      | 4     |
| 29  | ms_eos_construction_master_tasks          | 5       | 16     | 4     |
| 30  | ms_project_management_tasks               | 5       | 16,013 | 4     |
| 31  | ms_project_management_task_notes          | 5       | 509    | 4     |
| 32  | ms_project_management_master_statuses     | 2       | 5      | 4     |
| 33  | ms_project_management_master_tasks        | 6       | 2,223  | 4     |
| 34  | ms_user_territories                       | 2       | 372    | 5     |
| 35  | ms_territory_associated_counties          | 3       | 235    | 6     |
| 36  | ms_territory_associated_zip_codes         | 2       | 787    | 6     |
| 37  | ms_territory_badges                       | 5       | 4      | 6     |
| 38  | ms_territory_badges_earned                | 4       | 148    | 6     |
| 39  | ms_territory_dashboard_links              | 3       | 233    | 6     |
| 40  | ms_territory_inbox                        | 8       | 7,453  | 6     |
| 41  | ms_report_variables                       | 56      | 88     | 6     |
| 42  | ms_report_variable_configuration          | 8       | 32     | 6     |
| 43  | ms_territory_variables                    | 27      | 80     | 6     |
| 44  | ms_property_territory_variables_overrides | 27      | 50K    | 6     |
| 45  | ms_zillow_home_value_forecast_county      | 3       | 2,844  | 6     |
| 46  | ms_zillow_home_value_forecast_zip         | 2       | 30,494 | 6     |
| 47  | ms_zillow_median_sales_price_county       | 4       | 1,275  | 6     |
| 48  | ms_zillow_median_sales_price_zip          | 3       | 6,430  | 6     |
| 49  | ms_zillow_sfh_time_series_county          | 4       | 2,843  | 6     |
| 50  | ms_zillow_sfh_time_series_zip             | 3       | 30,464 | 6     |
| 51  | ms_zip_code_avg_price_sqft                | 51      | 30,545 | 6     |
| 52  | ms_zip_code_locations                     | 5       | 24,191 | 6     |
| 53  | ms_lead_types                             | 3       | 35     | 6     |
| 54  | ms_lead_type_categories                   | 2       | 6      | 6     |
| 55  | ms_stage0_types                           | 1       | 4      | 6     |
| 56  | ms_master_list_intangibles                | 2       | 7      | 6     |
| 57  | ms_note_holders                           | 5       | 1      | 6     |
| 58  | ms_construction_default_rooms             | 4       | 5      | 6     |
| 59  | ms_construction_property_rooms            | 3       | 20     | 6     |

**59 new tables total.**

---

## Appendix B: Property Status Funnel Reference

| Status           | Meaning                           | Count (all territories) | Store                 |
| ---------------- | --------------------------------- | ----------------------- | --------------------- |
| `0 Lead List`    | Raw marketing pipeline, untouched | 826,898                 | Aggregate counts only |
| `0 No Offer`     | Evaluated, didn't make offer      | 17,909                  | Full rows             |
| `0 No Deal`      | Made offer, couldn't close        | 13,190                  | Full rows             |
| `0 Trash`        | Bad data / not a real lead        | 11,922                  | Full rows             |
| `0 Unresponsive` | Couldn't reach seller             | 3,470                   | Full rows             |
| `0 Sell Later`   | Not ready now, future opp         | 1,383                   | Full rows             |
| `1`              | New lead (active funnel)          | 407                     | Full rows             |
| `2`              | Qualified                         | 119                     | Full rows             |
| `3`              | Appointment set                   | 129                     | Full rows             |
| `4`              | Made offer                        | 124                     | Full rows             |
| `5 Contract`     | Under contract                    | 23                      | Full rows             |
| `6 Purchase`     | Purchased                         | 1,290                   | Full rows             |

**Inventory statuses (post-purchase):**
Complete, Contract to Sell, Listed, Phase 1, Phase 2, Phase 3, Phase 4, Phase 4 Punch, Phase 5, Rented, Sold

---

## Appendix C: Sync Architecture

```
MasterSuite MySQL (read-only)
    ↓ cron: every 15 min (properties), daily (reference)
    ↓ WHERE LastModified > last_sync_time (incremental)
    ↓ MySQL client → Node.js sync script → Supabase upsert
NAH OS Supabase (PostgreSQL)
    ↓ Scout queries for coaching intelligence
    ↓ Territory pages for property lists
    ↓ API routes for computed KPIs
NAH OS UI (read-only display)
```

**Sync job design:**

- Runs as API route or cron job
- Connects to MasterSuite MySQL via `mysql2` npm package
- Queries with `WHERE LastModified > ?` for incremental updates
- Upserts into Supabase via service role client
- Logs to `cron_job_log` table
- Separate sync functions per table group (properties, EOS, territories, market)
- Lead List aggregate runs daily (full recount)
