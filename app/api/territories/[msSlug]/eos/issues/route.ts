export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** POST — create a territory issue */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();
  const body = await request.json() as { issue_text?: string; source?: string };

  if (!body.issue_text?.trim()) {
    return NextResponse.json({ error: "issue_text is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("eos_territory_issues")
    .insert({
      territory_slug: msSlug,
      issue_text: body.issue_text.trim(),
      source: body.source ?? "manual",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ issue: data });
}
