export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

/** GET — list habits for a contact */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ habits: [] });

  const { data, error } = await supabase
    .from("eos_contact_habits")
    .select("*")
    .eq("contact_id", localId)
    .order("sort_order")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ habits: data ?? [] });
}

/** POST — create a new habit */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const body = await request.json() as {
    habit_text?: string;
    cadence?: string;
    source?: string;
  };
  if (!body.habit_text?.trim()) {
    return NextResponse.json({ error: "habit_text is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("eos_contact_habits")
    .insert({
      contact_id: localId,
      habit_text: body.habit_text.trim(),
      cadence: body.cadence ?? "weekly",
      source: body.source ?? "manual",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ habit: data });
}
