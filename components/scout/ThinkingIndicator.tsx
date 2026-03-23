"use client";

import { MessageSquare } from "lucide-react";

/** Animated "Scout is thinking" indicator shown while waiting for a response */
export default function ThinkingIndicator() {
  return (
    <div className="flex gap-3 max-w-[85%]">
      {/* Scout avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-scout-bubble-bg border border-scout-bubble-border flex items-center justify-center mt-1">
        <MessageSquare size={14} className="text-scout-purple" />
      </div>

      <div>
        <span className="text-caption text-scout-purple font-semibold block mb-1">
          Scout
        </span>
        <div className="bg-scout-bubble-bg border border-scout-bubble-border rounded-xl rounded-tl-sm px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="text-body-sm text-text-secondary mr-1">
              Thinking
            </span>
            {/* Animated dots */}
            <span
              className="w-2 h-2 rounded-full bg-scout-purple animate-pulse-dot"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-2 h-2 rounded-full bg-scout-purple animate-pulse-dot"
              style={{ animationDelay: "200ms" }}
            />
            <span
              className="w-2 h-2 rounded-full bg-scout-purple animate-pulse-dot"
              style={{ animationDelay: "400ms" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
