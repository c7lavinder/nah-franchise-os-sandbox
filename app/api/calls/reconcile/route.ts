export const dynamic = "force-dynamic";

/**
 * POST /api/calls/reconcile — batch safety-net reconciliation.
 *
 * Walks every call with orphaned participants (no contact_id, no user_id) and
 * routes them through the shared resolver. Only fills in fields that are
 * still null — never clobbers a manual or higher-signal match.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { reconcileCall } from "@/lib/calls/processors/reconcile-call";

export async function POST(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const supabase = createServerClient();

  // Find every distinct call that has at least one fully-orphan participant.
  const { data: orphans } = await supabase
    .from("call_participants")
    .select("call_id")
    .is("contact_id", null)
    .is("user_id", null);

  const callIds = [...new Set((orphans ?? []).map((o) => o.call_id).filter(Boolean) as string[])];
  if (callIds.length === 0) {
    return NextResponse.json({ success: true, callsScanned: 0 });
  }

  let callsUpdated = 0;
  for (const callId of callIds) {
    const before = await supabase
      .from("calls")
      .select("contact_id, TerritorySlug, journey_pipeline_state_id")
      .eq("id", callId)
      .single();

    await reconcileCall(callId);

    const after = await supabase
      .from("calls")
      .select("contact_id, TerritorySlug, journey_pipeline_state_id")
      .eq("id", callId)
      .single();

    if (
      before.data?.contact_id !== after.data?.contact_id ||
      before.data?.TerritorySlug !== after.data?.TerritorySlug ||
      before.data?.journey_pipeline_state_id !== after.data?.journey_pipeline_state_id
    ) {
      callsUpdated++;
    }
  }

  return NextResponse.json({
    success: true,
    callsScanned: callIds.length,
    callsUpdated,
  });
}
