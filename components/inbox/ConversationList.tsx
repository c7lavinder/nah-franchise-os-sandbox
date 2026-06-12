"use client";

import { MessageSquare, Mail, Phone, ChevronDown, CheckCheck } from "lucide-react";
import type { GHLConversation } from "@/types/ghl";

interface ConversationListProps {
  conversations: GHLConversation[];
  selectedId: string | null;
  onSelect: (conversation: GHLConversation) => void;
  onLoadMore?: () => void;
  hasMore: boolean;
}

function channelIcon(type: string) {
  if (type.includes("PHONE") || type.includes("SMS")) return <MessageSquare size={14} className="text-[#2e7d32]" />;
  if (type.includes("EMAIL")) return <Mail size={14} className="text-[#6a1b9a]" />;
  if (type.includes("CALL")) return <Phone size={14} className="text-[#1565c0]" />;
  return <MessageSquare size={14} className="text-[#64748b]" />;
}

function formatPhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  if (last10.length !== 10) return value ?? "";
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
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
          <div className="px-5 py-10 text-center">
            <MessageSquare size={18} className="mx-auto mb-2 text-text-tertiary" />
            <p className="text-caption text-text-tertiary">No conversations</p>
          </div>
        )}
        {conversations.map((conv) => {
          const isSelected = conv.id === selectedId;
          const name = conv.contactName || conv.fullName || "Unknown";
          const hasUnread = (conv.unreadCount ?? 0) > 0;
          const preview = conv.lastMessageBody || (conv.type?.includes("CALL") ? "Call activity" : "No preview");
          const isOutbound = conv.lastMessageDirection === "outbound";

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={`
                w-full text-left px-4 py-3 border-b border-border-default transition-colors
                ${isSelected ? "bg-nah-orange/10 shadow-[inset_3px_0_0_#F97316]" : "hover:bg-bg-hover"}
              `}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                    hasUnread ? "bg-success/10" : "bg-bg-tertiary"
                  }`}
                >
                  {channelIcon(conv.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-body-sm truncate ${hasUnread ? "font-semibold text-text-primary" : "text-text-primary"}`}
                    >
                      {name}
                    </span>
                    <span className="text-caption text-text-tertiary flex-shrink-0">
                      {formatTime(conv.lastMessageDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {conv.phone && (
                      <span className="text-caption text-text-tertiary truncate">{formatPhone(conv.phone)}</span>
                    )}
                    {conv.assignedTo && (
                      <span className="text-[10px] text-text-tertiary truncate">via {conv.assignedTo}</span>
                    )}
                    {hasUnread && (
                      <span className="ml-auto w-5 h-5 rounded-full bg-nah-orange text-white text-caption font-bold flex items-center justify-center flex-shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-1 truncate text-caption ${hasUnread ? "font-medium text-text-primary" : "text-text-tertiary"}`}
                  >
                    {isOutbound && <CheckCheck size={11} className="mr-1 inline align-[-2px] text-success" />}
                    {preview}
                  </p>
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
