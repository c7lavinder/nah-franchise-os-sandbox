export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

/** PUT — update habit (grade / cadence / text) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; habitId: string }> }
) {
  const { habitId } = await params;
  const supabase = createServerClient();
  const body = await request.json() as {
    habit_text?: string;
    cadence?: string;
    grade?: string | null;
    sort_order?: number;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.habit_text !== undefined) updates.habit_text = body.habit_text;
  if (body.cadence !== undefined) updates.cadence = body.cadence;
  if (body.grade !== undefined) updates.grade = body.grade;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

  const { error } = await supabase
    .from("eos_contact_habits")
    .update(updates)
    .eq("id", habitId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE — remove habit */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; habitId: string }> }
) {
  const { habitId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from("eos_contact_habits")
    .delete()
    .eq("id", habitId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
