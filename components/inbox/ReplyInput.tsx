"use client";

import { useState } from "react";
import { Send, Loader2, MessageSquare, Mail } from "lucide-react";

interface ReplyInputProps {
  contactId: string;
  defaultChannel?: "SMS" | "Email";
  onSent: () => void;
}

export default function ReplyInput({ contactId, defaultChannel = "SMS", onSent }: ReplyInputProps) {
  const [channel, setChannel] = useState<"SMS" | "Email">(defaultChannel);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (sending) return;

    if (channel === "SMS" && !message.trim()) return;
    if (channel === "Email" && (!message.trim() || !subject.trim())) return;

    setSending(true);
    setError(null);

    try {
      const body = channel === "SMS"
        ? { type: "SMS", contactId, message: message.trim() }
        : { type: "Email", contactId, subject: subject.trim(), html: message.trim() };

      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send");
      }

      setMessage("");
      setSubject("");
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && channel === "SMS") {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="border-t border-border-default px-4 py-3 flex-shrink-0">
      {error && (
        <p className="text-caption text-danger mb-2">{error}</p>
      )}

      {/* Channel toggle */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setChannel("SMS")}
          className={`flex items-center gap-1 px-2 py-1 rounded text-caption font-medium transition-colors ${
            channel === "SMS"
              ? "bg-success/15 text-success"
              : "text-text-tertiary hover:text-text-primary"
          }`}
        >
          <MessageSquare size={12} /> SMS
        </button>
        <button
          onClick={() => setChannel("Email")}
          className={`flex items-center gap-1 px-2 py-1 rounded text-caption font-medium transition-colors ${
            channel === "Email"
              ? "bg-scout-purple/15 text-scout-purple"
              : "text-text-tertiary hover:text-text-primary"
          }`}
        >
          <Mail size={12} /> Email
        </button>
      </div>

      {/* Subject line (email only) */}
      {channel === "Email" && (
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject..."
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none mb-2"
          disabled={sending}
        />
      )}

      {/* Message body */}
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={channel === "SMS" ? "Type a message... (Enter to send)" : "Write your email..."}
          className="flex-1 bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none resize-none"
          rows={channel === "Email" ? 3 : 1}
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || (channel === "SMS" ? !message.trim() : !message.trim() || !subject.trim())}
          className="btn-primary p-2.5 rounded-lg disabled:opacity-40 self-end"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
