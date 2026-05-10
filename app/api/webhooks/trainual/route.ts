/**
 * POST /api/webhooks/trainual — Trainual completion webhook
 *
 * Maps Trainual module/course completions to onboarding sub-tasks.
 * Logs the sub-task and triggers auto-advance check.
 *
 * Expected payload: { event, user_email, module_name?, course_name?, ... }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/auth/webhook-verify";
import { createServerClient } from "@/lib/supabase/server";
import { checkAutoAdvance } from "@/lib/contacts/auto-advance";

/** Map Trainual module/course names to sub-task names (case-insensitive matching) */
const TRAINUAL_SUBTASK_MAP: Record<string, string> = {
  "part 1": "Trainual Part 1",
  "part 2": "Trainual Part 2",
  "part 3": "Trainual Part 3",
  "part 4": "Trainual Part 4",
  "part 5": "Trainual Part 5",
  "module 1": "Trainual Part 1",
  "module 2": "Trainual Part 2",
  "module 3": "Trainual Part 3",
  "module 4": "Trainual Part 4",
  "module 5": "Trainual Part 5",
};

interface TrainualPayload {
  event?: string;
  user_email?: string;
  module_name?: string;
  course_name?: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  const webhookAuthError = verifyWebhookSecret(request);
  if (webhookAuthError) return webhookAuthError;
  const body = (await request.json()) as TrainualPayload;
  const supabase = createServerClient();

  // Log every event regardless
  await supabase.from("integration_logs").insert({
    integration_name: "trainual",
    event_type: body.event ?? "unknown",
    status: "received",
    payload_summary: JSON.stringify(body).slice(0, 500),
    related_contact_id: null,
  });

  // Only process completion events
  if (body.event !== "module.completed" && body.event !== "course.completed") {
    return NextResponse.json({ ok: true });
  }

  if (!body.user_email) {
    return NextResponse.json({ ok: true });
  }

  // Find the contact by email
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id")
    .ilike("email", body.user_email.trim())
    .limit(1)
    .maybeSingle();

  if (!contact) {
    await supabase.from("integration_logs").insert({
      integration_name: "trainual",
      event_type: "contact_not_found",
      status: "failed",
      payload_summary: `Contact not found for email: ${body.user_email}`,
    });
    return NextResponse.json({ ok: true });
  }

  // Find the active territory for this contact via territory_owners
  const { data: ownership } = await supabase
    .from("territory_owners")
    .select("TerritorySlug")
    .eq("ghl_contact_id", contact.ghl_contact_id)
    .is("end_date", null)
    .limit(1)
    .maybeSingle();

  if (!ownership) {
    await supabase.from("integration_logs").insert({
      integration_name: "trainual",
      event_type: "no_territory",
      status: "failed",
      payload_summary: `No active territory for contact ${contact.ghl_contact_id}`,
      related_contact_id: contact.ghl_contact_id,
    });
    return NextResponse.json({ ok: true });
  }

  // Match module name to sub-task
  const rawName = (body.module_name || body.course_name || "").toLowerCase();
  let matchedSubtaskName: string | null = null;

  for (const [key, subtaskName] of Object.entries(TRAINUAL_SUBTASK_MAP)) {
    if (rawName.includes(key)) {
      matchedSubtaskName = subtaskName;
      break;
    }
  }

  if (!matchedSubtaskName) {
    await supabase.from("integration_logs").insert({
      integration_name: "trainual",
      event_type: "unrecognized_module",
      status: "failed",
      payload_summary: `Unrecognized module: "${body.module_name || body.course_name}" for ${body.user_email}`,
      related_contact_id: contact.ghl_contact_id,
    });
    return NextResponse.json({ ok: true });
  }

  // Find the sub-task by name within the Onboarding pipeline
  const { data: subTask } = await supabase
    .from("pipeline_sub_tasks")
    .select("id, stage_id, pipeline_stages!inner (id, pipeline_id, pipelines!inner (slug))")
    .eq("name", matchedSubtaskName)
    .limit(1)
    .maybeSingle();

  if (!subTask) {
    await supabase.from("integration_logs").insert({
      integration_name: "trainual",
      event_type: "subtask_not_found",
      status: "failed",
      payload_summary: `Sub-task "${matchedSubtaskName}" not found in DB`,
      related_contact_id: contact.ghl_contact_id,
    });
    return NextResponse.json({ ok: true });
  }

  // Find the contact's active pipeline state for the onboarding pipeline
  const stageData = subTask.pipeline_stages as unknown as {
    id: string;
    pipeline_id: string;
    pipelines: { slug: string };
  };

  // Find the canonical active jps row for (journey, pipeline).
  const { data: journey } = await supabase
    .from("journeys")
    .select("id")
    .eq("primary_contact_id", contact.id)
    .maybeSingle();

  let pipelineState: { id: string; current_stage_id: string } | null = null;
  if (journey?.id) {
    const { data: rows } = await supabase
      .from("journey_pipeline_state")
      .select("id, current_stage_id, TerritorySlug")
      .eq("journey_id", journey.id)
      .eq("pipeline_id", stageData.pipeline_id)
      .eq("is_active", true);
    const list = rows ?? [];
    const canon = list.find((r) => r.TerritorySlug === null) ?? list[0];
    if (canon) pipelineState = { id: canon.id, current_stage_id: canon.current_stage_id };
  }

  if (!pipelineState) {
    await supabase.from("integration_logs").insert({
      integration_name: "trainual",
      event_type: "no_pipeline_state",
      status: "failed",
      payload_summary: `No active onboarding pipeline state for contact ${contact.id}`,
      related_contact_id: contact.ghl_contact_id,
    });
    return NextResponse.json({ ok: true });
  }

  await supabase.from("contact_sub_task_logs").insert({
    journey_pipeline_state_id: pipelineState.id,
    sub_task_id: subTask.id,
    logger_user_id: null,
    source: "api",
    state_advance: null, // single-state tasks don't use state_advance
    content_type: "note",
    content_text: `${matchedSubtaskName} completed via Trainual`,
    metadata: {
      trainual_module: body.module_name,
      trainual_course: body.course_name,
      trainual_email: body.user_email,
    },
  });

  // Log success
  await supabase.from("integration_logs").insert({
    integration_name: "trainual",
    event_type: "subtask_logged",
    status: "success",
    payload_summary: `${matchedSubtaskName} logged for ${body.user_email}`,
    related_contact_id: contact.ghl_contact_id,
  });

  // Trigger auto-advance check
  void checkAutoAdvance(pipelineState.id, pipelineState.current_stage_id);

  return NextResponse.json({ ok: true, subtask: matchedSubtaskName });
}
