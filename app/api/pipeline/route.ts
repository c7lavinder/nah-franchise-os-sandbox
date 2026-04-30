export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline
 *
 * Returns all active pipelines with their stages and lead counts.
 * Reads entirely from Supabase — no GHL API calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPipelinesFromSupabase, countContactsByStage } from "@/lib/pipelines/queries";

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  try {
    const pipelines = await getPipelinesFromSupabase();

    const result = await Promise.all(
      pipelines.map(async (pipeline) => {
        const stageCounts = await countContactsByStage(pipeline.id);

        const stages = pipeline.stages.map((stage) => ({
          id: stage.id,
          name: stage.name,
          count: stageCounts.get(stage.id) ?? 0,
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
    return NextResponse.json({ error: "Failed to fetch pipelines" }, { status: 502 });
  }
}
