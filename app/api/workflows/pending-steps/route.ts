export const dynamic = "force-dynamic";

/**
 * GET /api/workflows/pending-steps — list all queued workflow steps awaiting confirmation.
 * Returns step logs with delivery_data.queued = true and no confirmed_at.
 * Joined with step + enrollment + workflow data for display.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const supabase = createServerClient();
    const ghlContactFilter = request.nextUrl.searchParams.get("ghl_contact_id");

    // Find step logs that are queued but not yet confirmed or executed
    let dbQuery = supabase
      .from("workflow_step_logs")
      .select(
        `
        id,
        enrollment_id,
        step_id,
        ghl_contact_id,
        step_type,
        content_sent,
        delivery_data,
        created_at,
        workflow_enrollments!inner (
          id,
          workflow_id,
          contact_name,
          current_day,
          workflows!inner (
            id,
            name
          )
        ),
        workflow_steps!inner (
          id,
          subject,
          send_time,
          condition_config
        )
      `
      )
      .is("confirmed_at", null)
      .is("executed_at", null)
      .order("created_at", { ascending: true });

    if (ghlContactFilter) {
      dbQuery = dbQuery.eq("ghl_contact_id", ghlContactFilter);
    }

    const { data: logs, error } = await dbQuery;

    if (error) {
      console.error("Failed to fetch pending steps:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter to only truly queued entries (delivery_data.queued = true)
    const pendingSteps = (logs ?? [])
      .filter((log) => {
        const dd = log.delivery_data as Record<string, unknown> | null;
        return dd?.queued === true;
      })
      .map((log) => {
        const enrollment = log.workflow_enrollments as unknown as {
          id: string;
          workflow_id: string;
          contact_name: string | null;
          current_day: number;
          workflows: { id: string; name: string };
        };
        const step = log.workflow_steps as unknown as {
          id: string;
          subject: string | null;
          send_time: string | null;
          condition_config: Record<string, unknown> | null;
        };

        return {
          logId: log.id,
          stepId: log.step_id,
          enrollmentId: log.enrollment_id,
          workflowId: enrollment.workflow_id,
          workflowName: enrollment.workflows.name,
          contactName: enrollment.contact_name,
          ghlContactId: log.ghl_contact_id,
          currentDay: enrollment.current_day,
          stepType: log.step_type,
          content: log.content_sent,
          subject: step.subject,
          sendTime: step.send_time,
          senderName: (step.condition_config as Record<string, unknown>)?.senderName ?? null,
          senderEmail: (step.condition_config as Record<string, unknown>)?.senderEmail ?? null,
          queuedAt: log.created_at,
        };
      });

    return NextResponse.json({ pendingSteps });
  } catch (err) {
    console.error("Pending steps error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
