export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard?period=week|month|quarter|year
 *
 * Aggregates pipeline and lead source metrics from GHL for the leadership dashboard.
 * Only counts opportunities in NAH Franchise Sales pipelines — excludes old/other pipelines.
 * Filters opportunities by createdAt date based on the selected time period.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import type { GHLOpportunity } from "@/types/ghl";

type DashboardPeriod = "week" | "month" | "quarter" | "year";

const VALID_PERIODS: ReadonlySet<string> = new Set<DashboardPeriod>(["week", "month", "quarter", "year"]);

/** Maps a period to the number of days to look back */
const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

/** Returns an ISO date string for the start of the requested period */
function getPeriodStart(period: DashboardPeriod): string {
  const now = new Date();
  now.setDate(now.getDate() - PERIOD_DAYS[period]);
  return now.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const rawPeriod = request.nextUrl.searchParams.get("period") ?? "month";
    const period: DashboardPeriod = VALID_PERIODS.has(rawPeriod)
      ? (rawPeriod as DashboardPeriod)
      : "month";
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

    // Filter opportunities to the selected time period
    const filtered = allOpportunities.filter((o) => o.createdAt >= periodStart);

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

    // Stage counts + average days in stage
    const openFiltered = filtered.filter((o) => o.status === "open");
    const now = Date.now();
    const stageCounts: { pipelineName: string; stageName: string; count: number; avgDays: number }[] = [];
    for (const pipeline of nahPipelines) {
      const pipelineOpps = openFiltered.filter((o) => o.pipelineId === pipeline.id);
      for (const stage of pipeline.stages) {
        const stageOpps = pipelineOpps.filter((o) => o.pipelineStageId === stage.id);
        const count = stageOpps.length;

        // Calculate average days in current stage from updatedAt
        let avgDays = 0;
        if (count > 0) {
          const totalDays = stageOpps.reduce((sum, o) => {
            return sum + Math.floor((now - new Date(o.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
          }, 0);
          avgDays = Math.round(totalDays / count);
        }

        stageCounts.push({
          pipelineName: pipeline.name.replace("NAH Franchise Sales - ", ""),
          stageName: stage.name.trim(),
          count,
          avgDays,
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
