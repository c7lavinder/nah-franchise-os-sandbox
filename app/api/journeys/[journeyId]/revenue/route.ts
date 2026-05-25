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
    supabase.from("journeys").select("primary_contact_id").eq("id", journeyId).single(),
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
  const slugs = [...new Set(((jpsRes.data ?? []) as any[]).map((r) => r.TerritorySlug).filter(Boolean) as string[])];

  // 2. Franchise fee from contacts table
  const { data: contact } = await supabase.from("contacts").select("franchise_fee").eq("id", primaryContactId).single();

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

  return NextResponse.json({
    franchise_fee: franchiseFee,
    total_paid: Math.round(totalPaid * 100) / 100,
    total_due: Math.round(totalDue * 100) / 100,
    monthly_series: monthlySeries,
  });
}
