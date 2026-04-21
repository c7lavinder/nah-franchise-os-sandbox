export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/stages
 *
 * Returns all pipeline stages with active counts. Phase 3 cutover: counts
 * come from journey_pipeline_state instead of contact_pipeline_state. Because
 * runway/onboarding jps rows fan out per territory, the counts naturally
 * reflect "territories in stage" for those pipelines — the special-case
 * territory-counting logic the old route needed is no longer required.
 *
 * Response shape (unchanged):
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

    const { data: pipelines, error: pipeError } = await supabase
      .from("pipelines")
      .select("id, slug, name, sort_order, is_visible_in_nav")
      .eq("is_active", true)
      .eq("is_visible_in_nav", true)
      .order("sort_order");

    if (pipeError) {
      return NextResponse.json({ error: pipeError.message }, { status: 500 });
    }

    const { data: stages, error: stageError } = await supabase
      .from("pipeline_stages")
      .select("id, slug, name, sort_order, is_terminal, pipeline_id")
      .order("sort_order");

    if (stageError) {
      return NextResponse.json({ error: stageError.message }, { status: 500 });
    }

    const countMap = new Map<string, number>();

    const { data: pipelineMeta } = await supabase
      .from("pipelines")
      .select("id, slug, entity_type")
      .eq("is_active", true);
    const entityTypeMap = new Map<string, string>();
    for (const p of pipelineMeta ?? []) entityTypeMap.set(p.id, p.entity_type ?? "contact");

    // Territories pipeline is entity_type=territory — count from the
    // territories table by status matching the stage slug.
    const territoriesPipeline = (pipelineMeta ?? []).find((p) => p.slug === "territories");
    if (territoriesPipeline) {
      const statusMap: Record<string, string> = { active: "active", inactive: "inactive", available: "available" };
      for (const stage of (stages ?? []).filter((s) => s.pipeline_id === territoriesPipeline.id)) {
        const status = statusMap[stage.slug];
        if (status) {
          const { count } = await supabase
            .from("territories")
            .select("ms_slug", { count: "exact", head: true })
            .eq("status", status);
          countMap.set(stage.id, count ?? 0);
        }
      }
    }

    // Every other stage counts from journey_pipeline_state. Runway and
    // onboarding fan out one row per (journey, territory), so a single jps
    // count gives the right "territories in stage" number without a special
    // case. Sales / Followup / other contact pipelines keep one jps row per
    // (journey, pipeline) so the numbers match 1:1 with the old cps counts.
    const remainingStageIds = (stages ?? [])
      .filter((s) => !countMap.has(s.id))
      .map((s) => s.id);

    const countPromises = remainingStageIds.map(async (stageId) => {
      const { count } = await supabase
        .from("journey_pipeline_state")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("current_stage_id", stageId);
      return { stageId, count: count ?? 0 };
    });

    const countResults = await Promise.all(countPromises);
    for (const { stageId, count } of countResults) {
      countMap.set(stageId, count);
    }

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
