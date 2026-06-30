"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GHLConversation, GHLMessage } from "@/types/ghl";
import ReplyInput from "./ReplyInput";
import { avatarColor, initials } from "./avatar";

interface ConversationThreadProps {
  conversation: GHLConversation;
  availableNumbers: string[];
  onMessageSent: () => void;
}

/** Determine if a message is real communication (not system activity) */
function isRealMessage(msg: GHLMessage): boolean {
  const t = msg.type;
  if (typeof t === "number" && t > 10) return false; // System activity
  if (t === "SMS" || t === "Email" || t === 1 || t === 2 || t === 3 || t === 4) return true;
  return typeof t === "string";
}

/** Centered day-separator label, e.g. "Today" / "Thursday 9:41 AM". */
function daySeparatorLabel(dateAdded: string): string {
  const d = new Date(dateAdded);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / (1000 * 60 * 60 * 24));
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  if (diffDays < 7) return `${d.toLocaleDateString([], { weekday: "long" })} ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function dayKey(dateAdded: string): string {
  const d = new Date(dateAdded);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function uniqueNumbers(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

export default function ConversationThread({ conversation, availableNumbers, onMessageSent }: ConversationThreadProps) {
  const [messages, setMessages] = useState<GHLMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchMessages() {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/inbox/${conversation.id}?limit=50`);
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
    void apiFetch(`/api/inbox/${conversation.id}/read`, { method: "PUT" });
  }, [conversation.id]);

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const realMessages = messages.filter(isRealMessage);
  const contactName = conversation.contactName || conversation.fullName || "Unknown";
  const assignedNumber = conversation.tags?.[0];
  const fromNumbers = uniqueNumbers([assignedNumber, ...availableNumbers]);
  const canReply = Boolean(conversation.phone);
  const localContactId = isUuid(conversation.contactId) ? conversation.contactId : null;
  const color = avatarColor(conversation.contactId || conversation.id);
  const lastOutboundId = [...realMessages].reverse().find((m) => m.direction === "outbound")?.id;

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-3 px-[18px] py-3.5 border-b border-[#eef1f5] flex-shrink-0">
        <span
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-semibold"
          style={{ backgroundColor: color }}
        >
          {initials(contactName)}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#1c2430] whitespace-nowrap truncate">{contactName}</h3>
          {(conversation.phone || conversation.email) && (
            <p className="text-xs text-[#8a94a3] mt-px truncate">{conversation.phone || conversation.email}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#9aa3b0] flex-shrink-0">
          <span className="w-[7px] h-[7px] rounded-full bg-[#1FB6A8]" />
          <span>SMS · {assignedNumber ? "Signal House" : "Signal House"}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-3.5 bg-white flex flex-col">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-[#9aa3b0]" />
          </div>
        )}

        {!loading && realMessages.length === 0 && (
          <p className="text-center text-[13px] text-[#9aa3b0] py-8">No messages yet — send the first one below</p>
        )}

        {realMessages.map((msg, idx) => {
          const isOutbound = msg.direction === "outbound";
          const prev = realMessages[idx - 1];
          const showSeparator = !prev || dayKey(prev.dateAdded) !== dayKey(msg.dateAdded);

          return (
            <div key={msg.id} className="flex flex-col">
              {showSeparator && (
                <div className="self-center text-[11px] font-semibold text-[#9aa3b0] mt-3.5 mb-2">
                  {daySeparatorLabel(msg.dateAdded)}
                </div>
              )}
              <div
                className={`max-w-[70%] px-3 py-[7px] text-[13px] leading-[1.4] my-0.5 rounded-[18px] whitespace-pre-wrap break-words ${
                  isOutbound
                    ? "self-end text-white rounded-br-[6px] bg-gradient-to-b from-[#1aa3e6] to-[#0E96D8]"
                    : "self-start text-[#1c1c1e] rounded-bl-[6px] bg-[#E9E9EB]"
                }`}
              >
                {msg.body}
              </div>
              {isOutbound && msg.id === lastOutboundId && (
                <span className="self-end text-[11px] text-[#9aa3b0] mt-[3px]">Delivered</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Reply input */}
      <ReplyInput
        contactId={localContactId}
        toNumber={conversation.phone}
        fromNumbers={fromNumbers}
        defaultFromNumber={assignedNumber}
        disabled={!canReply}
        disabledReason="This conversation does not have a phone number to reply to."
        onSent={() => {
          onMessageSent();
          // Refetch messages
          apiFetch(`/api/inbox/${conversation.id}?limit=50`)
            .then((r) => r.json())
            .then((d) => setMessages(d.messages ?? []))
            .catch(() => {});
        }}
      />
    </div>
  );
}
