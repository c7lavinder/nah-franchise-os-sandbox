export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/:contactId/team
 * Returns internal NAH team members who have touched this contact.
 * Derived from: pipeline assigned user, call hosts, message authors, sub-task loggers.
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

  // Pipeline assigned users
  const { data: states } = await supabase
    .from("contact_pipeline_state")
    .select("assigned_user_id")
    .eq("contact_id", localId)
    .eq("is_active", true);
  for (const s of states ?? []) if (s.assigned_user_id) userIds.add(s.assigned_user_id);

  // Call hosts
  const { data: calls } = await supabase
    .from("calls")
    .select("hosted_by_user_id")
    .eq("contact_id", localId)
    .is("deleted_at", null);
  for (const c of calls ?? []) if (c.hosted_by_user_id) userIds.add(c.hosted_by_user_id);

  // Sub-task loggers
  const stateIds = (states ?? []).map((s) => s.assigned_user_id).filter(Boolean);
  if (stateIds.length > 0) {
    // Get all pipeline state IDs for this contact
    const { data: allStates } = await supabase
      .from("contact_pipeline_state")
      .select("id")
      .eq("contact_id", localId);
    const psIds = (allStates ?? []).map((s) => s.id);
    if (psIds.length > 0) {
      const { data: logs } = await supabase
        .from("contact_sub_task_logs")
        .select("logger_user_id")
        .in("contact_pipeline_state_id", psIds)
        .is("deleted_at", null);
      for (const l of logs ?? []) if (l.logger_user_id) userIds.add(l.logger_user_id);
    }
  }

  // Message authors
  const { data: msgs } = await supabase
    .from("contact_activity_messages")
    .select("author_user_id")
    .eq("contact_id", localId)
    .is("deleted_at", null);
  for (const m of msgs ?? []) if (m.author_user_id) userIds.add(m.author_user_id);

  if (userIds.size === 0) return NextResponse.json({ team: [] });

  // Look up user details
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, role")
    .in("id", [...userIds]);

  const team = (users ?? []).map((u) => ({
    id: u.id,
    name: u.full_name,
    role: u.role,
  }));

  return NextResponse.json({ team });
}
