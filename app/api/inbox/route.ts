/**
 * GET /api/inbox
 *
 * Returns paginated conversation list for the inbox view.
 * Filters out conversations that only have system activity (no real messages).
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";

/** Message types that represent real communication */
const REAL_MESSAGE_TYPES = new Set([
  "TYPE_SMS",
  "TYPE_EMAIL",
  "TYPE_CALL",
  "TYPE_VOICEMAIL",
  "TYPE_WHATSAPP",
  "TYPE_FB",
  "TYPE_IG",
  "TYPE_LIVE_CHAT",
]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const lastId = searchParams.get("lastId") ?? undefined;
    const unreadOnly = searchParams.get("unread") === "true";

    // Fetch more than needed so we have enough after filtering
    const conversations = await ghl.getConversations({
      limit: Math.min(limit * 2, 100),
      lastId,
      unreadOnly,
    });

    // Filter to only conversations with real messages (not system activity)
    const filtered = conversations.filter((conv) => {
      const msgType = (conv.lastMessageType as unknown as string) ?? "";
      return REAL_MESSAGE_TYPES.has(msgType);
    });

    return NextResponse.json({ conversations: filtered.slice(0, limit) });
  } catch (err) {
    console.error("Inbox fetch failed:", err);
    return NextResponse.json({ error: "Failed to load inbox" }, { status: 502 });
  }
}
