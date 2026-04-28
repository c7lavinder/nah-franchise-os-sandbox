export const dynamic = "force-dynamic";

/**
 * POST /api/leads/score-all
 *
 * Recalculates lead scores for all active pipeline leads and saves to GHL.
 * Intended for cron jobs or manual trigger from admin.
 * Returns summary: total scored, score distribution by tier.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { calculateLeadScore, buildScoringInput } from "@/lib/profile/lead-scoring";

export async function POST(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  try {
    // Get NAH pipelines + open opportunities
    const allPipelines = await ghl.getPipelines();
    const nahPipelines = allPipelines.filter((p) => p.name.startsWith("NAH Franchise Sales"));

    const openOpps = [];
    for (const pipeline of nahPipelines) {
      try {
        const opps = await ghl.searchOpportunitiesPaginated({
          pipelineId: pipeline.id,
          status: "open",
        });
        openOpps.push(...opps);
      } catch {
        // Continue
      }
    }

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

    const scoreFieldId = nameToId.get("Scout Lead Score");
    const breakdownFieldId = nameToId.get("Score Breakdown");

    if (!scoreFieldId) {
      return NextResponse.json({
        error: "Scout Lead Score field not found in ghl_custom_fields cache. Run setup script first.",
      }, { status: 400 });
    }

    // Unique contact IDs
    const contactIds = [...new Set(openOpps.map((o) => o.contactId))];

    let scored = 0;
    let saved = 0;
    let failed = 0;
    const tierCounts: Record<string, number> = { Hot: 0, Warm: 0, Cool: 0, Cold: 0 };

    // Process in batches
    for (let i = 0; i < contactIds.length; i += 10) {
      const batch = contactIds.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (contactId) => {
          const contact = await ghl.getContact(contactId);

          // Extract profile
          const profile: Record<string, string | null> = {};
          for (const cf of contact.customFields) {
            const name = idToName.get(cf.id);
            if (name && cf.value) profile[name] = cf.value;
          }

          // Calculate score
          const input = buildScoringInput(
            { source: contact.source, dateAdded: contact.dateAdded },
            profile
          );
          const result = calculateLeadScore(input);
          scored++;
          tierCounts[result.tier] = (tierCounts[result.tier] ?? 0) + 1;

          // Save to GHL
          const customFields: { id: string; value: string }[] = [
            { id: scoreFieldId, value: String(result.total) },
          ];
          if (breakdownFieldId) {
            customFields.push({ id: breakdownFieldId, value: result.breakdown });
          }

          await ghl.updateContact(contactId, { customFields });
          saved++;
        })
      );

      for (const r of results) {
        if (r.status === "rejected") failed++;
      }
    }

    return NextResponse.json({
      totalContacts: contactIds.length,
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
