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

  // Full multi-territory list attached to this call.
  const { data: ctRows } = await supabase
    .from("call_territories")
    .select("territory_ms_slug, is_primary")
    .eq("call_id", callId)
    .order("is_primary", { ascending: false });
  const ctSlugs = (ctRows ?? []).map((r) => r.territory_ms_slug);
  const ctNameMap = new Map<string, string>();
  if (ctSlugs.length > 0) {
    const { data: tRows } = await supabase
      .from("territories")
      .select("ms_slug, territory_name")
      .in("ms_slug", ctSlugs);
    for (const t of tRows ?? []) ctNameMap.set(t.ms_slug, t.territory_name);
  }
  const callTerritories = (ctRows ?? []).map((r) => ({
    ms_slug: r.territory_ms_slug,
    territory_name: ctNameMap.get(r.territory_ms_slug) ?? r.territory_ms_slug,
    is_primary: r.is_primary,
  }));

  // Full multi-journey list attached to this call.
  const { data: cjRows } = await supabase
    .from("call_journeys")
    .select("journey_id, journey_pipeline_state_id, is_primary")
    .eq("call_id", callId)
    .order("is_primary", { ascending: false });
  const cjJourneyIds = Array.from(new Set((cjRows ?? []).map((r) => r.journey_id)));
  const cjJpsIds = Array.from(new Set((cjRows ?? []).map((r) => r.journey_pipeline_state_id)));
  const journeyNameMap = new Map<string, string>();
  if (cjJourneyIds.length > 0) {
    const { data: jRows } = await supabase
      .from("journeys")
      .select("id, name")
      .in("id", cjJourneyIds);
    for (const j of jRows ?? []) journeyNameMap.set(j.id, j.name);
  }
  const jpsDetailMap = new Map<string, { stage: string | null; territory_ms_slug: string | null }>();
  if (cjJpsIds.length > 0) {
    const { data: jpsRows } = await supabase
      .from("journey_pipeline_state")
      .select("id, territory_ms_slug, pipeline_stages(name)")
      .in("id", cjJpsIds);
    for (const r of (jpsRows ?? []) as unknown as {
      id: string;
      territory_ms_slug: string | null;
      pipeline_stages: { name: string } | { name: string }[] | null;
    }[]) {
      const stageName = Array.isArray(r.pipeline_stages)
        ? r.pipeline_stages[0]?.name ?? null
        : r.pipeline_stages?.name ?? null;
      jpsDetailMap.set(r.id, { stage: stageName, territory_ms_slug: r.territory_ms_slug });
    }
  }
  // Dedupe by journey_id — a journey with multiple active jps rows (e.g.
  // sales + follow-up) was rendering as two separate pills. Keep the
  // primary row if present, otherwise the first.
  type CjRow = { journey_id: string; journey_pipeline_state_id: string; is_primary: boolean };
  const callJourneysByJourney = new Map<string, CjRow>();
  for (const r of (cjRows ?? []) as CjRow[]) {
    const existing = callJourneysByJourney.get(r.journey_id);
    if (!existing || (r.is_primary && !existing.is_primary)) {
      callJourneysByJourney.set(r.journey_id, r);
    }
  }
  const callJourneys = Array.from(callJourneysByJourney.values()).map((r) => {
    const jps = jpsDetailMap.get(r.journey_pipeline_state_id);
    return {
      journey_id: r.journey_id,
      journey_pipeline_state_id: r.journey_pipeline_state_id,
      journey_name: journeyNameMap.get(r.journey_id) ?? "Journey",
      stage_name: jps?.stage ?? null,
      territory_ms_slug: jps?.territory_ms_slug ?? null,
      territory_name: jps?.territory_ms_slug ? ctNameMap.get(jps.territory_ms_slug) ?? null : null,
      is_primary: r.is_primary,
    };
  });

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
  const contactMap = new Map<string, { name: string; email: string | null; phone: string | null; ghl_contact_id: string | null }>();
  for (const c of contactRes.data ?? []) {
    contactMap.set(c.id, {
      name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown",
      email: c.email,
      phone: c.phone,
      ghl_contact_id: (c as unknown as { ghl_contact_id: string | null }).ghl_contact_id ?? null,
    });
  }

  // Fetch ghl_contact_id for mapped contacts so we can look up active territory.
  const mappedContactIds = Array.from(contactMap.keys());
  const ghlContactIdByLocal = new Map<string, string>();
  if (mappedContactIds.length > 0) {
    const { data: ghlRows } = await supabase
      .from("contacts")
      .select("id, ghl_contact_id")
      .in("id", mappedContactIds);
    for (const row of ghlRows ?? []) {
      if (row.ghl_contact_id) ghlContactIdByLocal.set(row.id, row.ghl_contact_id);
    }
  }

  // Active-territory lookup: ghl_contact_id → ms_slug
  const ghlToTerritory = new Map<string, string>();
  if (ghlContactIdByLocal.size > 0) {
    const { data: owners } = await supabase
      .from("territory_owners")
      .select("ghl_contact_id, ms_slug")
      .in("ghl_contact_id", Array.from(ghlContactIdByLocal.values()))
      .is("end_date", null);
    for (const o of owners ?? []) ghlToTerritory.set(o.ghl_contact_id, o.ms_slug);
  }

  const teamMembers = (participants ?? [])
    .filter((p) => p.role === "nah_team")
    .map((p) => {
      const u = p.user_id ? userMap.get(p.user_id) : null;
      return { id: p.user_id ?? "", name: u?.name ?? p.display_name ?? "Unknown", email: u?.email ?? p.email ?? "" };
    });

  // One pill per contact — multiple participant rows sharing a contact_id
  // (e.g., Brett invited via both his personal and his NAH email) collapse
  // into a single card. Unmapped rows (no contact_id) dedupe by email.
  const linkedContacts: Array<{
    id: string | null;
    name: string;
    email: string;
    phone: string;
    role: string;
    linked: boolean;
  }> = [];
  const seenContactIds = new Set<string>();
  const seenUnmappedEmails = new Set<string>();
  for (const p of participants ?? []) {
    if (p.role !== "prospect" && p.role !== "franchisee") continue;
    if (p.contact_id) {
      if (seenContactIds.has(p.contact_id)) continue;
      seenContactIds.add(p.contact_id);
      const c = contactMap.get(p.contact_id);
      linkedContacts.push({
        id: p.contact_id,
        name: c?.name ?? p.display_name ?? "Unknown",
        email: c?.email ?? p.email ?? "",
        phone: c?.phone ?? "",
        role: p.role,
        linked: true,
      });
    } else {
      const key = (p.email ?? "").toLowerCase();
      if (key && seenUnmappedEmails.has(key)) continue;
      if (key) seenUnmappedEmails.add(key);
      linkedContacts.push({
        id: null,
        name: p.display_name ?? "Unknown",
        email: p.email ?? "",
        phone: "",
        role: p.role,
        linked: false,
      });
    }
  }

  const unknownParticipants: Array<{ name: string; email: string }> = [];
  const seenUnknownKeys = new Set<string>();
  for (const p of participants ?? []) {
    if (p.role !== "unknown") continue;
    const key = (p.email ?? p.display_name ?? "").toLowerCase();
    if (key && seenUnknownKeys.has(key)) continue;
    if (key) seenUnknownKeys.add(key);
    unknownParticipants.push({
      name: p.display_name ?? p.email ?? "Unknown",
      email: p.email ?? "",
    });
  }

  // Raw participant rows — used by the mapping UI, needs the row id and the
  // current contact/territory link for each participant.
  const rawParticipants = (participants ?? []).map((p) => {
    const contact = p.contact_id ? contactMap.get(p.contact_id) : null;
    const ghl = p.contact_id ? ghlContactIdByLocal.get(p.contact_id) : null;
    const territory = ghl ? ghlToTerritory.get(ghl) ?? null : null;
    return {
      id: p.id,
      email: p.email,
      display_name: p.display_name,
      role: p.role,
      user_id: p.user_id,
      contact_id: p.contact_id,
      contact_name: contact?.name ?? null,
      contact_phone: contact?.phone ?? null,
      territory_ms_slug: territory,
    };
  });

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
    call: { ...call, contactName, contactEmail, contactPhone, hostName, callTypeName, callTypeSlug, territoryName, coachName, teamMembers, linkedContacts, unknownParticipants, rawParticipants, callTerritories, callJourneys },
    transcript: transcriptText,
    transcriptSource: transcript?.source ?? (call.raw_transcript ? "read_ai" : null),
    grade,
    coaching,
    actionItems: actionItems ?? [],
    dataExtractions: dataExtractions ?? [],
    profileFieldCount,
  });
}
