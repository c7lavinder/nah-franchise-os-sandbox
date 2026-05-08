export const dynamic = "force-dynamic";

/**
 * GET /api/metrics/conversion-funnel?pipeline=sales&period=month
 *
 * Returns stage-to-stage conversion rates for a pipeline.
 * Calculates how many contacts entered each stage vs how many advanced
 * to the next stage. Includes avg days per stage and drop-off rate.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

type Period = "week" | "month" | "quarter" | "year" | "all";

const PERIOD_DAYS: Record<Period, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
  all: 3650,
};

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const pipelineSlug = request.nextUrl.searchParams.get("pipeline") ?? "sales";
  const rawPeriod = request.nextUrl.searchParams.get("period") ?? "quarter";
  const period = (Object.keys(PERIOD_DAYS).includes(rawPeriod) ? rawPeriod : "quarter") as Period;
  const periodStart = new Date(Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createServerClient();

  // Get pipeline + stages
  const { data: pipeline } = await supabase.from("pipelines").select("id, name").eq("slug", pipelineSlug).single();

  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
  }

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, name, sort_order, is_terminal")
    .eq("pipeline_id", pipeline.id)
    .order("sort_order", { ascending: true });

  if (!stages || stages.length === 0) {
    return NextResponse.json({ funnel: [], pipeline: pipeline.name });
  }

  // Get all stage history entries in the period
  const { data: historyRows } = await supabase
    .from("pipeline_stage_history")
    .select("from_stage_id, to_stage_id, created_at")
    .gte("created_at", periodStart);

  const history = historyRows ?? [];

  // Also get current active states (people currently in each stage)
  const { data: activeStates } = await supabase
    .from("journey_pipeline_state")
    .select("current_stage_id, entered_current_stage_at")
    .eq("pipeline_id", pipeline.id)
    .eq("is_active", true);

  const active = activeStates ?? [];
  const now = Date.now();

  // Build funnel data
  const funnel = stages.map((stage, idx) => {
    // Count how many ever entered this stage (either currently there or moved past it)
    const currentlyHere = active.filter((a) => a.current_stage_id === stage.id).length;
    const movedPast = history.filter((h) => h.from_stage_id === stage.id).length;
    const entered = currentlyHere + movedPast;

    // Count how many advanced to the NEXT stage
    const nextStage = idx < stages.length - 1 ? stages[idx + 1] : null;
    const advanced = nextStage
      ? history.filter((h) => h.from_stage_id === stage.id && h.to_stage_id === nextStage.id).length
      : 0;

    // Avg days in this stage (from active states currently here)
    const daysInStage = active
      .filter((a) => a.current_stage_id === stage.id)
      .map((a) => Math.floor((now - new Date(a.entered_current_stage_at).getTime()) / (1000 * 60 * 60 * 24)));
    const avgDays =
      daysInStage.length > 0 ? Math.round(daysInStage.reduce((a, b) => a + b, 0) / daysInStage.length) : 0;

    const conversionRate = entered > 0 ? Math.round((advanced / entered) * 100) : 0;
    const dropOffRate = entered > 0 ? Math.round(((entered - advanced - currentlyHere) / entered) * 100) : 0;

    return {
      stageName: stage.name,
      stageId: stage.id,
      isTerminal: stage.is_terminal,
      entered,
      currentlyActive: currentlyHere,
      advanced,
      conversionRate,
      dropOffRate: Math.max(dropOffRate, 0),
      avgDaysInStage: avgDays,
    };
  });

  return NextResponse.json({
    pipeline: pipeline.name,
    period,
    funnel,
    totalEntered: funnel[0]?.entered ?? 0,
    totalCompleted: funnel[funnel.length - 1]?.currentlyActive ?? 0,
    overallConversion:
      funnel[0]?.entered > 0
        ? Math.round(((funnel[funnel.length - 1]?.currentlyActive ?? 0) / funnel[0].entered) * 100)
        : 0,
  });
}
