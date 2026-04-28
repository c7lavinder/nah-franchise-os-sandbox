/**
 * GET /api/contacts/:contactId/journey — active journey memberships.
 *
 * Returns the journeys this contact is currently part of (left_at IS NULL)
 * with the role + whether they're the journey's primary contact. Each
 * journey also carries the list of active journey_pipeline_state rows so
 * downstream pickers (e.g. the call override modal) can attach a specific
 * pipeline state. Most contacts will have exactly one journey; partnerships
 * surface two.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

interface JourneyPipelineStateOption {
  id: string;
  territory_ms_slug: string | null;
  territory_name: string | null;
  stage_name: string | null;
}

interface JourneyMembership {
  journey_id: string;
  journey_slug: string | null;
  journey_name: string;
  role: string;
  is_journey_primary: boolean;
  pipeline_states: JourneyPipelineStateOption[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;

  const localContactId = await resolveContactId(contactId);
  if (!localContactId) {
    return NextResponse.json({ journeys: [] });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("journey_contacts")
    .select("role, journeys!inner(id, slug, name, primary_contact_id, status)")
    .eq("contact_id", localContactId)
    .is("left_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseJourneys = (data ?? []).flatMap((row) => {
    const j = row.journeys as unknown as {
      id: string; slug: string | null; name: string; primary_contact_id: string; status: string;
    } | null;
    if (!j || j.status !== "active") return [];
    return [{
      journey_id: j.id,
      journey_slug: j.slug,
      journey_name: j.name,
      role: row.role as string,
      is_journey_primary: j.primary_contact_id === localContactId,
    }];
  });

  // Stakeholder fallback — if the contact is linked to a territory's ecosystem
  // (employee/contractor/agent), surface the active journey on that territory
  // as a picker option. Gives the rep a way to say "Brett's call should be
  // logged against Brian's journey, not a new one for Brett himself".
  const { data: stakeRows } = await supabase
    .from("territory_stakeholders")
    .select("ms_slug, role")
    .eq("contact_id", localContactId)
    .eq("is_active", true);
  const stakeholderSlugs = [...new Set((stakeRows ?? []).map((r) => r.ms_slug))];
  const directJourneyIds = new Set(baseJourneys.map((j) => j.journey_id));

  if (stakeholderSlugs.length > 0) {
    const { data: jpsRows } = await supabase
      .from("journey_pipeline_state")
      .select("journey_id, journeys!inner(id, slug, name, primary_contact_id, status)")
      .in("territory_ms_slug", stakeholderSlugs)
      .eq("is_active", true);
    const seen = new Set<string>();
    for (const row of (jpsRows ?? []) as unknown as {
      journey_id: string;
      journeys: { id: string; slug: string | null; name: string; primary_contact_id: string; status: string } | null;
    }[]) {
      const j = row.journeys;
      if (!j || j.status !== "active") continue;
      if (directJourneyIds.has(j.id)) continue;
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      baseJourneys.push({
        journey_id: j.id,
        journey_slug: j.slug,
        journey_name: j.name,
        role: "stakeholder",
        is_journey_primary: false,
      });
    }
  }

  // Attach each journey's active jps rows so the picker can let the rep
  // target a specific (territory + pipeline) pairing on the call.
  let journeys: JourneyMembership[];
  if (baseJourneys.length === 0) {
    journeys = [];
  } else {
    const journeyIds = baseJourneys.map((j) => j.journey_id);
    const { data: jpsRows } = await supabase
      .from("journey_pipeline_state")
      .select("id, journey_id, territory_ms_slug, pipeline_stages(name)")
      .in("journey_id", journeyIds)
      .eq("is_active", true);

    const jpsByJourney = new Map<string, JourneyPipelineStateOption[]>();
    const slugSet = new Set<string>();
    for (const r of (jpsRows ?? []) as unknown as {
      id: string;
      journey_id: string;
      territory_ms_slug: string | null;
      pipeline_stages: { name: string } | { name: string }[] | null;
    }[]) {
      const stageName = Array.isArray(r.pipeline_stages)
        ? r.pipeline_stages[0]?.name ?? null
        : r.pipeline_stages?.name ?? null;
      const option: JourneyPipelineStateOption = {
        id: r.id,
        territory_ms_slug: r.territory_ms_slug,
        territory_name: null,
        stage_name: stageName,
      };
      if (r.territory_ms_slug) slugSet.add(r.territory_ms_slug);
      const list = jpsByJourney.get(r.journey_id) ?? [];
      list.push(option);
      jpsByJourney.set(r.journey_id, list);
    }

    // Resolve territory display names in one batch.
    const territoryNameMap = new Map<string, string>();
    if (slugSet.size > 0) {
      const { data: tRows } = await supabase
        .from("territories")
        .select("ms_slug, territory_name")
        .in("ms_slug", Array.from(slugSet));
      for (const t of tRows ?? []) territoryNameMap.set(t.ms_slug, t.territory_name);
    }

    journeys = baseJourneys.map((j) => ({
      ...j,
      pipeline_states: (jpsByJourney.get(j.journey_id) ?? []).map((opt) => ({
        ...opt,
        territory_name: opt.territory_ms_slug ? territoryNameMap.get(opt.territory_ms_slug) ?? null : null,
      })),
    }));
  }

  return NextResponse.json({ journeys });
}
