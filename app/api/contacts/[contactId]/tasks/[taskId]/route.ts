export const dynamic = "force-dynamic";

/**
 * PUT /api/contacts/[contactId]/tasks/[taskId]
 *
 * Updates a task on a contact in GHL (e.g., mark as completed).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string; taskId: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const { contactId, taskId } = await params;
    const body = await request.json();

    // Validate: only allow known fields
    const allowed = ["title", "body", "dueDate", "completed", "assignedTo"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid update fields provided" }, { status: 400 });
    }
    if (updates.dueDate && isNaN(Date.parse(updates.dueDate as string))) {
      return NextResponse.json({ error: "dueDate must be a valid ISO date" }, { status: 400 });
    }
    if (updates.completed !== undefined && typeof updates.completed !== "boolean") {
      return NextResponse.json({ error: "completed must be a boolean" }, { status: 400 });
    }

    const task = await ghl.updateTask(contactId, taskId, updates as Parameters<typeof ghl.updateTask>[2]);
    return NextResponse.json({ task });
  } catch (err) {
    console.error("Update task failed:", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
