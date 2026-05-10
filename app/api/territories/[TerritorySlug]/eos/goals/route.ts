export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/** POST — upsert a territory goal row */
export async function POST(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const { TerritorySlug } = await params;
  const supabase = createServerClient();
  const body = (await request.json()) as {
    goal_type: string;
    actual?: string;
    current_year_goal?: string;
    year_5_goal?: string;
    year_25_goal?: string;
  };

  if (!body.goal_type?.trim()) {
    return NextResponse.json({ error: "goal_type is required" }, { status: 400 });
  }

  const { error } = await supabase.from("eos_territory_goals").upsert(
    {
      TerritorySlug: TerritorySlug,
      goal_type: body.goal_type,
      actual: body.actual ?? null,
      current_year_goal: body.current_year_goal ?? null,
      year_5_goal: body.year_5_goal ?? null,
      year_25_goal: body.year_25_goal ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "TerritorySlug,goal_type" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
