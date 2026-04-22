"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Bot, X, Send, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type Anthropic from "@anthropic-ai/sdk";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
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
  const historyRef = useRef<Anthropic.Messages.MessageParam[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isScoutPage = pathname === "/scout";

  // Derive page context from URL for context-aware KB loading
  const pageContext = useCallback(() => {
    const ctx: Record<string, string | undefined> = {};
    if (pathname.startsWith("/pipeline")) ctx.page = "pipeline";
    else if (pathname.match(/\/calls\/[^/]+$/)) ctx.page = "call_detail";
    else if (pathname.startsWith("/calls")) ctx.page = "calls";
    else if (pathname.match(/\/contacts\/[^/]+$/)) { ctx.page = "contact_detail"; ctx.contactId = pathname.split("/").pop(); }
    else if (pathname.match(/\/journeys\/[^/]+$/)) { ctx.page = "journey_detail"; ctx.journeyId = pathname.split("/").pop(); }
    else if (pathname.match(/\/territories\/[^/]+$/)) { ctx.page = "territory"; ctx.territorySlug = pathname.split("/").pop(); }
    else if (pathname.startsWith("/territories")) ctx.page = "territory";
    else if (pathname.startsWith("/knowledge")) ctx.page = "knowledge";
    else if (pathname.startsWith("/settings")) ctx.page = "settings";
    else ctx.page = "dashboard";
    return ctx;
  }, [pathname]);

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
      const res = await fetch("/api/scout/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          history: historyRef.current,
          userId: user?.id ?? "",
          userRole: user?.role ?? "rep",
          userName: user?.fullName ?? "User",
          pageContext: pageContext(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed");
      }

      const data = await res.json();
      historyRef.current = data.history ?? [];
      if (data.sessionId) setSessionId(data.sessionId);

      const scoutMsg: ChatMsg = { id: crypto.randomUUID(), role: "assistant", content: data.message };
      setMessages((prev) => [...prev, scoutMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to reach Scout";
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: `Error: ${errMsg}` }]);
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
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
          className="fixed top-0 right-0 bottom-0 z-[499] w-[320px] flex flex-col"
          style={{
            background: "rgba(255, 255, 255, 0.6)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderLeft: "1px solid rgba(255, 255, 255, 0.6)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-nah-blue" />
              <span className="font-headline font-semibold text-text-primary text-base">Scout AI</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); historyRef.current = []; setSessionId(null); }}
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
                <p className="text-sm text-text-secondary mb-4">
                  Ask about leads, pipeline, or what to do next.
                </p>
                <div className="flex flex-col gap-2 w-full">
                  {["Who needs attention today?", "What's my pipeline status?", "Draft a follow-up text"].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => { setInput(chip); setTimeout(() => inputRef.current?.focus(), 0); }}
                      className="text-left text-xs px-3 py-2 rounded-xl text-text-secondary hover:text-nah-blue hover:bg-[rgba(0,161,225,0.06)] transition-colors"
                      style={{ border: "1px solid rgba(255,255,255,0.6)" }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === "user"
                    ? "bg-nah-blue text-white"
                    : "text-text-primary"
                }`}
                  style={msg.role === "assistant" ? { background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.6)" } : undefined}
                >
                  <div className="prose prose-sm max-w-none break-words [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.6)" }}>
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
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.6)" }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
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
