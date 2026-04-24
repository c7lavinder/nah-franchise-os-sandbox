export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/data/:extractionId/save
 *
 * Marks a call_data_extractions row as saved_to_profile = true and writes the
 * extracted value to contact_profile_fields.
 *
 * Targeting resolution (in priority order):
 *   1. Request body override { target_contact_id, target_scope } — set by the
 *      UI's segmented partner picker when the rep flips Scout's pick.
 *   2. Stored target_scope on the extraction row — filled by Scout's
 *      partnership-aware prompt ('single' | 'both').
 *   3. Legacy default — write only to extraction.contact_id.
 *
 * When scope === 'both' the field fans out to every active primary + co_primary
 * on the journey so partnership profiles (Kevin + Kylie Kremer) stay in sync.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** Maps extraction field_key → contacts table column name (legacy fallback). */
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
  /** Override: the rep picked a specific partner (via UI segmented picker). */
  target_contact_id?: string;
  /** Override: 'single' or 'both'. Wins over the row's stored scope. */
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
    .select("id, call_id, contact_id, journey_id, field_key, field_category, extracted_value, target_scope")
    .eq("id", extractionId)
    .eq("call_id", callId)
    .single();

  if (!extraction) {
    return NextResponse.json({ error: "Extraction not found" }, { status: 404 });
  }
  if (!extraction.extracted_value) {
    return NextResponse.json({ error: "No value to save" }, { status: 400 });
  }

  // Effective target: body override > stored scope > legacy single.
  const effectiveScope: "single" | "both" =
    body.target_scope
    ?? (extraction.target_scope === "single" || extraction.target_scope === "both" ? extraction.target_scope : "single");

  const effectiveContactId = body.target_contact_id ?? extraction.contact_id;
  if (!effectiveContactId) {
    return NextResponse.json({ error: "No contact linked to this extraction" }, { status: 400 });
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
  const now = new Date().toISOString();

  // contact_profile_fields schema: field_name (text), field_value (jsonb),
  // last_updated_by (text CHECK in 'api'|'ai'|'manual'|'system'), last_updated_at.
  // The unique key is (contact_id, field_name).
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

/**
 * Return every active primary + co_primary contact on the extraction's journey.
 * Falls back to just the seed contact if the journey can't be resolved.
 */
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
