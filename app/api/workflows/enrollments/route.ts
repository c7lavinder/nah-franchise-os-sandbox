export const dynamic = "force-dynamic";

/**
 * GET  /api/workflows/enrollments?workflowId=X&contactId=Y&status=active
 * POST /api/workflows/enrollments — enroll a contact into a workflow
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { enrollContact, getWorkflowEnrollments, getContactEnrollments } from "@/lib/workflows/enrollment";
import type { EnrollmentStatus } from "@/lib/workflows/types";

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");
    const contactId = searchParams.get("contactId");
    const statusParam = searchParams.get("status");

    const statusFilter = statusParam ? (statusParam.split(",") as EnrollmentStatus[]) : undefined;

    if (!workflowId && !contactId) {
      return NextResponse.json({ error: "Provide workflowId or contactId" }, { status: 400 });
    }

    const enrollments = workflowId
      ? await getWorkflowEnrollments(workflowId, statusFilter)
      : await getContactEnrollments(contactId!, statusFilter);

    return NextResponse.json({ enrollments });
  } catch (err) {
    console.error("GET /api/workflows/enrollments error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  try {
    const body = await request.json();
    const { workflowId, workflowVersionId, ghlContactId, contactName } = body;

    if (!workflowId || !workflowVersionId || !ghlContactId) {
      return NextResponse.json(
        { error: "workflowId, workflowVersionId, and ghlContactId are required" },
        { status: 400 }
      );
    }

    // Verify workflow is live before enrolling
    const supabase = createServerClient();
    const { data: wf } = await supabase.from("workflows").select("status").eq("id", workflowId).single();

    if (!wf || wf.status !== "live") {
      return NextResponse.json({ error: "Workflow must be live before enrolling contacts" }, { status: 400 });
    }

    const result = await enrollContact({
      workflowId,
      workflowVersionId,
      ghlContactId,
      contactName,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ enrollment: result.enrollment }, { status: 201 });
  } catch (err) {
    console.error("POST /api/workflows/enrollments error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
