export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const supabase = createServerClient();

  // Resolve to ghl_contact_id
  let ghlContactId = contactId;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(contactId)) {
    const { data } = await supabase.from("contacts").select("ghl_contact_id").eq("id", contactId).single();
    if (data) ghlContactId = data.ghl_contact_id;
  }

  // Get territories owned by this contact
  const { data: ownerships } = await supabase
    .from("territory_owners")
    .select("TerritorySlug")
    .eq("ghl_contact_id", ghlContactId)
    .is("end_date", null);

  const slugs = (ownerships ?? []).map((o) => o.TerritorySlug);
  if (slugs.length === 0) {
    return NextResponse.json({ territories: [] });
  }

  // Get territory details
  const { data: territories } = await supabase
    .from("territories")
    .select("TerritorySlug, Nickname, status, region, FranchiseAgreementDate")
    .in("TerritorySlug", slugs);

  // Get territory profiles
  const { data: profiles } = await supabase
    .from("territory_profile")
    .select(
      "TerritorySlug, population, median_home_value, median_household_income, territory_value_est, market_type, flip_activity_score, competitor_presence, local_market_notes"
    )
    .in("TerritorySlug", slugs);

  const profileMap = new Map<string, typeof profiles extends (infer T)[] | null ? T : never>();
  for (const p of profiles ?? []) profileMap.set(p.TerritorySlug, p);

  // Get grades
  const { data: grades } = await supabase
    .from("territory_grades")
    .select("TerritorySlug, year, quarter, houses_purchased, revenue, grade")
    .in("TerritorySlug", slugs)
    .order("year", { ascending: false })
    .order("quarter", { ascending: false });

  const gradeMap = new Map<string, typeof grades>();
  for (const g of grades ?? []) {
    if (!gradeMap.has(g.TerritorySlug)) gradeMap.set(g.TerritorySlug, []);
    gradeMap.get(g.TerritorySlug)!.push(g);
  }

  const result = (territories ?? []).map((t) => ({
    ...t,
    profile: profileMap.get(t.TerritorySlug) ?? null,
    grades: gradeMap.get(t.TerritorySlug) ?? [],
  }));

  return NextResponse.json({ territories: result });
}
