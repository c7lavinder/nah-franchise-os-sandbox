export const dynamic = "force-dynamic";

/**
 * GET /api/l10
 *
 * L10 metrics dashboard — aggregates EOS scorecard data across all
 * active territories for a network-wide leadership view.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createServerClient();

  // Fetch active territories
  const { data: territories, error: tErr } = await supabase
    .from("territories")
    .select("TerritorySlug, Nickname, status, region")
    .eq("status", "active")
    .order("Nickname");

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  const slugs = (territories ?? []).map((t) => t.TerritorySlug);
  if (slugs.length === 0) {
    return NextResponse.json({ territories: [], scorecard: [], rocks: [], issues: [] });
  }

  // Parallel fetch EOS data for all territories
  const [scorecardRes, rocksRes, issuesRes, todosRes, habitsRes] = await Promise.all([
    supabase
      .from("eos_territory_scorecard")
      .select("TerritorySlug, metric_key, metric_label, goal, actual, unit, sort_order")
      .in("TerritorySlug", slugs)
      .order("sort_order"),
    supabase
      .from("eos_territory_rocks")
      .select("TerritorySlug, title, status, due_date, owner")
      .in("TerritorySlug", slugs)
      .order("due_date"),
    supabase
      .from("eos_territory_issues")
      .select("TerritorySlug, title, priority, status, created_at")
      .in("TerritorySlug", slugs)
      .eq("status", "open")
      .order("priority"),
    supabase
      .from("eos_territory_todos")
      .select("TerritorySlug, title, assignee, due_date, done")
      .in("TerritorySlug", slugs)
      .eq("done", false)
      .order("due_date"),
    supabase
      .from("eos_territory_habits")
      .select("TerritorySlug, habit_label, current_streak, target_per_week")
      .in("TerritorySlug", slugs)
      .order("sort_order"),
  ]);

  // Build per-territory summary
  const scorecardByTerritory = new Map<string, any[]>();
  for (const row of scorecardRes.data ?? []) {
    if (!scorecardByTerritory.has(row.TerritorySlug)) scorecardByTerritory.set(row.TerritorySlug, []);
    scorecardByTerritory.get(row.TerritorySlug)!.push(row);
  }

  const rocksByTerritory = new Map<string, any[]>();
  for (const row of rocksRes.data ?? []) {
    if (!rocksByTerritory.has(row.TerritorySlug)) rocksByTerritory.set(row.TerritorySlug, []);
    rocksByTerritory.get(row.TerritorySlug)!.push(row);
  }

  const territoryRows = (territories ?? []).map((t) => {
    const sc = scorecardByTerritory.get(t.TerritorySlug) ?? [];
    const rocks = rocksByTerritory.get(t.TerritorySlug) ?? [];
    const onTrack = rocks.filter((r) => r.status === "on_track").length;
    const offTrack = rocks.filter((r) => r.status === "off_track").length;

    // Scorecard health: how many metrics are at/above goal
    let metricsAtGoal = 0;
    let metricsTotal = 0;
    for (const m of sc) {
      if (m.goal != null && m.actual != null) {
        metricsTotal++;
        if (Number(m.actual) >= Number(m.goal)) metricsAtGoal++;
      }
    }

    return {
      slug: t.TerritorySlug,
      nickname: t.Nickname,
      region: t.region,
      scorecard: sc,
      scorecardHealth: metricsTotal > 0 ? Math.round((metricsAtGoal / metricsTotal) * 100) : null,
      rocks: { total: rocks.length, onTrack, offTrack },
    };
  });

  return NextResponse.json({
    territories: territoryRows,
    openIssues: issuesRes.data ?? [],
    openTodos: todosRes.data ?? [],
    habits: habitsRes.data ?? [],
    networkSummary: {
      totalTerritories: territoryRows.length,
      avgScorecardHealth:
        territoryRows.filter((t) => t.scorecardHealth !== null).length > 0
          ? Math.round(
              territoryRows.filter((t) => t.scorecardHealth !== null).reduce((s, t) => s + t.scorecardHealth!, 0) /
                territoryRows.filter((t) => t.scorecardHealth !== null).length
            )
          : null,
      totalOpenIssues: (issuesRes.data ?? []).length,
      totalOpenTodos: (todosRes.data ?? []).length,
      totalRocksOnTrack: territoryRows.reduce((s, t) => s + t.rocks.onTrack, 0),
      totalRocksOffTrack: territoryRows.reduce((s, t) => s + t.rocks.offTrack, 0),
    },
  });
}
