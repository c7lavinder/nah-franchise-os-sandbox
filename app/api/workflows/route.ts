export const dynamic = "force-dynamic";

/**
 * GET  /api/workflows — list all workflows with optional status filter
 * POST /api/workflows — create a new workflow (draft)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { WorkflowStatus, WorkflowInsert } from "@/lib/workflows/types";

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    let query = supabase.from("workflows").select("*").order("updated_at", { ascending: false });

    if (statusParam) {
      const statuses = statusParam.split(",") as WorkflowStatus[];
      query = query.in("status", statuses);
    }

    const { data: workflows, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workflows: workflows ?? [] });
  } catch (err) {
    console.error("GET /api/workflows error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const supabase = createServerClient();
    const body = await request.json();

    const {
      name,
      description,
      workflowType,
      triggerType,
      triggerConfig,
      exitConditions,
      pauseConditions,
      primaryMetric,
    } = body;

    if (!name || !workflowType || !triggerType) {
      return NextResponse.json({ error: "name, workflowType, and triggerType are required" }, { status: 400 });
    }

    const insert: WorkflowInsert = {
      name,
      description: description ?? null,
      workflow_type: workflowType,
      trigger_type: triggerType,
      trigger_config: triggerConfig ?? {},
      exit_conditions: exitConditions ?? {},
      pause_conditions: pauseConditions ?? {},
      health_score: "C",
      status: "draft",
      current_version_id: null,
      primary_metric_name: primaryMetric ?? null,
      primary_metric_value: null,
      created_by: user.id,
    };

    const { data: workflow, error } = await supabase.from("workflows").insert(insert).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create initial version (v1)
    const { error: versionErr } = await supabase.from("workflow_versions").insert({
      workflow_id: workflow.id,
      version_number: 1,
      change_description: "Initial version",
      created_by: user.id,
    });

    if (versionErr) {
      console.error("Failed to create initial version:", versionErr.message);
    }

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (err) {
    console.error("POST /api/workflows error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
