export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

/** PUT — update goal_value for a scorecard metric */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ msSlug: string; metricKey: string }> }
) {
  const { msSlug, metricKey } = await params;
  const supabase = createServerClient();
  const body = await request.json() as { goal_value?: string };

  const { error } = await supabase
    .from("eos_territory_scorecard")
    .update({ goal_value: body.goal_value ?? null, updated_at: new Date().toISOString() })
    .eq("territory_slug", msSlug)
    .eq("metric_key", metricKey);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
