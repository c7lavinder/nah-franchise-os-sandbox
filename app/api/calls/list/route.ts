export const dynamic = "force-dynamic";

/**
 * GET /api/calls/list — unified call list from the calls table.
 * Returns enriched calls with host, contact, call type, participants.
 * All enrichment queries run in parallel for speed.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const callTypeId = searchParams.get("call_type_id");
  const hostedBy = searchParams.get("hosted_by_user_id");
  const contactId = searchParams.get("contact_id");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const supabase = createServerClient();

  let query = supabase
    .from("calls")
    .select(`
      id, contact_id, call_type_id,
      scheduled_at, started_at, ended_at, duration_seconds,
      hosted_by_user_id, status, created_at,
      title, source, read_ai_session_id
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (callTypeId) query = query.eq("call_type_id", callTypeId);
  if (hostedBy) query = query.eq("hosted_by_user_id", hostedBy);
  if (contactId) query = query.eq("contact_id", contactId);

  const { data: calls, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!calls?.length) return NextResponse.json({ calls: [], total: 0 });

  // Collect IDs for batch enrichment
  const contactIds = [...new Set(calls.map((c) => c.contact_id).filter(Boolean))];
  const userIds = [...new Set(calls.map((c) => c.hosted_by_user_id).filter(Boolean))];
  const callTypeIds = [...new Set(calls.map((c) => c.call_type_id).filter(Boolean))];
  const sessionIds = calls.map((c) => c.read_ai_session_id).filter(Boolean) as string[];

  // Run ALL enrichment in parallel
  const [contactRes, userRes, callTypeRes, sessionRes] = await Promise.all([
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

  // Build email→name map for all known users (for participant resolution)
  const emailToName = new Map<string, string>();
  for (const u of userRes.data ?? []) {
    if (u.email) emailToName.set(u.email.toLowerCase(), u.full_name);
  }
  // Also fetch all users for participant matching (team members may not be hosts)
  const { data: allUsers } = await supabase.from("users").select("email, full_name").not("email", "is", null);
  for (const u of allUsers ?? []) {
    if (u.email) emailToName.set(u.email.toLowerCase(), u.full_name);
  }

  const sessionMap = new Map<string, { participant_emails: string[]; owner_email: string | null; call_type: string | null; platform: string | null }>();
  for (const s of sessionRes.data ?? []) {
    sessionMap.set(s.session_id, { participant_emails: s.participant_emails ?? [], owner_email: s.owner_email, call_type: s.call_type ?? null, platform: s.platform ?? null });
  }

  const NAH_DOMAIN = "newagainhouses.com";

  const enriched = calls.map((c) => {
    const session = c.read_ai_session_id ? sessionMap.get(c.read_ai_session_id) : null;
    const participantEmails = session?.participant_emails ?? [];

    // Split participants into team members and external contacts
    const teamMembers: string[] = [];
    const externalContacts: string[] = [];
    for (const email of participantEmails) {
      const lc = email.toLowerCase();
      const name = emailToName.get(lc);
      if (lc.endsWith(`@${NAH_DOMAIN}`)) {
        teamMembers.push(name ?? email.split("@")[0]);
      } else {
        externalContacts.push(name ?? email);
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
      teamMembers,
      externalContacts,
      date: c.scheduled_at ?? c.started_at ?? c.created_at,
      duration_seconds: c.duration_seconds,
    };
  });

  return NextResponse.json({ calls: enriched, total: enriched.length });
}
