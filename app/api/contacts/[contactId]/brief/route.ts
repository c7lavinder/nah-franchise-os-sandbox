/**
 * Pre-Call Brief API
 *
 * POST /api/contacts/:contactId/brief — Generate a pre-call brief
 * Body: { callType: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";
import { generatePreCallBrief } from "@/lib/calls/brief-generator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;

  let body: { callType?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Default to "general"
  }

  const callType = body.callType ?? "general";

  try {
    const brief = await generatePreCallBrief(contactId, callType);

    // Check for fresh agent context on today's call
    const supabase = createServerClient();
    const today = new Date().toISOString().split("T")[0];
    const { data: todayCall } = await supabase
      .from("calls")
      .select("brief_context")
      .eq("contact_id", contactId)
      .gte("scheduled_at", `${today}T00:00:00Z`)
      .lte("scheduled_at", `${today}T23:59:59Z`)
      .not("brief_context", "is", null)
      .limit(1)
      .maybeSingle();

    if (todayCall?.brief_context && brief.sections) {
      brief.sections.whoIsThis = `FRESH CONTEXT (from this morning): ${todayCall.brief_context}\n\n${brief.sections.whoIsThis}`;
    }

    return NextResponse.json({ success: true, brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
