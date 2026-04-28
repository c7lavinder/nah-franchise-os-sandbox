export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/:contactId/pipelines/:pipelineId/advance
 *
 * Advances a contact's pipeline state to the next stage.
 *
 * Body:
 *   - reason (optional)
 *   - force (optional) — skip sub-task completion check
 *   - territory_ms_slug (optional) — when set, advance ONLY the journey's
 *     jps row for (pipeline, territory). Without it, every active jps row
 *     for the (journey, pipeline) pair moves together — the legacy
 *     contact-wide semantic. Both paths write jps directly now; cps is no
 *     longer touched and syncJourneyForContact is gone.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";
import { syncStageToGHL } from "@/lib/ghl/stage-sync";
import { carryForwardContactEos } from "@/lib/eos/carry-forward";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; pipelineId: string }> }
) {
  try {
    const { contactId: rawId, pipelineId } = await params;
    const { reason, force, territory_ms_slug } = (await request.json()) as {
      reason?: string;
      force?: boolean;
      territory_ms_slug?: string | null;
    };
    const supabase = createServerClient();

    const localContactId = await resolveContactId(rawId);
    if (!localContactId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, sort_order, is_terminal, auto_spawn_pipeline_id")
      .eq("pipeline_id", pipelineId)
      .order("sort_order");
    if (!stages || stages.length === 0) {
      return NextResponse.json({ error: "Pipeline has no stages" }, { status: 400 });
    }

    const { data: journey } = await supabase
      .from("journeys")
      .select("id")
      .eq("primary_contact_id", localContactId)
      .maybeSingle();
    if (!journey?.id) return NextResponse.json({ error: "No journey for contact" }, { status: 404 });

    const now = new Date().toISOString();

    // ─── Per-territory path: write one targeted jps row. ───
    if (territory_ms_slug) {
      const { data: jps } = await supabase
        .from("journey_pipeline_state")
        .select("id, current_stage_id")
        .eq("journey_id", journey.id)
        .eq("pipeline_id", pipelineId)
        .eq("territory_ms_slug", territory_ms_slug)
        .eq("is_active", true)
        .maybeSingle();
      if (!jps) return NextResponse.json({ error: "No active state for territory" }, { status: 404 });

      const currentIdx = stages.findIndex((s) => s.id === jps.current_stage_id);
      if (currentIdx === -1 || currentIdx >= stages.length - 1) {
        return NextResponse.json({ error: "No next stage available" }, { status: 400 });
      }
      const nextStage = stages[currentIdx + 1];

      const { data: nextTasks } = await supabase
        .from("pipeline_sub_tasks").select("id")
        .eq("stage_id", nextStage.id).order("sort_order").limit(1);

      await supabase.from("journey_pipeline_state").update({
        current_stage_id: nextStage.id,
        entered_current_stage_at: now,
        current_sub_task_id: nextTasks?.[0]?.id ?? null,
        current_sub_task_started_at: now,
      }).eq("id", jps.id);

      await supabase.from("pipeline_stage_history").insert({
        journey_pipeline_state_id: jps.id,
        from_stage_id: jps.current_stage_id,
        to_stage_id: nextStage.id,
        reason: reason ?? (force ? "Skipped forward (territory)" : null),
        was_skip: force ?? false,
        was_revert: false,
        was_auto: false,
      });

      const { data: pipeline } = await supabase.from("pipelines").select("slug").eq("id", pipelineId).single();
      const { data: nextStageDef } = await supabase.from("pipeline_stages").select("slug").eq("id", nextStage.id).single();
      if (pipeline?.slug && nextStageDef?.slug) {
        void syncStageToGHL(localContactId, pipeline.slug, nextStageDef.slug);
      }

      return NextResponse.json({ success: true, newStageId: nextStage.id, scope: "territory" });
    }

    // ─── Contact-wide path: every active jps row for (journey, pipeline) moves together. ───
    const { data: jpsRows } = await supabase
      .from("journey_pipeline_state")
      .select("id, current_stage_id, territory_ms_slug")
      .eq("journey_id", journey.id)
      .eq("pipeline_id", pipelineId)
      .eq("is_active", true);
    if (!jpsRows || jpsRows.length === 0) {
      return NextResponse.json({ error: "No active pipeline state" }, { status: 404 });
    }

    // All active jps rows for a (journey, pipeline) share a stage under legacy
    // cps-sync semantics. Use the canonical row (NULL-territory preferred) for
    // completion checks + next-stage math.
    const canonical = jpsRows.find((r) => r.territory_ms_slug === null) ?? jpsRows[0];
    const currentIdx = stages.findIndex((s) => s.id === canonical.current_stage_id);
    if (currentIdx === -1 || currentIdx >= stages.length - 1) {
      return NextResponse.json({ error: "No next stage available" }, { status: 400 });
    }

    if (!force) {
      const { data: subTasks } = await supabase
        .from("pipeline_sub_tasks")
        .select("id, state_type, is_required")
        .eq("stage_id", canonical.current_stage_id);

      for (const task of (subTasks ?? []).filter((t) => t.is_required)) {
        const { data: logs } = await supabase
          .from("contact_sub_task_logs")
          .select("state_advance")
          .eq("journey_pipeline_state_id", canonical.id)
          .eq("sub_task_id", task.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1);

        const latest = logs?.[0];
        const complete = task.state_type === "single" ? !!latest : latest?.state_advance === "second";
        if (!complete) {
          return NextResponse.json({
            error: "Not all required sub-tasks are complete. Use force=true to skip.",
          }, { status: 400 });
        }
      }
    }

    const nextStage = stages[currentIdx + 1];

    const { data: nextTasks } = await supabase
      .from("pipeline_sub_tasks").select("id")
      .eq("stage_id", nextStage.id).order("sort_order").limit(1);

    // Move every active jps row to the next stage; one history row per jps row.
    const jpsIds = jpsRows.map((r) => r.id);
    await supabase.from("journey_pipeline_state").update({
      current_stage_id: nextStage.id,
      entered_current_stage_at: now,
      current_sub_task_id: nextTasks?.[0]?.id ?? null,
      current_sub_task_started_at: now,
    }).in("id", jpsIds);

    await supabase.from("pipeline_stage_history").insert(
      jpsRows.map((r) => ({
        journey_pipeline_state_id: r.id,
        from_stage_id: r.current_stage_id,
        to_stage_id: nextStage.id,
        reason: reason ?? (force ? "Skipped forward" : null),
        was_skip: force ?? false,
        was_revert: false,
        was_auto: false,
      }))
    );

    const { data: pipeline } = await supabase.from("pipelines").select("slug").eq("id", pipelineId).single();
    const { data: nextStageDef } = await supabase.from("pipeline_stages").select("slug").eq("id", nextStage.id).single();
    if (pipeline?.slug && nextStageDef?.slug) {
      void syncStageToGHL(localContactId, pipeline.slug, nextStageDef.slug);
    }

    // Auto-spawn: if the next stage is terminal and names an auto-spawn
    // pipeline, create fresh jps rows in that pipeline. Runway and onboarding
    // spawn per active territory; everything else spawns a single
    // NULL-territory row.
    if (nextStage.is_terminal && nextStage.auto_spawn_pipeline_id) {
      const spawnPipelineId = nextStage.auto_spawn_pipeline_id;
      const { data: spawnPipeline } = await supabase
        .from("pipelines").select("slug").eq("id", spawnPipelineId).single();
      const { data: spawnStages } = await supabase
        .from("pipeline_stages").select("id")
        .eq("pipeline_id", spawnPipelineId).order("sort_order").limit(1);
      const { data: spawnTasks } = spawnStages?.[0]
        ? await supabase.from("pipeline_sub_tasks").select("id")
            .eq("stage_id", spawnStages[0].id).order("sort_order").limit(1)
        : { data: [] as { id: string }[] };

      if (spawnStages?.[0]) {
        const fanOut = spawnPipeline?.slug === "runway" || spawnPipeline?.slug === "onboarding";
        let spawnSlugs: (string | null)[] = [null];
        if (fanOut) {
          const { data: contactRow } = await supabase
            .from("contacts").select("ghl_contact_id").eq("id", localContactId).maybeSingle();
          if (contactRow?.ghl_contact_id) {
            const { data: owners } = await supabase
              .from("territory_owners").select("ms_slug")
              .eq("ghl_contact_id", contactRow.ghl_contact_id).is("end_date", null);
            const slugs = (owners ?? []).map((o) => o.ms_slug);
            spawnSlugs = slugs.length > 0 ? slugs : [null];
          }
        }

        await supabase.from("journey_pipeline_state").insert(
          spawnSlugs.map((slug) => ({
            journey_id: journey.id,
            territory_ms_slug: slug,
            pipeline_id: spawnPipelineId,
            current_stage_id: spawnStages[0].id,
            current_sub_task_id: spawnTasks?.[0]?.id ?? null,
            current_sub_task_started_at: now,
            entered_pipeline_at: now,
            entered_current_stage_at: now,
            is_active: true,
          }))
        );

        // EOS carry-forward: when the spawn fanned out to real territories
        // (runway/onboarding), seed each territory's EOS from the primary
        // contact's EOS. Idempotent — safe to call even if already carried.
        if (fanOut) {
          for (const slug of spawnSlugs) {
            if (!slug) continue;
            try {
              await carryForwardContactEos(localContactId, slug);
            } catch (err) {
              console.error("[advance] EOS carry-forward failed:", err instanceof Error ? err.message : err);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, newStageId: nextStage.id, scope: "contact" });
  } catch (err) {
    console.error("Stage advance error:", err);
    return NextResponse.json({ error: "Failed to advance stage" }, { status: 500 });
  }
}
