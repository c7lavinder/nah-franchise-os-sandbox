"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";

interface ReplyInputProps {
  contactId: string;
  onSent: () => void;
}

export default function ReplyInput({ contactId, onSent }: ReplyInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim() || sending) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "SMS",
          contactId,
          message: message.trim(),
        }),
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
      {error && (
        <p className="text-caption text-danger mb-2">{error}</p>
      )}
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send)"
          className="flex-1 bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none resize-none"
          rows={1}
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          className="btn-primary p-2.5 rounded-lg disabled:opacity-40"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
