"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bot, X, Send, Loader2, CheckCheck } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DraftedActionCard } from "@/components/scout";
import { parsePageContext } from "@/lib/scout/page-context";
import type { DraftedAction } from "@/types/scout";
import type Anthropic from "@anthropic-ai/sdk";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  draftedAction?: DraftedAction;
  draftedActions?: DraftedAction[];
}

/** Scout AI floating action button + inline chat drawer */
export default function ScoutFAB() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const historyRef = useRef<Anthropic.Messages.MessageParam[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isScoutPage = pathname === "/scout";

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || thinking) return;

    setInput("");
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setThinking(true);

    try {
      const res = await apiFetch("/api/scout/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          history: historyRef.current,
          userId: user?.id ?? "",
          userRole: user?.role ?? "rep",
          userName: user?.fullName ?? "User",
          pageContext: parsePageContext(pathname),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed");
      }

      const data = await res.json();
      historyRef.current = data.history ?? [];
      if (data.sessionId) setSessionId(data.sessionId);

      const actions: DraftedAction[] = data.draftedActions ?? (data.draftedAction ? [data.draftedAction] : []);
      const scoutMsg: ChatMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        draftedAction: actions[0],
        draftedActions: actions.length > 0 ? actions : undefined,
      };
      setMessages((prev) => [...prev, scoutMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to reach Scout";
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: `Error: ${errMsg}` }]);
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  }

  /** Execute a confirmed drafted action — same flow as the dedicated /scout page. */
  async function handleConfirmAction(action: DraftedAction) {
    setExecutingActionId(action.id);
    try {
      const res = await apiFetch("/api/scout/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          userId: user?.id ?? "",
          sessionId: sessionId ?? "no-session",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to execute action");
      }
      setMessages((prev) =>
        prev.map((m) => {
          const updatedActions = m.draftedActions?.map((a) =>
            a.id === action.id ? { ...a, status: "confirmed" as const } : a
          );
          return m.draftedActions?.some((a) => a.id === action.id) ? { ...m, draftedActions: updatedActions } : m;
        })
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Failed to execute ${action.type.replace(/_/g, " ")} for ${action.contactName}: ${errMsg}`,
        },
      ]);
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
            userId: user?.id ?? "",
            sessionId: sessionId ?? "no-session",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error ?? "Failed");
        }
        // Mark this action as confirmed
        setMessages((prev) =>
          prev.map((m) => {
            const updatedActions = m.draftedActions?.map((a) =>
              a.id === action.id ? { ...a, status: "confirmed" as const } : a
            );
            return m.draftedActions?.some((a) => a.id === action.id) ? { ...m, draftedActions: updatedActions } : m;
          })
        );
        succeeded++;
      } catch (err) {
        failed++;
        errors.push(`${action.contactName}: ${err instanceof Error ? err.message : "Failed"}`);
        // Mark as failed by keeping it pending — user can retry
      }
    }
    setExecutingActionId(null);

    // Summary message
    const parts: string[] = [];
    if (succeeded > 0) parts.push(`${succeeded} action${succeeded !== 1 ? "s" : ""} executed`);
    if (failed > 0) parts.push(`${failed} failed`);
    const summary = parts.join(", ");
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          failed > 0 ? `${summary}.\n\nFailed:\n${errors.map((e) => `- ${e}`).join("\n")}` : `Done — ${summary}.`,
      },
    ]);
  }

  /** Cancel a drafted action — flips its status; the card stops showing buttons. */
  function handleCancelAction(actionId: string) {
    setMessages((prev) =>
      prev.map((m) => {
        const updatedActions = m.draftedActions?.map((a) =>
          a.id === actionId ? { ...a, status: "cancelled" as const } : a
        );
        return m.draftedActions?.some((a) => a.id === actionId) ? { ...m, draftedActions: updatedActions } : m;
      })
    );
  }

  // Don't render on the dedicated Scout page
  if (isScoutPage) return null;

  return (
    <>
      {/* FAB button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[500] w-14 h-14 rounded-full bg-nah-blue text-white flex items-center justify-center cursor-pointer hover:scale-[1.08] transition-transform"
          style={{ boxShadow: "0 4px 20px rgba(0, 161, 225, 0.4)" }}
          aria-label="Open Scout AI"
        >
          <Bot size={24} />
        </button>
      )}

      {/* Scout chat drawer */}
      {open && (
        <div
          className="fixed bottom-0 right-0 z-[499] w-[320px] max-h-[50vh] flex flex-col rounded-tl-xl"
          style={{
            background: "rgba(255, 255, 255, 0.6)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderLeft: "1px solid rgba(255, 255, 255, 0.6)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-4 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-nah-blue" />
              <span className="font-headline font-semibold text-text-primary text-base">Scout AI</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => {
                    setMessages([]);
                    historyRef.current = [];
                    setSessionId(null);
                  }}
                  className="text-[11px] text-text-tertiary hover:text-text-primary px-2 py-1 rounded-lg hover:bg-[rgba(0,161,225,0.08)] transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-xl hover:bg-[rgba(0,161,225,0.08)] transition-colors"
              >
                <X size={18} className="text-text-secondary" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && !thinking && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot size={32} className="text-nah-blue mb-3 opacity-30" />
                <p className="text-sm text-text-secondary mb-4">Ask about leads, pipeline, or what to do next.</p>
                <div className="flex flex-col gap-2 w-full">
                  {["Who needs attention today?", "What's my pipeline status?", "Draft a follow-up text"].map(
                    (chip) => (
                      <button
                        key={chip}
                        onClick={() => {
                          setInput(chip);
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        className="text-left text-xs px-3 py-2 rounded-xl text-text-secondary hover:text-nah-blue hover:bg-[rgba(0,161,225,0.06)] transition-colors"
                        style={{ border: "1px solid rgba(255,255,255,0.6)" }}
                      >
                        {chip}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                      msg.role === "user" ? "bg-nah-blue text-white" : "text-text-primary"
                    }`}
                    style={
                      msg.role === "assistant"
                        ? { background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.6)" }
                        : undefined
                    }
                  >
                    <div className="prose prose-sm max-w-none break-words [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
                {msg.draftedActions && msg.draftedActions.length > 0 && (
                  <div className="mt-2 space-y-2">
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
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-nah-blue text-white text-sm font-medium hover:bg-nah-blue/90 disabled:opacity-50 transition-colors"
                      >
                        {executingActionId ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                        Confirm All ({msg.draftedActions.filter((a) => a.status === "pending").length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {thinking && (
              <div className="flex justify-start">
                <div
                  className="px-3 py-2 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.6)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin text-nah-blue" />
                    <span className="text-sm text-text-tertiary">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.6)" }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask Scout..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
                disabled={thinking}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || thinking}
                className="p-1.5 rounded-full bg-nah-blue text-white disabled:opacity-30 transition-opacity"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
