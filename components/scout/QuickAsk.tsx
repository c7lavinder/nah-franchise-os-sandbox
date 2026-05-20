"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, Send, X, Loader2, RotateCcw, ExternalLink, Flag } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/auth/api-fetch";
import { parsePageContext } from "@/lib/scout/page-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { scoutLinkComponents } from "@/components/scout/ScoutBubble";
import type Anthropic from "@anthropic-ai/sdk";

const PLACEHOLDERS: Record<string, string> = {
  "/daily-hq": "What should I prioritize today? Who needs follow-up?",
  "/calls": "How can I improve my call performance? What did coaching suggest?",
  "/pipeline": "Which leads need attention? How's my pipeline health?",
  "/knowledge": "Search the knowledge base...",
  "/settings": "Ask Scout anything...",
};

const DEFAULT_PLACEHOLDER = "Ask Scout anything...";

interface Exchange {
  userMessage: string;
  aiResponse: string;
}

interface QuickAskProps {
  context?: string;
}

export default function QuickAsk({ context }: QuickAskProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [thinking, setThinking] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flaggedIndices, setFlaggedIndices] = useState<Set<number>>(new Set());
  const historyRef = useRef<Anthropic.Messages.MessageParam[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const placeholder = (context && PLACEHOLDERS[context]) ?? DEFAULT_PLACEHOLDER;

  // Always start fresh
  useEffect(() => {
    historyRef.current = [];
    sessionIdRef.current = null;
  }, []);

  // Auto-scroll to bottom when new exchanges arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [exchanges, thinking]);

  const handleClearSession = useCallback(() => {
    historyRef.current = [];
    sessionIdRef.current = null;
    setExchanges([]);
    setError(null);
    setQuery("");
    setFlaggedIndices(new Set());
    inputRef.current?.focus();
  }, []);

  const handleDismiss = useCallback(() => {
    setExchanges([]);
    setError(null);
    inputRef.current?.focus();
  }, []);

  const handleOpenInScout = useCallback(() => {
    router.push("/scout");
  }, [router]);

  const handleFlag = useCallback(
    async (index: number) => {
      const exchange = exchanges[index];
      if (!exchange) return;

      const alreadyFlagged = flaggedIndices.has(index);

      if (alreadyFlagged) {
        // Unflag
        setFlaggedIndices((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
        await apiFetch("/api/flagged-responses", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            userMessage: exchange.userMessage,
            aiResponse: exchange.aiResponse,
          }),
        }).catch(() => {});
      } else {
        // Flag
        setFlaggedIndices((prev) => new Set(prev).add(index));
        await apiFetch("/api/flagged-responses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            userMessage: exchange.userMessage,
            aiResponse: exchange.aiResponse,
            pageUrl: pathname,
          }),
        }).catch(() => {});
      }
    },
    [exchanges, pathname, flaggedIndices]
  );

  async function handleSend() {
    const trimmed = query.trim();
    if (!trimmed || thinking) return;

    const userMessage = trimmed;
    setQuery("");
    setThinking(true);
    setError(null);

    try {
      const pageContext = context ? parsePageContext(context) : undefined;

      const res = await apiFetch("/api/scout/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          sessionId: sessionIdRef.current,
          history: historyRef.current,
          pageContext,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Request failed" }));
        setError(errData.error ?? "Something went wrong");
        setThinking(false);
        return;
      }

      const data = await res.json();
      sessionIdRef.current = data.sessionId;
      historyRef.current = data.history ?? [];
      setExchanges((prev) => [...prev, { userMessage, aiResponse: data.message }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection error");
    } finally {
      setThinking(false);
    }
  }

  const hasContent = exchanges.length > 0 || error;

  return (
    <div className="space-y-2">
      {/* Input bar */}
      <div className="flex items-center gap-2 bg-scout-purple/5 border border-scout-purple/20 rounded-lg px-3 py-2">
        <MessageSquare size={14} className="text-scout-purple flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder={thinking ? "Scout is thinking..." : placeholder}
          disabled={thinking}
          className="flex-1 bg-transparent text-body-sm text-text-primary placeholder:text-scout-purple/40 outline-none disabled:opacity-50"
        />
        {thinking ? (
          <Loader2 size={14} className="text-scout-purple animate-spin" />
        ) : query.trim() ? (
          <button onClick={handleSend} className="p-1 text-scout-purple hover:text-scout-purple/80 transition-colors">
            <Send size={14} />
          </button>
        ) : null}
      </div>

      {/* Conversation panel */}
      {hasContent && (
        <div
          className={`relative rounded-lg border ${error && exchanges.length === 0 ? "bg-red-50 border-red-200" : "bg-scout-purple/5 border-scout-purple/20"}`}
        >
          {/* Top action bar */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-scout-purple/10">
            <button
              onClick={handleOpenInScout}
              title="Open in Scout"
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-text-tertiary hover:text-scout-purple transition-colors rounded hover:bg-scout-purple/10"
            >
              <ExternalLink size={11} />
              Open in Scout
            </button>
            <button
              onClick={handleClearSession}
              title="Clear session"
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-text-tertiary hover:text-scout-purple transition-colors rounded hover:bg-scout-purple/10"
            >
              <RotateCcw size={11} />
              Clear
            </button>
            <div className="flex-1" />
            <button
              onClick={handleDismiss}
              className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
              title="Minimize"
            >
              <X size={14} />
            </button>
          </div>

          {/* Scrollable thread */}
          <div ref={scrollRef} className="max-h-[400px] overflow-y-auto px-4 py-3 space-y-3">
            {exchanges.map((ex, i) => (
              <div key={i} className="space-y-2">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-scout-purple/10 rounded-lg px-3 py-2 max-w-[85%]">
                    <p className="text-body-sm text-text-primary">{ex.userMessage}</p>
                  </div>
                </div>

                {/* AI response */}
                <div className="group relative">
                  <div className="prose prose-sm max-w-none text-text-primary prose-headings:text-text-primary prose-strong:text-text-primary prose-code:text-scout-purple prose-a:text-nah-blue">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={scoutLinkComponents}>
                      {ex.aiResponse}
                    </ReactMarkdown>
                  </div>
                  {/* Flag / Unflag toggle button */}
                  <button
                    onClick={() => handleFlag(i)}
                    title={flaggedIndices.has(i) ? "Unflag this response" : "Flag this response"}
                    className={`absolute top-0 right-0 p-1 rounded transition-colors ${
                      flaggedIndices.has(i)
                        ? "text-red-400 hover:text-red-300 hover:bg-red-50"
                        : "text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50"
                    }`}
                  >
                    <Flag size={12} fill={flaggedIndices.has(i) ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            ))}

            {/* Error */}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {/* Thinking indicator */}
            {thinking && (
              <div className="flex items-center gap-2 text-scout-purple/60">
                <Loader2 size={12} className="animate-spin" />
                <span className="text-xs">Scout is thinking...</span>
              </div>
            )}
          </div>

          {/* Follow-up input */}
          {exchanges.length > 0 && !error && (
            <div className="px-4 pb-3 pt-1 border-t border-scout-purple/10">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                  placeholder="Follow up..."
                  disabled={thinking}
                  className="flex-1 bg-transparent text-body-sm text-text-primary placeholder:text-text-tertiary outline-none disabled:opacity-50"
                />
                {thinking ? (
                  <Loader2 size={12} className="text-scout-purple animate-spin" />
                ) : query.trim() ? (
                  <button
                    onClick={handleSend}
                    className="p-1 text-scout-purple hover:text-scout-purple/80 transition-colors"
                  >
                    <Send size={12} />
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
