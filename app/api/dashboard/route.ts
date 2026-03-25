/**
 * GET /api/dashboard
 *
 * Aggregates pipeline and lead source metrics from GHL for the leadership dashboard.
 * Only counts opportunities in NAH Franchise Sales pipelines — excludes old/other pipelines.
 */

import { NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";

export async function GET() {
  try {
    // First get pipelines to find NAH pipeline IDs
    const allPipelines = await ghl.getPipelines();
    const nahPipelines = allPipelines.filter((p) => p.name.startsWith("NAH Franchise Sales"));
    const nahPipelineIds = nahPipelines.map((p) => p.id);

    // Count opportunities per status, filtered to NAH pipelines only
    const statusCounts = { open: 0, won: 0, lost: 0 };
    for (const pipelineId of nahPipelineIds) {
      const [open, won, lost] = await Promise.all([
        ghl.countOpportunitiesByStatus("open", pipelineId),
        ghl.countOpportunitiesByStatus("won", pipelineId),
        ghl.countOpportunitiesByStatus("lost", pipelineId),
      ]);
      statusCounts.open += open;
      statusCounts.won += won;
      statusCounts.lost += lost;
    }

    // Contact source counts (in parallel)
    const [paidAdCount, referralCount, organicCount, eventCount, unknownCount] = await Promise.all([
      ghl.countContactsByFilter([{ field: "source", operator: "eq", value: "Paid Ad" }]),
      ghl.countContactsByFilter([{ field: "source", operator: "eq", value: "Referral" }]),
      ghl.countContactsByFilter([{ field: "source", operator: "eq", value: "Organic" }]),
      ghl.countContactsByFilter([{ field: "source", operator: "eq", value: "Event" }]),
      ghl.countContactsByFilter([{ field: "source", operator: "eq", value: "Unknown" }]),
    ]);

    // Stage counts for NAH pipelines
    const stageCounts: { pipelineName: string; stageName: string; count: number }[] = [];
    for (const pipeline of nahPipelines) {
      let opportunities: { pipelineStageId: string }[] = [];
      try {
        opportunities = await ghl.searchOpportunitiesPaginated({
          pipelineId: pipeline.id,
          status: "open",
        });
      } catch {
        // Continue with empty if fetch fails
      }

      for (const stage of pipeline.stages) {
        const count = opportunities.filter((o) => o.pipelineStageId === stage.id).length;
        stageCounts.push({
          pipelineName: pipeline.name.replace("NAH Franchise Sales - ", ""),
          stageName: stage.name.trim(),
          count,
        });
      }
    }

    // Calculate metrics — NAH pipelines only
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
    });
  } catch (err) {
    console.error("Dashboard fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 502 }
    );
  }
}
