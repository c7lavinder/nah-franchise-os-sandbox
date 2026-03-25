/**
 * PUT /api/pipeline/move
 *
 * Moves an opportunity to a new pipeline stage.
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

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as MoveRequestBody;

    if (!body.opportunityId || !body.targetStageId) {
      return NextResponse.json(
        { error: "opportunityId and targetStageId are required" },
        { status: 400 }
      );
    }

    // Move the opportunity in GHL
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
      // Don't fail the move if logging fails
      console.error("Failed to log stage move:", logErr);
    }

    return NextResponse.json({ opportunity: updated });
  } catch (err) {
    console.error("Pipeline move failed:", err);
    const message = err instanceof Error ? err.message : "Failed to move opportunity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
