export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/territory-cards?status=active|inactive|available
 *
 * Returns territory cards for the Territories pipeline on the pipeline page.
 * Each card: territory name, status, owner name, owner contact link.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { assignTerritoryPerformanceLabels } from "@/lib/territory-performance-quartiles";

type HistRow = { PropertyId: number; NewStatus: string | null; Inserted: string };
type PropertyRow = { PropertyId: number; TerritorySlug: string };
type InventoryRow = { PropertyId: number; Inv_ContractedPurchaseDate: string | null; Inv_PurchaseDate: string | null };

function stageKey(status: string | null): string | null {
  if (!status) return null;
  const trimmed = status.trim();
  if (trimmed === "1" || trimmed.startsWith("1 ")) return "1";
  if (trimmed === "4" || trimmed.startsWith("4 ")) return "4";
  return null;
}

async function fetchPaged<T>(queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await queryFactory(offset, offset + 999);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const status = request.nextUrl.searchParams.get("status");
  const stageId = request.nextUrl.searchParams.get("stage_id");
  const supabase = createServerClient();

  let query = supabase
    .from("territories")
    .select("TerritorySlug, Nickname, status, FranchiseAgreementDate")
    .order("Nickname");

  // Default to active-only; pass status=all to see everything
  if (status && status !== "all") {
    query = query.eq("status", status);
  } else if (!status) {
    query = query.eq("status", "active");
  }

  // If filtering by pipeline stage, find which territories have jps rows in
  // that stage. Phase 4 read migration — jps carries TerritorySlug
  // directly, so we skip the old contact→ghl→territory_owners dance.
  if (stageId) {
    const { data: stateRows } = await supabase
      .from("journey_pipeline_state")
      .select("TerritorySlug")
      .eq("current_stage_id", stageId)
      .eq("is_active", true)
      .not("TerritorySlug", "is", null);

    const stageFilterSlugs = [...new Set((stateRows ?? []).map((r) => r.TerritorySlug).filter(Boolean) as string[])];
    if (stageFilterSlugs.length === 0) {
      return NextResponse.json({ cards: [] });
    }

    query = query.in("TerritorySlug", stageFilterSlugs);
  }

  const { data: territories, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get current owners for all returned territories
  const slugs = (territories ?? []).map((t) => t.TerritorySlug);
  const { data: owners } = await supabase
    .from("territory_owners")
    .select("TerritorySlug, ghl_contact_id, role, contacts (first_name, last_name)")
    .in("TerritorySlug", slugs.length > 0 ? slugs : ["__none__"])
    .is("end_date", null);

  // Also get franchise_owners as fallback for owner name
  const { data: franchiseOwners } = await supabase
    .from("franchise_owners")
    .select("TerritorySlug, full_name, ghl_contact_id")
    .in("TerritorySlug", slugs.length > 0 ? slugs : ["__none__"]);

  const ownerMap = new Map<string, { name: string; ghlContactId: string | null }>();
  for (const fo of franchiseOwners ?? []) {
    ownerMap.set(fo.TerritorySlug, { name: fo.full_name, ghlContactId: fo.ghl_contact_id });
  }
  // Override with territory_owners if they exist (more current)
  for (const o of owners ?? []) {
    const c = o.contacts as unknown as { first_name: string; last_name: string } | null;
    if (c) {
      ownerMap.set(o.TerritorySlug, {
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
        ghlContactId: o.ghl_contact_id,
      });
    }
  }

  // Phase 4 read migration: jps carries TerritorySlug, so we can look
  // up onboarding/runway stage directly per territory. Runway wins when both
  // are present (matches the old "first one found" behavior since a territory
  // is typically only in one of the two at a time).
  const stageBySlug = new Map<string, { stageName: string; stageSlug: string; pipelineSlug: string }>();
  if (slugs.length > 0) {
    const { data: jpsRows } = await supabase
      .from("journey_pipeline_state")
      .select("TerritorySlug, pipeline_stages(slug, name), pipelines(slug)")
      .eq("is_active", true)
      .in("TerritorySlug", slugs);

    for (const row of jpsRows ?? []) {
      const slug = row.TerritorySlug as string | null;
      if (!slug) continue;
      const pSlug = (row.pipelines as unknown as { slug: string } | null)?.slug;
      const stage = row.pipeline_stages as unknown as { slug: string; name: string } | null;
      if (!stage) continue;
      if (pSlug === "onboarding" || pSlug === "runway") {
        const existing = stageBySlug.get(slug);
        if (!existing || pSlug === "runway") {
          stageBySlug.set(slug, { stageName: stage.name, stageSlug: stage.slug, pipelineSlug: pSlug });
        }
      }
    }
  }

  // High Performers: 10+ purchases in last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const highPerformerSlugs = new Set<string>();
  const purchasesBySlug: Record<string, number> = {};
  const activeSlugs = (territories ?? []).filter((t) => t.status === "active").map((t) => t.TerritorySlug);

  if (slugs.length > 0) {
    // Start from inventory (small set) then look up territories
    const { data: recentPurchases } = await supabase
      .from("ms_property_inventory")
      .select("PropertyId")
      .not("Inv_PurchaseDate", "is", null)
      .gte("Inv_PurchaseDate", twelveMonthsAgo.toISOString());

    const purchasedIds = (recentPurchases ?? []).map((r) => r.PropertyId);
    const purchasesBySlug: Record<string, number> = {};

    for (let i = 0; i < purchasedIds.length; i += 500) {
      const { data: props } = await supabase
        .from("ms_properties")
        .select("PropertyId, TerritorySlug")
        .in("PropertyId", purchasedIds.slice(i, i + 500))
        .in("TerritorySlug", slugs)
        .eq("Archived", false);
      for (const p of props ?? []) {
        purchasesBySlug[p.TerritorySlug] = (purchasesBySlug[p.TerritorySlug] ?? 0) + 1;
      }
    }

    for (const [slug, count] of Object.entries(purchasesBySlug)) {
      if (count >= 10) highPerformerSlugs.add(slug);
    }
  }

  const performanceLabelBySlug = new Map<string, { quartile: string; score: number; rank: number; status: string }>();
  if (activeSlugs.length > 0) {
    const [leadListRes, inventory30Res] = await Promise.all([
      supabase
        .from("ms_lead_list_counts")
        .select("TerritorySlug, count")
        .in("TerritorySlug", activeSlugs)
        .gte("month", currentMonthStart.toISOString().slice(0, 10)),
      supabase
        .from("ms_property_inventory")
        .select("PropertyId, Inv_ContractedPurchaseDate, Inv_PurchaseDate")
        .or(
          `Inv_ContractedPurchaseDate.gte.${thirtyDaysAgo.toISOString()},Inv_PurchaseDate.gte.${thirtyDaysAgo.toISOString()}`
        ),
    ]);

    const leadListBySlug = new Map<string, number>();
    for (const row of leadListRes.data ?? []) {
      leadListBySlug.set(row.TerritorySlug, (leadListBySlug.get(row.TerritorySlug) ?? 0) + Number(row.count ?? 0));
    }

    const history30 = await fetchPaged<HistRow>((from, to) =>
      supabase
        .from("ms_property_status_history")
        .select("PropertyId, NewStatus, Inserted")
        .gte("Inserted", thirtyDaysAgo.toISOString())
        .range(from, to)
    );
    const propertyIdsToLookup = [
      ...new Set([
        ...history30.map((h) => h.PropertyId),
        ...((inventory30Res.data ?? []) as InventoryRow[]).map((i) => i.PropertyId),
      ]),
    ];
    const propertyById = new Map<number, PropertyRow>();
    for (let i = 0; i < propertyIdsToLookup.length; i += 500) {
      const { data: props } = await supabase
        .from("ms_properties")
        .select("PropertyId, TerritorySlug")
        .in("PropertyId", propertyIdsToLookup.slice(i, i + 500))
        .in("TerritorySlug", activeSlugs)
        .eq("Archived", false);
      for (const prop of (props ?? []) as PropertyRow[]) propertyById.set(prop.PropertyId, prop);
    }

    const stage1BySlug = new Map<string, Set<number>>();
    const stage4BySlug = new Map<string, Set<number>>();
    for (const row of history30) {
      const prop = propertyById.get(row.PropertyId);
      if (!prop) continue;
      const key = stageKey(row.NewStatus);
      if (key === "1") {
        if (!stage1BySlug.has(prop.TerritorySlug)) stage1BySlug.set(prop.TerritorySlug, new Set());
        stage1BySlug.get(prop.TerritorySlug)!.add(row.PropertyId);
      }
      if (key === "4") {
        if (!stage4BySlug.has(prop.TerritorySlug)) stage4BySlug.set(prop.TerritorySlug, new Set());
        stage4BySlug.get(prop.TerritorySlug)!.add(row.PropertyId);
      }
    }

    const contracts30BySlug = new Map<string, number>();
    const purchases30BySlug = new Map<string, number>();
    for (const row of (inventory30Res.data ?? []) as InventoryRow[]) {
      const prop = propertyById.get(row.PropertyId);
      if (!prop) continue;
      if (row.Inv_ContractedPurchaseDate && new Date(row.Inv_ContractedPurchaseDate) >= thirtyDaysAgo) {
        contracts30BySlug.set(prop.TerritorySlug, (contracts30BySlug.get(prop.TerritorySlug) ?? 0) + 1);
      }
      if (row.Inv_PurchaseDate && new Date(row.Inv_PurchaseDate) >= thirtyDaysAgo) {
        purchases30BySlug.set(prop.TerritorySlug, (purchases30BySlug.get(prop.TerritorySlug) ?? 0) + 1);
      }
    }

    const scored = assignTerritoryPerformanceLabels(
      (territories ?? [])
        .filter((t) => t.status === "active")
        .map((t) => ({
          slug: t.TerritorySlug,
          name: t.Nickname,
          leadListInsertedMonth: leadListBySlug.get(t.TerritorySlug) ?? 0,
          stage1Last30d: stage1BySlug.get(t.TerritorySlug)?.size ?? 0,
          stage4Last30d: stage4BySlug.get(t.TerritorySlug)?.size ?? 0,
          contractsLast30d: contracts30BySlug.get(t.TerritorySlug) ?? 0,
          purchasesLast30d: purchases30BySlug.get(t.TerritorySlug) ?? 0,
          purchasesT12: purchasesBySlug[t.TerritorySlug] ?? 0,
        }))
    );

    for (const territory of scored) {
      performanceLabelBySlug.set(territory.slug, {
        quartile: territory.quartile,
        score: territory.score,
        rank: territory.rank,
        status: territory.status,
      });
    }
  }

  const cards = (territories ?? []).map((t) => {
    const owner = ownerMap.get(t.TerritorySlug);
    const pipelineStage = stageBySlug.get(t.TerritorySlug) ?? null;
    const performanceLabel = performanceLabelBySlug.get(t.TerritorySlug) ?? null;
    return {
      TerritorySlug: t.TerritorySlug,
      Nickname: t.Nickname,
      status: t.status,
      owner_name: owner?.name ?? null,
      owner_ghl_contact_id: owner?.ghlContactId ?? null,
      FranchiseAgreementDate: t.FranchiseAgreementDate,
      stage_name: pipelineStage?.stageName ?? null,
      stage_slug: pipelineStage?.stageSlug ?? null,
      pipeline_slug: pipelineStage?.pipelineSlug ?? null,
      highPerformer: highPerformerSlugs.has(t.TerritorySlug),
      performanceQuartile: performanceLabel?.quartile ?? null,
      performanceScore: performanceLabel?.score ?? null,
      performanceRank: performanceLabel?.rank ?? null,
      performanceStatus: performanceLabel?.status ?? null,
    };
  });

  return NextResponse.json({ cards });
}
