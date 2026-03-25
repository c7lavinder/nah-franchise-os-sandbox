/**
 * GET /api/notifications — returns unresolved alerts for the notification bell
 * PUT /api/notifications — mark an alert as resolved
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("inactivity_alerts")
    .select("*")
    .eq("is_resolved", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts: data ?? [], count: data?.length ?? 0 });
}

export async function PUT(request: NextRequest) {
  const supabase = createServerClient();
  const { id } = await request.json() as { id: string };

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("inactivity_alerts")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
