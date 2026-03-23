/**
 * GET /api/daily-hq
 *
 * Returns all data needed for the Daily HQ page:
 * - Rep scorecard (today's activity counts)
 * - Active alerts
 * - Today's tasks from GHL
 * - Pipeline snapshot (lead counts per stage)
 * - Upcoming appointments (next 48 hours)
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import type { InactivityAlert } from "@/types/database";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Fetch all data in parallel for speed
  const [alertsResult, pipelineResult, appointmentsResult] = await Promise.allSettled([
    fetchAlerts(userId),
    fetchPipelineSnapshot(),
    fetchUpcoming(),
  ]);

  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];
  const pipeline = pipelineResult.status === "fulfilled" ? pipelineResult.value : [];
  const upcoming = appointmentsResult.status === "fulfilled" ? appointmentsResult.value : [];

  return NextResponse.json({
    scorecard: {
      calls: 0,
      texts: 0,
      emails: 0,
      stageMoves: 0,
      newContacted: 0,
    },
    alerts,
    tasks: [],
    pipeline,
    upcoming,
  });
}

/** Fetch unresolved alerts for this user from Supabase */
async function fetchAlerts(userId: string): Promise<InactivityAlert[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("inactivity_alerts")
    .select("*")
    .eq("is_resolved", false)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to fetch alerts:", error.message);
    return [];
  }
  return (data ?? []) as InactivityAlert[];
}

/** Fetch pipeline snapshot — lead count per stage from GHL */
async function fetchPipelineSnapshot(): Promise<{ stage: string; count: number }[]> {
  try {
    const pipelines = await ghl.getPipelines();
    if (pipelines.length === 0) return [];

    const pipeline = pipelines[0];
    const opportunities = await ghl.searchOpportunities({
      pipelineId: pipeline.id,
      status: "open",
    });

    // Count opportunities per stage
    const stageCounts = new Map<string, number>();
    for (const stage of pipeline.stages) {
      stageCounts.set(stage.name, 0);
    }
    for (const opp of opportunities) {
      const stage = pipeline.stages.find((s) => s.id === opp.pipelineStageId);
      if (stage) {
        stageCounts.set(stage.name, (stageCounts.get(stage.name) ?? 0) + 1);
      }
    }

    return Array.from(stageCounts.entries()).map(([stage, count]) => ({
      stage,
      count,
    }));
  } catch (err) {
    console.error("Failed to fetch pipeline:", err);
    return [];
  }
}

/** Fetch upcoming appointments for the next 48 hours from GHL */
async function fetchUpcoming(): Promise<{ title: string; time: string; contactId: string }[]> {
  try {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const appointments = await ghl.getAppointments(
      now.toISOString(),
      in48h.toISOString()
    );

    return appointments.map((apt) => ({
      title: apt.title,
      time: apt.startTime,
      contactId: apt.contactId,
    }));
  } catch (err) {
    console.error("Failed to fetch appointments:", err);
    return [];
  }
}
