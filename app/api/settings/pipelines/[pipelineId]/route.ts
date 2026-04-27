export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const { pipelineId } = await params;
  const body = await request.json() as { name?: string; description?: string; is_active?: boolean; userId?: string };
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const supabase = createServerClient();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });

  const { error } = await supabase.from("pipelines").update(updates).eq("id", pipelineId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
