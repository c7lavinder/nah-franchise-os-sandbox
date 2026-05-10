export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/batch-actions — execute an action on multiple contacts.
 *
 * Supported actions:
 *   advance_stage  — move selected contacts to the next pipeline stage
 *   add_tag        — add a GHL tag to selected contacts
 *   remove_tag     — remove a GHL tag from selected contacts
 *   assign_user    — assign a user to selected pipeline states
 *   recalc_score   — recalculate lead scores for selected contacts
 *
 * Limited to 50 contacts per batch to avoid timeouts.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import { createServerClient } from "@/lib/supabase/server";
import { updateContact } from "@/lib/ghl/client";
import { syncStageToGHL } from "@/lib/ghl/stage-sync";
import { matchWorkflowTriggers } from "@/lib/workflows/trigger-matcher";
import { calculateLeadScore, buildScoringInputFromContact } from "@/lib/profile/lead-scoring";

interface BatchActionBody {
  action: "advance_stage" | "add_tag" | "remove_tag" | "assign_user" | "recalc_score";
  contactIds: string[];
  /** For add_tag / remove_tag */
  tag?: string;
  /** For assign_user */
  assignUserId?: string;
  /** For advance_stage */
  pipelineId?: string;
}

const MAX_BATCH_SIZE = 50;

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const rateLimited = checkRateLimit(user.id, RATE_LIMITS.general);
  if (rateLimited) return rateLimited;

  const body = (await request.json()) as BatchActionBody;

  if (!body.contactIds?.length) {
    return NextResponse.json({ error: "contactIds required" }, { status: 400 });
  }

  if (body.contactIds.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: `Maximum ${MAX_BATCH_SIZE} contacts per batch` }, { status: 400 });
  }

  const supabase = createServerClient();
  const results: { contactId: string; success: boolean; error?: string }[] = [];

  switch (body.action) {
    case "advance_stage": {
      if (!body.pipelineId) {
        return NextResponse.json({ error: "pipelineId required for advance_stage" }, { status: 400 });
      }

      // Get the next stage for the pipeline
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, name, slug, sort_order")
        .eq("pipeline_id", body.pipelineId)
        .order("sort_order", { ascending: true });

      const { data: pipelineRow } = await supabase
        .from("pipelines")
        .select("name, slug")
        .eq("id", body.pipelineId)
        .single();

      if (!stages || stages.length === 0 || !pipelineRow) {
        return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
      }

      for (const contactId of body.contactIds) {
        try {
          const { data: jps } = await supabase
            .from("journey_pipeline_state")
            .select("id, current_stage_id, journeys!inner(primary_contact_id)")
            .eq("journeys.primary_contact_id", contactId)
            .eq("pipeline_id", body.pipelineId)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

          if (!jps) {
            results.push({ contactId, success: false, error: "Not in this pipeline" });
            continue;
          }

          const currentIdx = stages.findIndex((s) => s.id === jps.current_stage_id);
          if (currentIdx === -1 || currentIdx >= stages.length - 1) {
            results.push({ contactId, success: false, error: "Already at final stage" });
            continue;
          }

          const fromStage = stages[currentIdx];
          const nextStage = stages[currentIdx + 1];
          const now = new Date().toISOString();

          // 1. Update pipeline state
          await supabase
            .from("journey_pipeline_state")
            .update({ current_stage_id: nextStage.id, entered_current_stage_at: now })
            .eq("id", jps.id);

          // 2. Write stage history
          await supabase.from("pipeline_stage_history").insert({
            journey_pipeline_state_id: jps.id,
            from_stage_id: fromStage.id,
            to_stage_id: nextStage.id,
            moved_by_user_id: user.id,
            moved_by_name: user.fullName,
            reason: "Batch advance",
            was_skip: false,
            was_revert: false,
            was_auto: false,
          });

          // 3. GHL sync (best-effort)
          const { data: contact } = await supabase
            .from("contacts")
            .select("ghl_contact_id")
            .eq("id", contactId)
            .single();

          if (contact?.ghl_contact_id) {
            syncStageToGHL(contact.ghl_contact_id, pipelineRow.slug, nextStage.slug).catch(() => {});

            // 4. Workflow triggers (best-effort)
            matchWorkflowTriggers("stage.advanced", contact.ghl_contact_id, {
              pipelineName: pipelineRow.name,
              pipelineSlug: pipelineRow.slug,
              fromStageSlug: fromStage.slug,
              toStageSlug: nextStage.slug,
              toStageName: nextStage.name,
            }).catch(() => {});
          }

          results.push({ contactId, success: true });
        } catch (err) {
          results.push({ contactId, success: false, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }
      break;
    }

    case "add_tag":
    case "remove_tag": {
      if (!body.tag) {
        return NextResponse.json({ error: "tag required" }, { status: 400 });
      }

      for (const contactId of body.contactIds) {
        try {
          // Get GHL contact ID
          const { data: contact } = await supabase
            .from("contacts")
            .select("ghl_contact_id")
            .eq("id", contactId)
            .single();

          if (!contact?.ghl_contact_id) {
            results.push({ contactId, success: false, error: "No GHL contact" });
            continue;
          }

          const payload = body.action === "add_tag" ? { tags: [body.tag] } : { removeTags: [body.tag] };

          await updateContact(contact.ghl_contact_id, payload as Record<string, unknown>);
          results.push({ contactId, success: true });
        } catch (err) {
          results.push({ contactId, success: false, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }
      break;
    }

    case "assign_user": {
      if (!body.assignUserId) {
        return NextResponse.json({ error: "assignUserId required" }, { status: 400 });
      }

      for (const contactId of body.contactIds) {
        try {
          await supabase
            .from("journey_pipeline_state")
            .update({ assigned_user_id: body.assignUserId })
            .eq("is_active", true)
            .eq("journey_id", supabase.from("journeys").select("id").eq("primary_contact_id", contactId).limit(1));

          // Simpler approach: update all active JPS rows for this contact's journeys
          const { data: journeys } = await supabase.from("journeys").select("id").eq("primary_contact_id", contactId);

          if (journeys && journeys.length > 0) {
            await supabase
              .from("journey_pipeline_state")
              .update({ assigned_user_id: body.assignUserId })
              .in(
                "journey_id",
                journeys.map((j) => j.id)
              )
              .eq("is_active", true);
          }

          results.push({ contactId, success: true });
        } catch (err) {
          results.push({ contactId, success: false, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }
      break;
    }

    case "recalc_score": {
      for (const contactId of body.contactIds) {
        try {
          const { data: contact } = await supabase
            .from("contacts")
            .select(
              "opportunity_source, source, NonRetirementCapitalAvailable, territory_status, BriefWorkHistory, investment_timeline, WhatInterestsInOpportunity, trainual_completion_pct, created_at"
            )
            .eq("id", contactId)
            .single();

          if (!contact) {
            results.push({ contactId, success: false, error: "Contact not found" });
            continue;
          }

          const input = buildScoringInputFromContact(contact);
          const score = calculateLeadScore(input);

          await supabase.from("contacts").update({ scout_lead_score: score.total }).eq("id", contactId);

          results.push({ contactId, success: true });
        } catch (err) {
          results.push({ contactId, success: false, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }
      break;
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    action: body.action,
    total: body.contactIds.length,
    succeeded,
    failed,
    results,
  });
}
