export const dynamic = "force-dynamic";

/**
 * PUT /api/inbox/[conversationId]/read
 *
 * Marks a conversation as read.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";

export async function PUT(
  _request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const conversation = await ghl.markConversationRead(params.conversationId);
    return NextResponse.json({ conversation });
  } catch (err) {
    console.error("Mark read failed:", err);
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }
}
