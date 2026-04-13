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

  // Resolve participants from Read.ai session
  const teamMembers: { id: string; name: string; email: string }[] = [];
  const externalParticipants: { name: string; email: string; contactId: string | null }[] = [];

  if (call.read_ai_session_id) {
    const { data: session } = await supabase
      .from("read_ai_sessions")
      .select("participant_emails, owner_email")
      .eq("session_id", call.read_ai_session_id)
      .maybeSingle();

    if (session?.participant_emails?.length) {
      const { data: allUsers } = await supabase.from("users").select("id, email, full_name").not("email", "is", null);
      const emailToUser = new Map<string, { id: string; name: string }>();
      for (const u of allUsers ?? []) {
        if (u.email) emailToUser.set(u.email.toLowerCase(), { id: u.id, name: u.full_name });
      }

      const externalEmails: string[] = [];
      for (const email of session.participant_emails) {
        const lc = email.toLowerCase();
        if (lc.endsWith("@newagainhouses.com")) {
          const user = emailToUser.get(lc);
          teamMembers.push({ id: user?.id ?? "", name: user?.name ?? email.split("@")[0], email });
        } else {
          externalEmails.push(email);
        }
      }

      // Match external emails to contacts
      if (externalEmails.length > 0) {
        const { data: matchedContacts } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, email")
          .in("email", externalEmails.map((e) => e.toLowerCase()));

        const contactByEmail = new Map<string, { id: string; name: string }>();
        for (const mc of matchedContacts ?? []) {
          if (mc.email) {
            contactByEmail.set(mc.email.toLowerCase(), {
              id: mc.id,
              name: `${mc.first_name ?? ""} ${mc.last_name ?? ""}`.trim() || mc.email,
            });
          }
        }

        for (const email of externalEmails) {
          const matched = contactByEmail.get(email.toLowerCase());
          externalParticipants.push({
            name: matched?.name ?? email,
            email,
            contactId: matched?.id ?? null,
          });
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

  return NextResponse.json({
    call: { ...call, contactName, hostName, callTypeName, callTypeSlug, territoryName, coachName, teamMembers, externalParticipants },
    transcript: transcriptText,
    transcriptSource: transcript?.source ?? (call.raw_transcript ? "read_ai" : null),
    grade,
    coaching,
    actionItems: actionItems ?? [],
    dataExtractions: dataExtractions ?? [],
    profileFieldCount,
  });
}
