export const dynamic = "force-dynamic";

/**
 * PATCH /api/workflows/pending-steps/:logId — confirm or reject a queued workflow step.
 *
 * Body: { action: "confirm" | "reject" }
 *
 * On confirm: executes the GHL action (send SMS/email), updates the step log.
 * On reject: marks the step log as rejected, no GHL action fires.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { executeGHLAction } from "@/lib/ghl/actions/executor";
import type { GHLActionCode } from "@/lib/ghl/permissions";
import { prepareEmailForTracking } from "@/lib/workflows/tracking";
import { advanceDay } from "@/lib/workflows/enrollment";

/** Maps step types to GHL action codes (same as scheduler) */
const STEP_ACTION_MAP: Record<string, GHLActionCode> = {
  sms: "C1",
  email: "C2",
  send_reminder: "A5",
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const { logId } = await params;
    const supabase = createServerClient();
    const body = await request.json();
    const action = body.action as "confirm" | "reject";

    if (!action || !["confirm", "reject"].includes(action)) {
      return NextResponse.json({ error: "action must be 'confirm' or 'reject'" }, { status: 400 });
    }

    // Fetch the step log with related data
    const { data: log, error: logErr } = await supabase
      .from("workflow_step_logs")
      .select(
        `
        *,
        workflow_enrollments!inner (
          id,
          ghl_contact_id,
          contact_name
        ),
        workflow_steps!inner (
          id,
          step_type,
          content,
          subject,
          condition_config
        )
      `
      )
      .eq("id", logId)
      .is("confirmed_at", null)
      .is("executed_at", null)
      .single();

    if (logErr || !log) {
      return NextResponse.json({ error: "Step log not found or already processed" }, { status: 404 });
    }

    const enrollment = log.workflow_enrollments as unknown as {
      id: string;
      ghl_contact_id: string;
      contact_name: string | null;
    };
    const step = log.workflow_steps as unknown as {
      id: string;
      step_type: string;
      content: string | null;
      subject: string | null;
      condition_config: Record<string, unknown> | null;
    };

    if (action === "reject") {
      // Mark as rejected — no GHL action
      await supabase
        .from("workflow_step_logs")
        .update({
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
          delivery_data: { queued: false, rejected: true, rejectedBy: user.fullName },
        })
        .eq("id", logId);

      return NextResponse.json({ status: "rejected" });
    }

    // Confirm and execute
    const actionCode = STEP_ACTION_MAP[step.step_type];
    if (!actionCode) {
      return NextResponse.json(
        { error: `Step type "${step.step_type}" cannot be confirmed — not a sendable action` },
        { status: 400 }
      );
    }

    // Personalize content
    const name = enrollment.contact_name ?? "there";
    const firstName = name.split(" ")[0];
    const content = (step.content ?? "")
      .replace(/\[Name\]/g, name)
      .replace(/\[FirstName\]/g, firstName)
      .replace(/\[name\]/g, name)
      .replace(/\[firstName\]/g, firstName);

    // Build action params
    const condConfig = step.condition_config ?? {};
    let actionParams: Record<string, unknown>;

    if (step.step_type === "sms") {
      actionParams = {
        contactId: enrollment.ghl_contact_id,
        message: content,
      };
    } else if (step.step_type === "send_reminder") {
      actionParams = {
        contactId: enrollment.ghl_contact_id,
        reminderMessage: content || "Reminder: You have an upcoming call with New Again Houses.",
      };
    } else {
      // email
      const trackedHtml = prepareEmailForTracking(content, logId);
      actionParams = {
        contactId: enrollment.ghl_contact_id,
        html: trackedHtml,
        subject: step.subject ? step.subject.replace(/\[Name\]/g, name).replace(/\[FirstName\]/g, firstName) : "",
        emailFrom:
          (condConfig as Record<string, unknown>).emailFrom ??
          process.env.GHL_DEFAULT_EMAIL_FROM ??
          "franchise@newagainhouses.com",
      };
    }

    // Execute the GHL action
    const result = await executeGHLAction(actionCode, actionParams, user.id, enrollment.ghl_contact_id);

    if (!result.success) {
      // Update log with error
      await supabase
        .from("workflow_step_logs")
        .update({
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
          delivery_data: { queued: false, error: result.error },
        })
        .eq("id", logId);

      return NextResponse.json({ error: result.error ?? "GHL action failed" }, { status: 500 });
    }

    // Update log as executed
    const ghlMessageId = (result.data as { id?: string })?.id ?? null;
    await supabase
      .from("workflow_step_logs")
      .update({
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        ghl_message_id: ghlMessageId,
        delivered: false,
        delivery_data: { queued: false, confirmedBy: user.fullName, providerAccepted: true },
      })
      .eq("id", logId);

    // Check if all steps for this enrollment's current day are now done.
    // If so, advance to the next day immediately instead of waiting for the scheduler.
    try {
      const { data: enrollmentFull } = await supabase
        .from("workflow_enrollments")
        .select("id, workflow_version_id, current_day")
        .eq("id", log.enrollment_id)
        .eq("status", "active")
        .single();

      if (enrollmentFull) {
        // Get all steps for the current day
        const { data: daySteps } = await supabase
          .from("workflow_steps")
          .select("id")
          .eq("workflow_version_id", enrollmentFull.workflow_version_id)
          .eq("day_number", enrollmentFull.current_day);

        // Get all executed/confirmed step logs for this enrollment
        const { data: executedLogs } = await supabase
          .from("workflow_step_logs")
          .select("step_id")
          .eq("enrollment_id", enrollmentFull.id)
          .not("executed_at", "is", null);

        const executedStepIds = new Set((executedLogs ?? []).map((l) => l.step_id));
        const allDone = (daySteps ?? []).every((s) => executedStepIds.has(s.id));

        if (allDone && (daySteps ?? []).length > 0) {
          await advanceDay(enrollmentFull.id);
        }
      }
    } catch (advErr) {
      // Non-fatal — scheduler will catch up on next run
      console.error("Day advance check after confirm failed:", advErr);
    }

    return NextResponse.json({ status: "confirmed", ghlMessageId });
  } catch (err) {
    console.error("Confirm step error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
