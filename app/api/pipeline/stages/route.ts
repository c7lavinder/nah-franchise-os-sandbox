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
      .select("id, slug, name, sort_order, is_visible_in_nav")
      .eq("is_active", true)
      .eq("is_visible_in_nav", true)
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

    // Fetch active counts per stage
    // Contact pipelines: count from contact_pipeline_state
    // Territories pipeline: count from territories table by status
    const countMap = new Map<string, number>();

    // Build pipeline entity_type lookup
    const { data: pipelineMeta } = await supabase
      .from("pipelines")
      .select("id, slug, entity_type")
      .eq("is_active", true);
    const entityTypeMap = new Map<string, string>();
    for (const p of pipelineMeta ?? []) entityTypeMap.set(p.id, p.entity_type ?? "contact");

    // Territories pipeline: count by territory status matching stage slug
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

    // Onboarding + Runway: count territories (not contacts) per stage
    // A contact may own multiple territories, so count territories via territory_owners
    const onboardingPipeline = (pipelineMeta ?? []).find((p) => p.slug === "onboarding");
    const runwayPipeline = (pipelineMeta ?? []).find((p) => p.slug === "runway");
    const territoryCountPipelineIds = new Set<string>();
    if (onboardingPipeline) territoryCountPipelineIds.add(onboardingPipeline.id);
    if (runwayPipeline) territoryCountPipelineIds.add(runwayPipeline.id);

    for (const pipelineId of territoryCountPipelineIds) {
      const pipelineStages = (stages ?? []).filter((s) => s.pipeline_id === pipelineId);
      for (const stage of pipelineStages) {
        // Get contacts in this stage
        const { data: stateRows } = await supabase
          .from("contact_pipeline_state")
          .select("contact_id")
          .eq("current_stage_id", stage.id)
          .eq("is_active", true);

        if (!stateRows || stateRows.length === 0) {
          countMap.set(stage.id, 0);
          continue;
        }

        // Get ghl_contact_ids for these contacts
        const { data: contactRows } = await supabase
          .from("contacts")
          .select("ghl_contact_id")
          .in("id", stateRows.map((r) => r.contact_id));

        const ghlIds = (contactRows ?? []).map((c) => c.ghl_contact_id).filter(Boolean) as string[];

        // Count territories owned by these contacts
        const { count: territoryCount } = await supabase
          .from("territory_owners")
          .select("id", { count: "exact", head: true })
          .in("ghl_contact_id", ghlIds.length > 0 ? ghlIds : ["__none__"])
          .is("end_date", null);

        countMap.set(stage.id, territoryCount ?? 0);
      }
    }

    // Contact pipeline stages: count from contact_pipeline_state (skip already counted)
    const contactStageIds = (stages ?? [])
      .filter((s) => !countMap.has(s.id))
      .map((s) => s.id);

    const countPromises = contactStageIds.map(async (stageId) => {
      const { count } = await supabase
        .from("contact_pipeline_state")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("current_stage_id", stageId);
      return { stageId, count: count ?? 0 };
    });

    const countResults = await Promise.all(countPromises);
    for (const { stageId, count } of countResults) {
      countMap.set(stageId, count);
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
