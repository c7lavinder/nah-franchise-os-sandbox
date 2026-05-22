/**
 * Territory Brief Generator — Phase 2 of the Retrieval Brain
 *
 * Pulls territory data, owners, EOS metrics, inventory performance,
 * market data, and active journeys into a pre-computed JSON brief + text summary.
 * Stored in territory_briefs table for instant retrieval by Scout.
 */

import { createServerClient } from "@/lib/supabase/server";

export interface TerritoryBrief {
  territorySlug: string;
  nickname: string;
  region: string | null;
  status: string | null;
  franchiseAgreementDate: string | null;
  owners: Array<{
    contactId: string | null;
    role: string;
  }>;
  performance: {
    t12Purchases: number;
    t12Sales: number;
    activeInventory: number;
    isHighPerformer: boolean;
  };
  eos: {
    goalsCount: number;
    openRocks: number;
    openIssues: number;
    openTodos: number;
    scorecardMetrics: number;
  };
  marketDataFieldCount: number;
  activeJourneyCount: number;
}

export async function generateTerritoryBrief(slug: string): Promise<{
  brief: TerritoryBrief;
  summary: string;
}> {
  const supabase = createServerClient();

  const [
    territoryRes,
    ownersRes,
    goalsRes,
    scorecardRes,
    rocksRes,
    issuesRes,
    todosRes,
    journeysRes,
    inventoryRes,
    marketCountRes,
  ] = await Promise.all([
    supabase
      .from("territories")
      .select(`"TerritorySlug", "Nickname", region, status, "FranchiseAgreementDate"`)
      .eq("TerritorySlug", slug)
      .single(),
    supabase.from("territory_owners").select("ghl_contact_id, role").eq("TerritorySlug", slug).is("end_date", null),
    supabase.from("eos_territory_goals").select("id", { count: "exact", head: true }).eq("TerritorySlug", slug),
    supabase.from("eos_territory_scorecard").select("id", { count: "exact", head: true }).eq("TerritorySlug", slug),
    supabase
      .from("eos_territory_rocks")
      .select("id", { count: "exact", head: true })
      .eq("TerritorySlug", slug)
      .neq("status", "complete"),
    supabase
      .from("eos_territory_issues")
      .select("id", { count: "exact", head: true })
      .eq("TerritorySlug", slug)
      .eq("is_done", false),
    supabase
      .from("eos_territory_todos")
      .select("id", { count: "exact", head: true })
      .eq("TerritorySlug", slug)
      .eq("is_done", false),
    supabase
      .from("journey_pipeline_state")
      .select("id", { count: "exact", head: true })
      .eq("TerritorySlug", slug)
      .eq("is_active", true),
    supabase
      .from("ms_property_inventory")
      .select("Inv_PurchaseDate, Inv_SellDate")
      .eq("TerritorySlug", slug)
      .not("Inv_PurchaseDate", "is", null)
      .order("Inv_PurchaseDate", { ascending: false })
      .limit(500),
    supabase.from("territory_market_data").select("id", { count: "exact", head: true }).eq("TerritorySlug", slug),
  ]);

  const territory = territoryRes.data as any;
  if (!territory) {
    throw new Error(`Territory '${slug}' not found`);
  }

  // T12 performance
  const now = new Date();
  const t12Start = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
  const invRows = (inventoryRes.data ?? []) as { Inv_PurchaseDate: string; Inv_SellDate: string | null }[];
  const t12Purchases = invRows.filter((i) => new Date(i.Inv_PurchaseDate) >= t12Start).length;
  const t12Sales = invRows.filter((i) => i.Inv_SellDate && new Date(i.Inv_SellDate) >= t12Start).length;
  const activeInventory = invRows.filter((i) => !i.Inv_SellDate).length;

  const brief: TerritoryBrief = {
    territorySlug: slug,
    nickname: territory.Nickname ?? slug,
    region: territory.region,
    status: territory.status,
    franchiseAgreementDate: territory.FranchiseAgreementDate,
    owners: ((ownersRes.data ?? []) as any[]).map((o) => ({
      contactId: o.ghl_contact_id,
      role: o.role,
    })),
    performance: {
      t12Purchases,
      t12Sales,
      activeInventory,
      isHighPerformer: t12Purchases >= 10,
    },
    eos: {
      goalsCount: goalsRes.count ?? 0,
      openRocks: rocksRes.count ?? 0,
      openIssues: issuesRes.count ?? 0,
      openTodos: todosRes.count ?? 0,
      scorecardMetrics: scorecardRes.count ?? 0,
    },
    marketDataFieldCount: marketCountRes.count ?? 0,
    activeJourneyCount: journeysRes.count ?? 0,
  };

  // Text summary
  const lines: string[] = [];
  lines.push(`${brief.nickname} (${slug}) — ${brief.status ?? "unknown"}`);
  if (brief.region) lines.push(`Region: ${brief.region}`);
  lines.push(`Owners: ${brief.owners.length}`);
  lines.push(`T12: ${t12Purchases} purchased, ${t12Sales} sold, ${activeInventory} active inventory`);
  lines.push(`Performance: ${brief.performance.isHighPerformer ? "HIGH PERFORMER" : "below threshold (<10 T12)"}`);
  lines.push(`EOS: ${brief.eos.openRocks} rocks, ${brief.eos.openIssues} issues, ${brief.eos.openTodos} todos open`);
  lines.push(`Active journeys: ${brief.activeJourneyCount}`);
  lines.push(`Market data fields: ${brief.marketDataFieldCount}`);

  return { brief, summary: lines.join("\n") };
}

/**
 * Generate and store a territory brief. Returns the brief.
 */
export async function generateAndStoreTerritoryBrief(slug: string): Promise<TerritoryBrief> {
  const supabase = createServerClient();
  const { brief, summary } = await generateTerritoryBrief(slug);

  await supabase.from("territory_briefs").upsert(
    {
      territory_slug: slug,
      brief,
      summary,
      updated_at: new Date().toISOString(),
      stale: false,
    },
    { onConflict: "territory_slug" }
  );

  return brief;
}
