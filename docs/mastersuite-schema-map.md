# MasterSuite Database Schema Map

> Read-only access to MasterSuite's MySQL production database.
> Connection: `db-production.mastersuiteapp.com:60265` (credentials in `.env.local`)

---

## Database overview

- **153 tables**, ~2,800 columns
- MySQL (not PostgreSQL)
- Key: `TerritorySlug` (varchar 6) links most tables together

---

## Row counts (as of 2026-05-08)

| Table                      | Rows      | Notes                               |
| -------------------------- | --------- | ----------------------------------- |
| Territories                | 88        | All franchise territories           |
| TerritoryMetrics           | 87        | Aggregate metrics per territory     |
| TerritoryScorecardKPIs     | 2,110     | ~24 type/scope combos per territory |
| TerritoryMetricsDailyStats | 54,976    | Daily snapshots                     |
| PropertyStage0             | 2,378,541 | Raw leads                           |
| PropertyStage1             | 896,893   | Qualified leads                     |
| PropertyInventory          | 896,892   | Active/historical inventory         |
| PropertyCalculations       | 897,046   | Financial calcs per property        |
| Eos_Goals                  | 68        | Territory-level goals               |
| Eos_Rocks                  | 124       | Quarterly rocks                     |
| Eos_Todos                  | 188       | Weekly to-dos                       |
| Eos_Issues                 | 203       | Issues list                         |
| Eos_Budgets                | 317       | Budget line items                   |
| PathToOwnershipEntries     | 2,707     | Franchise candidates (FranDev!)     |
| Users                      | 225       | MasterSuite users                   |

---

## High-value tables for NAH OS sync

### Tier 1 — Territory performance (sync daily)

**Territories** (88 rows, 65 columns)

- TerritoryId, TerritorySlug, Nickname, PersonalName, Owner2, Owner3
- IsFranchise, IsFullTime, Active, FullTimeOperator
- PrimaryCoach, FranchiseEmail, PersonalPhoneNumber
- ComplianceScore
- Key dates: InitialApplicationDate, FranchiseAgreementDate, TrainingCompleteDate, FirstPurchaseDate, FranchiseClosedDate
- GoHighLevelLocationId (links to GHL)
- Marketing: MarketingName, MarketingPhoneNumber, MarketingEmailAddress, social profiles
- Compliance docs: DocumentUrl\* fields

**TerritoryScorecardKPIs** (2,110 rows, 63 columns)

- SoldProfit, TotalSoldProfit, GrossProfit (+ ranks)
- PropertiesAcquired, NumberSold, NumberInInventory (+ ranks)
- LeadsEntered, LeadsIncoming, Stage1toStage4 conversion (+ ranks)
- AverageComplianceScore, MedianCycleDays, AcquisitionPercentage
- Type (weekly/monthly/quarterly/yearly), Scope (time window)

**TerritoryMetrics** (87 rows, 5 columns)

- AverageLast12MonthCycleTime, T3LeadsInserted, T3Stage1ToStage4

**TerritoryMetricsDailyStats** (54,976 rows, 5 columns)

- Daily: PropertiesInInventoryCount, InventoryProfit, ComplianceScore

**TerritoryVariables** (88 rows, 27 columns)

- Rental assumptions, lead score ideal ranges, royalty config

### Tier 2 — EOS data (sync daily)

**Eos_Goals** — Territory quarterly goals (leads, purchases, profit, compliance, cycle time)
**Eos_Rocks** — Quarterly rocks (id, territory, description, status)
**Eos_Todos** — Weekly to-dos (id, territory, description, done)
**Eos_Issues** — Issues list (id, territory, description, done)
**Eos_Budgets** — Budget items (id, territory, description, amount)
**Eos_Habits** — Weekly habits checklist (DailyTasks, WeeklyContractorMeeting, etc.)
**Eos_MarketingChannels** — 32 boolean flags per territory (ProspectNow, Vacants, FacebookAds, GoogleAds, etc.)

