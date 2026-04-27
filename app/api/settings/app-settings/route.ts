export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("pipeline_app_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json() as {
    time_in_stage_yellow_days?: number;
    time_in_stage_red_days?: number;
    ghl_sync_enabled?: boolean;
    ghl_sync_queue_alert_threshold?: number;
    userId?: string;
  };
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const supabase = createServerClient();
  const updates: Record<string, unknown> = {};
  if (body.time_in_stage_yellow_days !== undefined) updates.time_in_stage_yellow_days = body.time_in_stage_yellow_days;
  if (body.time_in_stage_red_days !== undefined) updates.time_in_stage_red_days = body.time_in_stage_red_days;
  if (body.ghl_sync_enabled !== undefined) updates.ghl_sync_enabled = body.ghl_sync_enabled;
  if (body.ghl_sync_queue_alert_threshold !== undefined) updates.ghl_sync_queue_alert_threshold = body.ghl_sync_queue_alert_threshold;
  updates.updated_by_user_id = user.id;

  const { error } = await supabase.from("pipeline_app_settings").update(updates).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
