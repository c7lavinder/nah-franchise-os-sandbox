"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Send } from "lucide-react";
import { ScoutBubble, UserBubble, ThinkingIndicator, DraftedActionCard, VoiceRecorder } from "@/components/scout";
import { useAuth } from "@/lib/auth/AuthContext";
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

  /** Load the most recent active session on page load */
  useEffect(() => {
    if (!user?.id) return;

    async function loadLastSession() {
      try {
        const response = await fetch(`/api/scout/session?userId=${user?.id}`);
        if (!response.ok) return;

        const data = await response.json();
        if (data.sessionId && data.history && data.messages) {
          setSessionId(data.sessionId);
          apiHistoryRef.current = data.history;
          setMessages(data.messages);
        }
      } catch {
        // Session loading is non-critical — start fresh if it fails
      }
    }

    void loadLastSession();
  }, [user?.id]);

  /** Send a message to Scout */
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

    try {
      const response = await fetch("/api/scout/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          history: apiHistoryRef.current,
          userId: user?.id ?? "",
          userRole: user?.role ?? "rep",
          userName: user?.fullName ?? "User",
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error ?? `Server error: ${response.status}`);
      }

      const data = await response.json();

      // Update the API history for the next turn
      apiHistoryRef.current = data.history ?? [];
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      // Add Scout's response to the UI
      const scoutMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
        draftedAction: data.draftedAction ?? undefined,
      };
      setMessages((prev) => [...prev, scoutMessage]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to reach Scout";
      setError(errMsg);

      // Add error as a Scout message so it's visible in the chat
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `I ran into an issue: ${errMsg}. Please try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsThinking(false);
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
      const response = await fetch("/api/scout/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          userId: user?.id ?? "",
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
          if (msg.draftedAction?.id === action.id) {
            return {
              ...msg,
              draftedAction: { ...msg.draftedAction, status: "confirmed" as const },
            };
          }
          return msg;
        })
      );

      // Add a confirmation message
      const confirmMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Done! The ${action.type === "message" ? "message has been sent" : action.type === "task" ? "task has been created" : "stage has been moved"} successfully.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to execute action";
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Failed to execute the action: ${errMsg}. You can try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setExecutingActionId(null);
    }
  }

  /** Cancel a drafted action */
  function handleCancelAction(actionId: string) {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.draftedAction?.id === actionId) {
          return {
            ...msg,
            draftedAction: { ...msg.draftedAction, status: "cancelled" as const },
          };
        }
        return msg;
      })
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-56px-48px)]">
      {/* Page header */}
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={20} className="text-scout-purple" />
        <h1 className="text-h1 text-text-primary">Scout AI</h1>
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

      {/* Chat area */}
      <div className="flex-1 bg-bg-secondary border border-border-default rounded-lg flex flex-col overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!hasMessages && !isThinking ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-scout-bubble-bg border border-scout-bubble-border flex items-center justify-center mb-4">
                <MessageSquare size={28} className="text-scout-purple" />
              </div>
              <h2 className="text-h2 text-text-primary mb-2">
                Welcome to Scout
              </h2>
              <p className="text-body text-text-secondary max-w-md">
                Your AI franchise sales assistant. Ask me about your leads,
                pipeline, tasks — or tell me to draft a message, create a task,
                or move a lead to a new stage.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
                {[
                  "What should I focus on today?",
                  "Show me my pipeline",
                  "Draft a follow-up text for my newest lead",
                  "Which leads need attention?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInputValue(suggestion);
                      // Small delay so user sees the text before sending
                      setTimeout(() => {
                        setInputValue(suggestion);
                        const fakeEvent = {
                          preventDefault: () => {},
                        } as React.FormEvent;
                        void fakeEvent;
                      }, 0);
                    }}
                    className="text-left text-body-sm text-text-secondary bg-bg-tertiary border border-border-default
                      rounded-lg px-3 py-2 hover:bg-bg-hover hover:text-text-primary transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message list */
            <>
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    <UserBubble
                      content={msg.content}
                      timestamp={msg.timestamp}
                    />
                  ) : (
                    <>
                      <ScoutBubble
                        content={msg.content}
                        timestamp={msg.timestamp}
                      />
                      {/* Drafted action card — rendered below Scout's message */}
                      {msg.draftedAction && (
                        <div className="ml-11 mt-2">
                          <DraftedActionCard
                            action={msg.draftedAction}
                            onConfirm={handleConfirmAction}
                            onCancel={handleCancelAction}
                            isExecuting={executingActionId === msg.draftedAction.id}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {isThinking && <ThinkingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 bg-danger/10 border-t border-danger/20">
            <p className="text-body-sm text-danger">{error}</p>
          </div>
        )}

        {/* Input area — fixed to bottom */}
        <div className="border-t border-border-default p-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Scout anything..."
              className="input flex-1"
              disabled={isThinking}
              autoFocus
            />
            <VoiceRecorder
              onTranscription={(text) => {
                setInputValue(text);
              }}
              disabled={isThinking}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isThinking}
              className="btn-scout p-2.5"
              title="Send message"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
