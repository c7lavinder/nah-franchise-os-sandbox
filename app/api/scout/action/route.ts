/**
 * POST /api/scout/action
 *
 * Executes a confirmed drafted action in GHL.
 * This is called when the user clicks "Confirm" on a drafted action card.
 * Logs the execution to scout_action_logs.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import type {
  DraftedAction,
  DraftedMessagePayload,
  DraftedTaskPayload,
  DraftedStageMovePayload,
} from "@/types/scout";

interface ActionRequestBody {
  action: DraftedAction;
  userId: string;
  sessionId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ActionRequestBody;

    if (!body.action || !body.userId) {
      return NextResponse.json(
        { error: "Missing required fields: action, userId" },
        { status: 400 }
      );
    }

    const { action } = body;
    let ghlResponse: Record<string, unknown> | null = null;
    let errorMessage: string | null = null;

    try {
      switch (action.type) {
        case "message": {
          const payload = action.payload as DraftedMessagePayload;
          const result = payload.channel === "Email"
            ? await ghl.sendMessage({
                type: "Email",
                contactId: action.contactId,
                html: payload.content,
                subject: payload.subject ?? "NAH Franchise",
                emailFrom: process.env.GHL_SENDING_EMAIL ?? "chad@newagainhouses.com",
              })
            : await ghl.sendMessage({
                type: "SMS",
                contactId: action.contactId,
                message: payload.content,
              });
          ghlResponse = result as unknown as Record<string, unknown>;
          break;
        }
        case "task": {
          const payload = action.payload as DraftedTaskPayload;
          const result = await ghl.createTask(action.contactId, {
            title: payload.title,
            body: payload.description,
            dueDate: payload.dueDate,
          });
          ghlResponse = result as unknown as Record<string, unknown>;
          break;
        }
        case "stage_move": {
          const payload = action.payload as DraftedStageMovePayload;
          // For stage moves, we need the opportunity ID — not the contact ID.
          // Search for the open opportunity for this contact.
          const opportunities = await ghl.searchOpportunities({
            status: "open",
          });
          const opportunity = opportunities.find(
            (opp) => opp.contactId === action.contactId
          );
          if (!opportunity) {
            throw new Error(
              `No open opportunity found for contact ${action.contactId}`
            );
          }
          // Find the target stage ID — need to look up from pipeline stages
          const pipelines = await ghl.getPipelines();
          const pipeline = pipelines.find(
            (p) => p.id === opportunity.pipelineId
          );
          const targetStage = pipeline?.stages.find(
            (s) =>
              s.name.toLowerCase() === payload.newStage.toLowerCase()
          );
          if (!targetStage) {
            throw new Error(
              `Pipeline stage "${payload.newStage}" not found`
            );
          }
          const result = await ghl.movePipelineStage(
            opportunity.id,
            targetStage.id
          );
          ghlResponse = result as unknown as Record<string, unknown>;
          break;
        }
        case "appointment": {
          // Appointment drafts are not yet implemented in Phase 1
          throw new Error("Appointment creation is coming in a future update");
        }
        default: {
          throw new Error(`Unknown action type: ${action.type}`);
        }
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Unknown error executing action";
    }

    // Log the execution result
    try {
      const supabase = createServerClient();
      const now = new Date().toISOString();

      await supabase.from("scout_action_logs").insert({
        user_id: body.userId,
        session_id: body.sessionId,
        action_type: action.type,
        action_status: errorMessage ? "failed" : "executed",
        ghl_contact_id: action.contactId,
        draft_content: action.payload as unknown as Record<string, unknown>,
        final_content: action.payload as unknown as Record<string, unknown>,
        ghl_response: ghlResponse,
        error_message: errorMessage,
        confirmed_at: now,
        executed_at: errorMessage ? null : now,
      });
    } catch {
      console.error("Failed to log action execution — continuing");
    }

    if (errorMessage) {
      return NextResponse.json(
        { error: errorMessage, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ghlResponse,
    });
  } catch (err) {
    console.error("Action execution error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
