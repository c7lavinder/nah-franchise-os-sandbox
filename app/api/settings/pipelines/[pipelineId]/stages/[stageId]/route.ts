export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string; stageId: string }> }
) {
  const { stageId } = await params;
  const body = await request.json() as { name?: string; is_terminal?: boolean; userId?: string };
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const supabase = createServerClient();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.is_terminal !== undefined) updates.is_terminal = body.is_terminal;

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });

  const { error } = await supabase.from("pipeline_stages").update(updates).eq("id", stageId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string; stageId: string }> }
) {
  const { stageId } = await params;
  const body = await request.json().catch(() => ({})) as { userId?: string };
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const supabase = createServerClient();

  // Check for referenced data — Phase 4 read migration: jps is source.
  const { count } = await supabase
    .from("journey_pipeline_state")
    .select("*", { count: "exact", head: true })
    .eq("current_stage_id", stageId);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `In use by ${count} pipeline-state rows — cannot delete` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("pipeline_stages").delete().eq("id", stageId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
