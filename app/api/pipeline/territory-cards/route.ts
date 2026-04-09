export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/territory-cards?status=active|inactive|available
 *
 * Returns territory cards for the Territories pipeline on the pipeline page.
 * Each card: territory name, status, owner name, owner contact link.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const supabase = createServerClient();

  let query = supabase
    .from("territories")
    .select("ms_slug, territory_name, status, awarded_date")
    .order("territory_name");

  if (status) {
    query = query.eq("status", status);
  }

  const { data: territories, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get current owners for all returned territories
  const slugs = (territories ?? []).map((t) => t.ms_slug);
  const { data: owners } = await supabase
    .from("territory_owners")
    .select("ms_slug, ghl_contact_id, role, contacts (first_name, last_name)")
    .in("ms_slug", slugs.length > 0 ? slugs : ["__none__"])
    .is("end_date", null);

  // Also get franchise_owners as fallback for owner name
  const { data: franchiseOwners } = await supabase
    .from("franchise_owners")
    .select("ms_slug, full_name, ghl_contact_id")
    .in("ms_slug", slugs.length > 0 ? slugs : ["__none__"]);

  const ownerMap = new Map<string, { name: string; ghlContactId: string | null }>();
  for (const fo of franchiseOwners ?? []) {
    ownerMap.set(fo.ms_slug, { name: fo.full_name, ghlContactId: fo.ghl_contact_id });
  }
  // Override with territory_owners if they exist (more current)
  for (const o of owners ?? []) {
    const c = o.contacts as unknown as { first_name: string; last_name: string } | null;
    if (c) {
      ownerMap.set(o.ms_slug, {
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
        ghlContactId: o.ghl_contact_id,
      });
    }
  }

  const cards = (territories ?? []).map((t) => {
    const owner = ownerMap.get(t.ms_slug);
    return {
      ms_slug: t.ms_slug,
      territory_name: t.territory_name,
      status: t.status,
      owner_name: owner?.name ?? null,
      owner_ghl_contact_id: owner?.ghlContactId ?? null,
      awarded_date: t.awarded_date,
    };
  });

  return NextResponse.json({ cards });
}
