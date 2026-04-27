export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json() as { stageIds: string[]; userId?: string };
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  if (!body.stageIds?.length) return NextResponse.json({ error: "stageIds required" }, { status: 400 });

  const supabase = createServerClient();
  for (let i = 0; i < body.stageIds.length; i++) {
    await supabase.from("pipeline_stages").update({ sort_order: i }).eq("id", body.stageIds[i]);
  }

  return NextResponse.json({ success: true });
}
