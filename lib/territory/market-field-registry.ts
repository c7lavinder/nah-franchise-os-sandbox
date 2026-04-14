/**
 * Territory Market Data Field Registry — 120 fields, 10 categories
 *
 * Single source of truth for all market data fields on a territory.
 * Drives the Market & Financial UI, API validation, and data ingestion.
 *
 * Population sources:
 *   - "census"    → US Census / ACS data (auto-populated on territory creation)
 *   - "zillow"    → Zillow / Redfin / MLS data feeds
 *   - "attom"     → ATTOM property data
 *   - "bls"       → Bureau of Labor Statistics
 *   - "manual"    → Entered by team manually
 *   - "scout"     → Extracted from call transcripts by post-call agent
 *   - "mastersuite" → Synced from MasterSuite (future)
 *   - "calculated" → Derived from other fields
 */

export type MarketCategory =
  | "demographics"
  | "housing"
  | "real_estate_market"
  | "flip_market"
  | "economy_employment"
  | "population_trends"
  | "construction"
  | "competition"
  | "financial_performance"
  | "territory_overview";

export type MarketDataType = "text" | "number" | "currency" | "percentage" | "date" | "boolean";

export type MarketPopulationSource =
  | "census"
  | "zillow"
  | "attom"
  | "bls"
  | "manual"
  | "scout"
  | "mastersuite"
  | "calculated";

export interface MarketField {
  name: string;
  label: string;
  category: MarketCategory;
  dataType: MarketDataType;
  populationSource: MarketPopulationSource;
  autoPopulate: boolean;
  help?: string;
}

export const MARKET_CATEGORIES: { key: MarketCategory; label: string; icon: string }[] = [
  { key: "territory_overview", label: "Territory Overview", icon: "MapPin" },
  { key: "demographics", label: "Demographics", icon: "Users" },
  { key: "population_trends", label: "Population Trends", icon: "TrendingUp" },
  { key: "housing", label: "Housing", icon: "Home" },
  { key: "real_estate_market", label: "Real Estate Market", icon: "BarChart3" },
  { key: "flip_market", label: "Flip Market", icon: "Repeat" },
  { key: "economy_employment", label: "Economy & Employment", icon: "Briefcase" },
  { key: "construction", label: "Construction", icon: "Wrench" },
  { key: "competition", label: "Competition", icon: "Target" },
  { key: "financial_performance", label: "Financial Performance", icon: "DollarSign" },
];

