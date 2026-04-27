"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Send, ArrowRight } from "lucide-react";

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
  const router = useRouter();

  const placeholder = (context && PLACEHOLDERS[context]) ?? DEFAULT_PLACEHOLDER;

  function handleSubmit() {
    if (!query.trim()) return;
    const ask = encodeURIComponent(query.trim());
    const from = context ? `&from=${encodeURIComponent(context)}` : "";
    router.push(`/scout?ask=${ask}${from}`);
    setQuery("");
  }

  return (
    <div className="flex items-center gap-2 bg-scout-purple/5 border border-scout-purple/20 rounded-lg px-3 py-2">
      <MessageSquare size={14} className="text-scout-purple flex-shrink-0" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-body-sm text-text-primary placeholder:text-scout-purple/40 outline-none"
      />
      {query.trim() ? (
        <button
          onClick={handleSubmit}
          className="p-1 text-scout-purple hover:text-scout-purple/80 transition-colors"
        >
          <Send size={14} />
        </button>
      ) : (
        <ArrowRight size={14} className="text-scout-purple/30" />
      )}
    </div>
  );
}
