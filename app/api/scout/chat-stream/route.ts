export const dynamic = "force-dynamic";

/**
 * POST /api/scout/chat-stream
 *
 * Streaming variant of /api/scout/chat. Returns Server-Sent Events (SSE)
 * so the frontend can render text progressively and show tool-call status.
 *
 * Event types:
 *   thinking  — Scout is processing (iteration count)
 *   tool      — A tool was called (tool name)
 *   text      — Partial text chunk from the final response
 *   actions   — Drafted actions produced during the turn
 *   done      — Final metadata (fullText, sessionId, history)
 *   error     — Something went wrong
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import { buildSystemPrompt } from "@/lib/scout/client";
import { runStreamingTurn } from "@/lib/scout/stream";
import { loadUserMemory, mergeUserMemory } from "@/lib/scout/memory";
import { logRetrieval } from "@/lib/scout/retrieval-logger";
import { createServerClient } from "@/lib/supabase/server";
import type Anthropic from "@anthropic-ai/sdk";
import type { DraftedAction } from "@/types/scout";

/** Max chars for a single tool result in stored conversation history */
const MAX_TOOL_RESULT_CHARS = 2000;

/**
 * Truncate tool results in conversation history to prevent oversized JSONB payloads.
 * Keeps user text, assistant text, and tool_use inputs intact — only caps tool_result content.
 */
function truncateHistoryForStorage(history: Anthropic.Messages.MessageParam[]): Anthropic.Messages.MessageParam[] {
  return history.map((msg) => {
    if (msg.role !== "user" || !Array.isArray(msg.content)) return msg;
    const hasToolResult = (msg.content as any[]).some((b: any) => b.type === "tool_result");
    if (!hasToolResult) return msg;

    return {
      ...msg,
      content: (msg.content as any[]).map((block: any) => {
        if (block.type !== "tool_result") return block;
        const content = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
        if (content.length <= MAX_TOOL_RESULT_CHARS) return block;
        return {
          ...block,
          content: content.slice(0, MAX_TOOL_RESULT_CHARS) + `\n...[truncated from ${content.length} chars]`,
        };
      }),
    };
  });
}

interface ChatStreamBody {
  message: string;
  sessionId: string | null;
  history: Anthropic.Messages.MessageParam[];
  pageContext?: {
    page: string;
    callType?: string;
    contactId?: string;
    territorySlug?: string;
    pipelineStage?: string;
  };
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const rateLimited = checkRateLimit(user.id, RATE_LIMITS.scoutChat);
  if (rateLimited) return rateLimited;

  let body: ChatStreamBody;
  try {
    body = (await request.json()) as ChatStreamBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.message) {
    return new Response("Missing required field: message", { status: 400 });
  }

  const messages: Anthropic.Messages.MessageParam[] = [...body.history, { role: "user", content: body.message }];

  const input = {
    messages,
    userId: user.id,
    userRole: user.role,
    userName: user.fullName,
    pageContext: body.pageContext,
  };

  // Build system prompt (loads KB, pipeline snapshot, memory)
  const { systemPrompt, ghlUserId, prefetch } = await buildSystemPrompt(input);

  // Create the SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let streamOpen = true;
      function sendEvent(event: string, data: string) {
        if (!streamOpen) return; // Don't throw if client disconnected
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          // Client disconnected — mark stream as closed but don't throw
          streamOpen = false;
        }
      }

      // Send initial thinking event
      sendEvent("thinking", JSON.stringify({ iteration: 0 }));

      let finalText = "";
      let finalActions: DraftedAction[] = [];
      let finalHistory: Anthropic.Messages.MessageParam[] = [];

      try {
        await runStreamingTurn({
          systemPrompt,
          messages,
          input,
          ghlUserId,
          onEvent: (event) => {
            sendEvent(event.type, event.data);

            // Capture final data for session persistence
            if (event.type === "done") {
              try {
                const parsed = JSON.parse(event.data);
                finalText = parsed.fullText;
                finalActions = parsed.draftedActions;
                finalHistory = parsed.history;
              } catch {
                console.error("Scout stream: failed to parse done event data");
              }
            }
          },
        });
      } catch (err) {
        // Stream or API error — log but continue to session persistence
        const errMsg = err instanceof Error ? err.message : "Unexpected error";
        console.error("Scout streaming turn error:", errMsg);
        sendEvent("error", JSON.stringify({ error: errMsg }));
      }

      // ALWAYS persist session — even if stream errored or client disconnected.
      // But NEVER overwrite an existing session with empty history.
      try {
        const supabase = createServerClient();
        let sessionId = body.sessionId;
        const storableHistory = truncateHistoryForStorage(finalHistory);

        if (storableHistory.length >= 2) {
          // We have real conversation data — safe to persist
          if (sessionId) {
            const { error: updateErr } = await supabase
              .from("sessions")
              .update({
                conversation_history: storableHistory as unknown as Record<string, unknown>[],
                last_activity_at: new Date().toISOString(),
              })
              .eq("id", sessionId);
            if (updateErr) console.error("Scout session update failed:", updateErr.message);
          } else {
            const { data: newSession, error: insertErr } = await supabase
              .from("sessions")
              .insert({
                user_id: user.id,
                conversation_history: storableHistory as unknown as Record<string, unknown>[],
                is_active: true,
              })
              .select("id")
              .single();
            if (insertErr) console.error("Scout session insert failed:", insertErr.message);
            sessionId = newSession?.id ?? null;
          }
        } else if (sessionId) {
          console.warn(`Scout: skipping session update — empty history would erase session ${sessionId}`);
        }

        // Send sessionId as a final event
        if (sessionId) {
          sendEvent("session", JSON.stringify({ sessionId }));
        }

        // Log drafted actions
        if (finalActions.length > 0) {
          const { error: actionErr } = await supabase.from("scout_action_logs").insert(
            finalActions.map((da) => ({
              user_id: user.id,
              session_id: sessionId ?? "00000000-0000-0000-0000-000000000000",
              action_type: da.type,
              action_status: "drafted",
              ghl_contact_id: da.contactId,
              draft_content: da.payload as unknown as Record<string, unknown>,
            }))
          );
          if (actionErr) console.error("Scout action log failed:", actionErr.message);
        }
      } catch (err) {
        console.error("Scout session persistence failed:", err instanceof Error ? err.message : err);
      }

      // Retrieval quality log (fire-and-forget)
      if (prefetch.chunksRetrieved > 0 || prefetch.questionType !== "general") {
        logRetrieval({
          userId: user.id,
          sessionId: body.sessionId ?? undefined,
          questionType: prefetch.questionType,
          userMessage: body.message,
          chunksRetrieved: prefetch.chunksRetrieved,
          tokenBudget: prefetch.tokenBudget,
          prefetchChunks: prefetch.chunkMeta,
        }).catch(() => {});
      }

      // Memory merge (fire-and-forget)
      (async () => {
        try {
          const existingMemory = await loadUserMemory(user.id);
          await mergeUserMemory({
            userId: user.id,
            userName: user.fullName,
            existingMemory,
            userMessage: body.message,
            assistantResponse: finalText,
            draftedActionType: finalActions[0]?.type,
          });
        } catch {
          // Memory merge is best-effort
        }
      })();

      try {
        controller.close();
      } catch {
        // Already closed
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
