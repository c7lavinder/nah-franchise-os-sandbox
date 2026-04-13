/**
 * Scorecard data fetchers for Daily HQ, Calls, and Pipeline pages.
 *
 * Week = rolling 7 days (now - 7 days to now).
 */

import { createServerClient } from "@/lib/supabase/server";

export function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
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

  // Calls completed in rolling 7 days (from calls table directly)
  const { count: callsCompleted } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("started_at", start.toISOString())
    .lte("started_at", end.toISOString())
    .is("deleted_at", null);

  // Calls scheduled (future scheduled_at or status = scheduled)
  const { count: callsScheduled } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString())
    .is("deleted_at", null);

  // Avg coaching score from calls with ai generation in last 7 days
  const { data: scoredCalls } = await supabase
    .from("calls")
    .select("coaching_score")
    .gte("started_at", start.toISOString())
    .lte("started_at", end.toISOString())
    .not("coaching_score", "is", null)
    .is("deleted_at", null);

  let avgScore = "—";
  if (scoredCalls && scoredCalls.length > 0) {
    const total = scoredCalls.reduce((s, c) => s + (c.coaching_score ?? 0), 0);
    avgScore = String(Math.round(total / scoredCalls.length));
  }

  return {
    callsCompleted: { value: callsCompleted ?? 0, label: "Calls This Week", sub: "last 7 days" },
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
