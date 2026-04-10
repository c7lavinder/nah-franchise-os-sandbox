export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/contacts
 *
 * Returns active pipeline contacts from Supabase for the All Leads list.
 *
 * Query params:
 *   stage_id — filter to a specific stage (optional)
 *   pipeline — "sales" | "followup" | "all" (default "all")
 *   sort — "urgency" | "name" | "recent" (default "recent")
 *   q — search term (server-side: searches contacts table first, then filters)
 *   limit — max results (default 500)
 *   offset — pagination offset (default 0)
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
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "5000", 10), 5000);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const supabase = createServerClient();

    // If there's a search query, find matching contact IDs server-side first
    let matchingContactIds: string[] | null = null;
    if (query) {
      // Search across contacts table — name, email, phone
      const { data: matchedContacts } = await supabase
        .from("contacts")
        .select("id")
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(1000);

      matchingContactIds = (matchedContacts ?? []).map((c) => c.id);

      // If no matches, return empty immediately
      if (matchingContactIds.length === 0) {
        return NextResponse.json({ contacts: [], total: 0, totalCount: 0 });
      }
    }

    // Build the main query
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

    // Filter by search results
    if (matchingContactIds) {
      dbQuery = dbQuery.in("contact_id", matchingContactIds);
    }

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

    // Get total count (before pagination)
    let totalCountQuery = supabase
      .from("contact_pipeline_state")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);
    if (matchingContactIds) totalCountQuery = totalCountQuery.in("contact_id", matchingContactIds);
    if (stageId) totalCountQuery = totalCountQuery.eq("current_stage_id", stageId);
    if (pipelineSlug === "sales") totalCountQuery = totalCountQuery.eq("pipeline_id", "a0000000-0000-0000-0000-000000000001");
    else if (pipelineSlug === "followup") totalCountQuery = totalCountQuery.eq("pipeline_id", "a0000000-0000-0000-0000-000000000002");
    const { count: totalCount } = await totalCountQuery;

    dbQuery = dbQuery.range(offset, offset + limit - 1);

    const { data: rows, error } = await dbQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Post-process: compute urgency color
    const now = Date.now();

    type ContactRow = { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; opportunity_source: string | null; city: string | null; state: string | null };
    type StageRow = { id: string; name: string; slug: string };
    type PipelineRow = { id: string; name: string; slug: string };

    const contacts = (rows ?? []).map((row) => {
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
    });

    // Re-sort if urgency or name requested
    if (sort === "urgency") {
      contacts.sort((a, b) => b.urgencyScore - a.urgencyScore || b.daysSinceSubTask - a.daysSinceSubTask);
    } else if (sort === "name") {
      contacts.sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json({ contacts, total: contacts.length, totalCount: totalCount ?? contacts.length });
  } catch (err) {
    console.error("Pipeline contacts error:", err);
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}
