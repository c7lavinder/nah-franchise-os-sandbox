export const dynamic = "force-dynamic";

/**
 * POST /api/workflows/:workflowId/dry-run — simulate workflow execution for a contact.
 *
 * Body: { contactName: string, ghlContactId?: string }
 *
 * Returns a timeline of what would happen each day without executing anything.
 * Useful for previewing the full sequence before going live.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const { workflowId } = await params;
    const supabase = createServerClient();
    const body = await request.json();
    const contactName = (body.contactName as string) ?? "Test Contact";
    const firstName = contactName.split(" ")[0];

    // Get workflow with exit conditions
    const { data: workflow, error: wfErr } = await supabase
      .from("workflows")
      .select("id, name, trigger_config, exit_conditions, current_version_id")
      .eq("id", workflowId)
      .single();

    if (wfErr || !workflow || !workflow.current_version_id) {
      return NextResponse.json({ error: "Workflow not found or has no version" }, { status: 404 });
    }

    // Get all steps for current version
    const { data: steps, error: stepsErr } = await supabase
      .from("workflow_steps")
      .select("*")
      .eq("workflow_version_id", workflow.current_version_id)
      .order("day_number", { ascending: true })
      .order("step_number", { ascending: true });

    if (stepsErr || !steps) {
      return NextResponse.json({ error: "Failed to load steps" }, { status: 500 });
    }

    const exitConditions = (workflow.exit_conditions ?? {}) as { maxDays?: number; description?: string };
    const triggerConfig = (workflow.trigger_config ?? {}) as { description?: string };

    // Auto-execute types (same as scheduler)
    const autoExecuteTypes = [
      "chad_call_task",
      "team_notify",
      "ai_agent_action",
      "condition_check",
      "trainual_check",
      "appointment",
      "send_reminder",
      "internal_note",
      "add_tag",
      "remove_tag",
      "update_contact",
      "pipeline_move",
      "trigger_workflow",
    ];

    // Personalize content
    function personalize(text: string | null): string {
      if (!text) return "";
      return text
        .replace(/\[Name\]/g, contactName)
        .replace(/\[FirstName\]/g, firstName)
        .replace(/\[name\]/g, contactName)
        .replace(/\[firstName\]/g, firstName);
    }

    // Group steps by day and build timeline
    const dayMap = new Map<number, typeof steps>();
    for (const step of steps) {
      const arr = dayMap.get(step.day_number) ?? [];
      arr.push(step);
      dayMap.set(step.day_number, arr);
    }

    const timeline = Array.from(dayMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([dayNum, daySteps]) => ({
        day: dayNum,
        steps: daySteps.map((step) => {
          const condConfig = (step.condition_config ?? {}) as Record<string, unknown>;
          const needsApproval = step.requires_confirmation && !autoExecuteTypes.includes(step.step_type);

          let from: string | null = null;
          let to: string | null = null;
          if (step.step_type === "sms") {
            from = (condConfig.senderName as string) ?? "NAH";
            to = contactName;
          } else if (step.step_type === "email") {
            const senderEmail = condConfig.senderEmail as string | undefined;
            from = senderEmail
              ? `${(condConfig.senderName as string) ?? "NAH"} (${senderEmail})`
              : ((condConfig.senderName as string) ?? "NAH");
            to = `${contactName}'s email`;
          } else if (step.step_type === "chad_call_task") {
            to = `Assigned to ${(condConfig.assignedTo as string) ?? "Chad"}`;
          }

          return {
            stepType: step.step_type,
            sendTime: step.send_time,
            from,
            to,
            subject: step.subject ? personalize(step.subject) : null,
            content: personalize(step.content),
            needsApproval,
            executionMode: needsApproval ? "Needs your approval before sending" : "Auto-fires immediately",
          };
        }),
      }));

    return NextResponse.json({
      workflowName: workflow.name,
      contactName,
      trigger: triggerConfig.description ?? "Manual enrollment",
      exitCondition:
        exitConditions.description ??
        (exitConditions.maxDays ? `After ${exitConditions.maxDays} days` : "No exit condition"),
      totalDays: dayMap.size,
      totalSteps: steps.length,
      timeline,
    });
  } catch (err) {
    console.error("Dry run error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
