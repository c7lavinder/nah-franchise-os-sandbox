export const dynamic = "force-dynamic";

/**
 * POST /api/calls/[callId]/delete — soft-delete a call row.
 *
 * Used when a call didn't happen (no-show, scheduled-then-cancelled, duplicate
 * webhook, etc). Sets calls.deleted_at; all list/detail endpoints already
 * filter on deleted_at IS NULL so the row disappears from every view.
 *
 * Access: admin, or the rep who hosts the call (hosted_by_user_id).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ callId: string }> }) {
  const authUser = await requireAuth(request, "calls:delete");
  if (authUser instanceof Response) return authUser;
  const { callId } = await params;
  const supabase = createServerClient();

  const { data: call, error: loadErr } = await supabase
    .from("calls")
    .select("id, hosted_by_user_id, deleted_at")
    .eq("id", callId)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  if (call.deleted_at) return NextResponse.json({ success: true, alreadyDeleted: true });

  const { error: updateErr } = await supabase
    .from("calls")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", callId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
