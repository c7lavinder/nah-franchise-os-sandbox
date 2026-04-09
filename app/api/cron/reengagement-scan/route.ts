/**
 * Cron: Re-engagement scan — all contacts (monthly 1st, 4am)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { runReengagementSignal } from "@/lib/agents/reengagement-signal";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();

  // All contacts including Nurture
  const { data: contacts } = await supabase
    .from("contacts")
    .select("ghl_contact_id")
    .not("ghl_contact_id", "is", null)
    .limit(500);

  const results = { scanned: 0, reengage_now: 0, reengage_soon: 0, leave_cold: 0 };

  for (const c of contacts ?? []) {
    try {
      const { signal } = await runReengagementSignal(c.ghl_contact_id);
      results.scanned++;
      if (signal === "re-engage-now") results.reengage_now++;
      else if (signal === "re-engage-soon") results.reengage_soon++;
      else results.leave_cold++;
    } catch { /* logged internally */ }
  }

  return NextResponse.json(results);
}
