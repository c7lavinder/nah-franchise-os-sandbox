export const dynamic = "force-dynamic";

/**
 * GET /api/workflows/:workflowId/activity — recent execution activity for a workflow.
 * Returns step logs joined with enrollment and step data, ordered most recent first.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const { workflowId } = await params;
    const supabase = createServerClient();

    // Get all enrollments for this workflow to get their IDs
    const { data: enrollments } = await supabase
      .from("workflow_enrollments")
      .select("id")
      .eq("workflow_id", workflowId);

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ activity: [] });
    }

    const enrollmentIds = enrollments.map((e) => e.id);

    // Get recent step logs for these enrollments
    const { data: logs, error } = await supabase
      .from("workflow_step_logs")
      .select(
        `
        id,
        enrollment_id,
        step_id,
        ghl_contact_id,
        step_type,
        content_sent,
        ghl_message_id,
        delivered,
        opened,
        clicked,
        responded,
        confirmed_by,
        confirmed_at,
        executed_at,
        delivery_data,
        created_at,
        workflow_enrollments!inner (
          contact_name,
          current_day
        ),
        workflow_steps!inner (
          subject,
          send_time
        )
      `
      )
      .in("enrollment_id", enrollmentIds)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const activity = (logs ?? []).map((log) => {
      const enrollment = log.workflow_enrollments as unknown as {
        contact_name: string | null;
        current_day: number;
      };
      const step = log.workflow_steps as unknown as {
        subject: string | null;
        send_time: string | null;
      };
      const dd = (log.delivery_data ?? {}) as Record<string, unknown>;

      let status: "executed" | "queued" | "rejected" | "failed";
      if (dd.rejected) status = "rejected";
      else if (dd.error) status = "failed";
      else if (dd.queued && !log.executed_at) status = "queued";
      else status = "executed";

      return {
        id: log.id,
        contactName: enrollment.contact_name ?? log.ghl_contact_id,
        stepType: log.step_type,
        subject: step.subject,
        content: log.content_sent,
        sendTime: step.send_time,
        status,
        delivered: log.delivered ?? false,
        opened: log.opened ?? false,
        responded: log.responded ?? false,
        confirmedBy: log.confirmed_by,
        confirmedAt: log.confirmed_at,
        executedAt: log.executed_at,
        createdAt: log.created_at,
        error: dd.error as string | undefined,
      };
    });

    return NextResponse.json({ activity });
  } catch (err) {
    console.error("Workflow activity error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
