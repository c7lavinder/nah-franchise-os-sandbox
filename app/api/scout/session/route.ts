export const dynamic = "force-dynamic";

/**
 * GET /api/scout/session
 *
 * Loads the most recent active session for a user.
 * Returns the session ID, API history, and display messages
 * so the Scout page can resume a previous conversation.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type Anthropic from "@anthropic-ai/sdk";

interface StoredMessage {
  role: "user" | "assistant";
  content: string | Anthropic.Messages.ContentBlock[];
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const supabase = createServerClient();

    const { data: session, error } = await supabase
      .from("sessions")
      .select("id, conversation_history")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !session) {
      return NextResponse.json({ sessionId: null, history: [], messages: [] });
    }

    const history = (session.conversation_history ?? []) as StoredMessage[];

    // Build display messages from the API history
    // Only extract user text and assistant text blocks for the chat UI
    const displayMessages = history
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .map((msg) => {
        let content = "";

        if (typeof msg.content === "string") {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          // Extract text blocks from assistant responses
          const textBlock = msg.content.find(
            (block: Anthropic.Messages.ContentBlock) => block.type === "text"
          ) as Anthropic.Messages.TextBlock | undefined;
          content = textBlock?.text ?? "";

          // Skip tool_result messages from the user side
          const hasToolResult = msg.content.some(
            (block: Anthropic.Messages.ContentBlock) => block.type === "tool_use"
          );
          if (hasToolResult && !content) return null;
        }

        if (!content) return null;

        return {
          id: crypto.randomUUID(),
          role: msg.role,
          content,
          timestamp: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      sessionId: session.id,
      history,
      messages: displayMessages,
    });
  } catch {
    return NextResponse.json({ sessionId: null, history: [], messages: [] });
  }
}
