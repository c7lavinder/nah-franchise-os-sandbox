export const dynamic = "force-dynamic";

/**
 * POST /api/calls/[callId]/actions
 *
 * Executes a batch of Scout-suggested actions from call grading.
 * Pushes notes, tasks, stage moves, and messages to GHL.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";

interface ActionToExecute {
  type: "note" | "task" | "stage_move" | "sms" | "email" | "workflow";
  content: string;
  contactId: string;
  opportunityId?: string;
  targetStage?: string;
  label: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  try {
    const body = (await request.json()) as { actions: ActionToExecute[] };

    if (!body.actions?.length) {
      return NextResponse.json({ error: "No actions to execute" }, { status: 400 });
    }

    const results: { action: string; status: "success" | "failed"; error?: string }[] = [];
    const supabase = createServerClient();

    for (const action of body.actions) {
      try {
        switch (action.type) {
          case "note": {
            await ghl.addNote(action.contactId, action.content);
            results.push({ action: action.label, status: "success" });
            break;
          }
          case "task": {
            await ghl.createTask(action.contactId, {
              title: action.content,
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            });
            results.push({ action: action.label, status: "success" });
            break;
          }
          case "stage_move": {
            if (action.opportunityId && action.targetStage) {
              const stageId = await ghl.getStageIdByName(action.targetStage);
              await ghl.movePipelineStage(action.opportunityId, stageId);
              results.push({ action: action.label, status: "success" });
            } else {
              results.push({ action: action.label, status: "failed", error: "Missing opportunityId or targetStage" });
            }
            break;
          }
          case "sms": {
            await ghl.sendMessage({
              type: "SMS",
              contactId: action.contactId,
              message: action.content,
            });
            results.push({ action: action.label, status: "success" });
            break;
          }
          case "email": {
            await ghl.sendMessage({
              type: "Email",
              contactId: action.contactId,
              subject: action.label,
              html: `<p>${action.content}</p>`,
              emailFrom: "chad@newagainhouses.com",
            });
            results.push({ action: action.label, status: "success" });
            break;
          }
          default:
            results.push({ action: action.label, status: "failed", error: `Unsupported action type: ${action.type}` });
        }

        // Log each action
        try {
          await supabase.from("scout_action_logs").insert({
            action_type: action.type === "sms" || action.type === "email" ? "message" : action.type === "stage_move" ? "stage_move" : action.type === "task" ? "task" : "note",
            action_status: "executed",
            ghl_contact_id: action.contactId,
            draft_content: { source: "call_grading", callId: params.callId, ...action },
            final_content: { content: action.content },
            executed_at: new Date().toISOString(),
          });
        } catch {
          // Don't fail if logging fails
        }

      } catch (err) {
        results.push({
          action: action.label,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const succeeded = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({ results, succeeded, failed });
  } catch (err) {
    console.error("Action execution failed:", err);
    return NextResponse.json({ error: "Failed to execute actions" }, { status: 500 });
  }
}
