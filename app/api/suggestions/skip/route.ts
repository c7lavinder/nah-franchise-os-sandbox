import { NextRequest, NextResponse } from "next/server";
import { writeSuggestionOutcome } from "@/lib/scout-learning";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json() as { suggestionId: string; reviewerId: string };
  if (!body.suggestionId) {
    return NextResponse.json({ error: "suggestionId required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: sug } = await supabase
    .from("data_update_suggestions")
    .select("field_name, suggested_value, contact_id, territory_ms_slug")
    .eq("id", body.suggestionId)
    .single();

  if (!sug) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await writeSuggestionOutcome({
    suggestion_id: body.suggestionId,
    field_name: sug.field_name,
    suggested_value: sug.suggested_value,
    outcome: "skipped",
    reviewer_id: body.reviewerId,
    contact_id: sug.contact_id ?? undefined,
    territory_ms_slug: sug.territory_ms_slug ?? undefined,
  });

  return NextResponse.json({ success: true });
}
