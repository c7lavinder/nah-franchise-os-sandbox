"use client";

import { MessageSquare, Mail, Phone } from "lucide-react";

interface Message {
  id: string;
  type: "SMS" | "Email" | number;
  direction: "inbound" | "outbound";
  body: string;
  subject?: string;
  dateAdded: string;
  messageType?: string;
}

interface ActivityTimelineProps {
  messages: Message[];
}

interface TimelineItem {
  id: string;
  type: "sms" | "email" | "call";
  direction: "inbound" | "outbound";
  content: string;
  timestamp: string;
}

/** Map GHL numeric message types to our categories */
function categorize(m: Message): "sms" | "email" | "call" | null {
  const t = m.type;
  const mt = m.messageType ?? "";

  // SMS
  if (t === "SMS" || t === 1) return "sms";
  // Email
  if (t === "Email" || t === 2) return "email";
  // Call (type 3 or 4 in GHL, or messageType contains "CALL")
  if (t === 3 || t === 4 || mt.toUpperCase().includes("CALL")) return "call";
  // GMB, FB, IG messages map to SMS-like
  if (t === 5 || t === 6 || t === 7 || t === 8) return "sms";

  // Skip system/activity messages (type 28 = opportunity created, etc.)
  if (typeof t === "number" && t > 10) return null;

  return null;
}

export default function ActivityTimeline({ messages }: ActivityTimelineProps) {
  // Filter to only calls, texts, and emails — no system activity or notes
  const items: TimelineItem[] = messages
    .map((m) => {
      const type = categorize(m);
      if (!type) return null;
      return {
        id: m.id,
        type,
        direction: m.direction,
        content: m.subject ? `${m.subject}: ${m.body}` : (m.body ?? ""),
        timestamp: m.dateAdded,
      };
    })
    .filter((item): item is TimelineItem => item !== null)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  function iconForType(type: string, direction: string) {
    switch (type) {
      case "sms": return <MessageSquare size={12} className={direction === "inbound" ? "text-info" : "text-success"} />;
      case "email": return <Mail size={12} className={direction === "inbound" ? "text-info" : "text-scout-purple"} />;
      case "call": return <Phone size={12} className={direction === "inbound" ? "text-warning" : "text-success"} />;
      default: return <MessageSquare size={12} className="text-text-tertiary" />;
    }
  }

  function labelForType(type: string, direction: string): string {
    if (type === "sms") return direction === "inbound" ? "Text received" : "Text sent";
    if (type === "email") return direction === "inbound" ? "Email received" : "Email sent";
    if (type === "call") return direction === "inbound" ? "Inbound call" : "Outbound call";
    return "Message";
  }

  return (
    <section>
      <h3 className="text-overline text-text-tertiary tracking-wider mb-3">
        COMMUNICATION ({items.length})
      </h3>

      {items.length === 0 && (
        <p className="text-caption text-text-tertiary py-2">
          No calls, texts, or emails yet — communication will appear here as messages are sent and received
        </p>
      )}

      <div className="space-y-0 max-h-[400px] overflow-y-auto">
        {items.map((item, i) => (
          <div key={item.id} className="flex gap-3 pb-3">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-bg-tertiary flex items-center justify-center">
                {iconForType(item.type, item.direction)}
              </div>
              {i < items.length - 1 && (
                <div className="w-px flex-1 bg-border-default mt-1" />
              )}
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-caption font-medium text-text-secondary">
                  {labelForType(item.type, item.direction)}
                </span>
                <span className="text-caption text-text-tertiary">
                  {new Date(item.timestamp).toLocaleDateString()}{" "}
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {item.content && (
                <p className="text-body-sm text-text-primary line-clamp-3 break-words">
                  {item.content}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
