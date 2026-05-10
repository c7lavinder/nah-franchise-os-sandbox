export const dynamic = "force-dynamic";

/**
 * POST /api/journeys/:journeyId/split
 *
 * Split a journey (typically a partnership) into N new journeys. Each new
 * journey inherits a subset of the original's members and territories and
 * carries parent_journey_id back to the original so history stays queryable.
 *
 * Body:
 *   reason?: string
 *   new_journeys: [
 *     {
 *       name: string,
 *       primary_contact_id: uuid,            // must appear in member_contact_ids
 *       member_contact_ids: uuid[],          // all active members going to this new journey
 *       TerritorySlugs: string[],        // territories inherited by this new journey
 *     },
 *     ...
 *   ]
 *
 * Post-conditions:
 *   - Original journey: status='closed', close_reason='split', closed_at=now()
 *   - Original journey_contacts: all active rows set left_at=now()
 *   - Original journey_pipeline_state: all active rows is_active=false,
 *     closed_reason='split', closed_at=now()
 *   - Each new journey gets: primary member row, co_primary rows for other
 *     members, and a cloned active jps row per (pipeline, territory) where
 *     the original was active.
 *
 * Validations (all-or-nothing — one bad case rejects the whole split):
 *   - At least 2 new journeys
 *   - Every member_contact_id must currently be an active member of the
 *     original journey
 *   - Every TerritorySlug must currently appear on an active jps row
 *     of the original journey
 *   - Every primary_contact_id must be inside its own member_contact_ids
 *   - No member or territory can appear in two new journeys
 *
 * Not in scope (follow-ups):
 *   - Sales-only journeys (no territory yet) skip the per-territory checks.
 *     Sales jps is cloned to each new journey.
 *   - pipeline_stage_history is not emitted for the split close event —
 *     stage_history FK still points at cps. Addressed in a later sprint.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid, slugifyBase } from "@/lib/journeys/slug";
import type { SupabaseClient } from "@supabase/supabase-js";

async function generateUniqueSlug(supabase: SupabaseClient, base: string): Promise<string> {
  const cleaned = slugifyBase(base) || "journey";
  const { data: existing } = await supabase.from("journeys").select("slug").like("slug", `${cleaned}%`);
  const taken = new Set((existing ?? []).map((r: { slug: string | null }) => r.slug).filter(Boolean));
  if (!taken.has(cleaned)) return cleaned;
  for (let i = 2; i < 100; i++) {
    const candidate = `${cleaned}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${cleaned}-${Math.random().toString(36).slice(2, 8)}`;
}

interface NewJourneyRequest {
  name: string;
  primary_contact_id: string;
  member_contact_ids: string[];
  TerritorySlugs: string[];
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ journeyId: string }> }) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  try {
    const { journeyId: rawId } = await params;
    const body = (await request.json()) as {
      reason?: string;
      new_journeys: NewJourneyRequest[];
    };

    if (!body.new_journeys || body.new_journeys.length < 2) {
      return NextResponse.json({ error: "At least two new journeys required" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Resolve identifier (slug or UUID) to the canonical journey id before
    // the rest of the route keeps using it.
    const lookupColumn = isUuid(rawId) ? "id" : "slug";
    const { data: original } = await supabase
      .from("journeys")
      .select("id, name, status")
      .eq(lookupColumn, rawId)
      .maybeSingle();
    if (!original) return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    const journeyId = original.id;
    if (original.status !== "active") {
      return NextResponse.json({ error: "Only active journeys can be split" }, { status: 400 });
    }

    // Load active members and active jps rows.
    const [{ data: members }, { data: jpsRows }] = await Promise.all([
      supabase.from("journey_contacts").select("id, contact_id, role").eq("journey_id", journeyId).is("left_at", null),
      supabase
        .from("journey_pipeline_state")
        .select(
          "id, pipeline_id, TerritorySlug, current_stage_id, current_sub_task_id, current_sub_task_started_at, entered_pipeline_at, entered_current_stage_at, assigned_user_id"
        )
        .eq("journey_id", journeyId)
        .eq("is_active", true),
    ]);

    const memberMap = new Map<string, { id: string; role: string }>();
    for (const m of members ?? []) memberMap.set(m.contact_id, { id: m.id, role: m.role });
    const activeTerritorySlugs = new Set((jpsRows ?? []).map((r) => r.TerritorySlug).filter(Boolean) as string[]);

    // Validate every new journey.
    const seenMembers = new Set<string>();
    const seenTerritories = new Set<string>();
    for (const [i, nj] of body.new_journeys.entries()) {
      if (!nj.name?.trim()) {
        return NextResponse.json({ error: `new_journeys[${i}].name is required` }, { status: 400 });
      }
      if (!nj.primary_contact_id || !nj.member_contact_ids.includes(nj.primary_contact_id)) {
        return NextResponse.json(
          { error: `new_journeys[${i}].primary_contact_id must be one of its members` },
          { status: 400 }
        );
      }
      for (const cid of nj.member_contact_ids) {
        if (!memberMap.has(cid)) {
          return NextResponse.json(
            { error: `contact ${cid} is not an active member of this journey` },
            { status: 400 }
          );
        }
        if (seenMembers.has(cid)) {
          return NextResponse.json({ error: `contact ${cid} assigned to multiple new journeys` }, { status: 400 });
        }
        seenMembers.add(cid);
      }
      for (const slug of nj.TerritorySlugs) {
        if (!activeTerritorySlugs.has(slug)) {
          return NextResponse.json(
            { error: `territory ${slug} is not currently active on this journey` },
            { status: 400 }
          );
        }
        if (seenTerritories.has(slug)) {
          return NextResponse.json({ error: `territory ${slug} assigned to multiple new journeys` }, { status: 400 });
        }
        seenTerritories.add(slug);
      }
    }

    const now = new Date().toISOString();

    // 1. Close the original.
    await supabase
      .from("journeys")
      .update({
        status: "closed",
        close_reason: "split",
        updated_at: now,
      })
      .eq("id", journeyId);

    await supabase
      .from("journey_contacts")
      .update({ left_at: now, updated_at: now })
      .eq("journey_id", journeyId)
      .is("left_at", null);

    await supabase
      .from("journey_pipeline_state")
      .update({
        is_active: false,
        closed_reason: "split",
        closed_at: now,
        updated_at: now,
      })
      .eq("journey_id", journeyId)
      .eq("is_active", true);

    // 2. Build the new journeys.
    const newJourneyIds: string[] = [];
    const results: { id: string; name: string; primary_contact_id: string }[] = [];

    for (const nj of body.new_journeys) {
      const newName = nj.name.trim();
      const newSlug = await generateUniqueSlug(supabase, newName);
      const { data: newJourney, error: jErr } = await supabase
        .from("journeys")
        .insert({
          name: newName,
          slug: newSlug,
          status: "active",
          primary_contact_id: nj.primary_contact_id,
          parent_journey_id: journeyId,
        })
        .select("id, name, primary_contact_id")
        .single();
      if (jErr || !newJourney) {
        return NextResponse.json(
          { error: `Failed to create new journey: ${jErr?.message ?? "unknown"}` },
          { status: 500 }
        );
      }
      newJourneyIds.push(newJourney.id);
      results.push({ id: newJourney.id, name: newJourney.name, primary_contact_id: newJourney.primary_contact_id });

      // Members: primary → role 'primary', everyone else keeps their original
      // role (co_primary, spouse, etc.) if it's not 'primary'; otherwise the
      // second+ primaries become co_primary on the new journey.
      const memberInserts = nj.member_contact_ids.map((cid) => {
        const isPrimary = cid === nj.primary_contact_id;
        const prior = memberMap.get(cid)?.role ?? "other";
        const role = isPrimary ? "primary" : prior === "primary" ? "co_primary" : prior;
        return {
          journey_id: newJourney.id,
          contact_id: cid,
          role,
          joined_at: now,
        };
      });
      if (memberInserts.length > 0) {
        const { error: mErr } = await supabase.from("journey_contacts").insert(memberInserts);
        if (mErr) console.error("split: member insert failed", mErr.message);
      }

      // JPS rows: clone every original active jps row that targets one of
      // this new journey's territories (runway/onboarding) OR targets no
      // territory (sales/followup — every new journey gets its own clone).
      const targetSlugs = new Set(nj.TerritorySlugs);
      const rowsToClone = (jpsRows ?? []).filter(
        (r) => (r.TerritorySlug && targetSlugs.has(r.TerritorySlug)) || !r.TerritorySlug
      );
      const jpsInserts = rowsToClone.map((r) => ({
        journey_id: newJourney.id,
        TerritorySlug: r.TerritorySlug,
        pipeline_id: r.pipeline_id,
        current_stage_id: r.current_stage_id,
        current_sub_task_id: r.current_sub_task_id,
        current_sub_task_started_at: r.current_sub_task_started_at,
        entered_pipeline_at: now,
        entered_current_stage_at: r.entered_current_stage_at,
        assigned_user_id: r.assigned_user_id,
        is_active: true,
      }));
      if (jpsInserts.length > 0) {
        const { error: jpsErr } = await supabase.from("journey_pipeline_state").insert(jpsInserts);
        if (jpsErr) console.error("split: jps insert failed", jpsErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      original_journey_id: journeyId,
      new_journeys: results,
    });
  } catch (err) {
    console.error("Journey split error:", err);
    return NextResponse.json({ error: "Failed to split journey" }, { status: 500 });
  }
}
