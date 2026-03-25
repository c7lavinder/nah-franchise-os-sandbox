export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/[contactId]
 *
 * Returns full contact details including notes, tasks, and message history.
 * Used by the ContactDetail slide-out panel.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";

export async function GET(
  _request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  const { contactId } = params;

  if (!contactId) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }

  try {
    // Fetch all data in parallel
    const [contact, notes, tasks, messages] = await Promise.all([
      ghl.getContact(contactId).catch(() => null),
      ghl.getNotes(contactId).catch(() => []),
      ghl.getTasks(contactId).catch(() => []),
      ghl.getContactHistory(contactId).catch(() => []),
    ]);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({
      contact,
      notes,
      tasks,
      messages,
    });
  } catch (err) {
    console.error("Contact detail fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch contact details" },
      { status: 502 }
    );
  }
}
