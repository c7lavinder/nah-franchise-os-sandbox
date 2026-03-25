/**
 * PUT /api/contacts/[contactId]/tasks/[taskId]
 *
 * Updates a task on a contact in GHL (e.g., mark as completed).
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";

export async function PUT(
  request: NextRequest,
  { params }: { params: { contactId: string; taskId: string } }
) {
  try {
    const { contactId, taskId } = params;
    const body = await request.json();

    const task = await ghl.updateTask(contactId, taskId, body);
    return NextResponse.json({ task });
  } catch (err) {
    console.error("Update task failed:", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
