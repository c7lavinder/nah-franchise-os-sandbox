"use client";

import { MessageSquare, Mail, Phone, ChevronDown } from "lucide-react";
import type { GHLConversation } from "@/types/ghl";

interface ConversationListProps {
  conversations: GHLConversation[];
  selectedId: string | null;
  onSelect: (conversation: GHLConversation) => void;
  onLoadMore?: () => void;
  hasMore: boolean;
}

function channelIcon(type: string) {
  if (type.includes("PHONE") || type.includes("SMS")) return <MessageSquare size={14} className="text-success" />;
  if (type.includes("EMAIL")) return <Mail size={14} className="text-scout-purple" />;
  if (type.includes("CALL")) return <Phone size={14} className="text-info" />;
  return <MessageSquare size={14} className="text-text-tertiary" />;
}

function formatTime(timestamp: string | number): string {
  const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
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
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="text-caption text-text-tertiary text-center py-8">No conversations</p>
        )}
        {conversations.map((conv) => {
          const isSelected = conv.id === selectedId;
          const name = conv.contactName || conv.fullName || "Unknown";
          const hasUnread = (conv.unreadCount ?? 0) > 0;

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={`
                w-full text-left px-3 py-2.5 border-b border-border-default transition-colors
                ${isSelected ? "bg-bg-tertiary" : "hover:bg-bg-hover"}
              `}
            >
              <div className="flex items-start gap-2">
                {/* Channel icon */}
                <div className="mt-0.5 flex-shrink-0">{channelIcon(conv.type)}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-body-sm truncate ${hasUnread ? "font-semibold text-text-primary" : "text-text-primary"}`}>
                      {name}
                    </span>
                    <span className="text-caption text-text-tertiary flex-shrink-0">
                      {formatTime(conv.lastMessageDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {conv.phone && (
                      <span className="text-caption text-text-tertiary truncate">{conv.phone}</span>
                    )}
                    {hasUnread && (
                      <span className="ml-auto w-5 h-5 rounded-full bg-nah-orange text-white text-caption font-bold flex items-center justify-center flex-shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="py-2 text-caption text-text-tertiary hover:text-text-primary flex items-center justify-center gap-1 border-t border-border-default"
        >
          <ChevronDown size={12} /> Load more
        </button>
      )}
    </div>
  );
}
