export const dynamic = "force-dynamic";

/**
 * GET  /api/workflows/:workflowId/steps — list all steps for the current version
 * POST /api/workflows/:workflowId/steps — add a new step
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { WorkflowStepInsert } from "@/lib/workflows/types";

export async function GET(request: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const { workflowId } = await params;
    const supabase = createServerClient();

    // Get the current version ID
    const { data: workflow } = await supabase
      .from("workflows")
      .select("current_version_id")
      .eq("id", workflowId)
      .single();

    if (!workflow?.current_version_id) {
      // Try to find the latest version
      const { data: latestVersion } = await supabase
        .from("workflow_versions")
        .select("id")
        .eq("workflow_id", workflowId)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();

      if (!latestVersion) {
        return NextResponse.json({ steps: [], versionId: null });
      }

      const { data: steps } = await supabase
        .from("workflow_steps")
        .select("*")
        .eq("workflow_version_id", latestVersion.id)
        .order("day_number", { ascending: true })
        .order("step_number", { ascending: true });

      return NextResponse.json({ steps: steps ?? [], versionId: latestVersion.id });
    }

    const { data: steps } = await supabase
      .from("workflow_steps")
      .select("*")
      .eq("workflow_version_id", workflow.current_version_id)
      .order("day_number", { ascending: true })
      .order("step_number", { ascending: true });

    return NextResponse.json({ steps: steps ?? [], versionId: workflow.current_version_id });
  } catch (err) {
    console.error("GET steps error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const { workflowId } = await params;
    const supabase = createServerClient();
    const body = await request.json();

    const { versionId, dayNumber, stepType, content, subject, sendTime, conditionConfig, requiresConfirmation } = body;

    if (!versionId || !dayNumber || !stepType) {
      return NextResponse.json({ error: "versionId, dayNumber, and stepType are required" }, { status: 400 });
    }

    // Get the next step number for this version
    const { data: existingSteps } = await supabase
      .from("workflow_steps")
      .select("step_number")
      .eq("workflow_version_id", versionId)
      .order("step_number", { ascending: false })
      .limit(1);

    const nextStepNumber = existingSteps && existingSteps.length > 0 ? (existingSteps[0].step_number as number) + 1 : 1;

    const insert: WorkflowStepInsert = {
      workflow_version_id: versionId,
      step_number: nextStepNumber,
      day_number: dayNumber,
      step_type: stepType,
      content: content ?? null,
      subject: subject ?? null,
      send_time: sendTime ?? null,
      condition_config: conditionConfig ?? null,
      requires_confirmation: requiresConfirmation ?? true,
    };

    const { data: step, error } = await supabase.from("workflow_steps").insert(insert).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update the workflow's current_version_id if not set
    await supabase
      .from("workflows")
      .update({ current_version_id: versionId, updated_at: new Date().toISOString() })
      .eq("id", workflowId)
      .is("current_version_id", null);

    return NextResponse.json({ step }, { status: 201 });
  } catch (err) {
    console.error("POST step error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
