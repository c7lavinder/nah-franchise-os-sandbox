/**
 * Scorecard data fetchers for Daily HQ, Calls, and Pipeline pages.
 *
 * Week = Monday 00:00 through Sunday 23:59 of CURRENT calendar week.
 */

import { createServerClient } from "@/lib/supabase/server";

export function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

// ─────────────────────────────────────────────
// DAILY HQ SCORECARDS
// ─────────────────────────────────────────────

export async function getDailyHQScorecard() {
  const supabase = createServerClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // New Prospects: contacts that entered the Sales pipeline in last 30 days
  const { count: newProspectCount } = await supabase
    .from("contact_pipeline_state")
    .select("id", { count: "exact", head: true })
    .eq("pipeline_id", "a0000000-0000-0000-0000-000000000001") // Sales pipeline
    .gte("entered_pipeline_at", thirtyDaysAgo);

  // Active Franchisees
  const { count: activeFranchisees } = await supabase
    .from("territories")
    .select("ms_slug", { count: "exact", head: true })
    .eq("status", "active");

  // High Performers: territories with 10+ houses in trailing 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const { data: grades } = await supabase
    .from("territory_grades")
    .select("ms_slug, houses_purchased")
    .gte("year", currentYear - 1);

  const housesByTerritory: Record<string, number> = {};
  for (const g of grades ?? []) {
    housesByTerritory[g.ms_slug] = (housesByTerritory[g.ms_slug] ?? 0) + (g.houses_purchased ?? 0);
  }
  const highPerformers = Object.values(housesByTerritory).filter((h) => h >= 10).length;

  return {
    newProspects: { value: newProspectCount ?? 0, label: "New Prospects", sub: "last 30 days" },
    activeFranchisees: { value: activeFranchisees ?? 0, goal: 250, label: "Active Franchisees", sub: "of 250 goal" },
    highPerformers: { value: highPerformers, goal: 100, label: "High Performers", sub: "10+ houses last 12 months" },
  };
}

// ─────────────────────────────────────────────
// CALLS PAGE SCORECARDS
// ─────────────────────────────────────────────

const CALL_SUB_TASK_SLUGS = [
  "intro_call", "intro-call",
  "matt_call", "matt-call",
  "sam_call", "sam-call",
  "mark_call", "mark-call",
  "fdd_review_call", "fdd-review-call",
  "territory_call", "territory-call",
  "matt_final_call", "matt-final-call",
];

export async function getCallsScorecard() {
  const supabase = createServerClient();
  const { start, end } = getWeekBounds();

  // Get call-type sub-task IDs
  const { data: callSubTasks } = await supabase
    .from("pipeline_sub_tasks")
    .select("id, slug")
    .in("slug", CALL_SUB_TASK_SLUGS);

  const callSubTaskIds = (callSubTasks ?? []).map((s) => s.id);

  // Calls completed this week (second state = completed)
  const { count: callsCompleted } = await supabase
    .from("contact_sub_task_logs")
    .select("id", { count: "exact", head: true })
    .in("sub_task_id", callSubTaskIds.length > 0 ? callSubTaskIds : ["__none__"])
    .eq("content_type", "second_state")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .is("deleted_at", null);

  // Calls scheduled this week (first state = scheduled)
  const { count: callsScheduled } = await supabase
    .from("contact_sub_task_logs")
    .select("id", { count: "exact", head: true })
    .in("sub_task_id", callSubTaskIds.length > 0 ? callSubTaskIds : ["__none__"])
    .eq("content_type", "first_state")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .is("deleted_at", null);

  // Avg call score this week
  const { data: grades } = await supabase
    .from("call_review_packages")
    .select("grade")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .not("grade", "is", null);

  let avgScore: string | null = null;
  if (grades && grades.length > 0) {
    const gradeMap: Record<string, number> = { A: 95, B: 85, C: 75, D: 65, F: 50 };
    const total = grades.reduce((s, g) => s + (gradeMap[g.grade] ?? 0), 0);
    const avg = Math.round(total / grades.length);
    // Convert back to letter
    if (avg >= 90) avgScore = "A";
    else if (avg >= 80) avgScore = "B";
    else if (avg >= 70) avgScore = "C";
    else if (avg >= 60) avgScore = "D";
    else avgScore = "F";
  }

  return {
    callsCompleted: { value: callsCompleted ?? 0, label: "Calls This Week", sub: "completed" },
    callsScheduled: { value: callsScheduled ?? 0, label: "Calls Scheduled", sub: "this week" },
    avgCallScore: { value: avgScore ?? "—", label: "Avg Call Score", sub: "this week" },
  };
}

// ─────────────────────────────────────────────
// PIPELINE PAGE SCORECARDS
// ─────────────────────────────────────────────

export async function getPipelineScorecard() {
  const supabase = createServerClient();

  // Look up pipeline IDs by slug (no ambiguous join needed)
  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, slug")
    .in("slug", ["sales", "onboarding", "runway"]);

  const pipelineIdBySlug = new Map<string, string>();
  for (const p of pipelines ?? []) pipelineIdBySlug.set(p.slug, p.id);

  // Get all non-terminal stages for each pipeline
  const { data: allStages } = await supabase
    .from("pipeline_stages")
    .select("id, slug, pipeline_id, is_terminal")
    .eq("is_terminal", false);

  function stageIdsFor(pipelineSlug: string): string[] {
    const pid = pipelineIdBySlug.get(pipelineSlug);
    if (!pid) return ["__none__"];
    const ids = (allStages ?? [])
      .filter((s) => s.pipeline_id === pid)
      .map((s) => s.id);
    return ids.length > 0 ? ids : ["__none__"];
  }

  // In Sales: non-terminal stages (Engagement through Awarding, excludes Closed)
  const { count: inSales } = await supabase
    .from("contact_pipeline_state")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("current_stage_id", stageIdsFor("sales"));

  // In Onboarding: non-terminal stages (excludes Onboarded)
  const { count: inOnboarding } = await supabase
    .from("contact_pipeline_state")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("current_stage_id", stageIdsFor("onboarding"));

  // In Runway: non-terminal stages (excludes Running)
  const { count: inRunway } = await supabase
    .from("contact_pipeline_state")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("current_stage_id", stageIdsFor("runway"));

  return {
    inSales: { value: inSales ?? 0, label: "In Sales", sub: "active prospects" },
    inOnboarding: { value: inOnboarding ?? 0, label: "In Onboarding", sub: "territories" },
    inRunway: { value: inRunway ?? 0, label: "In Runway", sub: "territories" },
  };
}
