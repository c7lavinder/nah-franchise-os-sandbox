export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/batch
 *
 * Fetches contact details for a batch of GHL contact IDs from Supabase.
 * Returns source, territory, lead score, and basic info for each contact.
 * Used by the pipeline lead list to enrich opportunity data.
 *
 * GET /api/contacts/batch?needs_review=true&count_only=true
 * Returns count of contacts needing review.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { calculateLeadScore, buildScoringInputFromContact } from "@/lib/profile/lead-scoring";

interface BatchRequestBody {
  contactIds: string[];
}

interface ContactSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  tags: string[];
  territory: string | null;
  dateAdded: string;
  leadScore: number | null;
  scoreTier: string | null;
}

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const { searchParams } = new URL(request.url);
  const needsReview = searchParams.get("needs_review");
  const countOnly = searchParams.get("count_only");

  if (needsReview === "true" && countOnly === "true") {
    const supabase = createServerClient();
    const { count } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("needs_review", true);
    return NextResponse.json({ count: count ?? 0 });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  try {
    const body = (await request.json()) as BatchRequestBody;

    if (!body.contactIds?.length) {
      return NextResponse.json({ contacts: {} });
    }

    const ids = body.contactIds.slice(0, 30);
    const supabase = createServerClient();

    // Fetch all contacts from Supabase in one query
    const { data: contacts } = await supabase
      .from("contacts")
      .select(
        "ghl_contact_id, first_name, last_name, email, phone, source, opportunity_source, territory_interest, NonRetirementCapitalAvailable, territory_status, BriefWorkHistory, investment_timeline, WhatInterestsInOpportunity, trainual_completion_pct, scout_lead_score, created_at"
      )
      .in("ghl_contact_id", ids);

    const results: Record<string, ContactSummary> = {};

    for (const c of contacts ?? []) {
      let leadScore = c.scout_lead_score;
      let scoreTier: string | null = null;

      // Calculate score if not stored
      if (leadScore === null) {
        const input = buildScoringInputFromContact(c);
        const result = calculateLeadScore(input);
        leadScore = result.total;
        scoreTier = result.tier;
      } else {
        scoreTier = leadScore >= 80 ? "Hot" : leadScore >= 60 ? "Warm" : leadScore >= 40 ? "Cool" : "Cold";
      }

      results[c.ghl_contact_id] = {
        id: c.ghl_contact_id,
        firstName: c.first_name ?? "",
        lastName: c.last_name ?? "",
        email: c.email,
        phone: c.phone,
        source: c.opportunity_source ?? c.source,
        tags: [],
        territory: c.territory_interest,
        dateAdded: c.created_at,
        leadScore,
        scoreTier,
      };
    }

    return NextResponse.json({ contacts: results });
  } catch (err) {
    console.error("Batch contact fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}
