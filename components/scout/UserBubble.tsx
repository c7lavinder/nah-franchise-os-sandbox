"use client";

interface UserBubbleProps {
  content: string;
  timestamp: string;
}

/** User's chat message bubble — right-aligned with dark background */
export default function UserBubble({ content, timestamp }: UserBubbleProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%]">
        {/* Message content */}
        <div className="bg-bg-tertiary border border-border-default rounded-xl rounded-tr-sm px-4 py-3">
          <div className="text-body-lg text-text-primary whitespace-pre-wrap break-words">
            {content}
          </div>
        </div>

        {/* Timestamp */}
        <span className="text-caption text-text-tertiary mt-1 block text-right">
          {new Date(timestamp).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
