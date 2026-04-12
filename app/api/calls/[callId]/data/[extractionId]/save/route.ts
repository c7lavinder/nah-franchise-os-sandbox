export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/data/:extractionId/save
 *
 * Marks a call_data_extractions row as saved_to_profile = true.
 * Also writes the extracted value to the contact's profile field.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** Maps extraction field_key → contacts table column name */
const FIELD_MAP: Record<string, string> = {
  employment_status: "employment_status",
  years_in_current_role: "years_in_current_role",
  timeline_intent: "timeline_intent",
  capital_range: "capital_range",
  lead_source: "source",
  competitors_mentioned: "competitors_mentioned",
  stated_why: "stated_why",
  risk_tolerance: "risk_tolerance",
  family_situation: "family_situation",
  prior_business_ownership: "prior_business_ownership",
  market_interest: "market_interest",
  territory_type_preference: "territory_type_preference",
  availability_confirmed: "availability_confirmed",
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ callId: string; extractionId: string }> }
) {
  const { callId, extractionId } = await params;
  const supabase = createServerClient();

  // Fetch the extraction
  const { data: extraction } = await supabase
    .from("call_data_extractions")
    .select("id, call_id, contact_id, field_key, extracted_value")
    .eq("id", extractionId)
    .eq("call_id", callId)
    .single();

  if (!extraction) {
    return NextResponse.json({ error: "Extraction not found" }, { status: 404 });
  }

  if (!extraction.contact_id) {
    return NextResponse.json({ error: "No contact linked to this extraction" }, { status: 400 });
  }

  if (!extraction.extracted_value) {
    return NextResponse.json({ error: "No value to save" }, { status: 400 });
  }

  // Mark as saved
  await supabase
    .from("call_data_extractions")
    .update({ saved_to_profile: true })
    .eq("id", extractionId);

  // Write to contact profile via contact_profile_fields (upsert)
  const contactColumn = FIELD_MAP[extraction.field_key];
  if (contactColumn) {
    // Try contact_profile_fields first (the extensible profile system)
    const { error: profileError } = await supabase
      .from("contact_profile_fields")
      .upsert(
        {
          contact_id: extraction.contact_id,
          field_key: extraction.field_key,
          field_value: extraction.extracted_value,
          source: "scout_extraction",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "contact_id,field_key" }
      );

    if (profileError) {
      // Fallback: try updating contacts table directly
      await supabase
        .from("contacts")
        .update({ [contactColumn]: extraction.extracted_value })
        .eq("id", extraction.contact_id);
    }
  } else {
    // Field not in FIELD_MAP — save to contact_profile_fields only
    await supabase
      .from("contact_profile_fields")
      .upsert(
        {
          contact_id: extraction.contact_id,
          field_key: extraction.field_key,
          field_value: extraction.extracted_value,
          source: "scout_extraction",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "contact_id,field_key" }
      );
  }

  return NextResponse.json({ success: true });
}
