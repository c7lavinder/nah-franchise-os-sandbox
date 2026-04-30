"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * ActionPanels — Call logging panel for contact page.
 * SMS, Email, and Schedule actions now use DraftedActionProvider hooks.
 */

import { useEffect, useState } from "react";
import { X, Loader2, Phone, ChevronDown, Check } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Shared overlay wrapper                                             */
/* ------------------------------------------------------------------ */

function PanelOverlay({
  title,
  icon: Icon,
  color,
  onClose,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-primary border border-border-default rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Header */}
        <div
          className={`flex items-center gap-2 px-5 py-3 border-b border-border-default bg-gradient-to-r ${color} rounded-t-xl`}
        >
          <Icon size={16} className="text-white" />
          <h3 className="text-body-sm font-semibold text-white flex-1">{title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dropdown helper                                                    */
/* ------------------------------------------------------------------ */

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary appearance-none pr-8 focus:outline-none focus:ring-1 focus:ring-nah-blue"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Call Panel                                                         */
/* ------------------------------------------------------------------ */

interface CallPanelProps {
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  onClose: () => void;
  onLogged?: () => void;
}

/**
 * Log a call to GHL.
 *
 * The user dials from their own phone, then comes back here to log what
 * happened. The log is written as a GHL note on the contact. An optional
 * follow-up task can be created in the same step.
 */
const CALL_OUTCOMES = [
  { value: "connected", label: "Connected — full conversation" },
  { value: "voicemail", label: "Voicemail left" },
  { value: "no_answer", label: "No answer" },
  { value: "busy", label: "Busy / call back" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "bad_number", label: "Bad / disconnected number" },
] as const;

type CallOutcome = (typeof CALL_OUTCOMES)[number]["value"];

const FOLLOWUP_DEFAULTS: Record<CallOutcome, { title: string; daysOut: number } | null> = {
  connected: null,
  voicemail: { title: "Follow up after voicemail", daysOut: 2 },
  no_answer: { title: "Retry call", daysOut: 1 },
  busy: { title: "Retry call", daysOut: 1 },
  wrong_number: null,
  bad_number: null,
};

export function CallPanel({ contactId, contactName, contactPhone, onClose, onLogged }: CallPanelProps) {
  const [outcome, setOutcome] = useState<CallOutcome>("connected");
  const [durationMin, setDurationMin] = useState("5");
  const [notes, setNotes] = useState("");
  const [createFollowup, setCreateFollowup] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset follow-up checkbox when outcome changes to one without a default task
  useEffect(() => {
    setCreateFollowup(FOLLOWUP_DEFAULTS[outcome] !== null);
  }, [outcome]);

  async function handleLog() {
    setError(null);
    setSubmitting(true);

    const outcomeLabel = CALL_OUTCOMES.find((o) => o.value === outcome)?.label ?? outcome;
    const lines = [`Outbound call — ${outcomeLabel}`, `Phone: ${contactPhone ?? "(none on file)"}`];
    if (outcome === "connected" && durationMin) {
      lines.push(`Duration: ~${durationMin} min`);
    }
    if (notes.trim()) {
      lines.push("", notes.trim());
    }
    const noteBody = lines.join("\n");

    try {
      // 1. Always log a note
      const noteRes = await apiFetch(`/api/contacts/${contactId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
      if (!noteRes.ok) {
        const data = await noteRes.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error ?? "Failed to log call");
      }

      // 2. Optionally create a follow-up task
      const followup = FOLLOWUP_DEFAULTS[outcome];
      if (createFollowup && followup) {
        const due = new Date(Date.now() + followup.daysOut * 24 * 60 * 60 * 1000).toISOString();
        await apiFetch(`/api/contacts/${contactId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: followup.title,
            dueDate: due,
            body: `Auto-created from call log (${outcomeLabel})`,
          }),
        });
      }

      setLogged(true);
      setTimeout(() => {
        onLogged?.();
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log call");
    } finally {
      setSubmitting(false);
    }
  }

  if (logged) {
    return (
      <PanelOverlay title="Call Logged" icon={Phone} color="from-success to-green-700" onClose={onClose}>
        <div className="flex flex-col items-center py-6 gap-2">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
            <Check size={20} className="text-success" />
          </div>
          <p className="text-body-sm font-medium text-text-primary">Call logged to {contactName}</p>
          <p className="text-caption text-text-tertiary">Saved as a note in GHL.</p>
        </div>
      </PanelOverlay>
    );
  }

  return (
    <PanelOverlay title="Log Call" icon={Phone} color="from-success to-green-700" onClose={onClose}>
      <div className="bg-bg-secondary border border-border-default rounded-lg p-3 text-center">
        <p className="text-caption text-text-secondary">
          {contactName}
          {contactPhone ? ` — ${contactPhone}` : ""}
        </p>
        <p className="text-[10px] text-text-tertiary mt-1">Dial from your phone, then come back to log the call.</p>
      </div>

      <FieldSelect
        label="OUTCOME"
        value={outcome}
        options={CALL_OUTCOMES.map((o) => ({ label: o.label, value: o.value }))}
        onChange={(v) => setOutcome(v as CallOutcome)}
      />

      {outcome === "connected" && (
        <div>
          <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">
            DURATION (MINUTES)
          </label>
          <input
            type="number"
            min="1"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-success"
          />
        </div>
      )}

      <div>
        <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">NOTES (OPTIONAL)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="What was discussed, next steps, key info captured..."
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-success resize-y"
        />
      </div>

      {FOLLOWUP_DEFAULTS[outcome] && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={createFollowup}
            onChange={(e) => setCreateFollowup(e.target.checked)}
            className="rounded border-border-default text-success focus:ring-success"
          />
          <span className="text-body-sm text-text-secondary">
            Create follow-up task: &quot;{FOLLOWUP_DEFAULTS[outcome]?.title}&quot;
            {" — due in "}
            {FOLLOWUP_DEFAULTS[outcome]?.daysOut}d
          </span>
        </label>
      )}

      {error && <p className="text-caption text-danger">{error}</p>}

      <button
        onClick={() => void handleLog()}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-success text-white font-medium text-body-sm hover:bg-green-700 transition-colors disabled:opacity-40"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
        {submitting ? "Logging..." : "Log Call"}
      </button>
    </PanelOverlay>
  );
}
