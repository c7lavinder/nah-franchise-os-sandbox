"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Loader2, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { parsePageContext } from "@/lib/scout/page-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type Anthropic from "@anthropic-ai/sdk";

const PLACEHOLDERS: Record<string, string> = {
  "/daily-hq": "What should I prioritize today? Who needs follow-up?",
  "/calls": "How can I improve my call performance? What did coaching suggest?",
  "/pipeline": "Which leads need attention? How's my pipeline health?",
  "/knowledge": "Search the knowledge base...",
  "/settings": "Ask Scout anything...",
};

const DEFAULT_PLACEHOLDER = "Ask Scout anything...";

interface QuickAskProps {
  context?: string;
}

export default function QuickAsk({ context }: QuickAskProps) {
  const [query, setQuery] = useState("");
  const [thinking, setThinking] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<Anthropic.Messages.MessageParam[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const placeholder = (context && PLACEHOLDERS[context]) ?? DEFAULT_PLACEHOLDER;

  // Always start fresh — no session resume
  useEffect(() => {
    historyRef.current = [];
    sessionIdRef.current = null;
  }, []);

  // Auto-scroll response into view when it appears
  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [response]);

  function handleNewConversation() {
    historyRef.current = [];
    sessionIdRef.current = null;
    setResponse(null);
    setError(null);
    setQuery("");
    inputRef.current?.focus();
  }

  async function handleSend() {
    const trimmed = query.trim();
    if (!trimmed || thinking) return;

    setQuery("");
    setThinking(true);
    setError(null);

    try {
      const pageContext = context ? parsePageContext(context) : undefined;

      const res = await apiFetch("/api/scout/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
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
      setResponse(data.message);
      sessionIdRef.current = data.sessionId;
      historyRef.current = data.history ?? [];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection error");
    } finally {
      setThinking(false);
    }
  }

  function handleDismiss() {
    setResponse(null);
    setError(null);
    inputRef.current?.focus();
  }

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

      {/* Inline response */}
      {(response || error) && (
        <div
          ref={responseRef}
          className={`relative rounded-lg border px-4 py-3 max-h-[200px] overflow-y-auto ${
            error ? "bg-red-50 border-red-200" : "bg-scout-purple/5 border-scout-purple/20"
          }`}
        >
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <button
              onClick={handleNewConversation}
              title="New conversation"
              className="p-1 text-text-tertiary hover:text-scout-purple transition-colors"
            >
              <RotateCcw size={12} />
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {error ? (
            <p className="text-sm text-red-600 pr-6">{error}</p>
          ) : (
            <div className="pr-6 prose prose-sm max-w-none text-text-primary prose-headings:text-text-primary prose-strong:text-text-primary prose-code:text-scout-purple prose-a:text-nah-blue">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{response!}</ReactMarkdown>
            </div>
          )}

          {/* Follow-up input */}
          {!error && (
            <div className="mt-3 pt-2 border-t border-scout-purple/10">
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
