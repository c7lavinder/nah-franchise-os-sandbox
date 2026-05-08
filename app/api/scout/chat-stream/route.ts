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
import { createServerClient } from "@/lib/supabase/server";
import type Anthropic from "@anthropic-ai/sdk";
import type { DraftedAction } from "@/types/scout";

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
  const { systemPrompt, ghlUserId } = await buildSystemPrompt(input);

  // Create the SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
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
              const parsed = JSON.parse(event.data);
              finalText = parsed.fullText;
              finalActions = parsed.draftedActions;
              finalHistory = parsed.history;
            }
          },
        });

        // Persist session (non-blocking from the stream perspective)
        try {
          const supabase = createServerClient();
          let sessionId = body.sessionId;

          if (sessionId) {
            await supabase
              .from("sessions")
              .update({
                conversation_history: finalHistory as unknown as Record<string, unknown>[],
                last_activity_at: new Date().toISOString(),
              })
              .eq("id", sessionId);
          } else {
            const { data: newSession } = await supabase
              .from("sessions")
              .insert({
                user_id: user.id,
                conversation_history: finalHistory as unknown as Record<string, unknown>[],
                is_active: true,
              })
              .select("id")
              .single();
            sessionId = newSession?.id ?? null;
          }

          // Send sessionId as a final event
          if (sessionId) {
            sendEvent("session", JSON.stringify({ sessionId }));
          }

          // Log drafted actions
          if (finalActions.length > 0) {
            await supabase.from("scout_action_logs").insert(
              finalActions.map((da) => ({
                user_id: user.id,
                session_id: sessionId ?? "00000000-0000-0000-0000-000000000000",
                action_type: da.type,
                action_status: "drafted",
                ghl_contact_id: da.contactId,
                draft_content: da.payload as unknown as Record<string, unknown>,
              }))
            );
          }
        } catch {
          // Session persistence is non-critical
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
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unexpected error";
        sendEvent("error", JSON.stringify({ error: errMsg }));
      } finally {
        controller.close();
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
