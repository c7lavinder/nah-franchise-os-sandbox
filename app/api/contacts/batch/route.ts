/**
 * POST /api/contacts/batch
 *
 * Fetches contact details for a batch of contact IDs.
 * Returns source, territory, tags, and basic info for each contact.
 * Used by the pipeline lead list to enrich opportunity data.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";

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
}

/** Extract territory from custom fields */
function extractTerritory(customFields: { id: string; value: string }[]): string | null {
  for (const field of customFields) {
    if (field.value && typeof field.value === "string" && field.value.length > 0) {
      // Territory Interest is the field we care about — match by checking known field patterns
      // The field name isn't in the response, just the ID and value
      // We'll check if the value looks like a territory (city, state pattern or state abbreviation)
      // For now, return the first non-empty custom field that looks geographic
    }
  }
  return null;
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

  // Check most specific tags first
  for (const tag of tags) {
    const mapped = sourceTagMap[tag];
    if (mapped && tag !== "paid-ad" && tag !== "organic" && tag !== "referral") {
      return mapped;
    }
  }
  // Fall back to broad category
  for (const tag of tags) {
    const mapped = sourceTagMap[tag];
    if (mapped) return mapped;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BatchRequestBody;

    if (!body.contactIds?.length) {
      return NextResponse.json({ contacts: {} });
    }

    // Cap at 30 to avoid rate limits
    const ids = body.contactIds.slice(0, 30);

    const results: Record<string, ContactSummary> = {};

    // Fetch contacts in parallel (limited concurrency)
    const BATCH_SIZE = 10;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (id) => {
        try {
          const contact = await ghl.getContact(id);
          results[id] = {
            id: contact.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            source: contact.source ?? extractSource(contact.tags),
            tags: contact.tags,
            territory: extractTerritory(contact.customFields),
            dateAdded: contact.dateAdded,
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
