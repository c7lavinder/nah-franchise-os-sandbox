export const dynamic = "force-dynamic";

/**
 * POST /api/intelligence/bootstrap
 *
 * Creates candidate_intelligence profiles for active pipeline leads.
 *
 * Query params:
 * - contactId (optional): bootstrap a single contact instead of all
 *
 * Returns:
 * - { created, skipped, errors, details } for batch
 * - { result: BootstrapContactResult } for single contact
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import {
  bootstrapContactProfile,
  bootstrapAllActiveLeads,
} from "@/lib/intelligence/bootstrap";

export async function POST(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");

    if (contactId) {
      // Single contact bootstrap
      const result = await bootstrapContactProfile(contactId);

      if (result.error) {
        return NextResponse.json(
          { error: result.error, result },
          { status: 422 }
        );
      }

      return NextResponse.json({ result });
    }

    // Full batch bootstrap
    const results = await bootstrapAllActiveLeads();

    return NextResponse.json({
      created: results.created,
      skipped: results.skipped,
      errorCount: results.errors.length,
      errors: results.errors,
      details: results.details,
    });
  } catch (err) {
    console.error("Bootstrap error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
