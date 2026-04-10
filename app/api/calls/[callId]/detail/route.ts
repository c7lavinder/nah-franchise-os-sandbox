export const dynamic = "force-dynamic";

/**
 * GET /api/calls/:callId/detail — full call detail with transcript, grade, coaching.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  const supabase = createServerClient();

  const { data: call } = await supabase
    .from("calls")
    .select("*")
    .eq("id", callId)
    .single();
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  // Enrich with names
  let contactName = null;
  if (call.contact_id) {
    const { data: c } = await supabase.from("contacts").select("first_name, last_name").eq("id", call.contact_id).single();
    if (c) contactName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown";
  }

  let hostName = null;
  if (call.hosted_by_user_id) {
    const { data: u } = await supabase.from("users").select("full_name").eq("id", call.hosted_by_user_id).single();
    if (u) hostName = u.full_name;
  }

  let callTypeName = null;
  if (call.call_type_id) {
    const { data: ct } = await supabase.from("call_types").select("name").eq("id", call.call_type_id).single();
    if (ct) callTypeName = ct.name;
  }

  let territoryName = null;
  if (call.territory_ms_slug) {
    const { data: t } = await supabase.from("territories").select("territory_name").eq("ms_slug", call.territory_ms_slug).single();
    if (t) territoryName = t.territory_name;
  }

  let coachName = null;
  if (call.coach_user_id) {
    const { data: cu } = await supabase.from("users").select("full_name").eq("id", call.coach_user_id).single();
    if (cu) coachName = cu.full_name;
  }

  const { data: transcript } = await supabase
    .from("call_transcripts")
    .select("id, source, full_text, word_count, created_at")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: grade } = await supabase
    .from("call_grades")
    .select("*")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: coaching } = await supabase
    .from("call_coaching")
    .select("*")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    call: { ...call, contactName, hostName, callTypeName, territoryName, coachName },
    transcript,
    grade,
    coaching,
  });
}
