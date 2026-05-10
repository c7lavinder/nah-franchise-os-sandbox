export const dynamic = "force-dynamic";

/**
 * POST /api/leads/score-all
 *
 * Recalculates lead scores for all non-converted contacts from Supabase
 * and saves results to contacts.scout_lead_score.
 * Intended for cron jobs or manual trigger from admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { calculateLeadScore, buildScoringInputFromContact } from "@/lib/profile/lead-scoring";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const supabase = createServerClient();

    // Fetch all non-converted, non-merged contacts
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select(
        "id, source, opportunity_source, NonRetirementCapitalAvailable, territory_status, BriefWorkHistory, investment_timeline, WhatInterestsInOpportunity, trainual_completion_pct, created_at"
      )
      .eq("is_converted_franchisee", false)
      .is("merged_into_contact_id", null);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
    }

    let scored = 0;
    let saved = 0;
    let failed = 0;
    const tierCounts: Record<string, number> = { Hot: 0, Warm: 0, Cool: 0, Cold: 0 };

    // Process in batches of 50
    for (let i = 0; i < contacts.length; i += 50) {
      const batch = contacts.slice(i, i + 50);
      const updates: { id: string; scout_lead_score: number }[] = [];

      for (const contact of batch) {
        try {
          const input = buildScoringInputFromContact(contact);
          const result = calculateLeadScore(input);
          scored++;
          tierCounts[result.tier] = (tierCounts[result.tier] ?? 0) + 1;
          updates.push({ id: contact.id, scout_lead_score: result.total });
        } catch {
          failed++;
        }
      }

      // Batch update scores
      for (const u of updates) {
        const { error: updateErr } = await supabase
          .from("contacts")
          .update({ scout_lead_score: u.scout_lead_score })
          .eq("id", u.id);
        if (updateErr) failed++;
        else saved++;
      }
    }

    return NextResponse.json({
      totalContacts: contacts.length,
      scored,
      saved,
      failed,
      tiers: tierCounts,
    });
  } catch (err) {
    console.error("Bulk scoring failed:", err);
    return NextResponse.json({ error: "Bulk scoring failed" }, { status: 502 });
  }
}
