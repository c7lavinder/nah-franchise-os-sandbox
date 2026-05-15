"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Send, Paperclip, Mic, Loader2, CheckCheck } from "lucide-react";
import Image from "next/image";
import { ScoutBubble, UserBubble, ThinkingIndicator, DraftedActionCard, VoiceRecorder } from "@/components/scout";
import { useAuth } from "@/lib/auth/AuthContext";
import { parsePageContext } from "@/lib/scout/page-context";
import type { ChatMessage, DraftedAction } from "@/types/scout";
import type Anthropic from "@anthropic-ai/sdk";

/** Scout AI page — full chat interface with tool-call support */
export default function ScoutPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState(searchParams.get("ask") ?? "");
  const [isThinking, setIsThinking] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Anthropic message history for the API — tracks the full conversation including tool calls
  const apiHistoryRef = useRef<Anthropic.Messages.MessageParam[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Auto-scroll to the bottom when new messages arrive */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);

  /** On mount: pick up a handoff from ScoutFAB if present, otherwise fresh.
   *  ScoutFAB writes the in-flight conversation to sessionStorage under
   *  "scout_handoff" when the user clicks the maximize button. We consume
   *  + clear it so refreshes don't keep replaying the same thread. */
  useEffect(() => {
    let hydrated = false;
    try {
      const raw = sessionStorage.getItem("scout_handoff");
      if (raw) {
        sessionStorage.removeItem("scout_handoff");
        const payload = JSON.parse(raw) as {
          messages?: ChatMessage[];
          history?: Anthropic.Messages.MessageParam[];
          sessionId?: string | null;
        };
        if (payload.messages && payload.messages.length > 0) {
          setMessages(payload.messages);
          apiHistoryRef.current = payload.history ?? [];
          setSessionId(payload.sessionId ?? null);
          hydrated = true;
        }
      }
    } catch {
      // Bad JSON or storage unavailable — fall through to fresh session.
    }
    if (!hydrated) {
      setMessages([]);
      setSessionId(null);
      apiHistoryRef.current = [];
    }
    setError(null);
    setInputValue(searchParams.get("ask") ?? "");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable ID for the in-progress Scout message during streaming
  const streamMsgIdRef = useRef<string>("");

  /** Send a message to Scout (streaming) */
  async function handleSend() {
    const trimmed = inputValue.trim();
    if (!trimmed || isThinking) return;

    setInputValue("");
    setError(null);

    // Add user message to the UI
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);

    // Create a placeholder Scout message for streaming
    const scoutMsgId = crypto.randomUUID();
    streamMsgIdRef.current = scoutMsgId;
    const placeholderMsg: ChatMessage = {
      id: scoutMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, placeholderMsg]);

    try {
      const fromPath = searchParams.get("from");
      const pageContext = parsePageContext(fromPath);

      const response = await apiFetch("/api/scout/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          history: apiHistoryRef.current,
          pageContext,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown error");
        throw new Error(errText || `Server error: ${response.status}`);
      }

      // Read the SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete line in buffer

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7);
          } else if (line.startsWith("data: ") && currentEvent) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              if (currentEvent === "text") {
                accumulatedText += parsed.text;
                // Update the streaming message with accumulated text
                setMessages((prev) => prev.map((m) => (m.id === scoutMsgId ? { ...m, content: accumulatedText } : m)));
              } else if (currentEvent === "actions") {
                const actions = parsed.actions as DraftedAction[];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === scoutMsgId ? { ...m, draftedAction: actions[0], draftedActions: actions } : m
                  )
                );
              } else if (currentEvent === "done") {
                apiHistoryRef.current = parsed.history ?? [];
              } else if (currentEvent === "session") {
                if (parsed.sessionId) setSessionId(parsed.sessionId);
              } else if (currentEvent === "error") {
                throw new Error(parsed.error);
              }
              // "thinking" and "tool" events: isThinking state already shows the indicator
            } catch (parseErr) {
              // Skip malformed JSON lines
              if (currentEvent === "error") {
                throw new Error(data);
              }
            }
            currentEvent = "";
          }
        }
      }

      // If we got no text at all, show a fallback
      if (!accumulatedText) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === scoutMsgId ? { ...m, content: "I wasn't able to generate a response. Please try again." } : m
          )
        );
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to reach Scout";
      setError(errMsg);

      // Update the placeholder message with the error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === scoutMsgId ? { ...m, content: `I ran into an issue: ${errMsg}. Please try again.` } : m
        )
      );
    } finally {
      setIsThinking(false);
      streamMsgIdRef.current = "";
      inputRef.current?.focus();
    }
  }

  /** Handle Enter key to send */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /** Execute a confirmed drafted action */
  async function handleConfirmAction(action: DraftedAction) {
    setExecutingActionId(action.id);

    try {
      const response = await apiFetch("/api/scout/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          sessionId: sessionId ?? "no-session",
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error ?? "Failed to execute action");
      }

      // Update the action status in the message that contains it
      setMessages((prev) =>
        prev.map((msg) => {
          const updatedActions = msg.draftedActions?.map((a) =>
            a.id === action.id ? { ...a, status: "confirmed" as const } : a
          );
          return msg.draftedActions?.some((a) => a.id === action.id) ? { ...msg, draftedActions: updatedActions } : msg;
        })
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to execute action";
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Failed to execute ${action.type.replace(/_/g, " ")} for ${action.contactName}: ${errMsg}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setExecutingActionId(null);
    }
  }

  /** Confirm all pending actions in a batch */
  async function handleConfirmAll(actions: DraftedAction[]) {
    const pending = actions.filter((a) => a.status === "pending");
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const action of pending) {
      setExecutingActionId(action.id);
      try {
        const res = await apiFetch("/api/scout/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            sessionId: sessionId ?? "no-session",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error ?? "Failed");
        }
        setMessages((prev) =>
          prev.map((msg) => {
            const updatedActions = msg.draftedActions?.map((a) =>
              a.id === action.id ? { ...a, status: "confirmed" as const } : a
            );
            return msg.draftedActions?.some((a) => a.id === action.id)
              ? { ...msg, draftedActions: updatedActions }
              : msg;
          })
        );
        succeeded++;
      } catch (err) {
        failed++;
        errors.push(`${action.contactName}: ${err instanceof Error ? err.message : "Failed"}`);
      }
    }
    setExecutingActionId(null);

    const parts: string[] = [];
    if (succeeded > 0) parts.push(`${succeeded} action${succeeded !== 1 ? "s" : ""} executed`);
    if (failed > 0) parts.push(`${failed} failed`);
    const summary = parts.join(", ");
    const summaryMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: failed > 0 ? `${summary}.\n\nFailed:\n${errors.map((e) => `- ${e}`).join("\n")}` : `Done — ${summary}.`,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, summaryMsg]);
  }

  /** Cancel a drafted action */
  function handleCancelAction(actionId: string) {
    setMessages((prev) =>
      prev.map((msg) => {
        const updatedActions = msg.draftedActions?.map((a) =>
          a.id === actionId ? { ...a, status: "cancelled" as const } : a
        );
        return msg.draftedActions?.some((a) => a.id === actionId) ? { ...msg, draftedActions: updatedActions } : msg;
      })
    );
  }

  const hasMessages = messages.length > 0;
  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  const PROMPT_CHIPS = [
    "Who should I call today?",
    "Summarize my last call with a prospect",
    "Draft a follow-up for cold prospects",
    "Which prospects haven't been contacted in 7+ days?",
    "What's our pipeline close rate this month?",
    "Help me prep for my next discovery call",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] max-w-3xl mx-auto">
      {!hasMessages && !isThinking ? (
        /* ─── HERO STATE ─── */
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          {/* Logo */}
          <Image
            src="/frandev/images/nah-logo.svg"
            alt="New Again Houses"
            width={140}
            height={50}
            className="mb-8"
            priority
          />

          {/* Greeting */}
          <h1 className="font-headline text-hero text-text-primary mb-2">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
            {firstName}.
          </h1>
          <p className="text-subtitle text-text-secondary mb-10">How can I help you today?</p>

          {/* Prompt chips */}
          <div className="flex flex-wrap justify-center gap-3 mb-10 max-w-2xl">
            {PROMPT_CHIPS.map((chip) => (
              <button key={chip} onClick={() => setInputValue(chip)} className="prompt-chip">
                {chip}
              </button>
            ))}
          </div>

          {/* Input pill */}
          <div className="w-full max-w-[700px]">
            <div className="input-pill">
              <Paperclip size={18} className="text-text-tertiary flex-shrink-0 ml-2" />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Scout anything..."
                className="bg-transparent border-none outline-none flex-1 px-4 text-body-lg text-text-primary placeholder:text-text-tertiary"
                autoFocus
              />
              <VoiceRecorder onTranscription={(text) => setInputValue(text)} disabled={isThinking} />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isThinking}
                className="p-2 rounded-full bg-nah-blue text-white disabled:opacity-30 transition-opacity"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-caption text-text-tertiary mt-3">
              AI may generate inaccurate information. Verify important details.
            </p>
          </div>
        </div>
      ) : (
        /* ─── CONVERSATION STATE ─── */
        <>
          {/* Header */}
          <div className="flex items-center gap-2 py-3 flex-shrink-0">
            <Bot size={20} className="text-nah-blue" />
            <h1 className="font-headline text-section-title text-text-primary">Scout AI</h1>
            {sessionId && (
              <button
                onClick={() => {
                  setMessages([]);
                  setSessionId(null);
                  apiHistoryRef.current = [];
                  setError(null);
                }}
                className="btn-ghost text-caption ml-auto"
              >
                New Session
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 card-glass rounded-xl flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    <UserBubble content={msg.content} timestamp={msg.timestamp} />
                  ) : (
                    <>
                      <ScoutBubble content={msg.content} timestamp={msg.timestamp} />
                      {msg.draftedActions && msg.draftedActions.length > 0 && (
                        <div className="ml-2 sm:ml-11 mt-2 space-y-2">
                          {msg.draftedActions.map((action) => (
                            <DraftedActionCard
                              key={action.id}
                              action={action}
                              onConfirm={handleConfirmAction}
                              onCancel={handleCancelAction}
                              isExecuting={executingActionId === action.id}
                            />
                          ))}
                          {msg.draftedActions.filter((a) => a.status === "pending").length > 1 && (
                            <button
                              onClick={() => handleConfirmAll(msg.draftedActions!)}
                              disabled={!!executingActionId}
                              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-nah-blue text-white text-sm font-medium hover:bg-nah-blue/90 disabled:opacity-50 transition-colors"
                            >
                              {executingActionId ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <CheckCheck size={14} />
                              )}
                              Confirm All ({msg.draftedActions.filter((a) => a.status === "pending").length})
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {isThinking && <ThinkingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-2 bg-[#fee2e2] border-t border-[rgba(239,68,68,0.2)]">
                <p className="text-body-sm text-danger">{error}</p>
              </div>
            )}

            {/* Input */}
            <div className="p-3" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="input-pill">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Scout anything..."
                  className="bg-transparent border-none outline-none flex-1 px-4 text-body text-text-primary placeholder:text-text-tertiary"
                  disabled={isThinking}
                  autoFocus
                />
                <VoiceRecorder onTranscription={(text) => setInputValue(text)} disabled={isThinking} />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isThinking}
                  className="p-2 rounded-full bg-nah-blue text-white disabled:opacity-30 transition-opacity"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
