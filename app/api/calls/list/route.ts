export const dynamic = "force-dynamic";

/**
 * GET /api/calls/list — returns calls from the calls table (Sprint 9 schema).
 * Query params: status, call_type_id, hosted_by_user_id, limit, offset
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
      id, ghl_event_id, contact_id, call_type_id, sub_task_id,
      scheduled_at, started_at, ended_at, duration_seconds,
      meeting_link, hosted_by_user_id, status, created_at
    `)
    .is("deleted_at", null)
    .order("scheduled_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (callTypeId) query = query.eq("call_type_id", callTypeId);
  if (hostedBy) query = query.eq("hosted_by_user_id", hostedBy);
  if (contactId) query = query.eq("contact_id", contactId);

  const { data: calls, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with names
  const contactIds = [...new Set((calls ?? []).map((c) => c.contact_id).filter(Boolean))];
  const userIds = [...new Set((calls ?? []).map((c) => c.hosted_by_user_id).filter(Boolean))];
  const callTypeIds = [...new Set((calls ?? []).map((c) => c.call_type_id).filter(Boolean))];

  const contactMap = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data } = await supabase.from("contacts").select("id, first_name, last_name").in("id", contactIds);
    for (const c of data ?? []) contactMap.set(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown");
  }

  const userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data } = await supabase.from("users").select("id, full_name").in("id", userIds as string[]);
    for (const u of data ?? []) userMap.set(u.id, u.full_name);
  }

  const callTypeMap = new Map<string, string>();
  if (callTypeIds.length > 0) {
    const { data } = await supabase.from("call_types").select("id, name").in("id", callTypeIds as string[]);
    for (const ct of data ?? []) callTypeMap.set(ct.id, ct.name);
  }

  // Check which calls have transcripts, grades, coaching
  const callIds = (calls ?? []).map((c) => c.id);
  const transcriptSet = new Set<string>();
  const gradeMap = new Map<string, string>();
  const coachingSet = new Set<string>();

  if (callIds.length > 0) {
    const { data: txs } = await supabase.from("call_transcripts").select("call_id").in("call_id", callIds);
    for (const t of txs ?? []) transcriptSet.add(t.call_id);

    const { data: grades } = await supabase.from("call_grades").select("call_id, overall_grade").in("call_id", callIds);
    for (const g of grades ?? []) gradeMap.set(g.call_id, g.overall_grade);

    const { data: coaching } = await supabase.from("call_coaching").select("call_id").in("call_id", callIds);
    for (const c of coaching ?? []) coachingSet.add(c.call_id);
  }

  const enriched = (calls ?? []).map((c) => ({
    ...c,
    contactName: c.contact_id ? (contactMap.get(c.contact_id) ?? "Unknown") : null,
    hostName: c.hosted_by_user_id ? (userMap.get(c.hosted_by_user_id) ?? null) : null,
    callTypeName: c.call_type_id ? (callTypeMap.get(c.call_type_id) ?? null) : null,
    hasTranscript: transcriptSet.has(c.id),
    grade: gradeMap.get(c.id) ?? null,
    hasCoaching: coachingSet.has(c.id),
  }));

  return NextResponse.json({ calls: enriched, total: enriched.length });
}
