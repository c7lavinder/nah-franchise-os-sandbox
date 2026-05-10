export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/** POST — create a territory issue */
export async function POST(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const { TerritorySlug } = await params;
  const supabase = createServerClient();
  const body = (await request.json()) as { Issue?: string; source?: string };

  if (!body.Issue?.trim()) {
    return NextResponse.json({ error: "Issue is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("eos_territory_issues")
    .insert({
      TerritorySlug: TerritorySlug,
      Issue: body.Issue.trim(),
      source: body.source ?? "manual",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ issue: data });
}
