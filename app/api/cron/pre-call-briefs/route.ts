/**
 * Cron: Pre-call brief enrichment + generation for today's calls (daily 7am)
 *
 * 1. Runs the pre-call brief agent (web search enrichment) for each call
 * 2. Then generates the full Scout pre-call brief
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generatePreCallBrief } from "@/lib/calls/brief-generator";
import { runPreCallBriefAgent } from "@/lib/agents/pre-call-brief";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  // Get calls scheduled for today
  const { data: calls } = await supabase
    .from("calls")
    .select("id, contact_id, call_type_id, call_types (name)")
    .gte("scheduled_at", `${today}T00:00:00Z`)
    .lte("scheduled_at", `${today}T23:59:59Z`)
    .eq("status", "scheduled");

  let enriched = 0;
  let generated = 0;

  for (const call of calls ?? []) {
    if (!call.contact_id) continue;

    // Step 1: Run the enrichment agent (web search for fresh context)
    try {
      await runPreCallBriefAgent(call.id);
      enriched++;
    } catch { /* logged internally */ }

    // Rate limit between calls
    await sleep(2000);

    // Step 2: Generate the full Scout pre-call brief
    const callType = (call.call_types as unknown as { name: string } | null)?.name ?? "general";
    try {
      await generatePreCallBrief(call.contact_id, callType);
      generated++;
    } catch { /* logged internally */ }
  }

  return NextResponse.json({
    enriched,
    generated,
    total: calls?.length ?? 0,
  });
}
