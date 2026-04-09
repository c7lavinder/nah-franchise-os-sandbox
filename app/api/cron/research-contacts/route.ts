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

  // Get active pipeline contacts (Sales pipeline, not Nurture)
  const { data: contacts } = await supabase
    .from("contact_pipeline_state")
    .select("contact_id, contacts (ghl_contact_id)")
    .eq("is_active", true)
    .limit(50);

  let processed = 0;
  for (const row of contacts ?? []) {
    const ghlId = (row.contacts as unknown as { ghl_contact_id: string } | null)?.ghl_contact_id;
    if (!ghlId) continue;
    try {
      await runContactResearch(ghlId, false);
      processed++;
    } catch { /* logged internally */ }
  }

  return NextResponse.json({ processed });
}
