/**
 * GET /api/dashboard?period=7d|30d|90d|all
 *
 * Aggregates pipeline and lead source metrics from GHL for the leadership dashboard.
 * Only counts opportunities in NAH Franchise Sales pipelines — excludes old/other pipelines.
 * When a period is specified, filters opportunities by createdAt date.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import type { GHLOpportunity } from "@/types/ghl";

/** Returns an ISO date string for the start of the requested period */
function getPeriodStart(period: string): string | null {
  if (period === "all") return null;
  const now = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 0;
  if (days === 0) return null;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const period = request.nextUrl.searchParams.get("period") ?? "all";
    const periodStart = getPeriodStart(period);

    // Get NAH pipelines
    const allPipelines = await ghl.getPipelines();
    const nahPipelines = allPipelines.filter((p) => p.name.startsWith("NAH Franchise Sales"));

    // Fetch all opportunities across NAH pipelines (needed for date filtering + funnel)
    const allOpportunities: GHLOpportunity[] = [];
    for (const pipeline of nahPipelines) {
      try {
        const opps = await ghl.searchOpportunitiesPaginated({
          pipelineId: pipeline.id,
        });
        allOpportunities.push(...opps);
      } catch {
        // Continue if a pipeline fetch fails
      }
    }

    // Apply date filter if period is not "all"
    const filtered = periodStart
      ? allOpportunities.filter((o) => o.createdAt >= periodStart)
      : allOpportunities;

    // Count by status
    const statusCounts = { open: 0, won: 0, lost: 0 };
    for (const opp of filtered) {
      if (opp.status === "open") statusCounts.open++;
      else if (opp.status === "won") statusCounts.won++;
      else if (opp.status === "lost") statusCounts.lost++;
    }

    // Contact source counts (not date-filterable via GHL — always shows all time)
    const [paidAdCount, referralCount, organicCount, eventCount, unknownCount] = await Promise.all([
      ghl.countContactsByFilter([{ field: "source", operator: "eq", value: "Paid Ad" }]),
      ghl.countContactsByFilter([{ field: "source", operator: "eq", value: "Referral" }]),
      ghl.countContactsByFilter([{ field: "source", operator: "eq", value: "Organic" }]),
      ghl.countContactsByFilter([{ field: "source", operator: "eq", value: "Event" }]),
      ghl.countContactsByFilter([{ field: "source", operator: "eq", value: "Unknown" }]),
    ]);

    // Stage counts — use only open opportunities within the period
    const openFiltered = filtered.filter((o) => o.status === "open");
    const stageCounts: { pipelineName: string; stageName: string; count: number }[] = [];
    for (const pipeline of nahPipelines) {
      const pipelineOpps = openFiltered.filter((o) => o.pipelineId === pipeline.id);
      for (const stage of pipeline.stages) {
        const count = pipelineOpps.filter((o) => o.pipelineStageId === stage.id).length;
        stageCounts.push({
          pipelineName: pipeline.name.replace("NAH Franchise Sales - ", ""),
          stageName: stage.name.trim(),
          count,
        });
      }
    }

    // Calculate metrics
    const totalDeals = statusCounts.open + statusCounts.won + statusCounts.lost;
    const conversionRate = totalDeals > 0 ? Math.round((statusCounts.won / totalDeals) * 100) : 0;
    const totalContacts = paidAdCount + referralCount + organicCount + eventCount + unknownCount;

    return NextResponse.json({
      kpis: {
        activeLeads: statusCounts.open,
        won: statusCounts.won,
        lost: statusCounts.lost,
        conversionRate,
        totalContacts,
      },
      funnel: stageCounts,
      sources: [
        { name: "Paid Ad", count: paidAdCount, color: "#7C3AED" },
        { name: "Organic", count: organicCount, color: "#22C55E" },
        { name: "Referral", count: referralCount, color: "#F59E0B" },
        { name: "Event", count: eventCount, color: "#3B82F6" },
        { name: "Unknown", count: unknownCount, color: "#737373" },
      ],
      period,
    });
  } catch (err) {
    console.error("Dashboard fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 502 }
    );
  }
}
