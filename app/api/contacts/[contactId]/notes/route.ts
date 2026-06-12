export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/[contactId]/notes
 *
 * Adds a note to a contact in GHL.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";

export async function POST(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const { contactId } = await params;
    const body = await request.json();

    if (!body.body?.trim()) {
      return NextResponse.json({ error: "Note body is required" }, { status: 400 });
    }

    const note = await ghl.addNote(contactId, body.body.trim());
    return NextResponse.json({ note });
  } catch (err) {
    console.error("Add note failed:", err);
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
}
