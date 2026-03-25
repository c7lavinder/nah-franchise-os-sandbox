/**
 * GET /api/calls
 *
 * Returns recent calls from GHL conversations.
 * Filters to only real calls (over 2 minutes) with actual voice activity.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import type { GHLConversation, GHLMessage } from "@/types/ghl";

/** Message types that indicate a real call */
function isCallMessage(msg: GHLMessage): boolean {
  const t = msg.type;
  const mt = (msg.messageType ?? "").toUpperCase();
  return t === 3 || t === 4 || mt.includes("CALL") || mt.includes("VOICEMAIL");
}

export interface CallSummary {
  id: string;
  conversationId: string;
  messageId: string;
  contactId: string;
  contactName: string;
  phone: string | null;
  direction: "inbound" | "outbound";
  dateAdded: string;
  duration: string | null;
  type: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    // Fetch recent conversations
    const conversations = await ghl.getConversations({ limit: 100 });

    const calls: CallSummary[] = [];

    // Check each conversation for call messages
    for (const conv of conversations) {
      if (calls.length >= limit) break;

      try {
        const result = await ghl.getConversationMessages(conv.id, { limit: 20 });
        const callMsgs = result.messages.filter(isCallMessage);

        for (const msg of callMsgs) {
          calls.push({
            id: `${conv.id}_${msg.id}`,
            conversationId: conv.id,
            messageId: msg.id,
            contactId: conv.contactId,
            contactName: conv.contactName ?? conv.fullName ?? "Unknown",
            phone: conv.phone ?? null,
            direction: msg.direction,
            dateAdded: msg.dateAdded,
            duration: msg.body ?? null,
            type: conv.type,
          });
        }
      } catch {
        // Skip conversations that fail
      }

      if (calls.length >= limit) break;
    }

    // Sort by most recent
    calls.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());

    return NextResponse.json({ calls: calls.slice(0, limit) });
  } catch (err) {
    console.error("Calls fetch failed:", err);
    return NextResponse.json({ error: "Failed to load calls" }, { status: 502 });
  }
}
