import type { createServerClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServerClient>;

type CallActionItemForNdaAutomation = {
  id: string;
  call_id: string;
  contact_id: string | null;
  category: string;
  title: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
};

export type NdaAutomationResult =
  | { status: "not_applicable" }
  | { status: "triggered"; workflowName: string }
  | { status: "not_configured" }
  | { status: "failed"; workflowName?: string; error: string };

export function shouldTriggerNdaAutomation(
  item: CallActionItemForNdaAutomation,
  payload: Record<string, unknown> = {}
): boolean {
  if (item.category !== "pipeline" || !item.contact_id) return false;

  const metadata = item.metadata ?? {};
  const searchable = [
    item.title,
    item.description,
    metadata.pipeline_action,
    metadata.pipeline_name,
    metadata.pipeline_stage,
    metadata.subtask_name,
    payload.pipeline_action,
    payload.pipeline_name,
    payload.pipeline_stage,
    payload.subtask_name,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  const isLogSubtask =
    searchable.includes("log_subtask") ||
    searchable.includes("log off") ||
    searchable.includes("mark") ||
    searchable.includes("completed");
  const isPtoInvite = /\b(pto|path to ownership|trainual)\b/.test(searchable) && /invite|sent|access/.test(searchable);

  return isLogSubtask && isPtoInvite;
}

export async function triggerNdaAutomationIfNeeded(
  supabase: SupabaseClient,
  item: CallActionItemForNdaAutomation,
  payload: Record<string, unknown> = {}
): Promise<NdaAutomationResult> {
  if (!shouldTriggerNdaAutomation(item, payload)) return { status: "not_applicable" };

  const workflowName = await findConfiguredNdaWorkflowName(supabase);
  if (!workflowName) return { status: "not_configured" };

  try {
    const { triggerWorkflow } = await import("@/lib/ghl/client");
    await triggerWorkflow(item.contact_id as string, workflowName);
    return { status: "triggered", workflowName };
  } catch (err) {
    return {
      status: "failed",
      workflowName,
      error: err instanceof Error ? err.message : "NDA automation failed",
    };
  }
}

async function findConfiguredNdaWorkflowName(supabase: SupabaseClient): Promise<string | null> {
  const envName =
    process.env.HELLOSIGN_NDA_WORKFLOW_NAME ??
    process.env.DROPBOX_SIGN_NDA_WORKFLOW_NAME ??
    process.env.NDA_AUTOMATION_WORKFLOW_NAME;

  if (envName?.trim()) return envName.trim();

  const { data } = await supabase
    .from("ghl_workflows")
    .select("name")
    .eq("is_active", true)
    .limit(100);

  const workflows = ((data ?? []) as { name?: string | null }[]).map((workflow) => workflow.name).filter(Boolean);

  return (
    workflows.find((name) => /hello\s*sign/i.test(name ?? "") && /nda/i.test(name ?? "")) ??
    workflows.find((name) => /dropbox\s*sign/i.test(name ?? "") && /nda/i.test(name ?? "")) ??
    workflows.find((name) => /nda/i.test(name ?? "")) ??
    null
  );
}
