/**
 * GHL Action Queue — Draft → Review → Confirm
 *
 * Enforces the core safety pattern: Scout drafts → human reviews → human confirms → execute.
 * No GHL action fires without explicit confirmation.
 */

import { createServerClient } from "@/lib/supabase/server";
import { checkActionPermission, type GHLActionCode } from "./permissions";
import { executeGHLAction, type ActionResult } from "./actions/executor";

export interface DraftAction {
  id: string;
  actionType: string;
  contactId: string | null;
  params: Record<string, unknown>;
  draftedBySource: "scout" | "user";
  status: "draft" | "confirmed" | "rejected" | "executed" | "failed";
  createdAt: string;
}

/**
 * Create a draft action for human review.
 */
export async function draftAction(
  actionType: GHLActionCode,
  params: Record<string, unknown>,
  userId: string,
  contactId?: string,
  source: "scout" | "user" = "scout"
): Promise<string> {
  const supabase = createServerClient();

  // Check permission before even drafting
  const permCheck = await checkActionPermission(userId, actionType, contactId);
  if (!permCheck.allowed) {
    throw new Error(permCheck.reason ?? "Action not permitted");
  }

  const { data, error } = await supabase
    .from("ghl_action_drafts")
    .insert({
      action_type: actionType,
      contact_id: contactId ?? null,
      drafted_by_user_id: userId,
      drafted_by_source: source,
      params,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create draft: ${error.message}`);
  }

  return data.id;
}

/**
 * Get a draft for review.
 */
export async function reviewAction(
  draftId: string
): Promise<DraftAction | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("ghl_action_drafts")
    .select("*")
    .eq("id", draftId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    actionType: data.action_type,
    contactId: data.contact_id,
    params: data.params,
    draftedBySource: data.drafted_by_source,
    status: data.status,
    createdAt: data.created_at,
  };
}

/**
 * Confirm and execute a draft action.
 * Accepts optional final params (if user edited the draft).
 */
export async function confirmAction(
  draftId: string,
  userId: string,
  finalParams?: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = createServerClient();

  // Fetch the draft
  const { data: draft, error: fetchErr } = await supabase
    .from("ghl_action_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("status", "draft")
    .single();

  if (fetchErr || !draft) {
    throw new Error("Draft not found or already processed");
  }

  // Re-check permission
  const permCheck = await checkActionPermission(
    userId,
    draft.action_type as GHLActionCode,
    draft.contact_id
  );
  if (!permCheck.allowed) {
    throw new Error(permCheck.reason ?? "Action not permitted");
  }

  // Mark as confirmed
  const paramsToUse = finalParams ?? draft.params;
  await supabase
    .from("ghl_action_drafts")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      edited_params: finalParams ?? null,
    })
    .eq("id", draftId);

  // Execute the action
  try {
    const result = await executeGHLAction(
      draft.action_type as GHLActionCode,
      paramsToUse,
      userId,
      draft.contact_id
    );

    // Mark as executed
    await supabase
      .from("ghl_action_drafts")
      .update({
        status: "executed",
        executed_at: new Date().toISOString(),
        outcome: result,
      })
      .eq("id", draftId);

    // Log to system_logs (scout_action_logs requires session_id FK)
    await supabase.from("system_logs").insert({
      action_type: `ghl_action_${draft.action_type}`,
      contact_id: draft.contact_id,
      user_id: userId,
      input_params: paramsToUse,
      result_summary: `Executed ${draft.action_type} via draft ${draftId}`,
      was_auto: false,
    });

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Mark as failed
    await supabase
      .from("ghl_action_drafts")
      .update({
        status: "failed",
        error_message: msg,
      })
      .eq("id", draftId);

    throw err;
  }
}

/**
 * Reject a draft action (does not execute).
 */
export async function rejectAction(
  draftId: string,
  reason?: string
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("ghl_action_drafts")
    .update({
      status: "rejected",
      error_message: reason ?? "Rejected by user",
    })
    .eq("id", draftId)
    .eq("status", "draft");

  if (error) {
    throw new Error(`Failed to reject draft: ${error.message}`);
  }
}

/**
 * Get pending drafts for a user.
 */
export async function getPendingDrafts(
  userId: string
): Promise<DraftAction[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("ghl_action_drafts")
    .select("*")
    .eq("drafted_by_user_id", userId)
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get drafts: ${error.message}`);
  }

  return (data ?? []).map((d) => ({
    id: d.id,
    actionType: d.action_type,
    contactId: d.contact_id,
    params: d.params,
    draftedBySource: d.drafted_by_source,
    status: d.status,
    createdAt: d.created_at,
  }));
}
