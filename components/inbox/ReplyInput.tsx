"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, ArrowUp } from "lucide-react";

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

  const sendDisabled = sending || disabled || normalizedFromNumbers.length === 0 || !fromNumber || !message.trim();

  return (
    <div className="px-4 py-3 border-t border-[#eef1f5] flex-shrink-0">
      {/* From-number picker (only when there's a choice to make) */}
      {normalizedFromNumbers.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-[#8a94a3]" htmlFor="reply-from-number">
            From
          </label>
          <select
            id="reply-from-number"
            value={fromNumber}
            onChange={(e) => setFromNumber(e.target.value)}
            disabled={sending}
            className="rounded-md border border-[#e2e7ee] bg-white px-2 py-1 text-xs text-[#1c2430] focus:border-[#0E96D8] focus:outline-none disabled:opacity-50"
          >
            {normalizedFromNumbers.map((number) => (
              <option key={number} value={number}>
                {formatPhone(number)}
              </option>
            ))}
          </select>
          {toNumber && <span className="text-xs text-[#9aa3b0]">to {formatPhone(toNumber)}</span>}
        </div>
      )}

      {(error || (disabled && disabledReason) || normalizedFromNumbers.length === 0) && (
        <p className="text-xs text-[#EB5757] mb-2">
          {error ?? (normalizedFromNumbers.length === 0 ? "No sending phone numbers are configured." : disabledReason)}
        </p>
      )}

      <div className="flex items-center gap-2.5">
        {/* Attach */}
        <button
          type="button"
          className="flex-shrink-0 w-[30px] h-[30px] rounded-full border-[1.5px] border-[#d5dbe3] flex items-center justify-center text-[#9aa3b0] disabled:opacity-40"
          disabled
          title="Attach (coming soon)"
        >
          <Plus size={16} strokeWidth={2} />
        </button>

        {/* Input */}
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Text Message"
          className="flex-1 border-[1.5px] border-[#e2e7ee] rounded-full px-[15px] py-[9px] text-[13.5px] text-[#1c2430] placeholder:text-[#9aa3b0] focus:border-[#0E96D8] focus:outline-none disabled:opacity-50"
          disabled={sending || disabled || normalizedFromNumbers.length === 0}
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={sendDisabled}
          className="flex-shrink-0 w-[34px] h-[34px] rounded-full bg-[#0E96D8] text-white flex items-center justify-center hover:bg-[#0a85cf] transition-colors disabled:opacity-40"
          title="Send SMS"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  );
}
