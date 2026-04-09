export const dynamic = "force-dynamic";

/**
 * GET    /api/contacts/:contactId/team — internal team (auto-derived + manual)
 * POST   /api/contacts/:contactId/team — manually add team member { userId }
 * DELETE /api/contacts/:contactId/team — remove manual team member { userId }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ team: [] });

  const userIds = new Set<string>();

  // Auto-derived: pipeline assigned users
  const { data: states } = await supabase
    .from("contact_pipeline_state")
    .select("id, assigned_user_id")
    .eq("contact_id", localId);
  for (const s of states ?? []) if (s.assigned_user_id) userIds.add(s.assigned_user_id);

  // Auto-derived: call hosts
  const { data: calls } = await supabase
    .from("calls")
    .select("hosted_by_user_id")
    .eq("contact_id", localId)
    .is("deleted_at", null);
  for (const c of calls ?? []) if (c.hosted_by_user_id) userIds.add(c.hosted_by_user_id);

  // Auto-derived: sub-task loggers
  const psIds = (states ?? []).map((s) => s.id);
  if (psIds.length > 0) {
    const { data: logs } = await supabase
      .from("contact_sub_task_logs")
      .select("logger_user_id")
      .in("contact_pipeline_state_id", psIds)
      .is("deleted_at", null);
    for (const l of logs ?? []) if (l.logger_user_id) userIds.add(l.logger_user_id);
  }

  // Auto-derived: message authors
  const { data: msgs } = await supabase
    .from("contact_activity_messages")
    .select("author_user_id")
    .eq("contact_id", localId)
    .is("deleted_at", null);
  for (const m of msgs ?? []) if (m.author_user_id) userIds.add(m.author_user_id);

  // Manual assignments
  const { data: manual } = await supabase
    .from("contact_team_members")
    .select("user_id")
    .eq("contact_id", localId);
  const manualIds = new Set((manual ?? []).map((m) => m.user_id));
  for (const id of manualIds) userIds.add(id);

  if (userIds.size === 0) return NextResponse.json({ team: [] });

  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, role")
    .in("id", [...userIds]);

  const team = (users ?? []).map((u) => ({
    id: u.id,
    name: u.full_name,
    role: u.role,
    isManual: manualIds.has(u.id),
  }));

  return NextResponse.json({ team });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const { userId } = await request.json() as { userId: string };
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { error } = await supabase
    .from("contact_team_members")
    .upsert({ contact_id: localId, user_id: userId }, { onConflict: "contact_id,user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const { userId } = await request.json() as { userId: string };
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await supabase
    .from("contact_team_members")
    .delete()
    .eq("contact_id", localId)
    .eq("user_id", userId);

  return NextResponse.json({ success: true });
}
