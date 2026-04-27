export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string; stageId: string }> }
) {
  const { stageId } = await params;
  const body = await request.json() as { enabled: boolean; userId?: string };
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const supabase = createServerClient();
  const { error } = await supabase
    .from("pipeline_stages")
    .update({ auto_advance_enabled: body.enabled })
    .eq("id", stageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
