export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ subTaskId: string }> }
) {
  const { subTaskId } = await params;
  const body = await request.json() as {
    name?: string; state_type?: string;
    first_state_label?: string; second_state_label?: string;
    is_required?: boolean; userId?: string;
  };
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const supabase = createServerClient();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.state_type !== undefined) updates.state_type = body.state_type;
  if (body.first_state_label !== undefined) updates.first_state_label = body.first_state_label;
  if (body.second_state_label !== undefined) updates.second_state_label = body.second_state_label;
  if (body.is_required !== undefined) updates.is_required = body.is_required;

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });

  const { error } = await supabase.from("pipeline_sub_tasks").update(updates).eq("id", subTaskId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ subTaskId: string }> }
) {
  const { subTaskId } = await params;
  const body = await request.json().catch(() => ({})) as { userId?: string };
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const supabase = createServerClient();

  // Check for referenced logs
  const { count } = await supabase
    .from("contact_sub_task_logs")
    .select("*", { count: "exact", head: true })
    .eq("sub_task_id", subTaskId)
    .is("deleted_at", null);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `In use by ${count} log entries — cannot delete` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("pipeline_sub_tasks").delete().eq("id", subTaskId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
