export const dynamic = "force-dynamic";

/**
 * GET /api/calls/:callId/detail — full call detail with transcript, grade, coaching.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { isValidFieldName } from "@/lib/profile/field-registry";
import { normalizeContactProfileFieldKey } from "@/lib/profile/field-aliases";

export async function GET(request: NextRequest, { params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  const supabase = createServerClient();

  const { data: call } = await supabase.from("calls").select("*").eq("id", callId).is("deleted_at", null).single();
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  // Enrich with names + contact info
  let contactName = null;
  let primaryContactEmail: string | null = null;
  let primaryContactPhone: string | null = null;
  if (call.contact_id) {
    const { data: contactRow } = await supabase
      .from("contacts")
      .select("first_name, last_name, email, phone")
      .eq("id", call.contact_id)
      .single();
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
    if (ct) {
      callTypeName = ct.name;
      callTypeSlug = ct.slug;
    }
  }

  let territoryName = null;
  if (call.TerritorySlug) {
    const { data: t } = await supabase
      .from("territories")
      .select("Nickname")
      .eq("TerritorySlug", call.TerritorySlug)
      .single();
    if (t) territoryName = t.Nickname;
  }

  // Full multi-territory list attached to this call.
  const { data: ctRows } = await supabase
    .from("call_territories")
    .select("TerritorySlug, is_primary")
    .eq("call_id", callId)
    .order("is_primary", { ascending: false });
  const ctSlugs = (ctRows ?? []).map((r) => r.TerritorySlug);
  const ctNameMap = new Map<string, string>();
  if (ctSlugs.length > 0) {
    const { data: tRows } = await supabase
      .from("territories")
      .select("TerritorySlug, Nickname")
      .in("TerritorySlug", ctSlugs);
    for (const t of tRows ?? []) ctNameMap.set(t.TerritorySlug, t.Nickname);
  }
  const callTerritories = (ctRows ?? []).map((r) => ({
    TerritorySlug: r.TerritorySlug,
    Nickname: ctNameMap.get(r.TerritorySlug) ?? r.TerritorySlug,
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
    const { data: jRows } = await supabase.from("journeys").select("id, name").in("id", cjJourneyIds);
    for (const j of jRows ?? []) journeyNameMap.set(j.id, j.name);
  }
  const jpsDetailMap = new Map<
    string,
    { stage: string | null; TerritorySlug: string | null; pipelineSortOrder: number }
  >();
  if (cjJpsIds.length > 0) {
    const { data: jpsRows } = await supabase
      .from("journey_pipeline_state")
      .select("id, TerritorySlug, pipeline_id, pipeline_stages(name)")
      .in("id", cjJpsIds);

    // Fetch pipeline sort_order to determine which is most advanced
    const jpsPipelineIds = [...new Set((jpsRows ?? []).map((r) => r.pipeline_id).filter(Boolean))];
    const pipelineSortMap = new Map<string, number>();
    if (jpsPipelineIds.length > 0) {
      const { data: pRows } = await supabase.from("pipelines").select("id, sort_order").in("id", jpsPipelineIds);
      for (const p of pRows ?? []) pipelineSortMap.set(p.id, p.sort_order ?? 0);
    }

    for (const r of (jpsRows ?? []) as unknown as {
      id: string;
      TerritorySlug: string | null;
      pipeline_id: string;
      pipeline_stages: { name: string } | { name: string }[] | null;
    }[]) {
      const stageName = Array.isArray(r.pipeline_stages)
        ? (r.pipeline_stages[0]?.name ?? null)
        : (r.pipeline_stages?.name ?? null);
      jpsDetailMap.set(r.id, {
        stage: stageName,
        TerritorySlug: r.TerritorySlug,
        pipelineSortOrder: pipelineSortMap.get(r.pipeline_id) ?? 0,
      });
    }
  }
  // Dedupe by journey_id — a journey with multiple active jps rows (e.g.
  // onboarding + runway) was rendering as two separate pills. Keep the
  // most advanced pipeline row (highest sort_order) so "Running" shows
  // instead of "Onboarded" when the journey has progressed past onboarding.
  type CjRow = { journey_id: string; journey_pipeline_state_id: string; is_primary: boolean };
  const callJourneysByJourney = new Map<string, CjRow>();
  for (const r of (cjRows ?? []) as CjRow[]) {
    const existing = callJourneysByJourney.get(r.journey_id);
    if (!existing) {
      callJourneysByJourney.set(r.journey_id, r);
    } else {
      const existingOrder = jpsDetailMap.get(existing.journey_pipeline_state_id)?.pipelineSortOrder ?? 0;
      const newOrder = jpsDetailMap.get(r.journey_pipeline_state_id)?.pipelineSortOrder ?? 0;
      if (newOrder > existingOrder) {
        callJourneysByJourney.set(r.journey_id, r);
      }
    }
  }
  const callJourneys = Array.from(callJourneysByJourney.values()).map((r) => {
    const jps = jpsDetailMap.get(r.journey_pipeline_state_id);
    return {
      journey_id: r.journey_id,
      journey_pipeline_state_id: r.journey_pipeline_state_id,
      journey_name: journeyNameMap.get(r.journey_id) ?? "Journey",
      stage_name: jps?.stage ?? null,
      TerritorySlug: jps?.TerritorySlug ?? null,
      Nickname: jps?.TerritorySlug ? (ctNameMap.get(jps.TerritorySlug) ?? null) : null,
      is_primary: r.is_primary,
    };
  });

  // "Partnership partners" — only populated when a journey on this call has
  // 2+ active primaries/co_primaries (Kevin + Kylie Kremer style). Used by the
  // Data tab to show a "Both primaries" option. Empty on group calls where
  // multiple attendees are on SEPARATE journeys (e.g. Brett + Michael).
  const partnershipPartners: { id: string; name: string }[] = [];
  const journeyIdsOnCall = Array.from(callJourneysByJourney.keys());
  if (journeyIdsOnCall.length > 0) {
    const { data: primariesRows } = await supabase
      .from("journey_contacts")
      .select("journey_id, contact_id, role, contacts ( first_name, last_name )")
      .in("journey_id", journeyIdsOnCall)
      .is("left_at", null)
      .in("role", ["primary", "co_primary"]);
    const byJourney = new Map<string, { id: string; name: string }[]>();
    for (const r of primariesRows ?? []) {
      if (!r.contact_id) continue;
      const c = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
      const first = (c as { first_name: string } | null)?.first_name ?? "";
      const last = (c as { last_name: string } | null)?.last_name ?? "";
      const name = `${first} ${last}`.trim();
      if (!name) continue;
      const list = byJourney.get(r.journey_id) ?? [];
      list.push({ id: r.contact_id, name });
      byJourney.set(r.journey_id, list);
    }
    for (const [, members] of byJourney) {
      if (members.length >= 2) {
        for (const m of members) {
          if (!partnershipPartners.some((p) => p.id === m.id)) partnershipPartners.push(m);
        }
      }
    }
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
      : Promise.resolve({
          data: [] as {
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string | null;
            phone: string | null;
          }[],
        }),
  ]);

  const userMap = new Map<string, { name: string; email: string }>();
  for (const u of userRes.data ?? []) {
    userMap.set(u.id, { name: u.full_name, email: u.email });
  }
  const contactMap = new Map<
    string,
    { name: string; email: string | null; phone: string | null; ghl_contact_id: string | null }
  >();
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
    const { data: ghlRows } = await supabase.from("contacts").select("id, ghl_contact_id").in("id", mappedContactIds);
    for (const row of ghlRows ?? []) {
      if (row.ghl_contact_id) ghlContactIdByLocal.set(row.id, row.ghl_contact_id);
    }
  }

  // Active-territory lookup: ghl_contact_id → TerritorySlug
  const ghlToTerritory = new Map<string, string>();
  if (ghlContactIdByLocal.size > 0) {
    const { data: owners } = await supabase
      .from("territory_owners")
      .select("ghl_contact_id, TerritorySlug")
      .in("ghl_contact_id", Array.from(ghlContactIdByLocal.values()))
      .is("end_date", null);
    for (const o of owners ?? []) ghlToTerritory.set(o.ghl_contact_id, o.TerritorySlug);
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

  // Build set of names already shown as linked contacts — skip unknowns that
  // duplicate a linked contact (same person, different email, one mapped).
  const linkedContactNames = new Set(linkedContacts.map((c) => c.name.toLowerCase()));

  const unknownParticipants: Array<{ name: string; email: string }> = [];
  const seenUnknownKeys = new Set<string>();
  for (const p of participants ?? []) {
    if (p.role !== "unknown") continue;
    const key = (p.email ?? p.display_name ?? "").toLowerCase();
    if (key && seenUnknownKeys.has(key)) continue;
    if (key) seenUnknownKeys.add(key);
    const name = p.display_name ?? p.email ?? "Unknown";
    if (linkedContactNames.has(name.toLowerCase())) continue;
    unknownParticipants.push({ name, email: p.email ?? "" });
  }

  // Raw participant rows — used by the mapping UI, needs the row id and the
  // current contact/territory link for each participant.
  const rawParticipants = (participants ?? []).map((p) => {
    const contact = p.contact_id ? contactMap.get(p.contact_id) : null;
    const ghl = p.contact_id ? ghlContactIdByLocal.get(p.contact_id) : null;
    const territory = ghl ? (ghlToTerritory.get(ghl) ?? null) : null;
    return {
      id: p.id,
      email: p.email,
      display_name: p.display_name,
      role: p.role,
      user_id: p.user_id,
      contact_id: p.contact_id,
      contact_name: contact?.name ?? null,
      contact_phone: contact?.phone ?? null,
      TerritorySlug: territory,
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

  // Note: coaching data lives on calls.coaching_data (written by post-call agent).
  // The call_coaching table is from an older standalone coach path and is not used by the UI.

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

  const enrichedDataExtractions = await addNewerProfileProtectionFlags(
    supabase,
    dataExtractions ?? [],
    call.started_at ?? call.created_at
  );

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
    call: {
      ...call,
      contactName,
      contactEmail,
      contactPhone,
      hostName,
      callTypeName,
      callTypeSlug,
      territoryName,
      coachName,
      teamMembers,
      linkedContacts,
      unknownParticipants,
      rawParticipants,
      callTerritories,
      callJourneys,
      partnershipPartners,
    },
    transcript: transcriptText,
    transcriptSource: transcript?.source ?? (call.raw_transcript ? "read_ai" : null),
    grade,
    actionItems: actionItems ?? [],
    dataExtractions: enrichedDataExtractions,
    profileFieldCount,
  });
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

async function addNewerProfileProtectionFlags(
  supabase: ReturnType<typeof createServerClient>,
  dataExtractions: any[],
  callOccurredAt: string | null
) {
  const callTimestamp = parseTimestamp(callOccurredAt);
  if (!callTimestamp || dataExtractions.length === 0) return dataExtractions;

  const pendingContactRows = dataExtractions.filter(
    (e) => e.contact_id && e.field_category === "contact" && !e.saved_to_profile && !e.dismissed
  );
  if (pendingContactRows.length === 0) return dataExtractions;

  const contactIds = [...new Set(pendingContactRows.map((e) => e.contact_id).filter(Boolean))] as string[];
  const fieldNames = [...new Set(pendingContactRows.map((e) => normalizeContactProfileFieldKey(e.field_key)))];

  const { data: existingFields } = await supabase
    .from("contact_profile_fields")
    .select("contact_id, field_name, last_updated_at")
    .in("contact_id", contactIds)
    .in("field_name", fieldNames);

  const newerFields = new Set<string>();
  for (const field of existingFields ?? []) {
    const updatedAt = parseTimestamp(field.last_updated_at);
    if (updatedAt !== null && updatedAt > callTimestamp) {
      newerFields.add(`${field.contact_id}:${field.field_name}`);
    }
  }

  return dataExtractions.map((e) => ({
    ...e,
    protected_by_newer_profile:
      !!e.contact_id && newerFields.has(`${e.contact_id}:${normalizeContactProfileFieldKey(e.field_key)}`),
    unsupported_contact_field:
      e.field_category === "contact" && !isValidFieldName(normalizeContactProfileFieldKey(e.field_key)),
  }));
}
