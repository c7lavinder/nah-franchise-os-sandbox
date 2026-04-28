export const dynamic = "force-dynamic";

/**
 * GET  /api/workflows/:workflowId/approvals — list approvals for a workflow
 * POST /api/workflows/:workflowId/approvals — submit a new approval request
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { getApprovalsForWorkflow, submitForApproval } from "@/lib/workflows/approvals";
import type { ApprovalType } from "@/lib/workflows/types";

const VALID_APPROVAL_TYPES: ApprovalType[] = [
  "publish",
  "pause",
  "archive",
  "ab_test_start",
  "ab_test_winner",
  "rollback",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await params;
    const approvals = await getApprovalsForWorkflow(workflowId);
    return NextResponse.json({ approvals });
  } catch (err) {
    console.error("GET workflow approvals error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await params;
    const body = await request.json();

    // Validate required fields
    const { approvalType, submittedBy, workflowVersionId, abTestId, notes } = body as {
      approvalType?: string;
      submittedBy?: string;
      workflowVersionId?: string;
      abTestId?: string;
      notes?: string;
    };

    if (!approvalType || !submittedBy) {
      return NextResponse.json(
        { error: "approvalType and submittedBy are required" },
        { status: 400 }
      );
    }

    if (!VALID_APPROVAL_TYPES.includes(approvalType as ApprovalType)) {
      return NextResponse.json(
        { error: `Invalid approvalType. Must be one of: ${VALID_APPROVAL_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await submitForApproval({
      workflowId,
      workflowVersionId,
      abTestId,
      approvalType: approvalType as ApprovalType,
      submittedBy,
      notes,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ approval: result.approval }, { status: 201 });
  } catch (err) {
    console.error("POST workflow approval error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
