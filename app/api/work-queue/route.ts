export const dynamic = "force-dynamic";

/**
 * GET /api/work-queue
 *
 * Central work queue API foundation for Daily HQ and other operator views.
 * Reads normalized queue rows; pass ?sync=1 to refresh source-backed items
 * first. POST performs the same source sync explicitly.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getWorkQueueItems,
  isWorkQueueSourceType,
  parseWorkQueueStatuses,
  syncWorkQueueSources,
  WORK_QUEUE_STATUS_LABELS,
  type WorkQueueSourceType,
} from "@/lib/work-queue/sources";

function boolParam(value: string | null): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function scopedUserId(user: { id: string; role: string }, request: NextRequest): string | null {
  const targetParam = request.nextUrl.searchParams.get("targetUserId");
  if (user.role === "admin") return targetParam || null;
  return user.id;
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const { searchParams } = request.nextUrl;
    const assignedUserId = scopedUserId(user, request);
    const sourceTypeParam = searchParams.get("sourceType");
    const sourceType = isWorkQueueSourceType(sourceTypeParam) ? sourceTypeParam : undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);

    const synced = boolParam(searchParams.get("sync"))
      ? await syncWorkQueueSources({ assignedUserId, sourceTypes: sourceType ? [sourceType] : undefined })
      : null;

    const items = await getWorkQueueItems({
      assignedUserId,
      sourceType,
      statuses: parseWorkQueueStatuses(searchParams.get("status")) ?? undefined,
      includeDone: boolParam(searchParams.get("includeDone")),
      limit,
    });

    return NextResponse.json({ items, statusLabels: WORK_QUEUE_STATUS_LABELS, synced });
  } catch (err) {
    console.error("GET work queue failed:", err);
    return NextResponse.json({ error: "Failed to load work queue" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      sourceTypes?: WorkQueueSourceType[];
      targetUserId?: string;
    };

    const assignedUserId = user.role === "admin" ? (body.targetUserId ?? null) : user.id;
    const sourceTypes = Array.isArray(body.sourceTypes) ? body.sourceTypes.filter(isWorkQueueSourceType) : undefined;

    const synced = await syncWorkQueueSources({ assignedUserId, sourceTypes });
    return NextResponse.json({ synced, statusLabels: WORK_QUEUE_STATUS_LABELS });
  } catch (err) {
    console.error("POST work queue sync failed:", err);
    return NextResponse.json({ error: "Failed to sync work queue" }, { status: 502 });
  }
}
