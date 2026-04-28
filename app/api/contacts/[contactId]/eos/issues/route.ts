export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

/** POST — create a new contact issue */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const body = await request.json() as { issue_text?: string; source?: string };
  if (!body.issue_text?.trim()) {
    return NextResponse.json({ error: "issue_text is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("eos_contact_issues")
    .insert({
      contact_id: localId,
      issue_text: body.issue_text.trim(),
      source: body.source ?? "manual",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ issue: data });
}
