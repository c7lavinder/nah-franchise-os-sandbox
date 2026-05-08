export const dynamic = "force-dynamic";

/**
 * GET /api/metrics/rep-leaderboard?period=week|month|quarter|year
 *
 * Returns per-rep performance metrics for leadership visibility:
 *   - Active leads count
 *   - Stages advanced (period)
 *   - Calls graded + average grade
 *   - Scout actions taken (period)
 *   - Stalled leads (7+ days no progress)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

type Period = "week" | "month" | "quarter" | "year";

const PERIOD_DAYS: Record<Period, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

interface RepMetrics {
  userId: string;
  userName: string;
  role: string;
  activeLeads: number;
  stagesAdvanced: number;
  callsGraded: number;
  avgGradeScore: number;
  avgGradeLetter: string;
  scoutActions: number;
  stalledLeads: number;
}

function gradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B+";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const rawPeriod = request.nextUrl.searchParams.get("period") ?? "month";
  const period = (["week", "month", "quarter", "year"].includes(rawPeriod) ? rawPeriod : "month") as Period;
  const periodStart = new Date(Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createServerClient();

  // Get active users (operators and reps who actually work leads)
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("is_active", true)
    .eq("is_real_user", true)
    .in("role", ["admin", "operator", "rep", "specialist"]);

  if (!users || users.length === 0) {
    return NextResponse.json({ leaderboard: [], period });
  }

  const userIds = users.map((u) => u.id);

  // Parallel queries for all metrics
  const [activeLeadsResult, stalledResult, stageAdvancesResult, callGradesResult, scoutActionsResult] =
    await Promise.all([
      // Active leads per user
      supabase
        .from("journey_pipeline_state")
        .select("assigned_user_id")
        .eq("is_active", true)
        .in("assigned_user_id", userIds),

      // Stalled leads per user (7+ days in current stage)
      supabase
        .from("journey_pipeline_state")
        .select("assigned_user_id")
        .eq("is_active", true)
        .in("assigned_user_id", userIds)
        .lt("entered_current_stage_at", sevenDaysAgo),

      // Stage advances per user in period
      supabase
        .from("pipeline_stage_history")
        .select("moved_by_user_id")
        .in("moved_by_user_id", userIds)
        .gte("created_at", periodStart)
        .eq("was_revert", false),

      // Call grades in period (join calls → call_grades)
      supabase
        .from("call_grades")
        .select("overall_score, calls!inner(hosted_by_user_id)")
        .gte("created_at", periodStart),

      // Scout actions per user in period
      supabase
        .from("scout_action_logs")
        .select("user_id")
        .in("user_id", userIds)
        .eq("action_status", "executed")
        .gte("created_at", periodStart),
    ]);

  // Aggregate per user
  const metricsMap = new Map<string, RepMetrics>();

  for (const u of users) {
    metricsMap.set(u.id, {
      userId: u.id,
      userName: u.full_name,
      role: u.role,
      activeLeads: 0,
      stagesAdvanced: 0,
      callsGraded: 0,
      avgGradeScore: 0,
      avgGradeLetter: "-",
      scoutActions: 0,
      stalledLeads: 0,
    });
  }

  // Active leads
  for (const row of activeLeadsResult.data ?? []) {
    const m = metricsMap.get(row.assigned_user_id);
    if (m) m.activeLeads++;
  }

  // Stalled leads
  for (const row of stalledResult.data ?? []) {
    const m = metricsMap.get(row.assigned_user_id);
    if (m) m.stalledLeads++;
  }

  // Stage advances
  for (const row of stageAdvancesResult.data ?? []) {
    const m = metricsMap.get(row.moved_by_user_id);
    if (m) m.stagesAdvanced++;
  }

  // Call grades
  const gradesByUser = new Map<string, number[]>();
  for (const row of callGradesResult.data ?? []) {
    const hostId = (row.calls as unknown as { hosted_by_user_id: string | null })?.hosted_by_user_id;
    if (!hostId) continue;
    const existing = gradesByUser.get(hostId) ?? [];
    existing.push(row.overall_score ?? 0);
    gradesByUser.set(hostId, existing);
  }
  for (const [userId, scores] of gradesByUser) {
    const m = metricsMap.get(userId);
    if (m && scores.length > 0) {
      m.callsGraded = scores.length;
      m.avgGradeScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      m.avgGradeLetter = gradeFromScore(m.avgGradeScore);
    }
  }

  // Scout actions
  for (const row of scoutActionsResult.data ?? []) {
    const m = metricsMap.get(row.user_id);
    if (m) m.scoutActions++;
  }

  // Sort by active leads desc, then stages advanced desc
  const leaderboard = Array.from(metricsMap.values())
    .filter((m) => m.activeLeads > 0 || m.stagesAdvanced > 0 || m.callsGraded > 0)
    .sort((a, b) => {
      if (b.stagesAdvanced !== a.stagesAdvanced) return b.stagesAdvanced - a.stagesAdvanced;
      return b.activeLeads - a.activeLeads;
    });

  return NextResponse.json({ leaderboard, period });
}
