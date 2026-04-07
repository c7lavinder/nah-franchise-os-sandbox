"use client";

// Sprint 0 fix: Scout chat was rendering markdown as literal text
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquare } from "lucide-react";

interface ScoutBubbleProps {
  content: string;
  timestamp: string;
}

/** Scout's chat message bubble — left-aligned with purple tint and avatar */
export default function ScoutBubble({ content, timestamp }: ScoutBubbleProps) {
  return (
    <div className="flex gap-3 max-w-[85%]">
      {/* Scout avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-scout-bubble-bg border border-scout-bubble-border flex items-center justify-center mt-1">
        <MessageSquare size={14} className="text-scout-purple" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Scout name */}
        <span className="text-caption text-scout-purple font-semibold block mb-1">
          Scout
        </span>

        {/* Message content — rendered as markdown for assistant messages */}
        <div className="bg-scout-bubble-bg border border-scout-bubble-border rounded-xl rounded-tl-sm px-4 py-3">
          <div className="prose prose-sm max-w-none text-text-primary prose-headings:text-text-primary prose-strong:text-text-primary prose-code:text-scout-purple prose-a:text-nah-blue">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Timestamp */}
        <span className="text-caption text-text-tertiary mt-1 block">
          {new Date(timestamp).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
