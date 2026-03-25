export const dynamic = "force-dynamic";

/**
 * GET   /api/workflows/:workflowId — get workflow details with health analysis
 * PATCH /api/workflows/:workflowId — update workflow fields (status, name, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { analyzeWorkflow } from "@/lib/workflows/health-scoring";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await params;
    const supabase = createServerClient();

    const { data: workflow, error } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (error || !workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Run health analysis on demand
    const analysis = await analyzeWorkflow(workflowId, workflow.name);

    return NextResponse.json({ workflow, analysis });
  } catch (err) {
    console.error("GET workflow error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await params;
    const supabase = createServerClient();
    const body = await request.json();

    // Only allow safe fields to be updated directly
    const allowedFields = [
      "name", "description", "status", "primary_metric_name",
      "trigger_config", "exit_conditions", "pause_conditions",
    ];

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
      return NextResponse.json(
        { error: error?.message ?? "Workflow not found" },
        { status: error ? 500 : 404 }
      );
    }

    return NextResponse.json({ workflow });
  } catch (err) {
    console.error("PATCH workflow error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
