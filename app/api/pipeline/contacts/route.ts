export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/contacts
 *
 * Returns active pipeline contacts from Supabase for the All Leads list.
 * Replaces the old GHL-based opportunity listing.
 *
 * Query params:
 *   stage_id — filter to a specific stage (optional)
 *   pipeline — "sales" | "followup" | "all" (default "all")
 *   sort — "urgency" | "name" | "recent" (default "recent")
 *   q — search term (matches first_name, last_name, or email)
 *   limit — max results (default 50)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stageId = searchParams.get("stage_id");
    const pipelineSlug = searchParams.get("pipeline") ?? "all";
    const sort = searchParams.get("sort") ?? "recent";
    const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 5000);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const supabase = createServerClient();

    // Build the query
    let dbQuery = supabase
      .from("contact_pipeline_state")
      .select(`
        id,
        contact_id,
        pipeline_id,
        current_stage_id,
        current_sub_task_id,
        current_sub_task_started_at,
        entered_current_stage_at,
        entered_pipeline_at,
        assigned_user_id,
        is_active,
        contacts (
          id,
          first_name,
          last_name,
          email,
          phone,
          opportunity_source,
          city,
          state
        ),
        pipeline_stages (
          id,
          name,
          slug
        ),
        pipelines (
          id,
          name,
          slug
        )
      `)
      .eq("is_active", true);

    // Filter by stage
    if (stageId) {
      dbQuery = dbQuery.eq("current_stage_id", stageId);
    }

    // Filter by pipeline
    if (pipelineSlug === "sales") {
      dbQuery = dbQuery.eq("pipeline_id", "a0000000-0000-0000-0000-000000000001");
    } else if (pipelineSlug === "followup") {
      dbQuery = dbQuery.eq("pipeline_id", "a0000000-0000-0000-0000-000000000002");
    }

    // Sort
    if (sort === "recent") {
      dbQuery = dbQuery.order("entered_current_stage_at", { ascending: false });
    } else {
      dbQuery = dbQuery.order("current_sub_task_started_at", { ascending: true, nullsFirst: false });
    }

    dbQuery = dbQuery.range(offset, offset + limit - 1);

    const { data: rows, error } = await dbQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Post-process: compute urgency color + search filter
    const now = Date.now();

    type ContactRow = { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; opportunity_source: string | null; city: string | null; state: string | null };
    type StageRow = { id: string; name: string; slug: string };
    type PipelineRow = { id: string; name: string; slug: string };

    const contacts = (rows ?? [])
      .map((row) => {
        const contact = (row.contacts as unknown) as ContactRow | null;
        const stage = (row.pipeline_stages as unknown) as StageRow | null;
        const pipeline = (row.pipelines as unknown) as PipelineRow | null;

        const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || "Unknown";

        // Time-in-stage coloring per §1.14
        const subTaskStarted = row.current_sub_task_started_at
          ? new Date(row.current_sub_task_started_at).getTime()
          : row.entered_current_stage_at
            ? new Date(row.entered_current_stage_at).getTime()
            : now;
        const daysSinceSubTask = Math.floor((now - subTaskStarted) / (1000 * 60 * 60 * 24));

        let urgency: "fresh" | "at_risk" | "losing";
        let urgencyScore: number;
        if (daysSinceSubTask >= 10) {
          urgency = "losing";
          urgencyScore = 3;
        } else if (daysSinceSubTask >= 5) {
          urgency = "at_risk";
          urgencyScore = 2;
        } else {
          urgency = "fresh";
          urgencyScore = 1;
        }

        return {
          stateId: row.id,
          contactId: row.contact_id,
          name,
          email: contact?.email ?? null,
          phone: contact?.phone ?? null,
          source: contact?.opportunity_source ?? null,
          city: contact?.city ?? null,
          state: contact?.state ?? null,
          stageName: stage?.name ?? "Unknown",
          stageSlug: stage?.slug ?? "",
          stageId: row.current_stage_id,
          pipelineName: pipeline?.name ?? "Unknown",
          pipelineSlug: pipeline?.slug ?? "",
          daysSinceSubTask,
          urgency,
          urgencyScore,
          enteredStageAt: row.entered_current_stage_at,
        };
      })
      .filter((c) => {
        if (!query) return true;
        return (
          c.name.toLowerCase().includes(query) ||
          (c.email?.toLowerCase().includes(query) ?? false) ||
          (c.phone?.includes(query) ?? false)
        );
      });

    // Re-sort if urgency requested
    if (sort === "urgency") {
      contacts.sort((a, b) => b.urgencyScore - a.urgencyScore || b.daysSinceSubTask - a.daysSinceSubTask);
    } else if (sort === "name") {
      contacts.sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json({ contacts, total: contacts.length });
  } catch (err) {
    console.error("Pipeline contacts error:", err);
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}
