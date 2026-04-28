export const dynamic = "force-dynamic";

/**
 * GET /api/workflows/approvals — list all pending approval requests
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { getPendingApprovals } from "@/lib/workflows/approvals";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  try {
    const approvals = await getPendingApprovals();
    return NextResponse.json({ approvals });
  } catch (err) {
    console.error("GET pending approvals error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
