export const dynamic = "force-dynamic";

/**
 * PUT /api/pipeline/move
 *
 * Moves an opportunity to a new pipeline stage.
 * Enforces stage move validation rules from pipeline.md:
 * - Lost/Nurture requires a reason
 * - FDD stage blocked before 14-day window
 * - Compliance gate must be passed before Application
 * Logs the action to scout_action_logs for audit trail.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";

interface MoveRequestBody {
  opportunityId: string;
  targetStageId: string;
  reason?: string;
}

/** Stage names that require a loss reason */
const REASON_REQUIRED_STAGES = new Set(["Nurture", "Follow-up"]);

/** Stage names that require a loss reason when status is being set to lost */
const LOST_REASON_REQUIRED = true;

/** Validate stage move rules and return an error message if blocked */
async function validateMove(
  opportunity: { contactId: string; pipelineStageId: string; status: string },
  targetStageName: string,
  currentStageName: string,
  reason: string | undefined
): Promise<string | null> {
  // Rule 1: Moving to Lost requires a reason
  if (targetStageName.toLowerCase().includes("lost") && !reason) {
    return "A loss reason is required when marking a lead as Lost.";
  }

  // Rule 2: Moving to Nurture/Follow-up requires a reason
  if (REASON_REQUIRED_STAGES.has(targetStageName) && !reason) {
    return `A reason is required when moving to ${targetStageName}.`;
  }

  // Rule 3: Can't move to Application without Compliance Gate passed
  if (targetStageName === "Application + Approval" || targetStageName === "Application") {
    const supabase = createServerClient();
    const { data: fieldMappings } = await supabase
      .from("ghl_custom_fields")
      .select("field_name, ghl_field_id")
      .eq("entity_type", "contact")
      .eq("field_name", "Compliance Checklist Complete");

    if (fieldMappings && fieldMappings.length > 0) {
      try {
        const contact = await ghl.getContact(opportunity.contactId);
        const complianceField = contact.customFields.find(
          (f) => f.id === fieldMappings[0].ghl_field_id
        );
        if (!complianceField || complianceField.value !== "Yes") {
          return "Compliance checklist must be complete before moving to Application. Complete it in the contact profile.";
        }
      } catch {
        // If we can't check, allow the move but log a warning
        console.warn("Could not verify compliance gate for", opportunity.contactId);
      }
    }
  }

  // Rule 4: FDD 14-day window check
  if (targetStageName === "Mark Call (Capital/Lending)" || targetStageName === "Mark Call") {
    const supabase = createServerClient();
    const { data: fieldMappings } = await supabase
      .from("ghl_custom_fields")
      .select("field_name, ghl_field_id")
      .eq("entity_type", "contact")
      .in("field_name", ["FDD Issued Date", "FDD 14-Day Unlocks"]);

    if (fieldMappings && fieldMappings.length > 0) {
      try {
        const contact = await ghl.getContact(opportunity.contactId);
        const fddField = fieldMappings.find((f) => f.field_name === "FDD Issued Date");
        if (fddField) {
          const fddCustom = contact.customFields.find((f) => f.id === fddField.ghl_field_id);
          if (fddCustom?.value) {
            const fddDate = new Date(fddCustom.value);
            const daysSinceFDD = Math.floor(
              (Date.now() - fddDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceFDD < 14) {
              return `FDD was issued ${daysSinceFDD} days ago. The legal 14-day waiting period has not passed yet (${14 - daysSinceFDD} days remaining).`;
            }
          }
        }
      } catch {
        console.warn("Could not verify FDD window for", opportunity.contactId);
      }
    }
  }

  return null; // No validation errors
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as MoveRequestBody;

    if (!body.opportunityId || !body.targetStageId) {
      return NextResponse.json(
        { error: "opportunityId and targetStageId are required" },
        { status: 400 }
      );
    }

    // Look up stage names for validation
    const pipelines = await ghl.getPipelines();
    let currentStageName = "Unknown";
    let targetStageName = "Unknown";
    let opportunity: { contactId: string; pipelineStageId: string; status: string } | null = null;

    for (const pipeline of pipelines) {
      const opps = await ghl.searchOpportunities({ pipelineId: pipeline.id });
      const match = opps.find((o) => o.id === body.opportunityId);
      if (match) {
        opportunity = match;
        const currentStage = pipeline.stages.find((s) => s.id === match.pipelineStageId);
        currentStageName = currentStage?.name?.trim() ?? "Unknown";
      }
      const target = pipeline.stages.find((s) => s.id === body.targetStageId);
      if (target) {
        targetStageName = target.name.trim();
      }
    }

    // Validate the move
    if (opportunity) {
      const validationError = await validateMove(
        opportunity,
        targetStageName,
        currentStageName,
        body.reason
      );
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 422 });
      }
    }

    // Execute the move in GHL
    const updated = await ghl.movePipelineStage(
      body.opportunityId,
      body.targetStageId
    );

    // Log to scout_action_logs
    try {
      const supabase = createServerClient();
      await supabase.from("scout_action_logs").insert({
        user_id: null,
        session_id: null,
        action_type: "stage_move",
        action_status: "executed",
        ghl_contact_id: updated.contactId,
        draft_content: {
          opportunityId: body.opportunityId,
          targetStageId: body.targetStageId,
          fromStage: currentStageName,
          toStage: targetStageName,
          reason: body.reason ?? null,
          source: "pipeline_board",
        },
        final_content: {
          opportunityId: updated.id,
          pipelineStageId: updated.pipelineStageId,
          status: updated.status,
        },
        ghl_response: { opportunity: updated },
        executed_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error("Failed to log stage move:", logErr);
    }

    return NextResponse.json({ opportunity: updated });
  } catch (err) {
    console.error("Pipeline move failed:", err);
    const message = err instanceof Error ? err.message : "Failed to move opportunity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
