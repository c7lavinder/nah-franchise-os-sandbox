export const dynamic = "force-dynamic";

/**
 * GET   /api/workflows/:workflowId/approvals/:approvalId — get a single approval
 * PATCH /api/workflows/:workflowId/approvals/:approvalId — approve or reject
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { getApproval, approveRequest, rejectRequest } from "@/lib/workflows/approvals";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string; approvalId: string }> }
) {
  try {
    const { approvalId } = await params;
    const approval = await getApproval(approvalId);

    if (!approval) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    return NextResponse.json({ approval });
  } catch (err) {
    console.error("GET approval error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string; approvalId: string }> }
) {
  try {
    const { approvalId } = await params;
    const body = await request.json();

    const { action, approvedBy, notes } = body as {
      action?: string;
      approvedBy?: string;
      notes?: string;
    };

    if (!action || !approvedBy) {
      return NextResponse.json(
        { error: "action ('approve' | 'reject') and approvedBy are required" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    let result;
    if (action === "approve") {
      result = await approveRequest(approvalId, approvedBy);
    } else {
      result = await rejectRequest(approvalId, approvedBy, notes);
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ approval: result.approval });
  } catch (err) {
    console.error("PATCH approval error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
