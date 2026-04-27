export const dynamic = "force-dynamic";

/**
 * GET /api/admin/webhooks — Admin webhook dashboard data
 * Returns read_ai_sessions, integration_logs, and recent calls for debugging.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

  const [sessionsRes, logsRes, callsRes] = await Promise.all([
    supabase
      .from("read_ai_sessions")
      .select("session_id, title, start_time, end_time, platform, owner_email, participant_emails, processing_status, call_type, error_message, classified_at, processed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("integration_logs")
      .select("id, integration_name, event_type, status, payload_summary, error_message, metadata, created_at")
      .eq("integration_name", "read_ai")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("calls")
      .select("id, title, contact_id, source, status, started_at, created_at, read_ai_session_id, summary")
      .in("source", ["read_ai", "manual"])
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  // Enrich calls with contact names
  const contactIds = [...new Set((callsRes.data ?? []).map((c) => c.contact_id).filter(Boolean))];
  const contactMap = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data } = await supabase.from("contacts").select("id, first_name, last_name").in("id", contactIds);
    for (const c of data ?? []) contactMap.set(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown");
  }

  const calls = (callsRes.data ?? []).map((c) => ({
    ...c,
    contactName: c.contact_id ? (contactMap.get(c.contact_id) ?? null) : null,
  }));

  return NextResponse.json({
    sessions: sessionsRes.data ?? [],
    logs: logsRes.data ?? [],
    calls,
    counts: {
      sessions: sessionsRes.data?.length ?? 0,
      logs: logsRes.data?.length ?? 0,
      calls: calls.length,
    },
  });
}
