/**
 * GET /api/metrics/north-star
 *
 * Returns the two numbers that run the company:
 * - franchisees_active (goal: 250)
 * - ten_plus_buyers (goal: 100)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const supabase = createServerClient();

  // Count active territories
  const { count: activeCount } = await supabase
    .from("territories")
    .select("ms_slug", { count: "exact", head: true })
    .eq("status", "active");

  // Count territories with 10+ houses purchased YTD
  // (Using territory_profile.houses_purchased_ytd as proxy until MasterSuite integration)
  const { data: performers } = await supabase
    .from("territory_profile")
    .select("ms_slug, houses_purchased_ytd")
    .gte("houses_purchased_ytd", 10);

  return NextResponse.json({
    franchisees_active: activeCount ?? 0,
    franchisees_active_goal: 250,
    ten_plus_buyers: performers?.length ?? 0,
    ten_plus_buyers_goal: 100,
  });
}
