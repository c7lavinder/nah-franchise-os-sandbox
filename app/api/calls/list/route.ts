export const dynamic = "force-dynamic";

/**
 * GET /api/calls/list — unified call list from the calls table.
 * Returns enriched calls with host, contact, call type, participants.
 * All enrichment queries run in parallel for speed.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const callTypeId = searchParams.get("call_type_id");
  const hostedBy = searchParams.get("hosted_by_user_id");
  const rawContactId = searchParams.get("contact_id");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const supabase = createServerClient();

  // contact_id filter accepts either a local UUID or a GHL contact ID.
  // calls.contact_id stores the local UUID, so resolve GHL → local when
  // we were handed a GHL identifier (non-UUID shape).
  let contactId: string | null = rawContactId;
  if (rawContactId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(rawContactId)) {
      const { data: localRow } = await supabase
        .from("contacts").select("id").eq("ghl_contact_id", rawContactId).maybeSingle();
      contactId = localRow?.id ?? null;
    }
  }

  let query = supabase
    .from("calls")
    .select(`
      id, contact_id, call_type_id, territory_ms_slug,
      scheduled_at, started_at, ended_at, duration_seconds,
      hosted_by_user_id, status, created_at,
      title, source, read_ai_session_id,
      raw_transcript, ai_summary_generated_at
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (callTypeId) query = query.eq("call_type_id", callTypeId);
  if (hostedBy) query = query.eq("hosted_by_user_id", hostedBy);
  if (contactId) query = query.eq("contact_id", contactId);
  // GHL ID that didn't resolve to any contact → return empty list, not everything.
  if (rawContactId && !contactId) return NextResponse.json({ calls: [], total: 0 });

  const { data: calls, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!calls?.length) return NextResponse.json({ calls: [], total: 0 });

  // Collect IDs for batch enrichment
  const contactIds = [...new Set(calls.map((c) => c.contact_id).filter(Boolean))];
  const userIds = [...new Set(calls.map((c) => c.hosted_by_user_id).filter(Boolean))];
  const callTypeIds = [...new Set(calls.map((c) => c.call_type_id).filter(Boolean))];
  const sessionIds = calls.map((c) => c.read_ai_session_id).filter(Boolean) as string[];
  const territorySlugs = [...new Set(calls.map((c) => c.territory_ms_slug).filter(Boolean))] as string[];

  // Run ALL enrichment in parallel
  const [contactRes, userRes, callTypeRes, sessionRes, territoryRes] = await Promise.all([
    contactIds.length > 0
      ? supabase.from("contacts").select("id, first_name, last_name").in("id", contactIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? supabase.from("users").select("id, full_name, email").in("id", userIds as string[])
      : Promise.resolve({ data: [] }),
    callTypeIds.length > 0
      ? supabase.from("call_types").select("id, name, slug").in("id", callTypeIds as string[])
      : Promise.resolve({ data: [] }),
    sessionIds.length > 0
      ? supabase.from("read_ai_sessions").select("session_id, participant_emails, owner_email, call_type, platform").in("session_id", sessionIds)
      : Promise.resolve({ data: [] }),
    territorySlugs.length > 0
      ? supabase.from("territories").select("ms_slug, territory_name").in("ms_slug", territorySlugs)
      : Promise.resolve({ data: [] }),
  ]);

  const contactMap = new Map<string, string>();
  for (const c of contactRes.data ?? []) {
    contactMap.set(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown");
  }

  const userMap = new Map<string, { name: string; email: string }>();
  for (const u of userRes.data ?? []) {
    userMap.set(u.id, { name: u.full_name, email: u.email });
  }

  const callTypeMap = new Map<string, { name: string; slug: string }>();
  for (const ct of callTypeRes.data ?? []) {
    callTypeMap.set(ct.id, { name: ct.name, slug: ct.slug });
  }

  const territoryMap = new Map<string, string>();
  for (const t of territoryRes.data ?? []) {
    territoryMap.set(t.ms_slug, t.territory_name);
  }

  // Build email→user map for all known users (for participant resolution)
  const emailToUser = new Map<string, { name: string; color: string | null }>();
  for (const u of userRes.data ?? []) {
    if (u.email) emailToUser.set(u.email.toLowerCase(), { name: u.full_name, color: null });
  }
  // Fetch all users with label_color for participant matching (team members may not be hosts)
  const { data: allUsers } = await supabase.from("users").select("email, full_name, label_color").not("email", "is", null);
  for (const u of allUsers ?? []) {
    if (u.email) emailToUser.set(u.email.toLowerCase(), { name: u.full_name, color: u.label_color });
  }

  const sessionMap = new Map<string, { participant_emails: string[]; owner_email: string | null; call_type: string | null; platform: string | null }>();
  for (const s of sessionRes.data ?? []) {
    sessionMap.set(s.session_id, { participant_emails: s.participant_emails ?? [], owner_email: s.owner_email, call_type: s.call_type ?? null, platform: s.platform ?? null });
  }

  // Build set of team emails from users table (not by domain — franchisees share @newagainhouses.com)
  const teamEmailSet = new Set<string>();
  for (const u of allUsers ?? []) {
    if (u.email) teamEmailSet.add(u.email.toLowerCase());
  }

  // Build email→name map from contacts table for external participant name resolution
  // Paginate to get all contacts (2000+)
  let allContacts: { email: string; first_name: string | null; last_name: string | null }[] = [];
  let cOffset = 0;
  while (true) {
    const { data: page } = await supabase.from("contacts").select("email, first_name, last_name").not("email", "is", null).range(cOffset, cOffset + 999);
    if (!page || page.length === 0) break;
    allContacts = allContacts.concat(page);
    if (page.length < 1000) break;
    cOffset += 1000;
  }
  const contactEmailToName = new Map<string, string>();
  for (const c of allContacts ?? []) {
    if (c.email) {
      const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
      if (name) contactEmailToName.set(c.email.toLowerCase(), name);
    }
  }

  // Build per-call participant lists from call_participants (primary source of truth)
  const callIds = calls.map((c) => c.id);
  const { data: allParticipants } = callIds.length > 0
    ? await supabase.from("call_participants").select("call_id, email, display_name, user_id, role, contact_id").in("call_id", callIds)
    : { data: [] };

  const callParticipantMap = new Map<string, typeof allParticipants>();
  for (const p of allParticipants ?? []) {
    const list = callParticipantMap.get(p.call_id) ?? [];
    list.push(p);
    callParticipantMap.set(p.call_id, list);
  }

  const enriched = calls.map((c) => {
    const participants = callParticipantMap.get(c.id) ?? [];
    const session = c.read_ai_session_id ? sessionMap.get(c.read_ai_session_id) : null;

    const unmappedCount = participants.filter((p) => p.role !== "nah_team" && !p.contact_id).length;

    // Use call_participants as primary source; fall back to session emails only if no participants
    const teamMembers: { name: string; color: string | null }[] = [];
    const externalContacts: string[] = [];

    if (participants.length > 0) {
      // Dedupe: one chip per contact_id for mapped rows, one per email for
      // unmapped. Keeps a contact invited under two emails from showing twice.
      const seenContactIds = new Set<string>();
      const seenExternalEmails = new Set<string>();
      const seenTeamEmails = new Set<string>();
      for (const p of participants) {
        const lc = p.email?.toLowerCase() ?? "";
        const isTeam = p.role === "nah_team" || (lc && teamEmailSet.has(lc)) || !!p.user_id;
        if (isTeam) {
          if (lc && seenTeamEmails.has(lc)) continue;
          if (lc) seenTeamEmails.add(lc);
          const user = lc ? emailToUser.get(lc) : null;
          teamMembers.push({
            name: user?.name ?? p.display_name ?? lc.split("@")[0],
            color: user?.color ?? null,
          });
        } else {
          if (p.contact_id) {
            if (seenContactIds.has(p.contact_id)) continue;
            seenContactIds.add(p.contact_id);
          } else if (lc) {
            if (seenExternalEmails.has(lc)) continue;
            seenExternalEmails.add(lc);
          }
          const name = p.display_name && !p.display_name.includes("@")
            ? p.display_name
            : (lc ? (contactEmailToName.get(lc) ?? null) : null)
              ?? (lc ? lc.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()) : "Unknown");
          externalContacts.push(name);
        }
      }
    } else {
      // Fallback: use session participant_emails when no call_participants exist
      const participantEmails = session?.participant_emails ?? [];
      for (const email of participantEmails) {
        const lc = email.toLowerCase();
        const user = emailToUser.get(lc);
        if (teamEmailSet.has(lc)) {
          teamMembers.push({ name: user?.name ?? email.split("@")[0], color: user?.color ?? null });
        } else {
          const displayName = contactEmailToName.get(lc) ?? user?.name ?? null;
          externalContacts.push(displayName ?? email.split("@")[0]);
        }
      }
    }

    const hostInfo = c.hosted_by_user_id ? userMap.get(c.hosted_by_user_id) : null;

    const ctInfo = c.call_type_id ? callTypeMap.get(c.call_type_id) : null;

    return {
      id: c.id,
      title: c.title,
      source: c.source,
      status: c.status,
      hostName: hostInfo?.name ?? null,
      contactName: c.contact_id ? (contactMap.get(c.contact_id) ?? null) : null,
      callTypeName: ctInfo?.name ?? null,
      callTypeSlug: ctInfo?.slug ?? null,
      classifiedType: session?.call_type ?? null,
      platform: session?.platform ?? null,
      territoryName: c.territory_ms_slug ? (territoryMap.get(c.territory_ms_slug) ?? null) : null,
      teamMembers,
      externalContacts,
      date: c.scheduled_at ?? c.started_at ?? c.created_at,
      duration_seconds: c.duration_seconds,
      has_transcript: !!c.raw_transcript,
      transcript_length: c.raw_transcript?.length ?? 0,
      ai_summary_generated_at: c.ai_summary_generated_at ?? null,
      unmappedCount,
    };
  });

  return NextResponse.json({ calls: enriched, total: enriched.length });
}
