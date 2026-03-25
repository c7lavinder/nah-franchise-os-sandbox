export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/board
 *
 * Returns all NAH pipelines with their stages and individual opportunities.
 * Supports optional filtering by status and search query.
 *
 * Query params:
 *   status  — "open" (default), "won", "lost", "all"
 *   q       — search term (filters by opportunity name client-side, or email/phone server-side)
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import type { GHLOpportunity } from "@/types/ghl";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") ?? "open";
    const query = searchParams.get("q")?.trim() ?? "";

    const allPipelines = await ghl.getPipelines();

    // Filter to NAH pipelines
    const nahPipelines = allPipelines.filter((p) =>
      p.name.startsWith("NAH Franchise Sales")
    );
    const pipelines = nahPipelines.length > 0 ? nahPipelines : allPipelines;

    // If searching by email/phone, find matching contact IDs first
    let contactIdFilter: Set<string> | null = null;
    if (query && (query.includes("@") || /^\+?\d{7,}$/.test(query.replace(/\D/g, "")))) {
      const contacts = await ghl.searchContacts({ query, limit: 50 });
      contactIdFilter = new Set(contacts.map((c) => c.id));
    }

    // Fetch opportunities for each pipeline
    const result = await Promise.all(
      pipelines.map(async (pipeline) => {
        let opportunities: GHLOpportunity[] = [];
        try {
          const searchStatus = statusParam === "all" ? undefined : statusParam as "open" | "won" | "lost";
          opportunities = await ghl.searchOpportunitiesPaginated({
            pipelineId: pipeline.id,
            status: searchStatus,
          });
        } catch {
          // If fetch fails, show empty stages
        }

        // Filter by contact IDs if email/phone search
        if (contactIdFilter) {
          opportunities = opportunities.filter((o) => contactIdFilter!.has(o.contactId));
        }

        // Group by stage
        const stages = pipeline.stages.map((stage) => ({
          id: stage.id,
          name: stage.name.trim(),
          position: stage.position,
          opportunities: opportunities.filter((o) => o.pipelineStageId === stage.id),
        }));

        return {
          id: pipeline.id,
          name: pipeline.name,
          stages,
        };
      })
    );

    return NextResponse.json({ pipelines: result });
  } catch (err) {
    console.error("Pipeline board fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch pipeline board from GHL" },
      { status: 502 }
    );
  }
}
