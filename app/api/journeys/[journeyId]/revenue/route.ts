export const dynamic = "force-dynamic";

/**
 * GET /api/journeys/:journeyId/revenue
 *
 * Returns revenue data for the journey:
 * - franchise_fee (from contacts table, manually entered)
 * - Royalty paid/due computed from per-property ms_property_royalty rows
 * - Monthly time-series of royalty payments (by paid date)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

interface MonthlyEntry {
  month: string;
  paid: number;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ journeyId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { journeyId } = await params;
  const supabase = createServerClient();

  // 1. Get journey + primary contact + territory slugs
  const [journeyRes, jpsRes] = await Promise.all([
    supabase.from("journeys").select("primary_contact_id, created_at").eq("id", journeyId).single(),
    supabase
      .from("journey_pipeline_state")
      .select(`"TerritorySlug"`)
      .eq("journey_id", journeyId)
      .not("TerritorySlug", "is", null),
  ]);

  if (!journeyRes.data) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  const primaryContactId = journeyRes.data.primary_contact_id;
  let slugs = [...new Set(((jpsRes.data ?? []) as any[]).map((r) => r.TerritorySlug).filter(Boolean) as string[])];

  // 2. Franchise fee from contacts table
  const { data: contact } = await supabase.from("contacts").select("franchise_fee").eq("id", primaryContactId).single();

  // Fallback: if JPS has no territory slugs, check territory_owners for this contact
  if (slugs.length === 0) {
    const { data: ownedTerritories } = await supabase
      .from("territory_owners")
      .select(`"TerritorySlug"`)
      .eq("contact_id", primaryContactId)
      .is("end_date", null);
    slugs = [...new Set(((ownedTerritories ?? []) as any[]).map((r) => r.TerritorySlug).filter(Boolean) as string[])];
  }

  const franchiseFee = contact?.franchise_fee ?? null;

  // 3. If no territories, return early with just franchise fee
  if (slugs.length === 0) {
    return NextResponse.json({
      franchise_fee: franchiseFee,
      total_paid: 0,
      total_due: 0,
      monthly_series: [],
    });
  }

  // 4. Get PropertyIds for these territories
  const { data: propRows } = await supabase.from("ms_properties").select(`"PropertyId"`).in("TerritorySlug", slugs);

  const propertyIds = (propRows ?? []).map((r: any) => r.PropertyId as number);

  if (propertyIds.length === 0) {
    return NextResponse.json({
      franchise_fee: franchiseFee,
      total_paid: 0,
      total_due: 0,
      monthly_series: [],
    });
  }

  // 5. Fetch royalty data for all properties
  // Also need sell dates to gate disposition royalty
  const [royaltyRes, inventoryRes] = await Promise.all([
    supabase
      .from("ms_property_royalty")
      .select(
        `
        "PropertyId",
        "AcquisitionRoyaltyPaid", "AcquisitionRoyaltyPaidDate",
        "Calculated_AcquisitionRoyaltyDue",
        "DispositionRoyaltyPaid", "DispositionRoyaltyPaidDate",
        "Calculated_DispositionRoyaltyDue",
        "DelayedRoyaltyFeePaid", "DelayedRoyaltyFeePaidDate",
        "Calculated_DelayedRoyaltyFeeDue"
      `
      )
      .in("PropertyId", propertyIds),
    supabase.from("ms_property_inventory").select(`"PropertyId", "Inv_SellDate"`).in("PropertyId", propertyIds),
  ]);

  const royaltyRows = (royaltyRes.data ?? []) as any[];
  const sellDates = new Map(((inventoryRes.data ?? []) as any[]).map((r) => [r.PropertyId, r.Inv_SellDate]));

  // 6. Compute totals + monthly series
  let totalPaid = 0;
  let totalDue = 0;
  const monthlyMap = new Map<string, number>();

  for (const row of royaltyRows) {
    // Acquisition royalty
    const acqPaid = Number(row.AcquisitionRoyaltyPaid) || 0;
    const acqDue = Number(row.Calculated_AcquisitionRoyaltyDue) || 0;
    totalPaid += acqPaid;
    if (acqDue > 0 && acqPaid === 0) totalDue += acqDue;
    if (acqPaid > 0 && row.AcquisitionRoyaltyPaidDate) {
      const month = String(row.AcquisitionRoyaltyPaidDate).substring(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + acqPaid);
    }

    // Disposition royalty — only count if property has sold
    const hasSold = !!sellDates.get(row.PropertyId);
    if (hasSold) {
      const dispPaid = Number(row.DispositionRoyaltyPaid) || 0;
      const dispDue = Number(row.Calculated_DispositionRoyaltyDue) || 0;
      totalPaid += dispPaid;
      if (dispDue > 0 && dispPaid === 0) totalDue += dispDue;
      if (dispPaid > 0 && row.DispositionRoyaltyPaidDate) {
        const month = String(row.DispositionRoyaltyPaidDate).substring(0, 7);
        monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + dispPaid);
      }
    }

    // Delayed royalty fee
    const delayPaid = Number(row.DelayedRoyaltyFeePaid) || 0;
    const delayDue = Number(row.Calculated_DelayedRoyaltyFeeDue) || 0;
    totalPaid += delayPaid;
    if (delayDue > 0 && delayPaid === 0) totalDue += delayDue;
    if (delayPaid > 0 && row.DelayedRoyaltyFeePaidDate) {
      const month = String(row.DelayedRoyaltyFeePaidDate).substring(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + delayPaid);
    }
  }

  // Sort monthly series chronologically
  const monthlySeries: MonthlyEntry[] = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, paid]) => ({ month, paid: Math.round(paid * 100) / 100 }));

  // Network median: median total revenue across all journeys with territory owners
  let networkMedian: number | null = null;
  try {
    const { data: allOwners } = await supabase
      .from("territory_owners")
      .select(`"TerritorySlug", contact_id`)
      .is("end_date", null);

    if (allOwners && allOwners.length > 0) {
      // Get franchise fees for all owner contacts
      const ownerContactIds = [...new Set((allOwners as any[]).map((o) => o.contact_id).filter(Boolean))];
      const { data: ownerContacts } = await supabase
        .from("contacts")
        .select("id, franchise_fee")
        .in("id", ownerContactIds);
      const feeMap = new Map((ownerContacts ?? []).map((c: any) => [c.id, Number(c.franchise_fee) || 0]));

      // Get all territory slugs for royalty lookup
      const allSlugs = [...new Set((allOwners as any[]).map((o: any) => o.TerritorySlug).filter(Boolean))];
      const { data: allProps } = await supabase
        .from("ms_properties")
        .select(`"PropertyId", "TerritorySlug"`)
        .in("TerritorySlug", allSlugs);

      const allPropIds = (allProps ?? []).map((p: any) => p.PropertyId as number);
      let royaltyBySlug = new Map<string, number>();

      if (allPropIds.length > 0) {
        // Batch royalty lookup
        const { data: allRoyalty } = await supabase
          .from("ms_property_royalty")
          .select(`"PropertyId", "AcquisitionRoyaltyPaid", "DispositionRoyaltyPaid", "DelayedRoyaltyFeePaid"`)
          .in("PropertyId", allPropIds);

        // Map PropertyId -> TerritorySlug
        const propToSlug = new Map((allProps ?? []).map((p: any) => [p.PropertyId, p.TerritorySlug]));

        for (const r of (allRoyalty ?? []) as any[]) {
          const slug = propToSlug.get(r.PropertyId);
          if (!slug) continue;
          const total =
            (Number(r.AcquisitionRoyaltyPaid) || 0) +
            (Number(r.DispositionRoyaltyPaid) || 0) +
            (Number(r.DelayedRoyaltyFeePaid) || 0);
          royaltyBySlug.set(slug, (royaltyBySlug.get(slug) ?? 0) + total);
        }
      }

      // Compute total revenue per contact (fee + royalty across their territories)
      const revenuePerContact: number[] = [];
      for (const contactId of ownerContactIds) {
        const fee = feeMap.get(contactId) ?? 0;
        const contactSlugs = (allOwners as any[])
          .filter((o) => o.contact_id === contactId)
          .map((o: any) => o.TerritorySlug);
        const royalty = contactSlugs.reduce((sum: number, s: string) => sum + (royaltyBySlug.get(s) ?? 0), 0);
        revenuePerContact.push(fee + royalty);
      }

      if (revenuePerContact.length > 0) {
        revenuePerContact.sort((a, b) => a - b);
        const mid = Math.floor(revenuePerContact.length / 2);
        networkMedian =
          revenuePerContact.length % 2 === 0
            ? (revenuePerContact[mid - 1] + revenuePerContact[mid]) / 2
            : revenuePerContact[mid];
        networkMedian = Math.round(networkMedian);
      }
    }
  } catch {
    // Non-critical — skip median if it fails
  }

  return NextResponse.json({
    franchise_fee: franchiseFee,
    total_paid: Math.round(totalPaid * 100) / 100,
    total_due: Math.round(totalDue * 100) / 100,
    monthly_series: monthlySeries,
    network_median: networkMedian,
    journey_start: journeyRes.data.created_at,
  });
}
