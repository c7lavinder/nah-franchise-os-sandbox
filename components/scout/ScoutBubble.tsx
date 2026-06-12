"use client";

// Sprint 0 fix: Scout chat was rendering markdown as literal text
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquare, ExternalLink } from "lucide-react";
import ScoutConcernFlagger from "@/components/scout/ScoutConcernFlagger";

/** Shared link renderer — opens in new tab with a styled pill for internal links */
export const scoutLinkComponents: Components = {
  a: ({ href, children }) => {
    const isInternal = href?.startsWith("/");
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={
          isInternal
            ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-nah-blue/10 text-nah-blue font-medium no-underline hover:bg-nah-blue/20 transition-colors"
            : "text-nah-blue underline underline-offset-2 hover:text-nah-blue/80 transition-colors"
        }
      >
        {children}
        {isInternal && <ExternalLink size={11} className="flex-shrink-0" />}
      </a>
    );
  },
};

interface ScoutBubbleProps {
  content: string;
  timestamp: string;
  onFlagConcern?: (feedback: { selectedText: string; concernType: string; correctionNote: string }) => Promise<void>;
}

/** Scout's chat message bubble — left-aligned with purple tint and avatar */
export default function ScoutBubble({ content, timestamp, onFlagConcern }: ScoutBubbleProps) {
  return (
    <div className="flex gap-3 max-w-[85%]">
      {/* Scout avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-scout-bubble-bg border border-scout-bubble-border flex items-center justify-center mt-1">
        <MessageSquare size={14} className="text-scout-purple" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Scout name */}
        <span className="text-caption text-scout-purple font-semibold block mb-1">Scout</span>

        {/* Message content — rendered as markdown for assistant messages */}
        <div className="bg-scout-bubble-bg border border-scout-bubble-border rounded-xl rounded-tl-sm px-4 py-3">
          <div className="prose prose-sm max-w-none text-text-primary prose-headings:text-text-primary prose-strong:text-text-primary prose-code:text-scout-purple prose-a:text-nah-blue">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={scoutLinkComponents}>
              {content}
            </ReactMarkdown>
          </div>
        </div>

        {onFlagConcern && <ScoutConcernFlagger onFlagConcern={onFlagConcern} className="mt-1" />}

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
