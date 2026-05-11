/**
 * GET /api/metrics/north-star
 *
 * Returns the two numbers that run the company:
 * - franchisees_active (goal: 250)
 * - ten_plus_buyers (goal: 100)
 *
 * Calculated from raw property data — not placeholder columns.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const supabase = createServerClient();

  const { count: activeCount } = await supabase
    .from("territories")
    .select("TerritorySlug", { count: "exact", head: true })
    .eq("status", "active");

  // Count territories with 10+ purchases YTD from actual property data
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const { data: purchased } = await supabase
    .from("ms_properties")
    .select("TerritorySlug, ms_property_inventory!inner(Inv_PurchaseDate)")
    .gte("ms_property_inventory.Inv_PurchaseDate", yearStart);

  const countByTerritory = new Map<string, number>();
  for (const row of (purchased ?? []) as { TerritorySlug: string }[]) {
    if (row.TerritorySlug) countByTerritory.set(row.TerritorySlug, (countByTerritory.get(row.TerritorySlug) ?? 0) + 1);
  }
  const tenPlusBuyers = [...countByTerritory.values()].filter((c) => c >= 10).length;

  return NextResponse.json({
    franchisees_active: activeCount ?? 0,
    franchisees_active_goal: 250,
    ten_plus_buyers: tenPlusBuyers,
    ten_plus_buyers_goal: 100,
  });
}
