export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/territory-cards?status=active|inactive|available
 *
 * Returns territory cards for the Territories pipeline on the pipeline page.
 * Each card: territory name, status, owner name, owner contact link.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const status = request.nextUrl.searchParams.get("status");
  const stageId = request.nextUrl.searchParams.get("stage_id");
  const supabase = createServerClient();

  let query = supabase
    .from("territories")
    .select("ms_slug, territory_name, status, awarded_date")
    .order("territory_name");

  if (status) {
    query = query.eq("status", status);
  }

  // If filtering by pipeline stage, find which territories have jps rows in
  // that stage. Phase 4 read migration — jps carries territory_ms_slug
  // directly, so we skip the old contact→ghl→territory_owners dance.
  if (stageId) {
    const { data: stateRows } = await supabase
      .from("journey_pipeline_state")
      .select("territory_ms_slug")
      .eq("current_stage_id", stageId)
      .eq("is_active", true)
      .not("territory_ms_slug", "is", null);

    const stageFilterSlugs = [...new Set((stateRows ?? []).map((r) => r.territory_ms_slug).filter(Boolean) as string[])];
    if (stageFilterSlugs.length === 0) {
      return NextResponse.json({ cards: [] });
    }

    query = query.in("ms_slug", stageFilterSlugs);
  }

  const { data: territories, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get current owners for all returned territories
  const slugs = (territories ?? []).map((t) => t.ms_slug);
  const { data: owners } = await supabase
    .from("territory_owners")
    .select("ms_slug, ghl_contact_id, role, contacts (first_name, last_name)")
    .in("ms_slug", slugs.length > 0 ? slugs : ["__none__"])
    .is("end_date", null);

  // Also get franchise_owners as fallback for owner name
  const { data: franchiseOwners } = await supabase
    .from("franchise_owners")
    .select("ms_slug, full_name, ghl_contact_id")
    .in("ms_slug", slugs.length > 0 ? slugs : ["__none__"]);

  const ownerMap = new Map<string, { name: string; ghlContactId: string | null }>();
  for (const fo of franchiseOwners ?? []) {
    ownerMap.set(fo.ms_slug, { name: fo.full_name, ghlContactId: fo.ghl_contact_id });
  }
  // Override with territory_owners if they exist (more current)
  for (const o of owners ?? []) {
    const c = o.contacts as unknown as { first_name: string; last_name: string } | null;
    if (c) {
      ownerMap.set(o.ms_slug, {
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
        ghlContactId: o.ghl_contact_id,
      });
    }
  }

  // Phase 4 read migration: jps carries territory_ms_slug, so we can look
  // up onboarding/runway stage directly per territory. Runway wins when both
  // are present (matches the old "first one found" behavior since a territory
  // is typically only in one of the two at a time).
  const stageBySlug = new Map<string, { stageName: string; stageSlug: string; pipelineSlug: string }>();
  if (slugs.length > 0) {
    const { data: jpsRows } = await supabase
      .from("journey_pipeline_state")
      .select("territory_ms_slug, pipeline_stages(slug, name), pipelines(slug)")
      .eq("is_active", true)
      .in("territory_ms_slug", slugs);

    for (const row of jpsRows ?? []) {
      const slug = row.territory_ms_slug as string | null;
      if (!slug) continue;
      const pSlug = (row.pipelines as unknown as { slug: string } | null)?.slug;
      const stage = row.pipeline_stages as unknown as { slug: string; name: string } | null;
      if (!stage) continue;
      if (pSlug === "onboarding" || pSlug === "runway") {
        const existing = stageBySlug.get(slug);
        if (!existing || pSlug === "runway") {
          stageBySlug.set(slug, { stageName: stage.name, stageSlug: stage.slug, pipelineSlug: pSlug });
        }
      }
    }
  }

  const cards = (territories ?? []).map((t) => {
    const owner = ownerMap.get(t.ms_slug);
    const pipelineStage = stageBySlug.get(t.ms_slug) ?? null;
    return {
      ms_slug: t.ms_slug,
      territory_name: t.territory_name,
      status: t.status,
      owner_name: owner?.name ?? null,
      owner_ghl_contact_id: owner?.ghlContactId ?? null,
      awarded_date: t.awarded_date,
      stage_name: pipelineStage?.stageName ?? null,
      stage_slug: pipelineStage?.stageSlug ?? null,
      pipeline_slug: pipelineStage?.pipelineSlug ?? null,
    };
  });

  return NextResponse.json({ cards });
}
