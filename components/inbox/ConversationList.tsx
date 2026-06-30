"use client";

import { ChevronDown } from "lucide-react";
import type { GHLConversation } from "@/types/ghl";
import { avatarColor, initials } from "./avatar";

interface ConversationListProps {
  conversations: GHLConversation[];
  selectedId: string | null;
  onSelect: (conversation: GHLConversation) => void;
  onLoadMore?: () => void;
  hasMore: boolean;
}

function formatTime(timestamp: string | number): string {
  const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onLoadMore,
  hasMore,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-2 py-1.5">
        {conversations.length === 0 && <p className="text-center text-[13px] text-[#9aa3b0] py-8">No conversations</p>}
        {conversations.map((conv) => {
          const isSelected = conv.id === selectedId;
          const name = conv.contactName || conv.fullName || "Unknown";
          const unread = conv.unreadCount ?? 0;
          const hasUnread = unread > 0;
          const color = avatarColor(conv.contactId || conv.id);

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={`w-full text-left flex items-center gap-[11px] px-[11px] py-2.5 rounded-[13px] mb-0.5 transition-colors ${
                isSelected ? "bg-[#eaf4fd]" : "hover:bg-[#f3f7fb]"
              }`}
            >
              {/* Avatar */}
              <span
                className="flex-shrink-0 w-[42px] h-[42px] rounded-full flex items-center justify-center text-white text-sm font-semibold"
                style={{ backgroundColor: color }}
              >
                {initials(name)}
              </span>

              {/* Body */}
              <span className="flex-1 min-w-0 block">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14.5px] font-semibold text-[#1c2430]">{name}</span>
                  <span className="flex-shrink-0 text-xs text-[#9aa3b0]">{formatTime(conv.lastMessageDate)}</span>
                </span>
                <span className="flex items-center gap-2 mt-0.5">
                  <span className="truncate text-[13px] text-[#8a94a3]">{conv.phone || conv.email || ""}</span>
                  {hasUnread && (
                    <span className="ml-auto flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-[9px] bg-[#0E96D8] text-white text-[11px] font-bold flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="py-2 text-xs text-[#9aa3b0] hover:text-[#1c2430] flex items-center justify-center gap-1 border-t border-[#eef1f5]"
        >
          <ChevronDown size={12} /> Load more
        </button>
      )}
    </div>
  );
}
