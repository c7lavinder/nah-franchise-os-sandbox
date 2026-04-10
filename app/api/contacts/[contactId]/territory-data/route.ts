export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
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
    .select("ms_slug")
    .eq("ghl_contact_id", ghlContactId)
    .is("end_date", null);

  const slugs = (ownerships ?? []).map((o) => o.ms_slug);
  if (slugs.length === 0) {
    return NextResponse.json({ territories: [] });
  }

  // Get territory details
  const { data: territories } = await supabase
    .from("territories")
    .select("ms_slug, territory_name, status, region, awarded_date")
    .in("ms_slug", slugs);

  // Get territory profiles
  const { data: profiles } = await supabase
    .from("territory_profile")
    .select("ms_slug, population, median_home_value, median_household_income, territory_value_est, market_type, flip_activity_score, competitor_presence, local_market_notes")
    .in("ms_slug", slugs);

  const profileMap = new Map<string, (typeof profiles extends (infer T)[] | null ? T : never)>();
  for (const p of profiles ?? []) profileMap.set(p.ms_slug, p);

  // Get grades
  const { data: grades } = await supabase
    .from("territory_grades")
    .select("ms_slug, year, quarter, houses_purchased, revenue, grade")
    .in("ms_slug", slugs)
    .order("year", { ascending: false })
    .order("quarter", { ascending: false });

  const gradeMap = new Map<string, typeof grades>();
  for (const g of grades ?? []) {
    if (!gradeMap.has(g.ms_slug)) gradeMap.set(g.ms_slug, []);
    gradeMap.get(g.ms_slug)!.push(g);
  }

  const result = (territories ?? []).map((t) => ({
    ...t,
    profile: profileMap.get(t.ms_slug) ?? null,
    grades: gradeMap.get(t.ms_slug) ?? [],
  }));

  return NextResponse.json({ territories: result });
}
