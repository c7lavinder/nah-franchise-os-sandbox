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
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { getWorkQueueItems, syncWorkQueueSources } from "@/lib/work-queue/sources";
import type { GHLAppointment } from "@/types/ghl";
import type { InactivityAlert } from "@/types/database";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  // Admin "view as" pattern: admins can pass ?targetUserId=X to see another
  // user's daily HQ. Non-admins always see their own data (param is ignored).
  const targetParam = request.nextUrl.searchParams.get("targetUserId");
  const userId = user.role === "admin" && targetParam ? targetParam : user.id;

  // Look up the user's GHL user ID once for all fetchers that need it
  const supabase = createServerClient();
  const { data: appUser } = await supabase.from("users").select("ghl_user_id").eq("id", userId).single();
  const ghlUserId = appUser?.ghl_user_id ?? null;

  // Fetch all data in parallel for speed
  const [
    alertsResult,
    pipelineResult,
    appointmentsResult,
    scorecardResult,
    tasksResult,
    workQueueResult,
  ] = await Promise.allSettled([
    fetchAlerts(userId),
    fetchPipelineSnapshot(userId),
    fetchUpcoming(ghlUserId),
    fetchScorecard(userId, ghlUserId),
    fetchTasks(ghlUserId),
    fetchWorkQueue(userId),
  ]);

  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];
  const pipeline = pipelineResult.status === "fulfilled" ? pipelineResult.value : [];
  const upcoming = appointmentsResult.status === "fulfilled" ? appointmentsResult.value : [];
  const scorecard =
    scorecardResult.status === "fulfilled"
      ? scorecardResult.value
      : { calls: 0, texts: 0, emails: 0, stageMoves: 0, newContacted: 0 };
  const tasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
  const workQueue = workQueueResult.status === "fulfilled" ? workQueueResult.value : [];

  return NextResponse.json({
    scorecard,
    alerts,
    tasks,
    pipeline,
    upcoming,
    workQueue,
  });
}

/** Sync and fetch normalized Work Queue items for the Daily HQ right rail. */
async function fetchWorkQueue(userId: string) {
  try {
    await syncWorkQueueSources({ assignedUserId: userId });
    return getWorkQueueItems({ assignedUserId: userId, limit: 20 });
  } catch (err) {
    console.error("Failed to fetch work queue:", err instanceof Error ? err.message : err);
    return [];
  }
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

/** Fetch pipeline snapshot — lead count per stage from Supabase (source of truth) */
async function fetchPipelineSnapshot(userId: string): Promise<{ stage: string; count: number; pipeline: string }[]> {
  try {
    const supabase = createServerClient();

    // Get active journey_pipeline_state rows with stage names
    // For non-admin users, filter to their assigned contacts
    const query = supabase
      .from("journey_pipeline_state")
      .select("pipeline_id, current_stage_id, pipelines!inner(name, slug), pipeline_stages!inner(name)")
      .eq("is_active", true);

    const { data: appUser } = await supabase.from("users").select("role").eq("id", userId).single();

    // Admins see all; non-admins see only their assigned pipeline states
    if (appUser?.role !== "admin") {
      query.eq("assigned_user_id", userId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch pipeline snapshot:", error.message);
      return [];
    }

    // Count per pipeline + stage
    const counts = new Map<string, { stage: string; count: number; pipeline: string }>();
    for (const row of data ?? []) {
      const pipelineName = (row as any).pipelines?.name ?? "Unknown";
      const stageName = (row as any).pipeline_stages?.name ?? "Unknown";
      const key = `${pipelineName}:${stageName}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, { stage: stageName, count: 1, pipeline: pipelineName });
      }
    }

    return Array.from(counts.values());
  } catch (err) {
    console.error("Failed to fetch pipeline:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Fetch upcoming appointments for the next 48 hours from GHL, filtered to this user */
async function fetchUpcoming(ghlUserId: string | null): Promise<GHLAppointment[]> {
  try {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // If user has a GHL ID, fetch only their appointments; otherwise fetch all (admin fallback)
    return ghlUserId
      ? await ghl.getAppointments(now.toISOString(), in48h.toISOString(), { userId: ghlUserId })
      : await ghl.getAllAppointments(now.toISOString(), in48h.toISOString());
  } catch (err) {
    console.error("Failed to fetch appointments:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Fetch today's activity counts for the scorecard */
async function fetchScorecard(
  userId: string,
  _ghlUserId: string | null
): Promise<{
  calls: number;
  texts: number;
  emails: number;
  stageMoves: number;
  newContacted: number;
}> {
  try {
    const supabase = createServerClient();
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

    // Count contacts that entered the sales pipeline today (from Supabase, not GHL)
    const { count } = await supabase
      .from("journey_pipeline_state")
      .select("id", { count: "exact", head: true })
      .eq("assigned_user_id", userId)
      .eq("is_active", true)
      .gte("entered_pipeline_at", todayISO);

    return { calls, texts, emails, stageMoves, newContacted: count ?? 0 };
  } catch (err) {
    console.error("Failed to fetch scorecard:", err instanceof Error ? err.message : err);
    return { calls: 0, texts: 0, emails: 0, stageMoves: 0, newContacted: 0 };
  }
}

/**
 * Open tasks assigned to the current user via the org-wide task search.
 * Replaces the old per-contact loop, which silently capped at the first
 * 10 contacts of a user's opportunities and missed everything else.
 */
async function fetchTasks(ghlUserId: string | null): Promise<
  {
    id: string;
    title: string;
    body: string | null;
    dueDate: string;
    assignedTo: string | null;
    contactId: string;
    contactName: string | null;
    completed: boolean;
  }[]
> {
  try {
    if (!ghlUserId) return [];

    const tasks = await ghl.searchTasks({
      assignedTo: [ghlUserId],
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
    console.error("Failed to fetch tasks:", err instanceof Error ? err.message : err);
    return [];
  }
}
