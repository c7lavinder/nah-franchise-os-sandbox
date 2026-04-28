export const dynamic = "force-dynamic";

/**
 * POST /api/agents/post-call/run
 *
 * Manual trigger for the Post-Call Agent from the Settings > Automation panel.
 * Finds the most recent call with a transcript but no ai_summary_generated_at
 * and runs the agent on it. If all calls are already processed, returns a message.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";
import { runPostCallAgent } from "@/lib/agents/post-call/agent";

export async function POST(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const supabase = createServerClient();

  // Find the most recent unprocessed call with a transcript
  const { data: call } = await supabase
    .from("calls")
    .select("id")
    .not("raw_transcript", "is", null)
    .is("ai_summary_generated_at", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!call) {
    return NextResponse.json({ message: "All calls already processed", processed: 0 });
  }

  const result = await runPostCallAgent(call.id);

  return NextResponse.json({
    message: `Processed call ${call.id}`,
    processed: 1,
    callId: call.id,
    ...result,
  });
}
