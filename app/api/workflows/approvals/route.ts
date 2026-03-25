export const dynamic = "force-dynamic";

/**
 * GET /api/workflows/approvals — list all pending approval requests
 */

import { NextResponse } from "next/server";
import { getPendingApprovals } from "@/lib/workflows/approvals";

export async function GET() {
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
