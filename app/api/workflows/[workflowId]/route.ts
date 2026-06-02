export const dynamic = "force-dynamic";

/**
 * GET   /api/workflows/:workflowId — get workflow details with health analysis
 * PATCH /api/workflows/:workflowId — update workflow fields (status, name, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { analyzeWorkflow } from "@/lib/workflows/health-scoring";

export async function GET(request: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const { workflowId } = await params;
    const supabase = createServerClient();

    const { data: workflow, error } = await supabase.from("workflows").select("*").eq("id", workflowId).single();

    if (error || !workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Run health analysis on demand
    const analysis = await analyzeWorkflow(workflowId, workflow.name);

    return NextResponse.json({ workflow, analysis });
  } catch (err) {
    console.error("GET workflow error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const { workflowId } = await params;
    const supabase = createServerClient();
    const body = await request.json();

    // Only allow safe fields to be updated directly
    const allowedFields = [
      "name",
      "description",
      "workflow_type",
      "trigger_type",
      "status",
      "primary_metric_name",
      "trigger_config",
      "exit_conditions",
      "pause_conditions",
    ];

    // Validate status transitions if status is being changed
    if (body.status) {
      const { data: current } = await supabase.from("workflows").select("status").eq("id", workflowId).single();

      if (current) {
        const validTransitions: Record<string, string[]> = {
          draft: ["live", "archived"],
          live: ["paused", "archived"],
          paused: ["live", "archived"],
          pending_approval: ["draft", "live", "archived"],
          archived: [], // archived is terminal — must clone to reuse
        };

        const allowed = validTransitions[current.status] ?? [];
        if (!allowed.includes(body.status)) {
          return NextResponse.json(
            { error: `Cannot change status from "${current.status}" to "${body.status}"` },
            { status: 400 }
          );
        }
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data: workflow, error } = await supabase
      .from("workflows")
      .update(updates)
      .eq("id", workflowId)
      .select()
      .single();

    if (error || !workflow) {
      return NextResponse.json({ error: error?.message ?? "Workflow not found" }, { status: error ? 500 : 404 });
    }

    return NextResponse.json({ workflow });
  } catch (err) {
    console.error("PATCH workflow error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
