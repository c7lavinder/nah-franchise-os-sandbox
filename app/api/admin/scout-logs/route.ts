export const dynamic = "force-dynamic";

/**
 * GET /api/admin/scout-logs
 *
 * Returns Scout conversation exchanges for the admin audit page.
 * Extracts user/assistant message pairs from session conversation_history.
 * Admin-only.
 *
 * Query params:
 *   ?limit=50    — max rows (default 50, max 200)
 *   ?offset=0    — pagination offset
 *   ?userId=X    — filter to specific user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

interface ConversationExchange {
  userMessage: string;
  aiResponse: string;
  toolsCalled: string[];
}

interface SessionEntry {
  sessionId: string;
  userId: string;
  userName: string;
  exchanges: ConversationExchange[];
  lastActivity: string;
}

/** Extract clean user message text from a message param */
function extractUserText(msg: any): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
  }
  return "";
}

/** Extract AI response text + tool names from an assistant message */
function extractAssistantContent(msg: any): { text: string; tools: string[] } {
  if (typeof msg.content === "string") return { text: msg.content, tools: [] };
  if (Array.isArray(msg.content)) {
    const text = msg.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    const tools = msg.content.filter((b: any) => b.type === "tool_use").map((b: any) => b.name);
    return { text, tools };
  }
  return { text: "", tools: [] };
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(params.get("limit") ?? "50", 10), 200);
  const offset = parseInt(params.get("offset") ?? "0", 10);
  const filterUserId = params.get("userId");

  const supabase = createServerClient();

  // Query sessions with conversation history
  let query = supabase
    .from("sessions")
    .select("id, user_id, conversation_history, last_activity_at")
    .not("conversation_history", "is", null)
    .order("last_activity_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filterUserId) {
    query = query.eq("user_id", filterUserId);
  }

  const { data: sessions, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Batch lookup user names
  const userIds = [...new Set((sessions ?? []).map((s: any) => s.user_id).filter(Boolean))];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", userIds.length > 0 ? userIds : ["none"]);

  const userMap = new Map((users ?? []).map((u: any) => [u.id, u.full_name]));

  // Parse conversation_history into clean exchanges
  const entries: SessionEntry[] = (sessions ?? [])
    .filter((s: any) => {
      const history = s.conversation_history as any[];
      return Array.isArray(history) && history.length >= 2;
    })
    .map((session: any) => {
      const history = session.conversation_history as any[];
      const exchanges: ConversationExchange[] = [];
      const allTools: string[] = [];

      // Walk through messages pairing user → assistant
      for (let i = 0; i < history.length; i++) {
        const msg = history[i];

        if (msg.role === "user") {
          const userText = extractUserText(msg);
          // Skip tool_result messages (they have content array with type: "tool_result")
          if (!userText && Array.isArray(msg.content) && msg.content[0]?.type === "tool_result") {
            continue;
          }
          if (!userText) continue;

          // Find the next assistant message with text content
          let aiText = "";
          let tools: string[] = [];
          for (let j = i + 1; j < history.length; j++) {
            if (history[j].role === "assistant") {
              const extracted = extractAssistantContent(history[j]);
              tools.push(...extracted.tools);
              if (extracted.text) {
                aiText = extracted.text;
                break;
              }
            }
            if (history[j].role === "user" && j > i + 1) break;
          }

          if (userText) {
            exchanges.push({ userMessage: userText, aiResponse: aiText, toolsCalled: tools });
            allTools.push(...tools);
          }
        }
      }

      return {
        sessionId: session.id,
        userId: session.user_id,
        userName: userMap.get(session.user_id) ?? "Unknown",
        exchanges,
        lastActivity: session.last_activity_at,
      };
    })
    .filter((e: SessionEntry) => e.exchanges.length > 0);

  // Count total sessions for pagination
  let countQuery = supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .not("conversation_history", "is", null);

  if (filterUserId) {
    countQuery = countQuery.eq("user_id", filterUserId);
  }

  const { count } = await countQuery;

  return NextResponse.json({
    entries,
    total: count ?? 0,
    limit,
    offset,
  });
}
