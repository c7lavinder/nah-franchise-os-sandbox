export const dynamic = "force-dynamic";

/**
 * PATCH /api/calls/:callId/data/:extractionId
 * Dismiss (skip) a data extraction. Also handles edit+save.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { normalizeContactProfileFieldKey } from "@/lib/profile/field-aliases";

interface PatchBody {
  action: "skip" | "edit_save";
  field_value?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string; extractionId: string }> }
) {
  const { callId, extractionId } = await params;
  const body = (await request.json()) as PatchBody;
  const supabase = createServerClient();

  const { data: extraction } = await supabase
    .from("call_data_extractions")
    .select("id, call_id, contact_id, field_key, extracted_value")
    .eq("id", extractionId)
    .eq("call_id", callId)
    .single();

  if (!extraction) {
    return NextResponse.json({ error: "Extraction not found" }, { status: 404 });
  }

  if (body.action === "skip") {
    await supabase
      .from("call_data_extractions")
      .update({ dismissed: true })
      .eq("id", extractionId);

    await supabase.from("call_action_feedback").insert({
      extraction_id: extractionId,
      action: "skip",
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === "edit_save") {
    const newValue = body.field_value ?? extraction.extracted_value;

    // Update extraction value
    await supabase
      .from("call_data_extractions")
      .update({ extracted_value: newValue, saved_to_profile: true })
      .eq("id", extractionId);

    // Save to profile — schema uses field_name (jsonb value), last_updated_by
    // constrained to 'api'|'ai'|'manual'|'system', last_updated_at.
    if (extraction.contact_id && newValue) {
      await supabase
        .from("contact_profile_fields")
        .upsert(
          {
            contact_id: extraction.contact_id,
            field_name: normalizeContactProfileFieldKey(extraction.field_key),
            field_value: JSON.stringify(newValue),
            last_updated_by: "ai",
            last_updated_at: new Date().toISOString(),
          },
          { onConflict: "contact_id,field_name" }
        );
    }

    await supabase.from("call_action_feedback").insert({
      extraction_id: extractionId,
      action: "edit",
      edit_diff: JSON.stringify({ from: extraction.extracted_value, to: newValue }),
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
