export const dynamic = "force-dynamic";

/**
 * POST /api/calls/[callId]/override — manual reassignment.
 *
 * Used by the Reclassify / Reassign buttons on the call detail page. Writes
 * the acting user's email + timestamp into classification_reason /
 * match_reason so the override is auditable downstream.
 *
 * Access: admin, or the rep who owns the call (hosted_by_user_id).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";

interface OverrideBody {
  call_type_id?: string | null;
  contact_id?: string | null;
  territory_ms_slug?: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> },
) {
  const { callId } = await params;
  const supabase = createServerClient();

  const authUser = await getAuthUser(request.headers.get("authorization") ?? request.headers.get("Authorization"));
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load the call to check access.
  const { data: call, error: loadErr } = await supabase
    .from("calls")
    .select("id, hosted_by_user_id")
    .eq("id", callId)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const isAdmin = authUser.role === "admin";
  const isOwner = call.hosted_by_user_id === authUser.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as OverrideBody;
  const { call_type_id, contact_id, territory_ms_slug } = body;

  if (
    call_type_id === undefined &&
    contact_id === undefined &&
    territory_ms_slug === undefined
  ) {
    return NextResponse.json({ error: "No override fields provided" }, { status: 400 });
  }

  const timestamp = new Date().toISOString();
  const audit = `manual override by ${authUser.email} at ${timestamp}`;
  const updates: Record<string, unknown> = {};

  if (call_type_id !== undefined) {
    updates.call_type_id = call_type_id;
    updates.classification_reason = audit;
  }

  // Territory can be reassigned on its own, or alongside a contact.
  if (contact_id !== undefined || territory_ms_slug !== undefined) {
    if (contact_id !== undefined) updates.contact_id = contact_id;
    if (territory_ms_slug !== undefined) updates.territory_ms_slug = territory_ms_slug;
    updates.match_confidence = 1.0;
    updates.match_reason = audit;
  }

  const { error: updateErr } = await supabase
    .from("calls")
    .update(updates)
    .eq("id", callId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ success: true, updates });
}