### Tier 3 — FranDev candidates (sync hourly)

**PathToOwnershipEntries** (2,707 rows, 25 columns)

- FirstName, LastName, PreferredName, PhoneNumber, EmailAddress
- Address, CountiesInterestedIn, PartnerName/Phone/Email
- BriefWorkHistory, WhatInterestsInOpportunity, DefinitionOfSuccess
- PreferredWeeklyHours, NonRetirementCapitalAvailable, RetirementFundsRollingOver
- LeadSource, ReferredBy, PtoSubmissionDate

Maps directly to NAH OS contacts table. This is the franchise candidate pipeline source.

### Tier 4 — Property-level data (sync daily, filtered)

These tables are huge (900K+ rows each). Only sync for active territories or recent properties.

**PropertyInventory** — Status, type, dates (purchase/construction/list/sell), all financial line items (ARV, costs, profit) across Stage0/Original/Revised/Actual/MostMature snapshots, rental pro forma
**PropertyCalculations** — Calculated metrics: ARV, risk factor, max offer, profit, lead score, follow-up score, cycle times, seller info, campaign ranks
**PropertyStage0** — Raw lead data: property details, owner/trustee info, valuation
**PropertyStage1** — Qualified lead snapshot

### Tier 5 — Reference/supporting

**TerritoryBadges** / **TerritoryBadgesEarned** — Gamification badges
**Eos*Construction*\*\*** — Construction-specific EOS (habits, issues, rocks, tasks)
**Zillow\_\*\*** — Market data by county/zip (home value forecasts, median sale prices, time series)
**ZipCodeAveragePriceSqFt** — Avg price per sqft by zip
**PropertyDispositions** — How properties were disposed
**PropertyRoyalty** — Royalty tracking

### Skip (not needed for NAH OS)

- `wp_*` tables (WordPress blog)
- `NewAgainHouses_Locations_Component_*` (website CMS components)
- `DeploymentCenter_*`, `SoftwareReleaseHistory` (MasterSuite internal)
- `MasterSuiteUI_*` (UI config)
- `Log_*`, `ApiLog_*`, `ThirdPartyApiLog` (internal logs)
- `Restb*` (image analysis API cache)
- `BackgroundJob_*` (internal job tracking)
- `GoHighLevel_*` (GHL integration cache — we have our own)
- `HubspotContact` (legacy)

---

## Key join patterns

- `TerritorySlug` (varchar 6) — primary key across almost all territory tables
- `PropertyId` (int) — links PropertyInventory, PropertyCalculations, PropertyStage0/1, PropertyComparables, etc.
- `NewAgainHouses_LocationId` → `NewAgainHouses_Locations` → `NewAgainHouses_LocationOwners`

---

## NAH OS table mapping

| MasterSuite                | NAH OS                                   | Sync direction |
| -------------------------- | ---------------------------------------- | -------------- |
| Territories                | territories                              | MS -> NAH      |
| TerritoryScorecardKPIs     | territory_grades / territory_market_data | MS -> NAH      |
| TerritoryMetrics           | territory_market_data                    | MS -> NAH      |
| TerritoryMetricsDailyStats | (new table or territory_market_data)     | MS -> NAH      |
| Eos_Goals                  | eos_territory_goals                      | MS -> NAH      |
| Eos_Rocks                  | eos_territory_rocks                      | MS -> NAH      |
| Eos_Todos                  | eos_territory_todos                      | MS -> NAH      |
| Eos_Issues                 | eos_territory_issues                     | MS -> NAH      |
| Eos_Budgets                | eos_territory_budgets                    | MS -> NAH      |
| Eos_Habits                 | eos_territory_habits                     | MS -> NAH      |
| Eos_MarketingChannels      | eos_territory_lead_channels              | MS -> NAH      |
| PathToOwnershipEntries     | contacts                                 | MS -> NAH      |
| PropertyCalculations       | (new: ms_property_summary)               | MS -> NAH      |
| Users                      | (cross-reference only)                   | —              |
