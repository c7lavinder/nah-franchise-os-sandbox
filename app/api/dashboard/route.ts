export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard?period=week|month|quarter|year
 *
 * Aggregates pipeline and lead source metrics from Supabase.
 * Reads pipelines, contacts, and journey_pipeline_state — no GHL API calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getPipelinesFromSupabase } from "@/lib/pipelines/queries";

type DashboardPeriod = "week" | "month" | "quarter" | "year";

const VALID_PERIODS: ReadonlySet<string> = new Set<DashboardPeriod>(["week", "month", "quarter", "year"]);

const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

function getPeriodStart(period: DashboardPeriod): string {
  const now = new Date();
  now.setDate(now.getDate() - PERIOD_DAYS[period]);
  return now.toISOString();
}

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  try {
    const rawPeriod = request.nextUrl.searchParams.get("period") ?? "month";
    const period: DashboardPeriod = VALID_PERIODS.has(rawPeriod) ? (rawPeriod as DashboardPeriod) : "month";
    const periodStart = getPeriodStart(period);

    const supabase = createServerClient();

    // Pipelines + stages from Supabase
    const pipelines = await getPipelinesFromSupabase();
    const pipelineIds = pipelines.map((p) => p.id);

    // Journey pipeline state — replaces GHL opportunities
    const { data: jpsRows } = await supabase
      .from("journey_pipeline_state")
      .select("id, contact_id, pipeline_id, current_stage_id, entered_current_stage_at, is_active, created_at")
      .in("pipeline_id", pipelineIds);

    const allStates = jpsRows ?? [];
    const filtered = allStates.filter((s) => s.created_at >= periodStart);

    // Count by active status
    const activeCount = filtered.filter((s) => s.is_active).length;
    const completedCount = filtered.filter((s) => !s.is_active).length;

    // Contact source counts from Supabase
    const sourceCountQuery = async (source: string) => {
      const { count } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .or(`source.eq.${source},opportunity_source.eq.${source}`);
      return count ?? 0;
    };

    const [paidAdCount, referralCount, organicCount, eventCount, unknownCount] = await Promise.all([
      sourceCountQuery("Paid Ad"),
      sourceCountQuery("Referral"),
      sourceCountQuery("Organic"),
      sourceCountQuery("Event"),
      sourceCountQuery("Unknown"),
    ]);

    // Stage counts + average days in stage
    const now = Date.now();
    const activeFiltered = filtered.filter((s) => s.is_active);
    const stageCounts: { pipelineName: string; stageName: string; count: number; avgDays: number }[] = [];

    for (const pipeline of pipelines) {
      const pipelineStates = activeFiltered.filter((s) => s.pipeline_id === pipeline.id);
      for (const stage of pipeline.stages) {
        const stageStates = pipelineStates.filter((s) => s.current_stage_id === stage.id);
        const count = stageStates.length;

        let avgDays = 0;
        if (count > 0) {
          const totalDays = stageStates.reduce((sum, s) => {
            return sum + Math.floor((now - new Date(s.entered_current_stage_at).getTime()) / (1000 * 60 * 60 * 24));
          }, 0);
          avgDays = Math.round(totalDays / count);
        }

        stageCounts.push({
          pipelineName: pipeline.name,
          stageName: stage.name,
          count,
          avgDays,
        });
      }
    }

    const totalContacts = paidAdCount + referralCount + organicCount + eventCount + unknownCount;
    const totalDeals = activeCount + completedCount;
    const conversionRate = totalDeals > 0 ? Math.round((completedCount / totalDeals) * 100) : 0;

    return NextResponse.json({
      kpis: {
        activeLeads: activeCount,
        won: completedCount,
        lost: 0,
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
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 502 });
  }
}
