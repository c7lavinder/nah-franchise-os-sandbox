export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline
 *
 * Returns all pipelines whose name starts with "NAH Franchise Sales"
 * with their stages and lead counts from GHL.
 * Falls back gracefully if GHL is unavailable.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import * as ghl from "@/lib/ghl";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  try {
    const allPipelines = await ghl.getPipelines();

    // Filter to NAH pipelines, fall back to all if none match
    const nahPipelines = allPipelines.filter((p) =>
      p.name.startsWith("NAH Franchise Sales")
    );
    const pipelines = nahPipelines.length > 0 ? nahPipelines : allPipelines;

    // Build response with lead counts per stage
    const result = await Promise.all(
      pipelines.map(async (pipeline) => {
        let opportunities: { pipelineStageId: string }[] = [];
        try {
          opportunities = await ghl.searchOpportunities({
            pipelineId: pipeline.id,
            status: "open",
          });
        } catch {
          // If opportunity search fails, just show 0 counts
        }

        const stages = pipeline.stages.map((stage) => ({
          id: stage.id,
          name: stage.name.trim(),
          count: opportunities.filter((o) => o.pipelineStageId === stage.id).length,
        }));

        return {
          name: pipeline.name,
          stages,
        };
      })
    );

    return NextResponse.json({ pipelines: result });
  } catch (err) {
    console.error("Pipeline fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch pipelines from GHL" },
      { status: 502 }
    );
  }
}
