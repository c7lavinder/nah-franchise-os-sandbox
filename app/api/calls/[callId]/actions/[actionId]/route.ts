export const dynamic = "force-dynamic";

/**
 * PATCH /api/calls/:callId/actions/:actionId
 *
 * Updates a call_action_item: push (with execution), edit+push, or skip.
 * Routes GHL actions through lib/ghl/actions/executor.ts.
 * Always writes a row to call_action_feedback for the learning loop.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { executeGHLAction } from "@/lib/ghl/actions/executor";
import type { GHLActionCode } from "@/lib/ghl/permissions";

interface PatchBody {
  action: "push" | "edit_push" | "skip" | "reassign";
  payload?: Record<string, unknown>;
  edit_diff?: string;
}

/** Maps action item category to the GHL action code used by the executor */
const CATEGORY_TO_ACTION_CODE: Record<string, GHLActionCode> = {
  comms_sms: "C1",
  comms_email: "C2",
  task: "T1",
  apt: "A1",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string; actionId: string }> }
) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const { callId, actionId } = await params;
  const body = (await request.json()) as PatchBody;
  const supabase = createServerClient();

  // Verify the action item exists and belongs to this call
  const { data: item } = await supabase
    .from("call_action_items")
    .select("id, call_id, contact_id, category, title, description, ghl_action")
    .eq("id", actionId)
    .eq("call_id", callId)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Action item not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  // --- REASSIGN ---
  // Move the action to a different partner on the same journey (e.g. Kevin
  // → Kylie on a partnership journey). Only contact_id + contact_name change;
  // the rest of the action stays pending for the rep to push/edit/skip.
  if (body.action === "reassign") {
    const newContactId = body.payload?.contact_id;
    const newContactName = body.payload?.contact_name;
    if (!newContactId || typeof newContactId !== "string") {
      return NextResponse.json({ error: "contact_id required" }, { status: 400 });
    }
    await supabase
      .from("call_action_items")
      .update({
        contact_id: newContactId,
        contact_name: typeof newContactName === "string" ? newContactName : null,
        updated_at: now,
      })
      .eq("id", actionId);
    return NextResponse.json({ success: true });
  }

  // --- SKIP ---
  if (body.action === "skip") {
    await supabase
      .from("call_action_items")
      .update({ status: "skipped", skipped_at: now, updated_at: now })
      .eq("id", actionId);

    await supabase.from("call_action_feedback").insert({
      call_action_item_id: actionId,
      action: "skip",
      payload: { category: item.category, title: item.title, reason: "user_skipped" },
    });

    return NextResponse.json({ success: true });
  }

  // --- PUSH or EDIT_PUSH ---
  const payload = body.payload ?? {};
  let executionError: string | null = null;

  // Route to GHL executor based on category
  if (item.ghl_action && item.category !== "pipeline" && item.category !== "data") {
    try {
      const result = await executeCategory(item.category, payload, item.contact_id);
      if (!result.success) {
        executionError = result.error ?? "GHL action failed";
      }
    } catch (err) {
      executionError = err instanceof Error ? err.message : "Execution failed";
    }
  }

  // Handle data category — save to contact profile
  if (item.category === "data" && payload.field_value && payload.contact_id) {
    try {
      await saveToProfile(
        supabase,
        String(payload.contact_id),
        String(payload.field_key ?? item.title),
        String(payload.field_value),
        callId
      );
    } catch (err) {
      executionError = err instanceof Error ? err.message : "Save failed";
    }
  }

  if (executionError) {
    return NextResponse.json({ error: executionError }, { status: 500 });
  }

  // Update action item status
  const status = body.action === "edit_push" ? "edited_pushed" : "pushed";
  const editDiff = body.edit_diff ?? null;

  // If edit_push, store the original values
  const updateFields: Record<string, unknown> = {
    status,
    pushed_at: now,
    updated_at: now,
  };

  if (body.action === "edit_push" && payload.title) {
    updateFields.original_title = item.title;
    updateFields.original_description = item.description;
    updateFields.title = payload.title;
    updateFields.description = payload.notes ?? payload.body ?? item.description;
  }

  await supabase
    .from("call_action_items")
    .update(updateFields)
    .eq("id", actionId);

  // Write feedback row with full payload for learning loop
  await supabase.from("call_action_feedback").insert({
    call_action_item_id: actionId,
    action: body.action === "edit_push" ? "edit" : "push",
    edit_diff: editDiff,
    payload: {
      category: item.category,
      original_title: item.title,
      original_description: item.description,
      pushed_fields: payload,
      was_edited: body.action === "edit_push",
    },
  });

  return NextResponse.json({ success: true });
}

// --- Execution helpers ---

async function executeCategory(
  category: string,
  payload: Record<string, unknown>,
  contactId: string | null,
) {
  const userId = "system"; // Placeholder — will wire real user from session later

  switch (category) {
    case "comms": {
      const channel = String(payload.channel ?? "sms");
      const actionCode: GHLActionCode = channel === "email" ? "C2" : "C1";
      const params: Record<string, unknown> = {
        contactId,
        message: payload.body,
        html: channel === "email" ? payload.body : undefined,
        subject: channel === "email" ? "Follow-up from New Again Houses" : undefined,
      };
      return executeGHLAction(actionCode, params, userId, contactId);
    }

    case "task": {
      const params: Record<string, unknown> = {
        contactId,
        title: payload.title,
        body: payload.notes ?? "",
        dueDate: payload.due_date ?? "",
        assignedTo: payload.assignee_user_id ?? userId,
      };
      return executeGHLAction("T1", params, userId, contactId);
    }

    case "apt": {
      const startTime = payload.start_time ? String(payload.start_time) : new Date().toISOString();
      const durationMs = (Number(payload.duration_minutes) || 30) * 60 * 1000;
      const endTime = new Date(new Date(startTime).getTime() + durationMs).toISOString();

      const params: Record<string, unknown> = {
        contactId: payload.contact_id ?? contactId,
        calendarId: process.env.GHL_DEFAULT_CALENDAR_ID ?? "",
        startTime,
        endTime,
        title: "NAH Call",
        assignedUserId: payload.rep_user_id ?? userId,
      };
      return executeGHLAction("A1", params, userId, contactId);
    }

    case "workflow": {
      // Workflow trigger uses the client directly, not the executor code system
      const { triggerWorkflow } = await import("@/lib/ghl/client");
      const workflowName = String(payload.workflow_name ?? "");
      if (!contactId) {
        return { success: false, actionCode: "workflow", error: "No contact linked" };
      }
      await triggerWorkflow(contactId, workflowName);
      return { success: true, actionCode: "workflow" };
    }

    default:
      // Pipeline and unknown categories — just log, no GHL call
      return { success: true, actionCode: category };
  }
}

async function saveToProfile(
  supabase: ReturnType<typeof createServerClient>,
  contactId: string,
  fieldKey: string,
  fieldValue: string,
  callId: string,
) {
  // contact_profile_fields uses field_name (not field_key), jsonb value,
  // last_updated_by constrained to 'api'|'ai'|'manual'|'system'.
  await supabase
    .from("contact_profile_fields")
    .upsert(
      {
        contact_id: contactId,
        field_name: fieldKey,
        field_value: JSON.stringify(fieldValue),
        last_updated_by: "ai",
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: "contact_id,field_name" }
    );

  // Mark any matching data extractions as saved
  await supabase
    .from("call_data_extractions")
    .update({ saved_to_profile: true })
    .eq("call_id", callId)
    .eq("contact_id", contactId)
    .eq("field_key", fieldKey);
}
