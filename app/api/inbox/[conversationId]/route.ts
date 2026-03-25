export const dynamic = "force-dynamic";

/**
 * GET /api/inbox/[conversationId]
 *
 * Returns messages for a specific conversation with pagination.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const lastMessageId = searchParams.get("cursor") ?? undefined;

    const result = await ghl.getConversationMessages(params.conversationId, {
      limit,
      lastMessageId,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Conversation messages fetch failed:", err);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 502 });
  }
}
