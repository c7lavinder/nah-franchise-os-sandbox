/**
 * Cron: Research active territories (weekly Sunday 3am)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { runTerritoryMarketResearch } from "@/lib/agents/territory-market";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: territories } = await supabase
    .from("territories")
    .select("ms_slug")
    .eq("status", "active")
    .limit(80);

  let processed = 0;
  for (const t of territories ?? []) {
    try {
      await runTerritoryMarketResearch(t.ms_slug);
      processed++;
    } catch { /* logged internally */ }
  }

  return NextResponse.json({ processed });
}
