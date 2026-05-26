export const dynamic = "force-dynamic";

/**
 * GET /api/journeys/:journeyId/debug-revenue
 *
 * Debug endpoint — shows why revenue data is or isn't loading.
 * Admin only. Remove after debugging.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ journeyId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { journeyId } = await params;
  const supabase = createServerClient();

  // 1. Journey
  const { data: journey } = await supabase
    .from("journeys")
    .select("id, name, primary_contact_id")
    .eq("id", journeyId)
    .single();

  if (!journey) return NextResponse.json({ error: "Journey not found" });

  // 2. Contact
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, franchise_fee, ghl_contact_id")
    .eq("id", journey.primary_contact_id)
    .single();

  // 3. JPS territory slugs
  const { data: jpsRows } = await supabase
    .from("journey_pipeline_state")
    .select(`id, "TerritorySlug", is_active, pipeline_stages(name)`)
    .eq("journey_id", journeyId);

  const jpsSlugs = ((jpsRows ?? []) as any[]).map((r) => r.TerritorySlug).filter(Boolean);

  // 4. Territory owners
  const { data: ownerRows } = await supabase
    .from("territory_owners")
    .select(`id, "TerritorySlug", contact_id, ghl_contact_id, end_date`)
    .eq("contact_id", journey.primary_contact_id);

  // Also check by ghl_contact_id
  const { data: ownerByGhl } = contact?.ghl_contact_id
    ? await supabase
        .from("territory_owners")
        .select(`id, "TerritorySlug", contact_id, ghl_contact_id, end_date`)
        .eq("ghl_contact_id", contact.ghl_contact_id)
    : { data: null };

  // 5. Determine which slugs we'd use
  let finalSlugs = [...new Set(jpsSlugs)];
  if (finalSlugs.length === 0 && ownerRows && ownerRows.length > 0) {
    finalSlugs = (ownerRows as any[])
      .filter((r) => !r.end_date)
      .map((r) => r.TerritorySlug)
      .filter(Boolean);
  }

  // 6. Property count for those slugs
  let propertyCount = 0;
  let royaltyRowCount = 0;
  if (finalSlugs.length > 0) {
    const { count } = await supabase
      .from("ms_properties")
      .select(`"PropertyId"`, { count: "exact", head: true })
      .in("TerritorySlug", finalSlugs);
    propertyCount = count ?? 0;

    if (propertyCount > 0) {
      const { data: propIds } = await supabase
        .from("ms_properties")
        .select(`"PropertyId"`)
        .in("TerritorySlug", finalSlugs)
        .limit(1000);
      const ids = (propIds ?? []).map((r: any) => r.PropertyId);
      if (ids.length > 0) {
        const { count: rc } = await supabase
          .from("ms_property_royalty")
          .select(`"PropertyId"`, { count: "exact", head: true })
          .in("PropertyId", ids);
        royaltyRowCount = rc ?? 0;
      }
    }
  }

  return NextResponse.json({
    journey: { id: journey.id, name: journey.name, primaryContactId: journey.primary_contact_id },
    contact: contact
      ? {
          id: contact.id,
          name: `${contact.first_name} ${contact.last_name}`,
          ghlContactId: contact.ghl_contact_id,
          franchiseFee: contact.franchise_fee,
        }
      : null,
    jps: {
      rowCount: jpsRows?.length ?? 0,
      territorySlugsFromJps: jpsSlugs,
      rows: (jpsRows ?? []).map((r: any) => ({
        territory: r.TerritorySlug,
        isActive: r.is_active,
        stage: Array.isArray(r.pipeline_stages) ? r.pipeline_stages[0]?.name : r.pipeline_stages?.name,
      })),
    },
    territoryOwners: {
      byContactId: (ownerRows ?? []).map((r: any) => ({
        territory: r.TerritorySlug,
        contactId: r.contact_id,
        ghlContactId: r.ghl_contact_id,
        endDate: r.end_date,
      })),
      byGhlContactId: (ownerByGhl ?? []).map((r: any) => ({
        territory: r.TerritorySlug,
        contactId: r.contact_id,
        ghlContactId: r.ghl_contact_id,
        endDate: r.end_date,
      })),
    },
    resolution: {
      finalSlugs,
      propertyCount,
      royaltyRowCount,
      reason:
        finalSlugs.length === 0
          ? "No territory slugs found in JPS or territory_owners"
          : propertyCount === 0
            ? `Territory slugs found (${finalSlugs.join(", ")}) but no properties in ms_properties`
            : royaltyRowCount === 0
              ? `${propertyCount} properties found but no rows in ms_property_royalty`
              : `OK — ${propertyCount} properties, ${royaltyRowCount} royalty rows`,
    },
  });
}
