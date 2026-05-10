export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { queryMS } from "@/lib/mastersuite/client";

/**
 * GET /api/territories/:TerritorySlug/quarterly-grades
 *
 * Reads quarterly scorecard KPIs directly from MasterSuite's TerritoryScorecardKPIs table.
 * Returns the most recent quarters of performance data.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { TerritorySlug } = await params;

  try {
    const rows = await queryMS(
      `SELECT * FROM TerritoryScorecardKPIs
       WHERE TerritorySlug = ? AND Type = 'Quarterly'
       ORDER BY Scope DESC
       LIMIT 12`,
      [TerritorySlug]
    );

    return NextResponse.json({ grades: rows });
  } catch (err) {
    // MasterSuite connection may not be available in all environments
    console.error("Quarterly grades query failed:", err);
    return NextResponse.json({ grades: [] });
  }
}
