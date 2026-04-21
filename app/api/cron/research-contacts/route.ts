/**
 * Cron: Research active pipeline contacts (weekly Sunday 2am)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { runContactResearch } from "@/lib/agents/contact-research";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();

  // Phase 4 read migration: get active journey primaries, one per journey.
  // Multi-territory franchisees get researched once rather than N times.
  const { data: rows } = await supabase
    .from("journey_pipeline_state")
    .select("journey_id, journeys!inner(primary_contact_id, contacts!journeys_primary_contact_id_fkey(ghl_contact_id))")
    .eq("is_active", true)
    .limit(50);

  const seen = new Set<string>();
  let processed = 0;
  for (const row of rows ?? []) {
    const journey = (row as unknown as { journeys: { primary_contact_id: string; contacts: { ghl_contact_id: string | null } | null } }).journeys;
    if (seen.has(journey.primary_contact_id)) continue;
    seen.add(journey.primary_contact_id);
    const ghlId = journey.contacts?.ghl_contact_id;
    if (!ghlId) continue;
    try {
      await runContactResearch(ghlId, false);
      processed++;
    } catch { /* logged internally */ }
  }

  return NextResponse.json({ processed });
}
