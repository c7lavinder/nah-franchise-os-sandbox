export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/[contactId]/score
 *
 * Calculates lead score for a contact from Supabase profile data
 * and saves the score to contacts.scout_lead_score.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { calculateLeadScore, buildScoringInputFromContact } from "@/lib/profile/lead-scoring";

export async function POST(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const { contactId } = await params;
    const supabase = createServerClient();

    const { data: contact, error } = await supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, source, opportunity_source, NonRetirementCapitalAvailable, territory_status, BriefWorkHistory, investment_timeline, WhatInterestsInOpportunity, trainual_completion_pct, created_at"
      )
      .eq("id", contactId)
      .single();

    if (error || !contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const input = buildScoringInputFromContact(contact);
    const result = calculateLeadScore(input);

    // Save score to Supabase
    await supabase.from("contacts").update({ scout_lead_score: result.total }).eq("id", contactId);

    const contactName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();

    return NextResponse.json({
      contactId,
      contactName,
      score: result.total,
      tier: result.tier,
      breakdown: result.breakdown,
      components: result.components,
    });
  } catch (err) {
    console.error("Score calculation failed:", err);
    return NextResponse.json({ error: "Failed to calculate score" }, { status: 502 });
  }
}
