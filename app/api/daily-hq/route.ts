export const dynamic = "force-dynamic";

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
  const [alertsResult, pipelineResult, appointmentsResult, scorecardResult, tasksResult] =
    await Promise.allSettled([
      fetchAlerts(userId),
      fetchPipelineSnapshot(),
      fetchUpcoming(),
      fetchScorecard(userId),
      fetchTasks(userId),
    ]);

  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];
  const pipeline = pipelineResult.status === "fulfilled" ? pipelineResult.value : [];
  const upcoming = appointmentsResult.status === "fulfilled" ? appointmentsResult.value : [];
  const scorecard = scorecardResult.status === "fulfilled"
    ? scorecardResult.value
    : { calls: 0, texts: 0, emails: 0, stageMoves: 0, newContacted: 0 };
  const tasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];

  return NextResponse.json({
    scorecard,
    alerts,
    tasks,
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

    const appointments = await ghl.getAllAppointments(
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

/** Fetch today's activity counts from GHL for the scorecard */
async function fetchScorecard(userId: string): Promise<{
  calls: number;
  texts: number;
  emails: number;
  stageMoves: number;
  newContacted: number;
}> {
  try {
    // Get the user's GHL user ID for filtering
    const supabase = createServerClient();
    const { data: appUser } = await supabase
      .from("users")
      .select("ghl_user_id")
      .eq("id", userId)
      .single();

    const ghlUserId = appUser?.ghl_user_id;

    // Search all contacts to count today's activity
    // GHL doesn't have a dedicated "activity" endpoint, so we count from
    // opportunities updated today and scout_action_logs
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Count actions from our own logs (most reliable source)
    const { data: todayActions } = await supabase
      .from("scout_action_logs")
      .select("action_type")
      .eq("user_id", userId)
      .eq("action_status", "executed")
      .gte("created_at", todayISO);

    const actions = todayActions ?? [];

    let texts = 0;
    let emails = 0;
    let stageMoves = 0;
    let calls = 0;

    for (const action of actions) {
      switch (action.action_type) {
        case "message":
          texts++;
          break;
        case "email":
          emails++;
          break;
        case "stage_move":
          stageMoves++;
          break;
        case "task":
          calls++;
          break;
      }
    }

    // Count contacts first contacted today
    let newContacted = 0;
    if (ghlUserId) {
      const opportunities = await ghl.searchOpportunities({
        assignedTo: ghlUserId,
        status: "open",
      });
      newContacted = opportunities.filter((opp) => {
        const created = new Date(opp.createdAt);
        return created >= today;
      }).length;
    }

    return { calls, texts, emails, stageMoves, newContacted };
  } catch (err) {
    console.error("Failed to fetch scorecard:", err);
    return { calls: 0, texts: 0, emails: 0, stageMoves: 0, newContacted: 0 };
  }
}

/**
 * Open tasks assigned to the current user via the org-wide task search.
 * Replaces the old per-contact loop, which silently capped at the first
 * 10 contacts of a user's opportunities and missed everything else.
 */
async function fetchTasks(userId: string): Promise<{
  id: string;
  title: string;
  body: string | null;
  dueDate: string;
  assignedTo: string | null;
  contactId: string;
  contactName: string | null;
  completed: boolean;
}[]> {
  try {
    const supabase = createServerClient();
    const { data: appUser } = await supabase
      .from("users")
      .select("ghl_user_id")
      .eq("id", userId)
      .single();

    if (!appUser?.ghl_user_id) return [];

    const tasks = await ghl.searchTasks({
      assignedTo: [appUser.ghl_user_id],
      completed: false,
      limit: 100,
    });

    return tasks
      .map((t) => ({
        id: t.id,
        title: t.title,
        body: t.body,
        dueDate: t.dueDate,
        assignedTo: t.assignedTo,
        contactId: t.contactId,
        contactName: t.contactName,
        completed: t.completed,
      }))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 20);
  } catch (err) {
    console.error("Failed to fetch tasks:", err);
    return [];
  }
}
