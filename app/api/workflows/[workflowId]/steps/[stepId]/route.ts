export const dynamic = "force-dynamic";

/**
 * PATCH  /api/workflows/:workflowId/steps/:stepId — update a step
 * DELETE /api/workflows/:workflowId/steps/:stepId — delete a step
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string; stepId: string }> }
) {
  try {
    const { stepId } = await params;
    const supabase = createServerClient();
    const body = await request.json();

    const allowedFields = [
      "day_number", "step_type", "content", "subject",
      "send_time", "condition_config", "requires_confirmation",
      "step_number",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: step, error } = await supabase
      .from("workflow_steps")
      .update(updates)
      .eq("id", stepId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ step });
  } catch (err) {
    console.error("PATCH step error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workflowId: string; stepId: string }> }
) {
  try {
    const { stepId } = await params;
    const supabase = createServerClient();

    const { error } = await supabase
      .from("workflow_steps")
      .delete()
      .eq("id", stepId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("DELETE step error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
