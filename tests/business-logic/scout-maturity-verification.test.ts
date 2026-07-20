/**
 * Live-behavior verification for the MasterSuite maturity fix.
 *
 * Drives the REAL Scout code paths (executeQuery + the data-dictionary loader
 * that describe_data serves) with a stubbed database, using the "108
 * Independence Ave" example from the observed wrong-answer set. Proves:
 *   1. The `calculations` entity is now reachable and returns the authoritative
 *      Calculated_Arv / Calculated_ConstructionBudget / Calculated_StageMaturity
 *      (these were synced but unreachable before the fix).
 *   2. The `inventory` entity returns the Inv_*MostMature current-best values.
 *   3. describe_data serves the owner-confirmed field meanings, including the
 *      "do not use" flags on dead/misleading fields.
 */

import { describe, it, expect, vi } from "vitest";

// ── Canned data for 108 Independence Ave: a purchased property whose ARV
//    matured from an early stage-1 estimate up to realized actuals. ──
const ROWS: Record<string, Record<string, unknown>[]> = {
  ms_properties: [
    {
      PropertyId: 233627,
      Address1: "108 Independence Ave",
      City: "Mount Carmel",
      State: "TN",
      Status: "6 Purchase",
      Stage1Arv: 120000, // least mature — the value Scout used to quote
      Stage3Arv: 142760,
    },
  ],
  ms_property_calculations: [
    {
      PropertyId: 233627,
      Calculated_Arv: 142760, // authoritative pre-purchase roll-up (was unreachable)
      Calculated_ConstructionBudget: 85000,
      Calculated_MaxOffer: 85000,
      Calculated_StageMaturity: 3,
      Calculated_Inv_Profit: 41000,
    },
  ],
  ms_property_inventory: [
    {
      PropertyId: 233627,
      Inv_Status: "Sold",
      Inv_CurrentArvStage0: 142760,
      Inv_CurrentArvMostMature: 150000, // realized actual — the current best answer
      Inv_ConstructionBudgetMostMature: 88000,
      Inv_PriceMostMature: 150000,
    },
  ],
};

// Chainable Supabase stub — records nothing, just returns the canned rows.
function makeBuilder(table: string) {
  let head = false;
  const b: Record<string, unknown> = {
    select: (_cols: string, opts?: { head?: boolean }) => {
      if (opts?.head) head = true;
      return b;
    },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      const rows = ROWS[table] ?? [];
      const payload = head ? { count: rows.length, error: null } : { data: rows, error: null };
      return Promise.resolve(payload).then(resolve, reject);
    },
  };
  for (const op of ["eq", "neq", "gt", "gte", "lt", "lte", "in", "ilike", "is", "not", "order", "limit"]) {
    b[op] = () => b;
  }
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: (t: string) => makeBuilder(t) }),
}));
vi.mock("@/lib/ghl", () => ({
  searchOpportunities: async () => [],
  getContact: async () => ({}),
  getPipelines: async () => [],
}));
// Brief generators pull the embeddings client (voyageai) transitively; they are
// only used by get_entity, not the query path under test.
vi.mock("@/lib/briefs/contact-brief-generator", () => ({ generateAndStoreContactBrief: async () => ({}) }));
vi.mock("@/lib/briefs/territory-brief-generator", () => ({ generateAndStoreTerritoryBrief: async () => ({}) }));

import { executeQuery } from "@/lib/scout/data-tools";
import { getTableDictionary, formatDictionaryForTool } from "@/lib/scout/data-dictionary";

describe("Scout maturity fix — live behavior on 108 Independence Ave", () => {
  it("PDF Q: 'What's the ARV?' — the calculations entity is reachable and returns the mature ARV", async () => {
    const res = JSON.parse(
      await executeQuery({
        entity: "calculations",
        filters: [{ field: "PropertyId", op: "eq", value: 233627 }],
      })
    );
    const row = res.rows[0];
    console.log("\n[calculations] Scout now receives:", {
      Calculated_Arv: row.Calculated_Arv,
      Calculated_ConstructionBudget: row.Calculated_ConstructionBudget,
      Calculated_StageMaturity: row.Calculated_StageMaturity,
    });
    expect(res.world).toBe("acquisitions");
    expect(row.Calculated_Arv).toBe(142760); // NOT the 120000 stage-1 value
    expect(row.Calculated_ConstructionBudget).toBe(85000);
    expect(row.Calculated_StageMaturity).toBe(3);
  });

  it("purchased property — inventory returns the Inv_*MostMature current-best values", async () => {
    const res = JSON.parse(
      await executeQuery({
        entity: "inventory",
        filters: [{ field: "PropertyId", op: "eq", value: 233627 }],
      })
    );
    const row = res.rows[0];
    console.log("[inventory] most-mature values:", {
      Inv_CurrentArvMostMature: row.Inv_CurrentArvMostMature,
      Inv_ConstructionBudgetMostMature: row.Inv_ConstructionBudgetMostMature,
    });
    expect(row.Inv_CurrentArvMostMature).toBe(150000); // realized, beats stage-0 142760
    expect(row.Inv_ConstructionBudgetMostMature).toBe(88000);
  });

  it("address lookup resolves a PropertyId (Address1 is now filterable)", async () => {
    const res = JSON.parse(
      await executeQuery({
        entity: "properties",
        filters: [{ field: "Address1", op: "ilike", value: "108 Independence" }],
      })
    );
    expect(res.rows[0].PropertyId).toBe(233627);
  });

  it("describe_data serves owner-confirmed meanings with maturity + do-not-use guidance", () => {
    const calc = formatDictionaryForTool(getTableDictionary("ms_property_calculations")!);
    const inv = formatDictionaryForTool(getTableDictionary("ms_property_inventory")!);
    const props = formatDictionaryForTool(getTableDictionary("ms_properties")!);

    console.log("\n[describe_data] Calculated_Arv:", calc.fieldMeanings.Calculated_Arv.meaning);
    console.log(
      "[describe_data] Inv_ConstructionBudgetMostMature:",
      inv.fieldMeanings.Inv_ConstructionBudgetMostMature.meaning
    );
    console.log(
      "[describe_data] Inv_Phase5CostsMostMature.do_not_use_for:",
      inv.fieldMeanings.Inv_Phase5CostsMostMature.do_not_use_for
    );
    console.log("[describe_data] Stage1Arv.prefer_instead:", props.fieldMeanings.Stage1Arv.prefer_instead);

    // ARV field explains it is the current/most-mature value
    expect(calc.fieldMeanings.Calculated_Arv.meaning.toLowerCase()).toContain("mature");
    // Phase 5 correction is served as an explicit misuse guard
    expect(inv.fieldMeanings.Inv_Phase5CostsMostMature.do_not_use_for?.toLowerCase()).toContain("overage");
    // Stage-1 evaluation points Scout to the authoritative roll-up
    expect(props.fieldMeanings.Stage1Arv.prefer_instead).toBeTruthy();
    // Dead field carries a do-not-use flag
    expect(props.fieldMeanings.Stage1CostOfMoneyPercent.do_not_use_for).toBeTruthy();
  });
});
