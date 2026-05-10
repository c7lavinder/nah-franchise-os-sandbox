export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/territories/:TerritorySlug/debug-performance
 *
 * Diagnostic endpoint — returns raw data from ms_properties + ms_property_inventory
 * so we can verify what's stored vs what's expected.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { TerritorySlug } = await params;
  const supabase = createServerClient();

  // 1. All properties for this territory (with archive status)
  const { data: allProperties, error: propError } = await supabase
    .from("ms_properties")
    .select("PropertyId, Status, Archived, Inserted, Address1, City, State")
    .eq("TerritorySlug", TerritorySlug)
    .order("PropertyId");

  // 2. All inventory rows for these properties
  const propertyIds = (allProperties ?? []).map((p) => p.PropertyId);
  const { data: allInventory, error: invError } =
    propertyIds.length > 0
      ? await supabase
          .from("ms_property_inventory")
          .select("PropertyId, Inv_PurchaseDate, Inv_SellDate, Inv_Status")
          .in("PropertyId", propertyIds)
      : { data: [], error: null };

  // 3. Build a joined view for easy diagnosis
  type InvRow = {
    PropertyId: number;
    Inv_PurchaseDate: string | null;
    Inv_SellDate: string | null;
    Inv_Status: string | null;
  };
  const invMap = new Map<number, InvRow>();
  for (const inv of (allInventory ?? []) as InvRow[]) {
    invMap.set(inv.PropertyId, inv);
  }

  const ytdStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

  const propertyDetails = (allProperties ?? []).map((p) => {
    const inv = invMap.get(p.PropertyId);
    return {
      PropertyId: p.PropertyId,
      Address: p.Address1,
      City: p.City,
      Status: p.Status,
      Archived: p.Archived,
      Inserted: p.Inserted,
      Inv_PurchaseDate: inv?.Inv_PurchaseDate ?? null,
      Inv_SellDate: inv?.Inv_SellDate ?? null,
      Inv_Status: inv?.Inv_Status ?? null,
      hasInventoryRow: !!inv,
      purchasedYTD: inv?.Inv_PurchaseDate && new Date(inv.Inv_PurchaseDate) >= new Date(ytdStart),
      soldYTD: inv?.Inv_SellDate && new Date(inv.Inv_SellDate) >= new Date(ytdStart),
      activeInventory: inv?.Inv_PurchaseDate && !inv?.Inv_SellDate,
    };
  });

  // Summary counts
  const nonArchived = propertyDetails.filter((p) => !p.Archived);
  const withPurchaseDate = nonArchived.filter((p) => p.Inv_PurchaseDate);
  const purchasedYTD = withPurchaseDate.filter((p) => p.purchasedYTD);
  const soldYTD = nonArchived.filter((p) => p.soldYTD);
  const activeInventory = withPurchaseDate.filter((p) => p.activeInventory);

  return NextResponse.json({
    territory: TerritorySlug,
    summary: {
      totalProperties: allProperties?.length ?? 0,
      nonArchived: nonArchived.length,
      withInventoryRow: propertyDetails.filter((p) => p.hasInventoryRow).length,
      withPurchaseDate: withPurchaseDate.length,
      purchasedYTD: purchasedYTD.length,
      soldYTD: soldYTD.length,
      activeInventory: activeInventory.length,
      ytdStart,
    },
    purchasedYTDProperties: purchasedYTD.map((p) => ({
      Address: p.Address,
      PurchaseDate: p.Inv_PurchaseDate,
      Status: p.Status,
    })),
    soldYTDProperties: soldYTD.map((p) => ({
      Address: p.Address,
      SellDate: p.Inv_SellDate,
      Status: p.Status,
    })),
    activeInventoryProperties: activeInventory.map((p) => ({
      Address: p.Address,
      PurchaseDate: p.Inv_PurchaseDate,
      Status: p.Status,
    })),
    // Show all properties with any inventory data for full picture
    allWithInventory: propertyDetails
      .filter((p) => p.hasInventoryRow && !p.Archived)
      .map((p) => ({
        PropertyId: p.PropertyId,
        Address: p.Address,
        Status: p.Status,
        Inv_PurchaseDate: p.Inv_PurchaseDate,
        Inv_SellDate: p.Inv_SellDate,
        Inv_Status: p.Inv_Status,
      })),
    errors: {
      properties: propError?.message ?? null,
      inventory: invError?.message ?? null,
    },
  });
}
