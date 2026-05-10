import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { syncTerritories } from "@/lib/mastersuite/sync-territories";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const result = await syncTerritories();

  return NextResponse.json({
    success: result.errors.length === 0,
    synced: result.synced,
    errors: result.errors,
  });
}
