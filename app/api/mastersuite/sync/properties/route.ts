import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { syncProperties, syncLeadListCounts } from "@/lib/mastersuite/sync-properties";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { since?: string; leadListOnly?: boolean };

  if (body.leadListOnly) {
    const result = await syncLeadListCounts();
    return NextResponse.json({
      success: result.errors.length === 0,
      synced: result.synced,
      errors: result.errors,
    });
  }

  const result = await syncProperties(body.since);

  return NextResponse.json({
    success: result.errors.length === 0,
    synced: result.synced,
    errors: result.errors,
  });
}
