import { queryMS } from "./client";
import { getServiceSupabase } from "./supabase";
import { markJourneyBriefStaleByTerritory } from "@/lib/briefs/mark-journey-brief-stale";

const supabase = getServiceSupabase();

const BATCH_SIZE = 500;

function toISOOrNull(val: unknown): string | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toDateOrNull(val: unknown): string | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function toBoolOrNull(val: unknown): boolean | null {
  if (val === null || val === undefined) return null;
  return val === 1 || val === true;
}

/**
 * Sync properties from MasterSuite — non-Lead-List only.
 * Uses incremental sync via LastModified timestamp.
 */
export async function syncProperties(since?: string): Promise<{
  synced: { properties: number; calculations: number; inventory: number; statusHistory: number };
  errors: string[];
}> {
  const errors: string[] = [];
  const counts = { properties: 0, calculations: 0, inventory: 0, statusHistory: 0, royalty: 0 };

  // Build WHERE clause — exclude Lead List, optionally filter by LastModified
  let whereClause = "WHERE ps.Archived = 0 AND ps.Status != '0 Lead List'";
  const params: (string | number)[] = [];
  if (since) {
    whereClause += " AND ps.LastModified > ?";
    params.push(since);
  }

  // 1. Sync ms_properties from PropertySummaries + PropertyDataEntry
  const properties = await queryMS(
    `SELECT ps.*, pde.MarketRiskFactor, pde.DispositionNotes
     FROM PropertySummaries ps
     LEFT JOIN PropertyDataEntry pde ON ps.PropertyId = pde.PropertyId
     ${whereClause}
     ORDER BY ps.PropertyId`,
    params.length > 0 ? params : undefined
  );

  // Process in batches
  for (let i = 0; i < properties.length; i += BATCH_SIZE) {
    const batch = properties.slice(i, i + BATCH_SIZE);
    const records = batch.map((row: Record<string, unknown>) => ({
      PropertyId: row.PropertyId as number,
      Archived: toBoolOrNull(row.Archived) ?? false,
      ArchivedDate: toISOOrNull(row.ArchivedDate),
      TerritorySlug: row.TerritorySlug as string,
      PropertyType: row.PropertyType,
      BatchId: row.BatchId,
      Inserted: toISOOrNull(row.Inserted),
      InsertedBy: row.InsertedBy,
      LastModified: toISOOrNull(row.LastModified),
      LastModifiedBy: row.LastModifiedBy,
      PropertyReviewedDate: toISOOrNull(row.PropertyReviewedDate),
      PropertyReviewedBy: row.PropertyReviewedBy,
      PropertyReviewedByFriendlyName: row.PropertyReviewedByFriendlyName,
      PropertyUrl: row.PropertyUrl,
      AddressSlugVerbose: row.AddressSlugVerbose,
      AddressSlugShort: row.AddressSlugShort,
      Address1: row.Address1,
      Streetname: row.Streetname,
      Zip: row.Zip,
      City: row.City,
      State: row.State,
      County: row.County,
      GoogleCity: row.GoogleCity,
      GoogleState: row.GoogleState,
      GoogleCounty: row.GoogleCounty,
      Latitude: row.Latitude,
      Longitude: row.Longitude,
      AutoTerritorySlug: row.AutoTerritorySlug,
      ZillowPropertyId: row.ZillowPropertyId,
      OwnerOfferStatus: row.OwnerOfferStatus,
      DirectSellerNotes: row.DirectSellerNotes,
      OwnerLeadSource: row.OwnerLeadSource,
      Vacant: row.Vacant,
      Septic: row.Septic,
      RoadType: row.RoadType,
      LeadCategory: row.LeadCategory,
      LeadType: row.LeadType,
      LeadClassification: row.LeadClassification,
      LeadSubType2: row.LeadSubType2,
      ComparableSubjectCondition: row.ComparableSubjectCondition,
      AuctionAdPrice: row.AuctionAdPrice,
      AuctionDate: row.AuctionDate,
      AuctionTime: row.AuctionTime,
      AuctionReserveBid: row.AuctionReserveBid,
      AuctionTrustee: row.AuctionTrustee,
      AuctionCountyLocation: row.AuctionCountyLocation,
      AuctionDriveBy: row.AuctionDriveBy,
      AuctionTitle: row.AuctionTitle,
      AuctionStatus: row.AuctionStatus,
      Auctioneer: row.Auctioneer,
      TaxOverallGrade: row.TaxOverallGrade,
      FloodRisk: row.FloodRisk,
      MethCheck: row.MethCheck,
      UsdaQualified: row.UsdaQualified,
      GoogleSearch: row.GoogleSearch,
      AedQualified: row.AedQualified,
      Stage1Arv: row.Stage1Arv,
      Stage1ManualArv: row.Stage1ManualArv,
      Stage1Price: row.Stage1Price,
      Stage1LocationGrade: row.Stage1LocationGrade,
      Stage1RehabLevel: row.Stage1RehabLevel,
      Stage1Notes: row.Stage1Notes,
      Stage1CostOfMoneyPercent: row.Stage1CostOfMoneyPercent,
      Stage1MaxRiskFactorPercent: row.Stage1MaxRiskFactorPercent,
      Stage1MlsSellPercent: row.Stage1MlsSellPercent,
      LowEndPriceSquareFoot: row.LowEndPriceSquareFoot,
      HighEndPriceSquareFoot: row.HighEndPriceSquareFoot,
      ArvCeiling: row.ArvCeiling,
      OfferRange: row.OfferRange,
      Stage2Arv: row.Stage2Arv,
      Stage2Price: row.Stage2Price,
      Stage2LocationGrade: row.Stage2LocationGrade,
      Stage2RehabLevel: row.Stage2RehabLevel,
      Stage2Notes: row.Stage2Notes,
      Stage3ConstructionProfitRatio: row.Stage3ConstructionProfitRatio,
      Stage3MaxOffer: row.Stage3MaxOffer,
      Stage3Arv: row.Stage3Arv,
      Stage3Price: row.Stage3Price,
      Stage3LocationGrade: row.Stage3LocationGrade,
      Stage3RiskFactor: row.Stage3RiskFactor,
      Stage3ConstructionBudget: row.Stage3ConstructionBudget,
      Stage3CostOfMoneyPercent: row.Stage3CostOfMoneyPercent,
      Stage3MaxRiskFactorPercent: row.Stage3MaxRiskFactorPercent,
      Stage3Notes: row.Stage3Notes,
      Stage3MortgageStartDate: toDateOrNull(row.Stage3MortgageStartDate),
      Stage3MortgageAmount: row.Stage3MortgageAmount,
      Stage3MortgageTerm: row.Stage3MortgageTerm,
      Stage3MortgageKnownInterestRate: row.Stage3MortgageKnownInterestRate,
      Stage3Mortgage_Calculated_Payoff: row.Stage3Mortgage_Calculated_Payoff,
      Stage3Mortgage2StartDate: toDateOrNull(row.Stage3Mortgage2StartDate),
      Stage3Mortgage2Amount: row.Stage3Mortgage2Amount,
      Stage3Mortgage2Term: row.Stage3Mortgage2Term,
      Stage3Mortgage2KnownInterestRate: row.Stage3Mortgage2KnownInterestRate,
      Stage3Mortgage2_Calculated_Payoff: row.Stage3Mortgage2_Calculated_Payoff,
      BuyingCost: row.BuyingCost,
      HoldingCost: row.HoldingCost,
      ClosingCost: row.ClosingCost,
      MlsListCost: row.MlsListCost,
      SellDate: toDateOrNull(row.SellDate),
      DirectMailInitiatedDate: toDateOrNull(row.DirectMailInitiatedDate),
      Status: row.Status,
      EvaluationStatus: row.EvaluationStatus,
      BaseGrade: row.BaseGrade,
      Premium: row.Premium,
      Siding: row.Siding,
      Windows: row.Windows,
      Roof: row.Roof,
      ExteriorIndicators: row.ExteriorIndicators,
      SellerGender: row.SellerGender,
      SellerApproxAge: row.SellerApproxAge,
      SellerType: row.SellerType,
      SellerRole: row.SellerRole,
      SellerMotivation: row.SellerMotivation,
      SellerBlackSwans: row.SellerBlackSwans,
      PropertyAddressDoNotSend: toBoolOrNull(row.PropertyAddressDoNotSend) ?? false,
      OwnerDoNotSend: toBoolOrNull(row.OwnerDoNotSend) ?? false,
      TrusteeDoNotSend: toBoolOrNull(row.TrusteeDoNotSend) ?? false,
      ReferralPartnerName: row.ReferralPartnerName,
      HouseCanaryValue: row.HouseCanaryValue,
      utmMedium: row.utmMedium,
      utmContent: row.utmContent,
      utmSource: row.utmSource,
      utmCampaign: row.utmCampaign,
      MarketRiskFactor: row.MarketRiskFactor,
      DispositionNotes: row.DispositionNotes,
      ms_synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("ms_properties").upsert(records, { onConflict: "PropertyId" });

    if (error) {
      errors.push(`ms_properties batch ${i}: ${error.message}`);
    } else {
      counts.properties += records.length;
    }
  }

  // 2. Sync ms_property_calculations
  const propertyIds = properties.map((p: Record<string, unknown>) => p.PropertyId);
  if (propertyIds.length > 0) {
    for (let i = 0; i < propertyIds.length; i += BATCH_SIZE) {
      const batchIds = propertyIds.slice(i, i + BATCH_SIZE);
      const placeholders = batchIds.map(() => "?").join(",");

      const calcRows = await queryMS(
        `SELECT * FROM PropertyCalculations WHERE PropertyId IN (${placeholders})`,
        batchIds as number[]
      );

      // Columns we have in ms_property_calculations — only send these
      const CALC_COLUMNS = new Set([
        "PropertyId",
        "Modified",
        "StatusSnapshot",
        "Calculated_Arv",
        "Calculated_Arv_MarketRiskAdjusted",
        "Calculated_RiskFactor",
        "Calculated_RiskFactor_Original",
        "Calculated_RiskFactorStage1",
        "Calculated_RiskFactorStage2",
        "Calculated_RiskFactorStage3",
        "Calculated_ConstructionBudget",
        "Calculated_ConstructionEstimatedDays",
        "Calculated_ConstructionDaysComplete",
        "Calculated_ConstructionDaysRemaining",
        "Calculated_ConstructionDaysOver",
        "Calculated_MaxOffer",
        "Calculated_MaxOffer_Original",
        "Calculated_MaxOffer_Price_Ratio",
        "Calculated_MaxOffer_Auction_Price_Ratio",
        "Calculated_AuctionMinimumPrice",
        "Calculated_AuctionMinimumPriceMeta",
        "Calculated_NahProfit",
        "Calculated_NahConstructionProfitRatio",
        "Calculated_NahProfitMarketAdjusted",
        "ConstructionCostPerSquareFoot",
        "Calculated_ArvPerAdjustedSqFt",
        "Calculated_LocationGrade",
        "Calculated_RehabGrade",
        "Calculated_Price",
        "Calculated_MlsProfit",
        "Calculated_MlsConstructionProfitRatio",
        "Calculated_MlsProfitMarketAdjusted",
        "Calculated_IntangibleScore",
        "Calculated_ArvRiskFactor",
        "Calculated_LocationRiskAdjustment",
        "Calculated_IntangibleRiskAdjustment",
        "Calculated_StarredCompsAveragePriceSqFt",
        "Calculated_StarredCompsMedianPriceSqFt",
        "Calculated_CompRiskAdjustment",
        "Calculated_AdjustedRiskFactor",
        "Calculated_AdjustedSqFt",
        "Calculated_AmountFinanced",
        "Calculated_BuyingCost",
        "Calculated_HoldingCost",
        "Calculated_ClosingCost",
        "Calculated_MlsListCost",
        "Calculated_TotalQuietCosts",
        "Calculated_TotalCostOfMoney",
        "Calculated_StageMaturity",
        "Calculated_FinanceCostCycleTimeDays",
        "Calculated_FinanceCost",
        "Calculated_EstimatedPayoff2",
        "Calculated_CashRequired",
        "Calculated_ReturnOnInvestment",
        "Calculated_SellerType",
        "Calculated_SellerName",
        "Calculated_SellerFirstName",
        "Calculated_SellerLastName",
        "Calculated_SellerMailingAddress",
        "Calculated_SellerAddress",
        "Calculated_SellerCity",
        "Calculated_SellerState",
        "Calculated_SellerZip",
        "Calculated_SellerAddressDistance",
        "Calculated_AbsenteeSeller",
        "Calculated_SellerPhone",
        "Calculated_SellerEmail",
        "Calculated_SellerMarketingWeek",
        "Calculated_FullPropertyAddress",
        "Calculated_TotalCbGrade",
        "Calculated_Stage1ArvSqFt",
        "Stage1ArvEstatedCombined",
        "Calculated_LowEndTotalPrice",
        "Calculated_HighEndTotalPrice",
        "Calculated_Stage2Arv",
        "Calculated_ConstructionBudgetStage1",
        "Calculated_ConstructionBudgetStage2",
        "Calculated_ConstructionStage3RehabGrade",
        "Calculated_BuiltAge",
        "Calculated_EffectiveAge",
        "Calculated_ArvCeilingSqFt",
        "Calculated_Stage1MaxOfferPriceRatio",
        "Calculated_LeadScore",
        "LeadScore_MaxOfferPriceScore_Points",
        "LeadScore_MaxOfferPriceScore_Percent",
        "LeadScore_ConditionScore_Points",
        "LeadScore_ConditionScore_Percent",
        "LeadScore_AbsenteeOwnerScore_Points",
        "LeadScore_AbsenteeOwnerScore_Percent",
        "LeadScore_SoldAmountArvScore_Points",
        "LeadScore_SoldAmountArvScore_Percent",
        "LeadScore_YearBuiltScore_Points",
        "LeadScore_YearBuiltScore_Percent",
        "LeadScore_SquareFootageScore_Points",
        "LeadScore_SquareFootageScore_Percent",
        "FollowUpScore",
        "FollowUpScore_LeadCategory_Points",
        "FollowUpScore_Status_Points",
        "FollowUpScore_MarketingWeek_Points",
        "Calculated_Inv_DaysOwned",
        "Calculated_Inv_MonthsOwned",
        "Calculated_Inv_YearsOwned",
        "Calculated_Inv_DaysOnMarket",
        "Calculated_Inv_ProjectProfit",
        "Calculated_Inv_Profit",
        "Calculated_Inv_Proceeds",
        "Calculated_Inv_TotalNotesPayable",
        "Calculated_Inv_OverBudget",
        "Calculated_Inv_CashInvested",
        "Calculated_Inv_RiskFactor",
        "Calculated_Inv_ConstructionProfitRatio",
        "Calculated_Inv_CBGrade",
        "Calculated_Inv_Item19Year",
        "Calculated_Inv_Royalty",
        "HasInventory",
        "HasActiveInventory",
        "CycleTimePurchaseToSell",
        "CycleTimePurchaseToContractedSell",
        "CycleTimePurchaseToConstructionStart",
        "CycleTimePurchaseToList",
        "CycleTimeConstructionStartToConstructionComplete",
        "CycleTimeConstructionCompleteToSell",
        "CycleTimePurchaseToConstructionComplete",
        "CycleTimeListToSell",
        "CycleTimeS1ToFinalOutcome",
        "ProjectedRoyaltyDate",
        "Calculated_LastSoldDate",
        "Calculated_YearsOwned",
        "Calculated_ReportingStatus",
      ]);

      const calcRecords = calcRows.map((row: Record<string, unknown>) => {
        const record: Record<string, unknown> = { ms_synced_at: new Date().toISOString() };
        for (const [key, val] of Object.entries(row)) {
          if (!CALC_COLUMNS.has(key)) continue;
          if (val instanceof Date) {
            record[key] = val.toISOString();
          } else if (key === "Calculated_AbsenteeSeller" || key === "HasInventory" || key === "HasActiveInventory") {
            record[key] = toBoolOrNull(val);
          } else {
            record[key] = val;
          }
        }
        return record;
      });

      if (calcRecords.length > 0) {
        const { error } = await supabase
          .from("ms_property_calculations")
          .upsert(calcRecords, { onConflict: "PropertyId" });

        if (error) {
          errors.push(`ms_property_calculations batch ${i}: ${error.message}`);
        } else {
          counts.calculations += calcRecords.length;
        }
      }
    }

    // 3. Sync ms_property_inventory
    for (let i = 0; i < propertyIds.length; i += BATCH_SIZE) {
      const batchIds = propertyIds.slice(i, i + BATCH_SIZE);
      const placeholders = batchIds.map(() => "?").join(",");

      const invRows = await queryMS(
        `SELECT * FROM PropertyInventory WHERE PropertyId IN (${placeholders})`,
        batchIds as number[]
      );

      const invRecords = invRows.map((row: Record<string, unknown>) => {
        const record: Record<string, unknown> = { ms_synced_at: new Date().toISOString() };
        for (const [key, val] of Object.entries(row)) {
          if (val instanceof Date) {
            record[key] = val.toISOString();
          } else {
            record[key] = val;
          }
        }
        return record;
      });

      if (invRecords.length > 0) {
        const { error } = await supabase.from("ms_property_inventory").upsert(invRecords, { onConflict: "PropertyId" });

        if (error) {
          errors.push(`ms_property_inventory batch ${i}: ${error.message}`);
        } else {
          counts.inventory += invRecords.length;
        }
      }
    }

    // 4. Sync ms_property_status_history
    for (let i = 0; i < propertyIds.length; i += BATCH_SIZE) {
      const batchIds = propertyIds.slice(i, i + BATCH_SIZE);
      const placeholders = batchIds.map(() => "?").join(",");

      const histRows = await queryMS(
        `SELECT * FROM PropertyStatusHistory WHERE PropertyId IN (${placeholders})`,
        batchIds as number[]
      );

      const histRecords = histRows.map((row: Record<string, unknown>) => ({
        PropertyId: row.PropertyId,
        Inserted: toISOOrNull(row.Inserted),
        PreviousStatus: row.PreviousStatus,
        NewStatus: row.NewStatus,
      }));

      if (histRecords.length > 0) {
        // Delete existing history for these properties, then insert
        await supabase.from("ms_property_status_history").delete().in("PropertyId", batchIds);

        const { error } = await supabase.from("ms_property_status_history").insert(histRecords);

        if (error) {
          errors.push(`ms_property_status_history batch ${i}: ${error.message}`);
        } else {
          counts.statusHistory += histRecords.length;
        }
      }
    }

    // 5. Sync ms_property_royalty
    for (let i = 0; i < propertyIds.length; i += BATCH_SIZE) {
      const batchIds = propertyIds.slice(i, i + BATCH_SIZE);
      const placeholders = batchIds.map(() => "?").join(",");

      const royaltyRows = await queryMS(
        `SELECT * FROM PropertyRoyalty WHERE PropertyId IN (${placeholders})`,
        batchIds as number[]
      );

      const royaltyRecords = royaltyRows.map((row: Record<string, unknown>) => {
        const record: Record<string, unknown> = { ms_synced_at: new Date().toISOString() };
        for (const [key, val] of Object.entries(row)) {
          if (val instanceof Date) {
            record[key] = val.toISOString();
          } else {
            record[key] = val;
          }
        }
        return record;
      });

      if (royaltyRecords.length > 0) {
        const { error } = await supabase
          .from("ms_property_royalty")
          .upsert(royaltyRecords, { onConflict: "PropertyId" });

        if (error) {
          errors.push(`ms_property_royalty batch ${i}: ${error.message}`);
        } else {
          counts.royalty += royaltyRecords.length;
        }
      }
    }
  }

  // Mark journey briefs stale for territories that had property data synced
  if (counts.properties > 0 || counts.inventory > 0) {
    const slugs = [
      ...new Set(properties.map((r: Record<string, unknown>) => r.TerritorySlug as string).filter(Boolean)),
    ];
    for (const slug of slugs) {
      void markJourneyBriefStaleByTerritory(slug).catch(() => {});
    }
  }

  return { synced: counts, errors };
}

/**
 * Sync Lead List aggregate counts.
 * Full recount — runs daily.
 */
export async function syncLeadListCounts(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];

  const rows = await queryMS<{
    TerritorySlug: string;
    month: string;
    LeadCategory: string | null;
    LeadType: string | null;
    cnt: number;
  }>(`
    SELECT
      TerritorySlug,
      DATE_FORMAT(Inserted, '%Y-%m-01') as month,
      LeadCategory,
      LeadType,
      COUNT(*) as cnt
    FROM PropertySummaries
    WHERE Status = '0 Lead List' AND Archived = 0
    GROUP BY TerritorySlug, DATE_FORMAT(Inserted, '%Y-%m-01'), LeadCategory, LeadType
  `);

  const records = rows.map((row) => ({
    TerritorySlug: row.TerritorySlug,
    month: row.month,
    LeadCategory: row.LeadCategory,
    LeadType: row.LeadType,
    count: row.cnt,
    synced_at: new Date().toISOString(),
  }));

  // Truncate and reload
  await supabase.from("ms_lead_list_counts").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  let synced = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("ms_lead_list_counts").insert(batch);
    if (error) {
      errors.push(`ms_lead_list_counts batch ${i}: ${error.message}`);
    } else {
      synced += batch.length;
    }
  }

  return { synced, errors };
}
