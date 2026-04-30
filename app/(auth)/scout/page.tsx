"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Send, Paperclip, Mic } from "lucide-react";
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

  /** Always start a fresh session — clear state on mount / navigation */
  useEffect(() => {
    setMessages([]);
    setSessionId(null);
    apiHistoryRef.current = [];
    setError(null);
    setInputValue(searchParams.get("ask") ?? "");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      const fromPath = searchParams.get("from");
      const pageContext = parsePageContext(fromPath);

      const response = await apiFetch("/api/scout/chat", {
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
