export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/data/:extractionId/save
 *
 * Saves a call_data_extractions row to either a contact profile or a territory
 * profile. Target is chosen by the rep via the unified picker in the Data tab
 * (any contact on the call, any territory on the call, or "Both primaries" on
 * a real partnership journey).
 *
 * Request body:
 *   target_type:          'contact' | 'territory'
 *   target_contact_id?:   string (when target_type = 'contact' and scope = 'single')
 *   target_territory_slug?: string (when target_type = 'territory')
 *   target_scope?:        'single' | 'both'  ('both' only valid on partnership journeys)
 *
 * Missing body falls back to the extraction's stored contact_id / territory_slug.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

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

interface SaveBody {
  target_type?: "contact" | "territory";
  target_contact_id?: string;
  target_territory_slug?: string;
  target_scope?: "single" | "both";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string; extractionId: string }> }
) {
  const { callId, extractionId } = await params;
  const body = (await request.json().catch(() => ({}))) as SaveBody;
  const supabase = createServerClient();

  const { data: extraction } = await supabase
    .from("call_data_extractions")
    .select("id, call_id, contact_id, journey_id, territory_ms_slug, field_key, field_category, extracted_value, target_scope")
    .eq("id", extractionId)
    .eq("call_id", callId)
    .single();

  if (!extraction) {
    return NextResponse.json({ error: "Extraction not found" }, { status: 404 });
  }
  if (!extraction.extracted_value) {
    return NextResponse.json({ error: "No value to save" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const targetType: "contact" | "territory" =
    body.target_type
    ?? (body.target_territory_slug ? "territory" : "contact");

  if (targetType === "territory") {
    const slug = body.target_territory_slug ?? extraction.territory_ms_slug;
    if (!slug) {
      return NextResponse.json({ error: "No territory selected" }, { status: 400 });
    }
    const { error } = await supabase
      .from("territory_market_data")
      .upsert(
        {
          territory_slug: slug,
          field_name: extraction.field_key,
          field_value: extraction.extracted_value,
          source: "scout_extraction",
          source_date: now,
          updated_at: now,
        },
        { onConflict: "territory_slug,field_name" }
      );
    if (error) {
      console.error("[save-extraction] territory upsert failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await supabase
      .from("call_data_extractions")
      .update({
        saved_to_profile: true,
        territory_ms_slug: slug,
        target_scope: null,
      })
      .eq("id", extractionId);
    return NextResponse.json({ success: true, saved_to_territory: slug });
  }

  // Contact target (single or both)
  const effectiveScope: "single" | "both" =
    body.target_scope
    ?? (extraction.target_scope === "single" || extraction.target_scope === "both" ? extraction.target_scope : "single");

  const effectiveContactId = body.target_contact_id ?? extraction.contact_id;
  if (!effectiveContactId) {
    return NextResponse.json({ error: "No contact selected" }, { status: 400 });
  }

  const targetContactIds = effectiveScope === "both"
    ? await resolvePartnerContactIds(supabase, effectiveContactId, extraction.journey_id)
    : [effectiveContactId];

  await supabase
    .from("call_data_extractions")
    .update({
      saved_to_profile: true,
      contact_id: effectiveContactId,
      target_scope: effectiveScope,
    })
    .eq("id", extractionId);

  const contactColumn = FIELD_MAP[extraction.field_key];

  for (const cid of targetContactIds) {
    const { error: profileError } = await supabase
      .from("contact_profile_fields")
      .upsert(
        {
          contact_id: cid,
          field_name: extraction.field_key,
          field_value: JSON.stringify(extraction.extracted_value),
          last_updated_by: "ai",
          last_updated_at: now,
        },
        { onConflict: "contact_id,field_name" }
      );

    if (profileError) {
      console.error("[save-extraction] profile upsert failed:", profileError.message, "for contact", cid, "field", extraction.field_key);
      if (contactColumn) {
        await supabase
          .from("contacts")
          .update({ [contactColumn]: extraction.extracted_value })
          .eq("id", cid);
      }
    }
  }

  return NextResponse.json({
    success: true,
    saved_to_contact_ids: targetContactIds,
    fanout_count: targetContactIds.length,
    scope: effectiveScope,
  });
}

async function resolvePartnerContactIds(
  supabase: ReturnType<typeof createServerClient>,
  seedContactId: string,
  extractionJourneyId: string | null,
): Promise<string[]> {
  let journeyId = extractionJourneyId;
  if (!journeyId) {
    const { data: journey } = await supabase
      .from("journeys")
      .select("id")
      .eq("primary_contact_id", seedContactId)
      .maybeSingle();
    journeyId = journey?.id ?? null;
  }
  if (!journeyId) return [seedContactId];

  const { data: members } = await supabase
    .from("journey_contacts")
    .select("contact_id, role")
    .eq("journey_id", journeyId)
    .is("left_at", null)
    .in("role", ["primary", "co_primary"]);

  const ids = new Set<string>([seedContactId]);
  for (const m of members ?? []) {
    if (m.contact_id) ids.add(m.contact_id);
  }
  return [...ids];
}
