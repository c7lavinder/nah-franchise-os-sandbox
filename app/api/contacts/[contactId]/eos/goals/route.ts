export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

/** POST — upsert contact goals (one row per contact) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const body = await request.json() as {
    income_goal?: string;
    lifestyle_goal?: string;
    qol_goal?: string;
    source?: string;
  };

  const { data, error } = await supabase
    .from("eos_contact_goals")
    .upsert(
      {
        contact_id: localId,
        income_goal: body.income_goal ?? null,
        lifestyle_goal: body.lifestyle_goal ?? null,
        qol_goal: body.qol_goal ?? null,
        source: body.source ?? "manual",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "contact_id" }
    )
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, success: true });
}
