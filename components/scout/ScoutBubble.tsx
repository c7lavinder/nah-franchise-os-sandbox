"use client";

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

        {/* Message content */}
        <div className="bg-scout-bubble-bg border border-scout-bubble-border rounded-xl rounded-tl-sm px-4 py-3">
          <div className="text-body-lg text-text-primary whitespace-pre-wrap break-words">
            {content}
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