export const MARKET_FIELDS: MarketField[] = [
  // ═══════════════════════════════════════
  // 1. TERRITORY OVERVIEW (8)
  // ═══════════════════════════════════════
  { name: "region", label: "Region", category: "territory_overview", dataType: "text", populationSource: "manual", autoPopulate: false },
  { name: "market_type", label: "Market Type", category: "territory_overview", dataType: "text", populationSource: "manual", autoPopulate: false, help: "Primary, Secondary, Tertiary" },
  { name: "territory_value_est", label: "Territory Value Estimate", category: "territory_overview", dataType: "currency", populationSource: "mastersuite", autoPopulate: false },
  { name: "counties_included", label: "Counties Included", category: "territory_overview", dataType: "text", populationSource: "manual", autoPopulate: false },
  { name: "major_cities", label: "Major Cities", category: "territory_overview", dataType: "text", populationSource: "manual", autoPopulate: false },
  { name: "zip_codes", label: "Zip Codes Covered", category: "territory_overview", dataType: "text", populationSource: "manual", autoPopulate: false },
  { name: "territory_sq_miles", label: "Square Miles", category: "territory_overview", dataType: "number", populationSource: "census", autoPopulate: true },
  { name: "territory_notes", label: "Territory Notes", category: "territory_overview", dataType: "text", populationSource: "manual", autoPopulate: false },

  // ═══════════════════════════════════════
  // 2. DEMOGRAPHICS (15)
  // ═══════════════════════════════════════
  { name: "population_total", label: "Total Population", category: "demographics", dataType: "number", populationSource: "census", autoPopulate: true },
  { name: "population_density", label: "Population Density (per sq mi)", category: "demographics", dataType: "number", populationSource: "census", autoPopulate: true },
  { name: "median_age", label: "Median Age", category: "demographics", dataType: "number", populationSource: "census", autoPopulate: true },
  { name: "median_household_income", label: "Median Household Income", category: "demographics", dataType: "currency", populationSource: "census", autoPopulate: true },
  { name: "per_capita_income", label: "Per Capita Income", category: "demographics", dataType: "currency", populationSource: "census", autoPopulate: true },
  { name: "poverty_rate", label: "Poverty Rate", category: "demographics", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "pct_bachelors_degree", label: "% Bachelor's Degree+", category: "demographics", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "pct_high_school", label: "% High School Diploma+", category: "demographics", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "avg_household_size", label: "Avg Household Size", category: "demographics", dataType: "number", populationSource: "census", autoPopulate: true },
  { name: "total_households", label: "Total Households", category: "demographics", dataType: "number", populationSource: "census", autoPopulate: true },
  { name: "pct_married_households", label: "% Married-Couple Households", category: "demographics", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "pct_single_parent", label: "% Single-Parent Households", category: "demographics", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "pct_white", label: "% White", category: "demographics", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "pct_black", label: "% Black/African American", category: "demographics", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "pct_hispanic", label: "% Hispanic/Latino", category: "demographics", dataType: "percentage", populationSource: "census", autoPopulate: true },

  // ═══════════════════════════════════════
  // 3. POPULATION TRENDS (10)
  // ═══════════════════════════════════════
  { name: "population_growth_1yr", label: "Population Growth (1yr)", category: "population_trends", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "population_growth_5yr", label: "Population Growth (5yr)", category: "population_trends", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "population_growth_10yr", label: "Population Growth (10yr)", category: "population_trends", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "net_migration_annual", label: "Net Migration (Annual)", category: "population_trends", dataType: "number", populationSource: "census", autoPopulate: true },
  { name: "net_domestic_migration", label: "Net Domestic Migration", category: "population_trends", dataType: "number", populationSource: "census", autoPopulate: true },
  { name: "pct_under_18", label: "% Under 18", category: "population_trends", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "pct_18_34", label: "% Age 18-34", category: "population_trends", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "pct_35_54", label: "% Age 35-54", category: "population_trends", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "pct_55_plus", label: "% Age 55+", category: "population_trends", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "birth_rate", label: "Birth Rate (per 1,000)", category: "population_trends", dataType: "number", populationSource: "census", autoPopulate: true },

  // ═══════════════════════════════════════
  // 4. HOUSING (16)
  // ═══════════════════════════════════════
  { name: "total_housing_units", label: "Total Housing Units", category: "housing", dataType: "number", populationSource: "census", autoPopulate: true },
  { name: "median_home_value", label: "Median Home Value", category: "housing", dataType: "currency", populationSource: "zillow", autoPopulate: true },
  { name: "median_rent", label: "Median Rent", category: "housing", dataType: "currency", populationSource: "census", autoPopulate: true },
  { name: "homeownership_rate", label: "Homeownership Rate", category: "housing", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "vacancy_rate", label: "Vacancy Rate", category: "housing", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "pct_owner_occupied", label: "% Owner Occupied", category: "housing", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "pct_renter_occupied", label: "% Renter Occupied", category: "housing", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "median_year_built", label: "Median Year Built", category: "housing", dataType: "number", populationSource: "census", autoPopulate: true },
  { name: "pct_built_before_1970", label: "% Built Before 1970", category: "housing", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "pct_built_after_2000", label: "% Built After 2000", category: "housing", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "housing_permits_annual", label: "New Housing Permits (Annual)", category: "housing", dataType: "number", populationSource: "census", autoPopulate: true },
  { name: "avg_property_tax", label: "Avg Annual Property Tax", category: "housing", dataType: "currency", populationSource: "census", autoPopulate: true },
  { name: "pct_cost_burdened", label: "% Cost-Burdened (>30% income)", category: "housing", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "mortgage_rate_avg", label: "Avg Mortgage Rate (Local)", category: "housing", dataType: "percentage", populationSource: "zillow", autoPopulate: false },
  { name: "pct_homes_with_mortgage", label: "% Homes with Mortgage", category: "housing", dataType: "percentage", populationSource: "census", autoPopulate: true },
  { name: "median_monthly_housing_cost", label: "Median Monthly Housing Cost", category: "housing", dataType: "currency", populationSource: "census", autoPopulate: true },

  // ═══════════════════════════════════════
  // 5. REAL ESTATE MARKET (16)
  // ═══════════════════════════════════════
  { name: "avg_days_on_market", label: "Avg Days on Market", category: "real_estate_market", dataType: "number", populationSource: "zillow", autoPopulate: true },
  { name: "list_to_sale_ratio", label: "List-to-Sale Price Ratio", category: "real_estate_market", dataType: "percentage", populationSource: "zillow", autoPopulate: true },
  { name: "active_listings", label: "Active Listings", category: "real_estate_market", dataType: "number", populationSource: "zillow", autoPopulate: true },
  { name: "months_of_inventory", label: "Months of Inventory", category: "real_estate_market", dataType: "number", populationSource: "zillow", autoPopulate: true },
  { name: "price_per_sqft", label: "Median Price per Sq Ft", category: "real_estate_market", dataType: "currency", populationSource: "zillow", autoPopulate: true },
  { name: "yoy_home_appreciation", label: "YoY Home Value Appreciation", category: "real_estate_market", dataType: "percentage", populationSource: "zillow", autoPopulate: true },
  { name: "home_appreciation_5yr", label: "5-Year Home Appreciation", category: "real_estate_market", dataType: "percentage", populationSource: "zillow", autoPopulate: true },
  { name: "foreclosure_rate", label: "Foreclosure Rate", category: "real_estate_market", dataType: "percentage", populationSource: "attom", autoPopulate: true },
  { name: "pre_foreclosure_count", label: "Pre-Foreclosure Count", category: "real_estate_market", dataType: "number", populationSource: "attom", autoPopulate: true },
  { name: "distressed_property_pct", label: "% Distressed Properties", category: "real_estate_market", dataType: "percentage", populationSource: "attom", autoPopulate: true },
  { name: "cash_buyer_pct", label: "% Cash Buyers", category: "real_estate_market", dataType: "percentage", populationSource: "attom", autoPopulate: true },
  { name: "investor_purchase_pct", label: "% Investor Purchases", category: "real_estate_market", dataType: "percentage", populationSource: "attom", autoPopulate: true },
  { name: "absorption_rate", label: "Absorption Rate", category: "real_estate_market", dataType: "percentage", populationSource: "zillow", autoPopulate: true },
  { name: "avg_seller_concession", label: "Avg Seller Concession", category: "real_estate_market", dataType: "percentage", populationSource: "scout", autoPopulate: false },
  { name: "pct_price_reductions", label: "% Listings with Price Reductions", category: "real_estate_market", dataType: "percentage", populationSource: "zillow", autoPopulate: true },
  { name: "new_listings_monthly", label: "New Listings (Monthly Avg)", category: "real_estate_market", dataType: "number", populationSource: "zillow", autoPopulate: true },

  // ═══════════════════════════════════════
  // 6. FLIP MARKET (14)
  // ═══════════════════════════════════════
  { name: "flip_rate", label: "Flip Rate (% of sales)", category: "flip_market", dataType: "percentage", populationSource: "attom", autoPopulate: true },
  { name: "flip_volume_annual", label: "Annual Flip Volume", category: "flip_market", dataType: "number", populationSource: "attom", autoPopulate: true },
  { name: "avg_flip_profit", label: "Avg Gross Flip Profit", category: "flip_market", dataType: "currency", populationSource: "attom", autoPopulate: true },
  { name: "avg_flip_roi", label: "Avg Flip ROI", category: "flip_market", dataType: "percentage", populationSource: "attom", autoPopulate: true },
  { name: "avg_arv", label: "Avg After-Repair Value", category: "flip_market", dataType: "currency", populationSource: "attom", autoPopulate: true },
  { name: "avg_purchase_price", label: "Avg Purchase Price (Flips)", category: "flip_market", dataType: "currency", populationSource: "attom", autoPopulate: true },
  { name: "avg_purchase_discount", label: "Avg Purchase Discount (%)", category: "flip_market", dataType: "percentage", populationSource: "attom", autoPopulate: true },
  { name: "avg_rehab_cost", label: "Avg Rehab Cost", category: "flip_market", dataType: "currency", populationSource: "scout", autoPopulate: false },
  { name: "avg_hold_time_days", label: "Avg Hold Time (Days)", category: "flip_market", dataType: "number", populationSource: "attom", autoPopulate: true },
  { name: "best_flip_zip_codes", label: "Best Zip Codes for Flips", category: "flip_market", dataType: "text", populationSource: "scout", autoPopulate: false },
  { name: "best_price_range", label: "Best Price Range for Flips", category: "flip_market", dataType: "text", populationSource: "scout", autoPopulate: false },
  { name: "flip_friendly_lenders", label: "Flip-Friendly Lenders (Local)", category: "flip_market", dataType: "text", populationSource: "scout", autoPopulate: false },
  { name: "wholesale_deal_flow", label: "Wholesale Deal Flow (Monthly)", category: "flip_market", dataType: "number", populationSource: "scout", autoPopulate: false },
  { name: "avg_days_to_sell_flip", label: "Avg Days to Sell (Flipped)", category: "flip_market", dataType: "number", populationSource: "attom", autoPopulate: true },

  // ═══════════════════════════════════════
  // 7. ECONOMY & EMPLOYMENT (14)
  // ═══════════════════════════════════════
  { name: "unemployment_rate", label: "Unemployment Rate", category: "economy_employment", dataType: "percentage", populationSource: "bls", autoPopulate: true },
  { name: "labor_force_size", label: "Labor Force Size", category: "economy_employment", dataType: "number", populationSource: "bls", autoPopulate: true },
  { name: "job_growth_rate_1yr", label: "Job Growth Rate (1yr)", category: "economy_employment", dataType: "percentage", populationSource: "bls", autoPopulate: true },
  { name: "job_growth_rate_5yr", label: "Job Growth Rate (5yr)", category: "economy_employment", dataType: "percentage", populationSource: "bls", autoPopulate: true },
  { name: "top_employer_1", label: "Top Employer #1", category: "economy_employment", dataType: "text", populationSource: "manual", autoPopulate: false },
  { name: "top_employer_2", label: "Top Employer #2", category: "economy_employment", dataType: "text", populationSource: "manual", autoPopulate: false },
  { name: "top_employer_3", label: "Top Employer #3", category: "economy_employment", dataType: "text", populationSource: "manual", autoPopulate: false },
  { name: "top_industry_1", label: "Top Industry #1", category: "economy_employment", dataType: "text", populationSource: "bls", autoPopulate: true },
  { name: "top_industry_2", label: "Top Industry #2", category: "economy_employment", dataType: "text", populationSource: "bls", autoPopulate: true },
  { name: "top_industry_3", label: "Top Industry #3", category: "economy_employment", dataType: "text", populationSource: "bls", autoPopulate: true },
  { name: "new_business_formations", label: "New Business Formations (Annual)", category: "economy_employment", dataType: "number", populationSource: "census", autoPopulate: true },
  { name: "gdp_per_capita", label: "GDP per Capita (Metro)", category: "economy_employment", dataType: "currency", populationSource: "bls", autoPopulate: true },
  { name: "cost_of_living_index", label: "Cost of Living Index", category: "economy_employment", dataType: "number", populationSource: "census", autoPopulate: true, help: "100 = national average" },
  { name: "commute_time_avg", label: "Avg Commute Time (min)", category: "economy_employment", dataType: "number", populationSource: "census", autoPopulate: true },

  // ═══════════════════════════════════════
  // 8. CONSTRUCTION (11)
  // ═══════════════════════════════════════
  { name: "contractor_availability", label: "Contractor Availability", category: "construction", dataType: "text", populationSource: "scout", autoPopulate: false, help: "High / Medium / Low" },
  { name: "avg_labor_rate_hr", label: "Avg Labor Rate ($/hr)", category: "construction", dataType: "currency", populationSource: "scout", autoPopulate: false },
  { name: "avg_material_cost_sqft", label: "Avg Material Cost ($/sq ft)", category: "construction", dataType: "currency", populationSource: "scout", autoPopulate: false },
  { name: "avg_rehab_cost_sqft", label: "Avg Rehab Cost ($/sq ft)", category: "construction", dataType: "currency", populationSource: "scout", autoPopulate: false },
  { name: "permit_timeline_days", label: "Permit Timeline (Days)", category: "construction", dataType: "number", populationSource: "scout", autoPopulate: false },
  { name: "permit_cost_avg", label: "Avg Permit Cost", category: "construction", dataType: "currency", populationSource: "scout", autoPopulate: false },
  { name: "inspection_requirements", label: "Inspection Requirements", category: "construction", dataType: "text", populationSource: "scout", autoPopulate: false, help: "Strict / Moderate / Lenient" },
  { name: "hoa_prevalence", label: "HOA Prevalence", category: "construction", dataType: "text", populationSource: "scout", autoPopulate: false, help: "High / Medium / Low / Rare" },
  { name: "renovation_restrictions", label: "Renovation Restrictions", category: "construction", dataType: "text", populationSource: "scout", autoPopulate: false },
  { name: "licensed_contractors_count", label: "Licensed Contractors (Area)", category: "construction", dataType: "number", populationSource: "manual", autoPopulate: false },
  { name: "construction_season", label: "Construction Season", category: "construction", dataType: "text", populationSource: "scout", autoPopulate: false, help: "Year-round / Seasonal (months)" },

  // ═══════════════════════════════════════
  // 9. COMPETITION (10)
  // ═══════════════════════════════════════
  { name: "active_flippers_count", label: "Active Flippers (Estimated)", category: "competition", dataType: "number", populationSource: "attom", autoPopulate: true },
  { name: "ibuyer_presence", label: "iBuyer Presence", category: "competition", dataType: "text", populationSource: "manual", autoPopulate: false, help: "Opendoor, Offerpad, etc." },
  { name: "wholesaler_activity", label: "Wholesaler Activity", category: "competition", dataType: "text", populationSource: "scout", autoPopulate: false, help: "High / Medium / Low" },
  { name: "investor_saturation", label: "Investor Saturation", category: "competition", dataType: "text", populationSource: "scout", autoPopulate: false, help: "Saturated / Moderate / Underserved" },
  { name: "competitor_presence", label: "Competitor Presence", category: "competition", dataType: "text", populationSource: "scout", autoPopulate: false },
  { name: "top_competitor_1", label: "Top Competitor #1", category: "competition", dataType: "text", populationSource: "scout", autoPopulate: false },
  { name: "top_competitor_2", label: "Top Competitor #2", category: "competition", dataType: "text", populationSource: "scout", autoPopulate: false },
  { name: "top_competitor_3", label: "Top Competitor #3", category: "competition", dataType: "text", populationSource: "scout", autoPopulate: false },
  { name: "buy_box_overlap", label: "Buy Box Overlap", category: "competition", dataType: "text", populationSource: "scout", autoPopulate: false, help: "Which competitors target same properties" },
  { name: "competitive_advantage", label: "NAH Competitive Advantage", category: "competition", dataType: "text", populationSource: "scout", autoPopulate: false },

  // ═══════════════════════════════════════
  // 10. FINANCIAL PERFORMANCE (6)
  // ═══════════════════════════════════════
  { name: "total_invested", label: "Total Invested", category: "financial_performance", dataType: "currency", populationSource: "mastersuite", autoPopulate: false },
  { name: "revenue_ytd", label: "Revenue YTD", category: "financial_performance", dataType: "currency", populationSource: "mastersuite", autoPopulate: false },
  { name: "projected_purchases", label: "Projected Purchases", category: "financial_performance", dataType: "number", populationSource: "mastersuite", autoPopulate: false },
  { name: "actual_purchases", label: "Actual Purchases", category: "financial_performance", dataType: "number", populationSource: "mastersuite", autoPopulate: false },
  { name: "avg_profit_per_flip", label: "Avg Profit per Flip", category: "financial_performance", dataType: "currency", populationSource: "mastersuite", autoPopulate: false },
  { name: "flip_activity_score", label: "Flip Activity Score", category: "financial_performance", dataType: "number", populationSource: "calculated", autoPopulate: false },
];

/** Get fields for a specific category */
export function getFieldsByCategory(category: MarketCategory): MarketField[] {
  return MARKET_FIELDS.filter((f) => f.category === category);
}

/** Get all auto-populate fields (for data ingestion) */
export function getAutoPopulateFields(): MarketField[] {
  return MARKET_FIELDS.filter((f) => f.autoPopulate);
}

/** Get all scout-extractable fields (for post-call agent) */
export function getScoutFields(): MarketField[] {
  return MARKET_FIELDS.filter((f) => f.populationSource === "scout");
}

/** Get sorted categories */
export function getSortedMarketCategories(): MarketCategory[] {
  return MARKET_CATEGORIES.map((c) => c.key);
}
