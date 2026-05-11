export const dynamic = "force-dynamic";

/**
 * GET /api/admin/scout-logs
 *
 * Returns Scout conversation exchanges for the admin audit page.
 * Extracts user/assistant message pairs from session conversation_history,
 * including tool call details (inputs + results) for debugging.
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

interface ToolCallDetail {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

interface ConversationExchange {
  userMessage: string;
  aiResponse: string;
  toolsCalled: string[];
  toolDetails: ToolCallDetail[];
}

interface SessionEntry {
  sessionId: string;
  userId: string;
  userName: string;
  exchanges: ConversationExchange[];
  lastActivity: string;
  startedAt: string;
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

/** Extract AI response text, tool names, and full tool details from an assistant message */
function extractAssistantContent(msg: any): {
  text: string;
  tools: string[];
  toolUses: { id: string; name: string; input: Record<string, unknown> }[];
} {
  if (typeof msg.content === "string") return { text: msg.content, tools: [], toolUses: [] };
  if (Array.isArray(msg.content)) {
    const text = msg.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    const tools = msg.content.filter((b: any) => b.type === "tool_use").map((b: any) => b.name);
    const toolUses = msg.content
      .filter((b: any) => b.type === "tool_use")
      .map((b: any) => ({ id: b.id as string, name: b.name as string, input: b.input ?? {} }));
    return { text, tools, toolUses };
  }
  return { text: "", tools: [], toolUses: [] };
}

/** Extract tool_result blocks from a user message (these follow tool_use calls) */
function extractToolResults(msg: any): Map<string, { content: string; isError: boolean }> {
  const results = new Map<string, { content: string; isError: boolean }>();
  if (!Array.isArray(msg.content)) return results;

  for (const block of msg.content) {
    if (block.type === "tool_result" && block.tool_use_id) {
      let content = "";
      if (typeof block.content === "string") {
        content = block.content;
      } else if (Array.isArray(block.content)) {
        content = block.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("\n");
      }
      results.set(block.tool_use_id, {
        content,
        isError: block.is_error === true,
      });
    }
  }
  return results;
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

  // Query sessions with conversation history — fetch extra to compensate for
  // sessions that get filtered out (empty/no-exchange sessions)
  const fetchLimit = limit * 2;
  let query = supabase
    .from("sessions")
    .select("id, user_id, conversation_history, last_activity_at, started_at")
    .not("conversation_history", "is", null)
    .not("conversation_history", "eq", "[]")
    .order("last_activity_at", { ascending: false })
    .range(offset, offset + fetchLimit - 1);

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

  // Build a map of tool_use_id → tool_result from the entire history
  function buildToolResultMap(history: any[]): Map<string, { content: string; isError: boolean }> {
    const allResults = new Map<string, { content: string; isError: boolean }>();
    for (const msg of history) {
      if (msg.role === "user") {
        const results = extractToolResults(msg);
        results.forEach((val, key) => allResults.set(key, val));
      }
    }
    return allResults;
  }

  // Parse conversation_history into clean exchanges
  const entries: SessionEntry[] = (sessions ?? [])
    .filter((s: any) => {
      const history = s.conversation_history as any[];
      return Array.isArray(history) && history.length >= 2;
    })
    .map((session: any) => {
      const history = session.conversation_history as any[];
      const exchanges: ConversationExchange[] = [];
      const toolResultMap = buildToolResultMap(history);

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

          // Find the next assistant message(s) — collect all tool calls and text
          let aiText = "";
          const allTools: string[] = [];
          const allToolDetails: ToolCallDetail[] = [];

          for (let j = i + 1; j < history.length; j++) {
            if (history[j].role === "assistant") {
              const extracted = extractAssistantContent(history[j]);
              allTools.push(...extracted.tools);

              // Build tool details with matched results
              for (const tu of extracted.toolUses) {
                const result = toolResultMap.get(tu.id);
                allToolDetails.push({
                  name: tu.name,
                  input: tu.input,
                  result: result?.content,
                  isError: result?.isError,
                });
              }

              if (extracted.text) {
                aiText = extracted.text;
                // Only break if this is a final response (no tool calls in this message)
                if (extracted.tools.length === 0) break;
              }
            }
            // Stop at the next real user message — but skip tool_result messages
            // (tool_result messages have role "user" but are system-generated, not new turns)
            if (history[j].role === "user" && j > i + 1) {
              const isToolResult = Array.isArray(history[j].content) && history[j].content[0]?.type === "tool_result";
              if (!isToolResult) break;
            }
          }

          exchanges.push({
            userMessage: userText,
            aiResponse: aiText,
            toolsCalled: allTools,
            toolDetails: allToolDetails,
          });
        }
      }

      return {
        sessionId: session.id,
        userId: session.user_id,
        userName: userMap.get(session.user_id) ?? "Unknown",
        exchanges,
        lastActivity: session.last_activity_at,
        startedAt: session.started_at ?? session.last_activity_at,
      };
    })
    .filter((e: SessionEntry) => e.exchanges.length > 0);

  // Trim to requested limit after filtering
  const trimmedEntries = entries.slice(0, limit);

  // Count total displayable sessions
  let countQuery = supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .not("conversation_history", "is", null)
    .not("conversation_history", "eq", "[]");

  if (filterUserId) {
    countQuery = countQuery.eq("user_id", filterUserId);
  }

  const { count } = await countQuery;

  return NextResponse.json({
    entries: trimmedEntries,
    total: count ?? 0,
    limit,
    offset,
  });
}
