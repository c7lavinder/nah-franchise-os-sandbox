export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/stages
 *
 * Returns all pipeline stages with active contact counts from Supabase.
 * Replaces the old GHL-based pipeline board for the OwnershipPath component.
 *
 * Response shape:
 * {
 *   pipelines: [{
 *     id, slug, name, sort_order,
 *     stages: [{ id, slug, name, sort_order, is_terminal, active_count }]
 *   }]
 * }
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();

    // Fetch all active pipelines with their stages
    const { data: pipelines, error: pipeError } = await supabase
      .from("pipelines")
      .select("id, slug, name, sort_order")
      .eq("is_active", true)
      .order("sort_order");

    if (pipeError) {
      return NextResponse.json({ error: pipeError.message }, { status: 500 });
    }

    // Fetch all stages
    const { data: stages, error: stageError } = await supabase
      .from("pipeline_stages")
      .select("id, slug, name, sort_order, is_terminal, pipeline_id")
      .order("sort_order");

    if (stageError) {
      return NextResponse.json({ error: stageError.message }, { status: 500 });
    }

    // Fetch active contact counts per stage
    const { data: stateCounts, error: countError } = await supabase
      .from("contact_pipeline_state")
      .select("current_stage_id")
      .eq("is_active", true);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // Build count map
    const countMap = new Map<string, number>();
    for (const row of stateCounts ?? []) {
      countMap.set(row.current_stage_id, (countMap.get(row.current_stage_id) ?? 0) + 1);
    }

    // Assemble response
    const result = (pipelines ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      sort_order: p.sort_order,
      stages: (stages ?? [])
        .filter((s) => s.pipeline_id === p.id)
        .map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          sort_order: s.sort_order,
          is_terminal: s.is_terminal,
          active_count: countMap.get(s.id) ?? 0,
        })),
    }));

    return NextResponse.json({ pipelines: result });
  } catch (err) {
    console.error("Pipeline stages error:", err);
    return NextResponse.json({ error: "Failed to load pipeline stages" }, { status: 500 });
  }
}
