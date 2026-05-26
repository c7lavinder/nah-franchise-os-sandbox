export const dynamic = "force-dynamic";

/**
 * GET /api/admin/journey-briefs
 *
 * Returns all journey briefs with journey + contact context for the audit page.
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createServerClient();

  const { data: briefs, error } = await supabase
    .from("journey_briefs")
    .select(
      `journey_id, narrative, next_actions, stale, updated_at,
       journeys!inner(name, status, primary_contact_id,
         journey_contacts(contact_id, role, contacts(first_name, last_name)),
         journey_pipeline_state(current_stage_id, is_active,
           pipelines(name), pipeline_stages(name))
       )`
    )
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[admin/journey-briefs] query error:", error);
    return NextResponse.json({ error: "Failed to load briefs" }, { status: 500 });
  }

  const entries = (briefs ?? []).map((row: any) => {
    const j = Array.isArray(row.journeys) ? row.journeys[0] : row.journeys;
    const members = (j?.journey_contacts ?? []).map((jc: any) => {
      const c = Array.isArray(jc.contacts) ? jc.contacts[0] : jc.contacts;
      return {
        name: `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || "Unknown",
        role: jc.role,
      };
    });
    const activePipeline = (j?.journey_pipeline_state ?? []).find((ps: any) => ps.is_active);
    const pipelineName = activePipeline
      ? ((Array.isArray(activePipeline.pipelines)
          ? activePipeline.pipelines[0]?.name
          : activePipeline.pipelines?.name) ?? null)
      : null;
    const stageName = activePipeline
      ? ((Array.isArray(activePipeline.pipeline_stages)
          ? activePipeline.pipeline_stages[0]?.name
          : activePipeline.pipeline_stages?.name) ?? null)
      : null;

    return {
      journey_id: row.journey_id,
      journey_name: j?.name ?? "Unknown",
      journey_status: j?.status ?? null,
      members,
      pipeline: pipelineName,
      stage: stageName,
      narrative: row.narrative,
      next_actions: row.next_actions,
      stale: row.stale,
      updated_at: row.updated_at,
    };
  });

  return NextResponse.json(entries);
}
