export const dynamic = "force-dynamic";

/**
 * POST /api/calls/create — manual call entry
 * Creates a call record from user input (title, contact, call type, date, notes).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  const body = await request.json();
  const {
    title,
    contact_id,
    call_type_id,
    hosted_by_user_id,
    scheduled_at,
    started_at,
    duration_minutes,
    notes,
  } = body as {
    title?: string;
    contact_id?: string;
    call_type_id?: string;
    hosted_by_user_id?: string;
    scheduled_at?: string;
    started_at?: string;
    duration_minutes?: number;
    notes?: string;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const durationSeconds = duration_minutes ? duration_minutes * 60 : null;

  const { data: call, error } = await supabase
    .from("calls")
    .insert({
      title: title.trim(),
      contact_id: contact_id || null,
      call_type_id: call_type_id || null,
      hosted_by_user_id: hosted_by_user_id || null,
      scheduled_at: scheduled_at || null,
      started_at: started_at || null,
      duration_seconds: durationSeconds,
      summary: notes?.trim() || null,
      source: "manual",
      status: "completed",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: call.id, success: true });
}
