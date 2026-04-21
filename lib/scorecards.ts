/**
 * Scorecard data fetchers for Daily HQ, Calls, and Pipeline pages.
 *
 * Rolling week = last 7 days (now - 7 days to now).
 * Calendar week = Monday 00:00 through Sunday 23:59 of the current week.
 *
 * The Calls page tab "This Week" filters on calendar week, so the
 * "Calls This Week" card must match to avoid a confusing count mismatch.
 */

import { createServerClient } from "@/lib/supabase/server";

export function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
}

export function getCalendarWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
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

  // New Prospects: journeys that entered the Sales pipeline in last 30 days.
  // Phase 4 read migration. Sales jps rows have territory_ms_slug = NULL so
  // this counts journeys, not territories.
  const { count: newProspectCount } = await supabase
    .from("journey_pipeline_state")
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
  const calendarWeek = getCalendarWeekBounds();
  const rolling = getWeekBounds();

  // Calls "this week" — match the calls-page tab exactly: any call (any status)
  // whose primary date (scheduled_at ?? started_at ?? created_at) falls in the
  // current calendar week Mon–Sun. Supabase PostgREST can't filter on a
  // COALESCE expression, so we fetch the minimal columns and count in JS.
  const { data: weekCandidates } = await supabase
    .from("calls")
    .select("scheduled_at, started_at, created_at")
    .is("deleted_at", null)
    .or(
      `and(scheduled_at.gte.${calendarWeek.start.toISOString()},scheduled_at.lte.${calendarWeek.end.toISOString()}),` +
      `and(started_at.gte.${calendarWeek.start.toISOString()},started_at.lte.${calendarWeek.end.toISOString()}),` +
      `and(created_at.gte.${calendarWeek.start.toISOString()},created_at.lte.${calendarWeek.end.toISOString()})`,
    );

  const callsCompleted = (weekCandidates ?? []).filter((c) => {
    const d = c.scheduled_at ?? c.started_at ?? c.created_at;
    if (!d) return false;
    const dt = new Date(d);
    return dt >= calendarWeek.start && dt <= calendarWeek.end;
  }).length;

  // Calls scheduled (future scheduled_at or status = scheduled)
  const { count: callsScheduled } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString())
    .is("deleted_at", null);

  // Avg coaching score — rolling 7 days. Different metric from the tab count,
  // so a different window is fine; keep the sub text honest.
  const { data: scoredCalls } = await supabase
    .from("calls")
    .select("coaching_score")
    .gte("started_at", rolling.start.toISOString())
    .lte("started_at", rolling.end.toISOString())
    .not("coaching_score", "is", null)
    .is("deleted_at", null);

  let avgScore = "—";
  if (scoredCalls && scoredCalls.length > 0) {
    const total = scoredCalls.reduce((s, c) => s + (c.coaching_score ?? 0), 0);
    avgScore = String(Math.round(total / scoredCalls.length));
  }

  return {
    callsCompleted: { value: callsCompleted, label: "Calls This Week", sub: "Mon–Sun" },
    callsScheduled: { value: callsScheduled ?? 0, label: "Calls Scheduled", sub: "upcoming" },
    avgCallScore: { value: avgScore, label: "Avg Call Score", sub: "last 7 days" },
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

  // Phase 4 read migration: counts come from journey_pipeline_state.
  //   - Sales has one jps row per journey (NULL territory) → counts prospects.
  //   - Onboarding / Runway fan out per territory → counts territories,
  //     which matches the "territories" sub-label below.
  const { count: inSales } = await supabase
    .from("journey_pipeline_state")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("current_stage_id", stageIdsFor("sales"));

  const { count: inOnboarding } = await supabase
    .from("journey_pipeline_state")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("current_stage_id", stageIdsFor("onboarding"));

  const { count: inRunway } = await supabase
    .from("journey_pipeline_state")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("current_stage_id", stageIdsFor("runway"));

  return {
    inSales: { value: inSales ?? 0, label: "In Sales", sub: "active prospects" },
    inOnboarding: { value: inOnboarding ?? 0, label: "In Onboarding", sub: "territories" },
    inRunway: { value: inRunway ?? 0, label: "In Runway", sub: "territories" },
  };
}
