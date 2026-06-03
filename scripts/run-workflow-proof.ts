#!/usr/bin/env tsx
/**
 * Safe production proof for FranDev workflows.
 *
 * Creates a proof-only internal workflow, enrolls a fake non-customer contact,
 * runs the scheduler, and verifies step logs were written. The executable step
 * type is `team_notify`, so no SMS/email/GHL customer-facing send is attempted.
 * A second approval-required step keeps the enrollment from advancing and
 * syncing workflow-day fields to GHL for the fake contact.
 */

import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { runScheduler } from "../lib/workflows/scheduler";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
});

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const proofName = `XHAKA 48-Hour Workflow Proof ${runId}`;
  const proofContactId = `proof-no-customer-send-${runId}`;

  const { count: activeBefore, error: activeErr } = await supabase
    .from("workflow_enrollments")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");
  if (activeErr) throw activeErr;

  // Avoid accidentally advancing real enrollments during this proof.
  if (activeBefore && activeBefore > 0) {
    throw new Error(`Refusing proof run: ${activeBefore} active workflow enrollment(s) already exist.`);
  }

  const { data: owner, error: ownerErr } = await supabase
    .from("workflows")
    .select("created_by")
    .limit(1)
    .maybeSingle();
  if (ownerErr) throw ownerErr;
  if (!owner?.created_by) throw new Error("Could not resolve workflow owner for proof row.");

  const { data: workflow, error: workflowErr } = await supabase
    .from("workflows")
    .insert({
      name: proofName,
      description: "Proof-only workflow write test. Internal team_notify step; no customer-facing send.",
      workflow_type: "proof",
      trigger_type: "manual",
      trigger_config: { proof: true, source: "scripts/run-workflow-proof.ts" },
      exit_conditions: { maxDays: 1, description: "Proof run only" },
      pause_conditions: {},
      health_score: "C",
      status: "live",
      active_enrollee_count: 0,
      created_by: owner.created_by,
    })
    .select("id")
    .single();
  if (workflowErr || !workflow) throw workflowErr ?? new Error("Workflow insert failed.");

  const { data: version, error: versionErr } = await supabase
    .from("workflow_versions")
    .insert({
      workflow_id: workflow.id,
      version_number: 1,
      change_description: "48-hour proof run",
      created_by: owner.created_by,
    })
    .select("id")
    .single();
  if (versionErr || !version) throw versionErr ?? new Error("Version insert failed.");

  await supabase.from("workflows").update({ current_version_id: version.id }).eq("id", workflow.id);

  const { data: step, error: stepErr } = await supabase
    .from("workflow_steps")
    .insert({
      workflow_version_id: version.id,
      step_number: 1,
      day_number: 1,
      step_type: "team_notify",
      content: "Internal proof step executed for [Name]. No SMS/email/GHL send.",
      subject: "48-hour workflow proof",
      requires_confirmation: false,
      performance_status: "neutral",
    })
    .select("id")
    .single();
  if (stepErr || !step) throw stepErr ?? new Error("Step insert failed.");

  const { data: queuedStep, error: queuedStepErr } = await supabase
    .from("workflow_steps")
    .insert({
      workflow_version_id: version.id,
      step_number: 2,
      day_number: 1,
      step_type: "sms",
      content: "Approval-required proof SMS. This must queue and must not send.",
      subject: "48-hour workflow proof queued step",
      requires_confirmation: true,
      performance_status: "neutral",
    })
    .select("id")
    .single();
  if (queuedStepErr || !queuedStep) throw queuedStepErr ?? new Error("Queued step insert failed.");

  const { data: enrollment, error: enrollmentErr } = await supabase
    .from("workflow_enrollments")
    .insert({
      workflow_id: workflow.id,
      workflow_version_id: version.id,
      ghl_contact_id: proofContactId,
      contact_name: "XHAKA Workflow Proof",
      status: "active",
      current_day: 1,
    })
    .select("id")
    .single();
  if (enrollmentErr || !enrollment) throw enrollmentErr ?? new Error("Enrollment insert failed.");

  await supabase.from("workflows").update({ active_enrollee_count: 1 }).eq("id", workflow.id);

  const result = await runScheduler();

  const { data: logs, error: logsErr } = await supabase
    .from("workflow_step_logs")
    .select("id, step_type, executed_at, ghl_message_id, delivery_data")
    .eq("enrollment_id", enrollment.id);
  if (logsErr) throw logsErr;

  const executedLog = logs?.find((log) => log.step_type === "team_notify" && log.executed_at);
  if (!executedLog) {
    throw new Error(`Proof failed: no executed team_notify log for enrollment ${enrollment.id}`);
  }
  const queuedLog = logs?.find((log) => log.step_type === "sms" && !log.executed_at);
  if (!queuedLog) {
    throw new Error(`Proof failed: no queued approval-required sms log for enrollment ${enrollment.id}`);
  }

  await supabase
    .from("workflow_enrollments")
    .update({
      status: "exited",
      exit_reason: "Proof complete - safe internal workflow test",
      completed_at: new Date().toISOString(),
    })
    .eq("id", enrollment.id);
  await supabase.from("workflows").update({ status: "archived", active_enrollee_count: 0 }).eq("id", workflow.id);

  console.log(
    JSON.stringify(
      {
        success: true,
        workflowId: workflow.id,
        versionId: version.id,
        executedStepId: step.id,
        queuedStepId: queuedStep.id,
        enrollmentId: enrollment.id,
        executedStepLogId: executedLog.id,
        queuedStepLogId: queuedLog.id,
        schedulerResult: result,
        proofWrites: ["workflows", "workflow_versions", "workflow_steps", "workflow_enrollments", "workflow_step_logs"],
        externalCustomerSend: false,
      },
      null,
      2
    )
  );
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
