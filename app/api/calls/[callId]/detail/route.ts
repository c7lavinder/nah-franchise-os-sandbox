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

  // Enrich with names + contact info
  let contactName = null;
  let primaryContactEmail: string | null = null;
  let primaryContactPhone: string | null = null;
  if (call.contact_id) {
    const { data: contactRow } = await supabase.from("contacts").select("first_name, last_name, email, phone").eq("id", call.contact_id).single();
    if (contactRow) {
      contactName = `${contactRow.first_name ?? ""} ${contactRow.last_name ?? ""}`.trim() || "Unknown";
      primaryContactEmail = contactRow.email ?? null;
      primaryContactPhone = contactRow.phone ?? null;
    }
  }

  let hostName = null;
  if (call.hosted_by_user_id) {
    const { data: u } = await supabase.from("users").select("full_name").eq("id", call.hosted_by_user_id).single();
    if (u) hostName = u.full_name;
  }

  let callTypeName = null;
  let callTypeSlug = null;
  if (call.call_type_id) {
    const { data: ct } = await supabase.from("call_types").select("name, slug").eq("id", call.call_type_id).single();
    if (ct) { callTypeName = ct.name; callTypeSlug = ct.slug; }
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

  // Resolve participants from call_participants table
  const { data: participants } = await supabase
    .from("call_participants")
    .select("id, role, display_name, email, user_id, contact_id")
    .eq("call_id", callId);

  // Batch-resolve user names and contact names
  const pUserIds = (participants ?? []).map((p) => p.user_id).filter(Boolean) as string[];
  const pContactIds = (participants ?? []).map((p) => p.contact_id).filter(Boolean) as string[];

  const [userRes, contactRes] = await Promise.all([
    pUserIds.length > 0
      ? supabase.from("users").select("id, full_name, email").in("id", pUserIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[] }),
    pContactIds.length > 0
      ? supabase.from("contacts").select("id, first_name, last_name, email, phone").in("id", pContactIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null }[] }),
  ]);

  const userMap = new Map<string, { name: string; email: string }>();
  for (const u of userRes.data ?? []) {
    userMap.set(u.id, { name: u.full_name, email: u.email });
  }
  const contactMap = new Map<string, { name: string; email: string | null; phone: string | null }>();
  for (const c of contactRes.data ?? []) {
    contactMap.set(c.id, { name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown", email: c.email, phone: c.phone });
  }

  const teamMembers = (participants ?? [])
    .filter((p) => p.role === "nah_team")
    .map((p) => {
      const u = p.user_id ? userMap.get(p.user_id) : null;
      return { id: p.user_id ?? "", name: u?.name ?? p.display_name ?? "Unknown", email: u?.email ?? p.email ?? "" };
    });

  const linkedContacts = (participants ?? [])
    .filter((p) => p.role === "prospect" || p.role === "franchisee")
    .map((p) => {
      const c = p.contact_id ? contactMap.get(p.contact_id) : null;
      return {
        id: p.contact_id,
        name: c?.name ?? p.display_name ?? "Unknown",
        email: c?.email ?? p.email ?? "",
        phone: c?.phone ?? "",
        role: p.role,
        linked: !!p.contact_id,
      };
    });

  const unknownParticipants = (participants ?? [])
    .filter((p) => p.role === "unknown")
    .map((p) => ({ name: p.display_name ?? p.email ?? "Unknown", email: p.email ?? "" }));

  // Fallback: if no call_participants yet, resolve from read_ai_sessions (backwards compat)
  if ((participants ?? []).length === 0 && call.read_ai_session_id) {
    const { data: session } = await supabase
      .from("read_ai_sessions")
      .select("participant_emails")
      .eq("session_id", call.read_ai_session_id)
      .maybeSingle();

    if (session?.participant_emails?.length) {
      const { data: allUsers } = await supabase.from("users").select("id, email, full_name").not("email", "is", null);
      const emailToUser = new Map<string, { id: string; name: string }>();
      for (const u of allUsers ?? []) {
        if (u.email) emailToUser.set(u.email.toLowerCase(), { id: u.id, name: u.full_name });
      }
      for (const email of session.participant_emails) {
        const lc = email.toLowerCase();
        const user = emailToUser.get(lc);
        if (user) {
          // In users table = team member
          teamMembers.push({ id: user.id, name: user.name, email });
        } else {
          linkedContacts.push({ id: null, name: email, email, phone: "", role: "unknown", linked: false });
        }
      }
    }
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

  // Fetch action items for Next Steps tab
  const { data: actionItems } = await supabase
    .from("call_action_items")
    .select("*")
    .eq("call_id", callId)
    .order("created_at", { ascending: true });

  // Fetch data extractions for Data tab
  const { data: dataExtractions } = await supabase
    .from("call_data_extractions")
    .select("*")
    .eq("call_id", callId)
    .order("field_category", { ascending: true });

  // Count total contact profile fields populated (for completeness bar)
  let profileFieldCount = 0;
  if (call.contact_id) {
    const { count } = await supabase
      .from("contact_profile_fields")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", call.contact_id)
      .not("field_value", "is", null);
    profileFieldCount = count ?? 0;
  }

  // Unified transcript text — prefer call_transcripts row, fall back to raw_transcript on call
  const transcriptText: string | null = transcript?.full_text ?? call.raw_transcript ?? null;

  // Resolve contact email/phone for action items (from main contact query or first linked contact)
  const contactEmail = primaryContactEmail ?? linkedContacts[0]?.email ?? null;
  const contactPhone = primaryContactPhone ?? linkedContacts[0]?.phone ?? null;

  return NextResponse.json({
    call: { ...call, contactName, contactEmail, contactPhone, hostName, callTypeName, callTypeSlug, territoryName, coachName, teamMembers, linkedContacts, unknownParticipants },
    transcript: transcriptText,
    transcriptSource: transcript?.source ?? (call.raw_transcript ? "read_ai" : null),
    grade,
    coaching,
    actionItems: actionItems ?? [],
    dataExtractions: dataExtractions ?? [],
    profileFieldCount,
  });
}
