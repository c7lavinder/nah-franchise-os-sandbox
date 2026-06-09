"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";

interface ReplyInputProps {
  contactId: string | null;
  toNumber?: string;
  fromNumbers: string[];
  defaultFromNumber?: string;
  disabled?: boolean;
  disabledReason?: string;
  onSent: () => void;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return value;
}

export default function ReplyInput({
  contactId,
  toNumber,
  fromNumbers,
  defaultFromNumber,
  disabled = false,
  disabledReason,
  onSent,
}: ReplyInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedFromNumbers = useMemo(() => Array.from(new Set(fromNumbers.filter(Boolean))), [fromNumbers]);
  const [fromNumber, setFromNumber] = useState(defaultFromNumber ?? normalizedFromNumbers[0] ?? "");

  useEffect(() => {
    setFromNumber(defaultFromNumber ?? normalizedFromNumbers[0] ?? "");
  }, [defaultFromNumber, normalizedFromNumbers]);

  async function handleSend() {
    if (sending || disabled || !message.trim() || !fromNumber) return;

    setSending(true);
    setError(null);

    try {
      const res = await apiFetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "SMS",
          contactId,
          toNumber,
          fromNumber,
          message: message.trim(),
          confirmed: true,
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
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="text-caption font-medium text-text-secondary" htmlFor="reply-from-number">
          From
        </label>
        <select
          id="reply-from-number"
          value={fromNumber}
          onChange={(e) => setFromNumber(e.target.value)}
          disabled={sending || normalizedFromNumbers.length === 0}
          className="rounded-md border border-border-default bg-white px-2 py-1 text-caption text-text-primary focus:border-nah-orange focus:outline-none disabled:opacity-50"
        >
          {normalizedFromNumbers.map((number) => (
            <option key={number} value={number}>
              {formatPhone(number)}
            </option>
          ))}
        </select>
        {toNumber && <span className="text-caption text-text-tertiary">to {formatPhone(toNumber)}</span>}
      </div>

      {(error || (disabled && disabledReason) || normalizedFromNumbers.length === 0) && (
        <p className="text-caption text-danger mb-2">
          {error ?? (normalizedFromNumbers.length === 0 ? "No sending phone numbers are configured." : disabledReason)}
        </p>
      )}

      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none resize-none"
          rows={1}
          disabled={sending || disabled || normalizedFromNumbers.length === 0}
        />
        <button
          onClick={handleSend}
          disabled={sending || disabled || normalizedFromNumbers.length === 0 || !fromNumber || !message.trim()}
          className="btn-primary p-2.5 rounded-lg disabled:opacity-40 self-end"
          title="Send SMS"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
