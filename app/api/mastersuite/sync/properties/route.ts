import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  syncProperties,
  syncLeadList,
  syncLeadListCounts,
  syncLeadListProperties,
  syncStage0Origins,
} from "@/lib/mastersuite/sync-properties";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    since?: string;
    leadListOnly?: boolean;
    leadListCountsOnly?: boolean;
    leadListPropertiesOnly?: boolean;
    stage0OriginsOnly?: boolean;
  };

  if (body.stage0OriginsOnly) {
    const result = await syncStage0Origins();
    return NextResponse.json({
      success: result.errors.length === 0,
      synced: result.upserted,
      errors: result.errors,
    });
  }

  if (body.leadListPropertiesOnly) {
    const result = await syncLeadListProperties(body.since);
    return NextResponse.json({
      success: result.errors.length === 0,
      synced: result,
      errors: result.errors,
    });
  }

  if (body.leadListCountsOnly) {
    const result = await syncLeadListCounts();
    return NextResponse.json({
      success: result.errors.length === 0,
      synced: result.synced,
      errors: result.errors,
    });
  }

  if (body.leadListOnly) {
    const result = await syncLeadList(body.since);
    return NextResponse.json({
      success: result.errors.length === 0,
      synced: {
        counts: result.counts.synced,
        leadListPropertiesUpserted: result.properties.upserted,
        leadListPropertiesMovedOut: result.properties.markedMovedOut,
      },
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
