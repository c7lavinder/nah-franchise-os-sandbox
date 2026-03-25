"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Send, ArrowRight } from "lucide-react";

/** Compact Scout input — type a question, press Enter to navigate to Scout with the question prefilled */
export default function QuickAsk() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit() {
    if (!query.trim()) return;
    router.push(`/scout?ask=${encodeURIComponent(query.trim())}`);
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
        placeholder="Ask Scout anything..."
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
