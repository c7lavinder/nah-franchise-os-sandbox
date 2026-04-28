export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

/** GET — returns all territory EOS sections */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();

  const [goals, scorecard, budgets, leadChannels, habits, rocks, issues, todos] =
    await Promise.all([
      supabase
        .from("eos_territory_goals")
        .select("*")
        .eq("territory_slug", msSlug)
        .order("goal_type"),
      supabase
        .from("eos_territory_scorecard")
        .select("*")
        .eq("territory_slug", msSlug)
        .order("sort_order"),
      supabase
        .from("eos_territory_budgets")
        .select("*")
        .eq("territory_slug", msSlug)
        .order("sort_order"),
      supabase
        .from("eos_territory_lead_channels")
        .select("*")
        .eq("territory_slug", msSlug)
        .order("sort_order"),
      supabase
        .from("eos_territory_habits")
        .select("*")
        .eq("territory_slug", msSlug)
        .order("sort_order"),
      supabase
        .from("eos_territory_rocks")
        .select("*")
        .eq("territory_slug", msSlug)
        .order("created_at"),
      supabase
        .from("eos_territory_issues")
        .select("*")
        .eq("territory_slug", msSlug)
        .order("created_at"),
      supabase
        .from("eos_territory_todos")
        .select("*")
        .eq("territory_slug", msSlug)
        .order("created_at"),
    ]);

  // Return first error if any query failed
  const firstError = [goals, scorecard, budgets, leadChannels, habits, rocks, issues, todos]
    .find((r) => r.error);
  if (firstError?.error) {
    return NextResponse.json({ error: firstError.error.message }, { status: 500 });
  }

  return NextResponse.json({
    goals: goals.data ?? [],
    scorecard: scorecard.data ?? [],
    budgets: budgets.data ?? [],
    leadChannels: leadChannels.data ?? [],
    habits: habits.data ?? [],
    rocks: rocks.data ?? [],
    issues: issues.data ?? [],
    todos: todos.data ?? [],
  });
}
