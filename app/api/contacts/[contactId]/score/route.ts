/**
 * POST /api/contacts/[contactId]/score
 *
 * Calculates lead score for a contact based on their profile fields
 * and optionally saves the score + breakdown back to GHL.
 *
 * Query params:
 *   ?save=true — write score back to GHL custom fields
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { calculateLeadScore, buildScoringInput } from "@/lib/profile/lead-scoring";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    const shouldSave = request.nextUrl.searchParams.get("save") === "true";

    // Fetch contact
    const contact = await ghl.getContact(contactId);

    // Load field mapping
    const supabase = createServerClient();
    const { data: fieldMappings } = await supabase
      .from("ghl_custom_fields")
      .select("field_name, ghl_field_id")
      .eq("entity_type", "contact");

    const idToName = new Map<string, string>();
    const nameToId = new Map<string, string>();
    if (fieldMappings) {
      for (const m of fieldMappings) {
        idToName.set(m.ghl_field_id, m.field_name);
        nameToId.set(m.field_name, m.ghl_field_id);
      }
    }

    // Extract profile values
    const profile: Record<string, string | null> = {};
    for (const cf of contact.customFields) {
      const name = idToName.get(cf.id);
      if (name) {
        profile[name] = cf.value || null;
      }
    }

    // Calculate score
    const scoringInput = buildScoringInput(
      { source: contact.source, dateAdded: contact.dateAdded },
      profile
    );
    const result = calculateLeadScore(scoringInput);

    // Save score back to GHL if requested
    if (shouldSave) {
      const customFields: { id: string; value: string }[] = [];

      const scoreFieldId = nameToId.get("Scout Lead Score");
      if (scoreFieldId) {
        customFields.push({ id: scoreFieldId, value: String(result.total) });
      }

      const breakdownFieldId = nameToId.get("Score Breakdown");
      if (breakdownFieldId) {
        customFields.push({ id: breakdownFieldId, value: result.breakdown });
      }

      if (customFields.length > 0) {
        await ghl.updateContact(contactId, { customFields });
      }
    }

    const contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim();

    return NextResponse.json({
      contactId,
      contactName,
      score: result.total,
      tier: result.tier,
      breakdown: result.breakdown,
      components: result.components,
      saved: shouldSave,
    });
  } catch (err) {
    console.error("Score calculation failed:", err);
    return NextResponse.json({ error: "Failed to calculate score" }, { status: 502 });
  }
}
