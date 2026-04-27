export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/[contactId]/tasks
 *
 * Create a task on a contact in GHL.
 * Body: { title, dueDate, body? }
 *
 * The contactId param is expected to be the GHL contact ID (matching
 * the existing notes endpoint's convention; LeadDetailView resolves
 * UUIDs to GHL IDs before mounting).
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";

export async function POST(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const { contactId } = params;
    const body = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }
    if (!body.dueDate) {
      return NextResponse.json({ error: "dueDate is required" }, { status: 400 });
    }

    const task = await ghl.createTask(contactId, {
      title: body.title.trim(),
      body: body.body?.trim() || undefined,
      dueDate: body.dueDate,
    });

    return NextResponse.json({ task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
