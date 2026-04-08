export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-check";

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
  const admin = await requireAdmin(request.headers.get("Authorization"), body.userId);
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const supabase = createServerClient();
  const updates: Record<string, unknown> = {};
  if (body.time_in_stage_yellow_days !== undefined) updates.time_in_stage_yellow_days = body.time_in_stage_yellow_days;
  if (body.time_in_stage_red_days !== undefined) updates.time_in_stage_red_days = body.time_in_stage_red_days;
  if (body.ghl_sync_enabled !== undefined) updates.ghl_sync_enabled = body.ghl_sync_enabled;
  if (body.ghl_sync_queue_alert_threshold !== undefined) updates.ghl_sync_queue_alert_threshold = body.ghl_sync_queue_alert_threshold;
  updates.updated_by_user_id = admin.userId;

  const { error } = await supabase.from("pipeline_app_settings").update(updates).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
