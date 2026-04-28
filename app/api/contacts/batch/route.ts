export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/batch
 *
 * Fetches contact details for a batch of contact IDs.
 * Returns source, territory, tags, lead score, and basic info for each contact.
 * Used by the pipeline lead list to enrich opportunity data.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { calculateLeadScore, buildScoringInput } from "@/lib/profile/lead-scoring";

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

/** Load field ID → name mapping from Supabase */
async function loadFieldMapping(): Promise<Map<string, string>> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("ghl_custom_fields")
    .select("field_name, ghl_field_id")
    .eq("entity_type", "contact");

  const map = new Map<string, string>();
  if (data) {
    for (const m of data) {
      map.set(m.ghl_field_id, m.field_name);
    }
  }
  return map;
}

/** Extract source detail from tags */
function extractSource(tags: string[]): string | null {
  const sourceTagMap: Record<string, string> = {
    "google-ads": "Google Ads",
    "facebook": "Facebook",
    "linkedin": "LinkedIn",
    "youtube": "YouTube",
    "fbr": "FBR",
    "referral": "Referral",
    "referral-corey": "Referral (Corey)",
    "website-form": "Website",
    "franchise-show": "Franchise Show",
    "organic": "Organic",
    "paid-ad": "Paid Ad",
    "unknown-source": "Unknown",
  };

  for (const tag of tags) {
    const mapped = sourceTagMap[tag];
    if (mapped && tag !== "paid-ad" && tag !== "organic" && tag !== "referral") {
      return mapped;
    }
  }
  for (const tag of tags) {
    const mapped = sourceTagMap[tag];
    if (mapped) return mapped;
  }
  return null;
}

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
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
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  try {
    const body = (await request.json()) as BatchRequestBody;

    if (!body.contactIds?.length) {
      return NextResponse.json({ contacts: {} });
    }

    const ids = body.contactIds.slice(0, 30);

    // Load field mapping once for all contacts
    const fieldMapping = await loadFieldMapping();
    const hasFieldMapping = fieldMapping.size > 0;

    const results: Record<string, ContactSummary> = {};

    const BATCH_SIZE = 10;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (id) => {
        try {
          const contact = await ghl.getContact(id);

          // Extract profile fields for scoring
          const profile: Record<string, string | null> = {};
          let territory: string | null = null;

          if (hasFieldMapping) {
            for (const cf of contact.customFields) {
              const name = fieldMapping.get(cf.id);
              if (name && cf.value) {
                profile[name] = cf.value;
                if (name === "Territory Interest") territory = cf.value;
              }
            }
          }

          // Calculate lead score if we have field mapping
          let leadScore: number | null = null;
          let scoreTier: string | null = null;

          if (hasFieldMapping) {
            const input = buildScoringInput(
              { source: contact.source, dateAdded: contact.dateAdded },
              profile
            );
            const result = calculateLeadScore(input);
            leadScore = result.total;
            scoreTier = result.tier;
          }

          results[id] = {
            id: contact.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            source: contact.source ?? extractSource(contact.tags),
            tags: contact.tags,
            territory,
            dateAdded: contact.dateAdded,
            leadScore,
            scoreTier,
          };
        } catch {
          // Skip contacts that fail to fetch
        }
      });
      await Promise.all(promises);
    }

    return NextResponse.json({ contacts: results });
  } catch (err) {
    console.error("Batch contact fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}
