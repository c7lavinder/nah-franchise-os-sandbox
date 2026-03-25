"use client";

import { Phone, PhoneIncoming, PhoneOutgoing, MapPin, Clock } from "lucide-react";

interface CallSummary {
  id: string;
  conversationId: string;
  messageId: string;
  contactId: string;
  contactName: string;
  phone: string | null;
  direction: "inbound" | "outbound";
  dateAdded: string;
  duration: string | null;
  type: string;
}

interface CallListProps {
  calls: CallSummary[];
  selectedId: string | null;
  onSelect: (call: CallSummary) => void;
}

function formatDate(dateAdded: string): string {
  const d = new Date(dateAdded);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CallList({ calls, selectedId, onSelect }: CallListProps) {
  if (calls.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Phone size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-body-sm text-text-tertiary">No calls yet</p>
          <p className="text-caption text-text-tertiary mt-1">Calls will appear here as they happen through GHL</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {calls.map((call) => {
        const isSelected = call.id === selectedId;

        return (
          <button
            key={call.id}
            onClick={() => onSelect(call)}
            className={`
              w-full text-left px-4 py-3 rounded-lg border transition-colors
              ${isSelected
                ? "border-nah-orange bg-nah-orange/5"
                : "border-border-default bg-bg-secondary hover:border-border-hover"
              }
            `}
          >
            <div className="flex items-center gap-3">
              {/* Direction icon */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                call.direction === "inbound" ? "bg-info/10" : "bg-success/10"
              }`}>
                {call.direction === "inbound"
                  ? <PhoneIncoming size={16} className="text-info" />
                  : <PhoneOutgoing size={16} className="text-success" />
                }
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-medium text-text-primary truncate">
                    {call.contactName}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                    call.direction === "inbound"
                      ? "bg-info/15 text-info"
                      : "bg-success/15 text-success"
                  }`}>
                    {call.direction === "inbound" ? "Inbound" : "Outbound"}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-caption text-text-tertiary">
                    <Clock size={10} />
                    {formatDate(call.dateAdded)}
                  </span>
                  {call.duration && (
                    <span className="text-caption text-text-tertiary">
                      {call.duration}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
