"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

interface ReplyInputProps {
  contactId: string;
  disabled?: boolean;
  disabledReason?: string;
  onSent: () => void;
}

export default function ReplyInput({ contactId, disabled = false, disabledReason, onSent }: ReplyInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (sending || disabled || !message.trim()) return;

    setSending(true);
    setError(null);

    try {
      const res = await apiFetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "SMS", contactId, message: message.trim(), confirmed: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send");
      }

      setMessage("");
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="border-t border-border-default px-4 py-3 flex-shrink-0">
      {(error || (disabled && disabledReason)) && (
        <p className="text-caption text-danger mb-2">{error ?? disabledReason}</p>
      )}

      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none resize-none"
          rows={1}
          disabled={sending || disabled}
        />
        <button
          onClick={handleSend}
          disabled={sending || disabled || !message.trim()}
          className="btn-primary p-2.5 rounded-lg disabled:opacity-40 self-end"
          title="Send SMS"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
