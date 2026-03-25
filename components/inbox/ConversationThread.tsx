"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GHLConversation, GHLMessage } from "@/types/ghl";
import ReplyInput from "./ReplyInput";

interface ConversationThreadProps {
  conversation: GHLConversation;
  onMessageSent: () => void;
}

/** Determine if a message is real communication (not system activity) */
function isRealMessage(msg: GHLMessage): boolean {
  const t = msg.type;
  if (typeof t === "number" && t > 10) return false; // System activity
  if (t === "SMS" || t === "Email" || t === 1 || t === 2 || t === 3 || t === 4) return true;
  return typeof t === "string";
}

function formatMessageTime(dateAdded: string): string {
  const d = new Date(dateAdded);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ConversationThread({ conversation, onMessageSent }: ConversationThreadProps) {
  const [messages, setMessages] = useState<GHLMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchMessages() {
      setLoading(true);
      try {
        const res = await fetch(`/api/inbox/${conversation.id}?limit=50`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages ?? []);
        }
      } catch {
        // Continue with empty
      } finally {
        setLoading(false);
      }
    }

    void fetchMessages();

    // Mark as read
    void fetch(`/api/inbox/${conversation.id}/read`, { method: "PUT" });
  }, [conversation.id]);

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const realMessages = messages.filter(isRealMessage);
  const contactName = conversation.contactName || conversation.fullName || "Unknown";

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="px-4 py-3 border-b border-border-default flex-shrink-0">
        <h3 className="text-body-sm font-semibold text-text-primary">{contactName}</h3>
        {conversation.phone && (
          <span className="text-caption text-text-tertiary">{conversation.phone}</span>
        )}
        {conversation.email && !conversation.phone && (
          <span className="text-caption text-text-tertiary">{conversation.email}</span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
          </div>
        )}

        {!loading && realMessages.length === 0 && (
          <p className="text-caption text-text-tertiary text-center py-8">
            No messages yet — send the first one below
          </p>
        )}

        {realMessages.map((msg) => {
          const isOutbound = msg.direction === "outbound";

          return (
            <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-lg ${
                isOutbound
                  ? "bg-nah-orange/10 border border-nah-orange/20"
                  : "bg-bg-tertiary border border-border-default"
              }`}>
                <p className="text-body-sm text-text-primary whitespace-pre-wrap break-words">
                  {msg.body}
                </p>
                <p className={`text-caption mt-1 ${isOutbound ? "text-nah-orange/60" : "text-text-tertiary"}`}>
                  {formatMessageTime(msg.dateAdded)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply input */}
      <ReplyInput
        contactId={conversation.contactId}
        onSent={() => {
          onMessageSent();
          // Refetch messages
          fetch(`/api/inbox/${conversation.id}?limit=50`)
            .then((r) => r.json())
            .then((d) => setMessages(d.messages ?? []))
            .catch(() => {});
        }}
      />
    </div>
  );
}
